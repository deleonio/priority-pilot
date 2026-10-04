import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, handleWriteError, parseId } from '../http-error.js';
import { Op, Transaction, type WhereOptions } from 'sequelize';
import sequelize from '../../database.js';
import { Group, GroupMember, Pillar, ScoreEntry, Task, TaskPillar, User } from '../../models/index.js';
import { wouldCreateCycle } from '../../logics/cycle.js';
import { haversineKm } from '../../logics/geo.js';
import { selectSeriesRepresentatives } from '../../logics/series.js';
import { berechneScore } from '../../logics/score.js';
import {
	PillarContribution,
	validatePillars,
	arePillarsExistent,
	coversAllAccountPillars,
	getAccountPillarIds,
	buildHandoverRows,
	PILLAR_DISTRIBUTION_RULE,
} from '../../logics/pillarContributions.js';
import { isCategoryExistent, remapCategoryForRecipient, validateCategoryId } from '../../logics/categoryOwnership.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';
import { GEO_CONFIG_DEFAULTS, resolveGeoUser } from './geoConfig.js';
import { allowEmail } from '../../logics/allowedEmails.js';
import { claimAccessMailSlot, sendAccountAccessMail } from '../../logics/accessMail.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import { notifyTaskCreated } from '../../logics/taskCreatedNotification.js';
import { notifyTaskCompleted } from '../../logics/taskCompletedNotification.js';
import { notifyReachedMilestones } from '../../logics/milestoneNotification.js';
import { meilensteinStandVon } from '../../logics/milestones.js';
import type { PushSender } from '../../logics/push.js';
import type { ChecklistItem } from '../../models/task.js';
import { protokolliereCareReaktion } from '../../logics/careWirkung.js';
import { protokolliereErledigung } from '../../logics/kpiKennzahlen.js';
import type { components } from '../../api';

type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type TaskStatus = components['schemas']['TaskStatus'];
type NearbyTaskDto = components['schemas']['NearbyTask'];

const VALID_STATUSES: readonly TaskStatus[] = ['Open', 'In process', 'Done'];

/** Validierte Task-Attribute (Spalten), wie sie an das Sequelize-Modell übergeben werden. */
interface TaskAttributes {
	title?: string;
	status?: TaskStatus;
	priority?: number;
	estimatedEffort?: number;
	actualEffort?: number | null;
	description?: string | null;
	deadline?: Date | null;
	address?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	autoDeleteAfterDeadline?: boolean;
	checklist?: ChecklistItem[];
	categoryId?: number | null;
	pinned?: boolean;
	pinnedAt?: Date | null;
}

type ValidationResult =
	| { ok: true; attrs: TaskAttributes; pillars: PillarContribution[] | undefined; completedAt: Date | undefined }
	| { ok: false; message: string };

const isTaskStatus = (value: unknown): value is TaskStatus =>
	typeof value === 'string' && VALID_STATUSES.some((status) => status === value);

/** UUID-Format (beliebige Version) für die `id` eines Checklist-Eintrags (#531). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Maximalzahl an Checklist-Einträgen je Task (#531). */
const MAX_CHECKLIST_ITEMS = 20;

/**
 * Validiert die Checkliste eines Tasks (#531): Liste aus höchstens 20 Einträgen mit gültiger
 * UUID-`id`, nicht-leerem `title` (1–255 Zeichen nach Trim) und optionalem `completed`
 * (Default `false`). Liefert die normierten Einträge `{ id, title, completed }` oder eine
 * Fehlermeldung (string) — der Fehler wird vom Aufrufer zu HTTP 400 übersetzt.
 */
const validateChecklist = (value: unknown): ChecklistItem[] | string => {
	if (!Array.isArray(value)) {
		return 'checklist muss eine Liste sein.';
	}
	if (value.length > MAX_CHECKLIST_ITEMS) {
		return 'checklist darf höchstens 20 Einträge enthalten.';
	}
	const items: ChecklistItem[] = [];
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null) {
			return 'Jeder checklist-Eintrag muss ein Objekt sein.';
		}
		const item = entry as Record<string, unknown>;
		if (typeof item.id !== 'string' || !UUID_RE.test(item.id)) {
			return 'Jeder checklist-Eintrag benötigt eine gültige id (UUID).';
		}
		const title = typeof item.title === 'string' ? item.title.trim() : '';
		if (title === '' || title.length > 255) {
			return 'Jeder checklist-Eintrag benötigt einen nicht-leeren title (1–255 Zeichen).';
		}
		const completed = item.completed === undefined ? false : item.completed;
		if (typeof completed !== 'boolean') {
			return 'completed eines checklist-Eintrags muss ein Boolean sein.';
		}
		items.push({ id: item.id, title, completed });
	}
	return items;
};

/**
 * Kontext für die Ersteller-/Empfänger-Kennzeichen des Task-DTO (#1213): `requesterId` entscheidet,
 * ob `forUserId`/`forUserName` gesetzt werden (nur der Ersteller sieht das „Für:"-Kennzeichen),
 * `names` liefert Anzeigenamen (E-Mail-Fallback) der referenzierten Konten. Ohne Kontext (z. B.
 * Series-Instanzen, /next, /suggestions) bleiben alle vier Felder null — der DTO-Vertrag erlaubt das.
 */
export interface TaskSerializeContext {
	requesterId?: number | null;
	names?: Map<number, string>;
	/** Gruppennamen zu den referenzierten `groupId`s (#1521) — ein Sammel-Query statt je Task. */
	groupNames?: Map<number, string>;
}

/**
 * Lädt die Anzeigenamen (E-Mail-Fallback, Muster `displayNameOf` in routes/groups.ts) zu den
 * referenzierten Nutzer-IDs — ein Sammel-Query statt je Task.
 */
export const loadUserNames = async (ids: number[]): Promise<Map<number, string>> => {
	const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
	if (unique.length === 0) {
		return new Map();
	}
	const users = await User.findAll({ where: { id: unique } });
	return new Map(users.map((user) => [user.id, user.displayName ?? user.email]));
};

/**
 * Lädt die Namen der referenzierten Gruppen (#1521) — Sammel-Query, Muster `loadUserNames`.
 */
const loadGroupNames = async (ids: number[]): Promise<Map<number, string>> => {
	const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
	if (unique.length === 0) {
		return new Map();
	}
	const groups = await Group.findAll({ where: { id: unique } });
	return new Map(groups.map((group) => [group.id, group.name]));
};

/**
 * Wandelt eine Task-Instanz in die im API-Vertrag definierte Form um. Die Säulen-Beiträge stammen
 * aus der **eager-geladenen** Assoziation `task.Pillars` (`include: [Pillar]`); fehlt sie, gilt
 * „keine Säulen". Die Beiträge sind nach `pillarId` sortiert (deterministische Reihenfolge).
 */
export const serializeTask = (task: Task, context: TaskSerializeContext = {}): TaskDto => {
	// #1213: Ersteller-Kennzeichen. `forUserId`/`forUserName` nur aus Sicht des Erstellers — der
	// Empfänger bekommt kein „Für:"-Kennzeichen für die eigene Aufgabe (AK3), der Ersteller eines
	// Selbst-Empfängers ebenso wenig (userId == createdById).
	const createdBy = task.createdById ?? null;
	const handedOff =
		createdBy !== null &&
		context.requesterId != null &&
		context.requesterId === createdBy &&
		task.userId != null &&
		task.userId !== createdBy;
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		estimatedEffort: task.estimatedEffort,
		actualEffort: task.actualEffort ?? null,
		description: task.description ?? null,
		address: task.address ?? null,
		latitude: task.latitude ?? null,
		longitude: task.longitude ?? null,
		deadline: task.deadline ? task.deadline.toISOString() : null,
		autoDeleteAfterDeadline: task.autoDeleteAfterDeadline ?? false,
		// Verschiebe-Zähler + Archiv (#1964).
		postponeCount: task.postponeCount ?? 0,
		archivedAt: task.archivedAt ? task.archivedAt.toISOString() : null,
		checklist: task.checklist ?? [],
		categoryId: task.categoryId ?? null,
		seriesId: task.seriesId ?? null,
		isException: task.isException ?? false,
		pinned: task.pinned ?? false,
		pinnedAt: task.pinnedAt ? task.pinnedAt.toISOString() : null,
		// #1222: Eigentümer im DTO (Spiegel zu `Series.userId`) — generierte Instanzen einer
		// Empfänger-Serie tragen den Serien-Eigentümer (AK4).
		userId: task.userId ?? null,
		createdById: createdBy,
		createdByName: createdBy !== null ? (context.names?.get(createdBy) ?? null) : null,
		forUserId: handedOff ? task.userId : null,
		forUserName: handedOff ? (context.names?.get(task.userId as number) ?? null) : null,
		// #1521: Gruppen-Adressierung. `groupName` trägt das „Für:"-Kennzeichen der Aufgabenliste
		// (AK7) — anders als `forUserName` ohne Ersteller-Bedingung: die Gruppen-Aufgabe ist für
		// jedes Mitglied eine Gruppen-Aufgabe.
		groupId: task.groupId ?? null,
		groupName: task.groupId != null ? (context.groupNames?.get(task.groupId) ?? null) : null,
		pillars: (task.Pillars ?? [])
			.map((pillar) => ({
				pillarId: pillar.id,
				share: pillar.TaskPillar.share,
				confidence: pillar.TaskPillar.confidence,
			}))
			.sort((a, b) => a.pillarId - b.pillarId),
	};
};

/**
 * Nutzer-IDs, mit denen der Requester aktuell mindestens eine Gruppe teilt (#1250). Basis sind die
 * vorhandenen `group_members`-Zeilen: Austritt, Admin-Entfernung und Gruppenlöschung entfernen sie
 * physisch, die Sichtbarkeit folgt damit zur Abfragezeit der Mitgliedschaft (Wiedereintritt stellt
 * sie wieder her). Duplikate über mehrere gemeinsame Gruppen werden dedupliziert.
 */
export const loadSharedUserIds = async (requesterId: number): Promise<number[]> => {
	const own = await GroupMember.findAll({ where: { userId: requesterId }, attributes: ['groupId'] });
	if (own.length === 0) {
		return [];
	}
	const shared = await GroupMember.findAll({
		where: { groupId: own.map((membership) => membership.groupId) },
		attributes: ['userId'],
	});
	return [...new Set(shared.map((membership) => membership.userId))];
};

export type RecipientResolution =
	{ ok: true; recipientId: number | null } | { ok: false; status: 400 | 403; message: string };

/**
 * Validiert und löst den optionalen Empfänger (`userId` im Body) gegen die Gruppenmitgliedschaft auf
 * (#1213/#1222/#1252): Fehlt das Feld oder entspricht es dem Aufrufer, bleibt der Datensatz beim
 * Aufrufer (`recipientId: null`); sonst muss der Empfänger mindestens eine Gruppe mit dem Aufrufer
 * teilen (403), keine Ganzzahl scheitert mit 400.
 */
export const resolveRecipientId = async (
	requesterId: number | null,
	recipientInput: unknown,
): Promise<RecipientResolution> => {
	if (recipientInput === undefined) {
		return { ok: true, recipientId: null };
	}
	if (typeof recipientInput !== 'number' || !Number.isInteger(recipientInput)) {
		return { ok: false, status: 400, message: 'userId muss eine Ganzzahl sein.' };
	}
	if (recipientInput === requesterId) {
		return { ok: true, recipientId: null };
	}
	const sharedUserIds = await loadSharedUserIds(requesterId ?? -1);
	if (!sharedUserIds.includes(recipientInput)) {
		return { ok: false, status: 403, message: 'Der Empfänger teilt keine Gruppe mit dir.' };
	}
	return { ok: true, recipientId: recipientInput };
};

/**
 * #1983 (AK5): Empfänger per `recipientEmail` statt `userId`. Ein bekanntes Konto liefert dessen
 * userId (die Shared-Group-Prüfung von `resolveRecipientId` greift danach unverändert); eine
 * unbekannte Adresse wird als Konto angelegt, mit Herkunft `delegation` freigeschaltet und per
 * Zugangs-Mail benachrichtigt — das frische Konto teilt noch keine Gruppe mit dem Ersteller,
 * die Übergabe an die externe Adresse ist der Freischalt-Anlass, deshalb `directRecipientId`.
 */
type EmailRecipientResolution =
	{ ok: true; recipientInput: number; newRecipientEmail: string | null } | { ok: false; status: 400; message: string };

const resolveRecipientByEmail = async (input: unknown): Promise<EmailRecipientResolution> => {
	if (typeof input !== 'string' || input.trim() === '') {
		return { ok: false, status: 400, message: 'recipientEmail muss eine nicht-leere Zeichenkette sein.' };
	}
	const email = input.trim().toLowerCase();
	if (!email.includes('@') || email.length > 254) {
		return { ok: false, status: 400, message: 'Bitte gib eine gültige E-Mail-Adresse an.' };
	}
	const existing = await User.findOne({ where: { email } });
	if (existing) {
		return { ok: true, recipientInput: existing.id, newRecipientEmail: null };
	}
	const recipient = await upsertOAuthUser({ email });
	await allowEmail(email, 'delegation');
	return { ok: true, recipientInput: recipient.id, newRecipientEmail: email };
};

/**
 * Gruppen-IDs, in denen der Requester aktuell Mitglied ist (#1521). Basis wie `loadSharedUserIds`
 * die vorhandenen `group_members`-Zeilen — Austritt/Löschung entziehen die Sichtbarkeit sofort.
 */
const loadOwnGroupIds = async (requesterId: number): Promise<number[]> => {
	const memberships = await GroupMember.findAll({ where: { userId: requesterId }, attributes: ['groupId'] });
	return [...new Set(memberships.map((membership) => membership.groupId))];
};

/**
 * Lese-Scope der Task-Liste (#1213, AK3/AK5): eigene Aufgaben (`ownerScope`) OER Aufgaben, die der
 * Nutzer für ein anderes Gruppenmitglied angelegt hat (`createdById`). Der Schreib-Scope
 * (`findOwnTask`) bleibt ausschließlich `ownerScope` — der Ersteller einer fremden Aufgabe erhält
 * auf PATCH/DELETE 404. Ohne Session (Pass-Through) unverändert leer (alles sichtbar); Aufgaben
 * ohne `createdById` (NULL) sind über den `userId`-Zweig abgedeckt (AK6, NULL-sicher).
 *
 * #1250: Der `createdById`-Zweig ist an die AKTUELLE Gruppenmitgliedschaft gebunden — der Ersteller
 * sieht die Aufgabe nur, solange er mit dem Eigentümer mindestens eine Gruppe teilt (leere Liste →
 * `IN (NULL)` → nichts sichtbar). Der `userId`-Zweig bleibt davon unberührt.
 */
const taskReadScope = async (userId: number | undefined, requesterId: number | null): Promise<WhereOptions> => {
	if (userId === undefined) {
		return {};
	}
	if (requesterId === null) {
		return { userId };
	}
	const sharedUserIds = await loadSharedUserIds(requesterId);
	const ownGroupIds = await loadOwnGroupIds(requesterId);
	return {
		[Op.or]: [
			{ userId },
			{ createdById: requesterId, userId: { [Op.in]: sharedUserIds } },
			// #1521 (AK2/AK3): unclaimte Gruppen-Aufgaben der eigenen Gruppen. `userId: null` ist der
			// Unclaimed-Marker — sobald ein Mitglied die Aufgabe erledigt hat (Claim), greift für alle
			// anderen nur noch der `userId`-Zweig, die Aufgabe verschwindet also aus ihrer Liste.
			{ groupId: { [Op.in]: ownGroupIds }, userId: null },
		],
	};
};

/**
 * Serialisiert Tasks mit Ersteller-/Empfänger-Kennzeichen aus Sicht des Request-Nutzers (#1213).
 * Nutzer-Auflösung wie /geo-config: Session-Nutzer, sonst im Pass-Through-Modus der gemeinsame
 * Entwicklungs-Nutzer — nur so trägt das „Für:"-Kennzeichen auch im Dev/E2E-Betrieb.
 */
const serializeTasksFor = async (req: Request, tasks: Task[]): Promise<TaskDto[]> => {
	const requester = await resolveGeoUser(req);
	const names = await loadUserNames(tasks.flatMap((task) => [task.createdById ?? 0, task.userId ?? 0]));
	const groupNames = await loadGroupNames(tasks.map((task) => task.groupId ?? 0));
	return tasks.map((task) => serializeTask(task, { requesterId: requester?.id ?? null, names, groupNames }));
};

/**
 * Lädt einen Task nur, wenn er dem Nutzer gehört (bzw. im Pass-Through-Modus uneingeschränkt).
 * Ein fremder Task ist damit nicht auffindbar → die Route antwortet mit 404 (statt 403), was den
 * Vertrag „403 oder 404" erfüllt und zugleich keine Existenz fremder Tasks preisgibt.
 */
const findOwnTask = (id: number, userId: number | undefined): Promise<Task | null> =>
	Task.findOne({ where: { id, ...ownerScope(userId) } });

/**
 * Lädt eine noch unclaimte Gruppen-Aufgabe (#1521, AK3), sofern der Nutzer Mitglied der adressierten
 * Gruppe ist — der Schreib-Scope von `findOwnTask` greift dort nicht, weil die Aufgabe (noch) keinen
 * Eigentümer hat. Ohne Session (Pass-Through) bleibt `findOwnTask` zuständig (leerer Owner-Filter).
 */
const findClaimableGroupTask = async (id: number, userId: number | undefined): Promise<Task | null> => {
	if (userId === undefined) {
		return null;
	}
	const ownGroupIds = await loadOwnGroupIds(userId);
	if (ownGroupIds.length === 0) {
		return null;
	}
	return Task.findOne({ where: { id, userId: null, groupId: { [Op.in]: ownGroupIds } } });
};

/**
 * Validiert den Request-Body für Anlegen/Aktualisieren eines Tasks.
 * `requireTitle` erzwingt einen Titel (POST); bei PATCH sind alle Felder optional. `pillars` ist
 * `undefined`, wenn das Feld fehlt (PATCH lässt die Beiträge dann unverändert).
 */
const validateTaskFields = (body: unknown, requireTitle: boolean): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const input = body as Record<string, unknown>;
	const attrs: TaskAttributes = {};

	if (input.title !== undefined) {
		if (typeof input.title !== 'string' || input.title.trim() === '') {
			return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
		}
		attrs.title = input.title.trim();
	}
	if (requireTitle && attrs.title === undefined) {
		return { ok: false, message: 'title ist erforderlich.' };
	}

	if (input.status !== undefined) {
		if (!isTaskStatus(input.status)) {
			return { ok: false, message: 'status muss "Open", "In process" oder "Done" sein.' };
		}
		attrs.status = input.status;
	}

	if (input.priority !== undefined) {
		if (
			typeof input.priority !== 'number' ||
			!Number.isInteger(input.priority) ||
			input.priority < 1 ||
			input.priority > 5
		) {
			return { ok: false, message: 'priority muss eine Ganzzahl zwischen 1 und 5 sein.' };
		}
		attrs.priority = input.priority;
	}

	if (input.estimatedEffort !== undefined) {
		if (
			typeof input.estimatedEffort !== 'number' ||
			!Number.isFinite(input.estimatedEffort) ||
			input.estimatedEffort < 0.1 ||
			input.estimatedEffort > 1
		) {
			return { ok: false, message: 'estimatedEffort muss eine Zahl zwischen 0.1 und 1 sein.' };
		}
		attrs.estimatedEffort = input.estimatedEffort;
	}

	if (input.actualEffort !== undefined) {
		if (
			input.actualEffort !== null &&
			(typeof input.actualEffort !== 'number' || !Number.isFinite(input.actualEffort) || input.actualEffort < 0)
		) {
			return { ok: false, message: 'actualEffort muss eine endliche Zahl >= 0 oder null sein.' };
		}
		attrs.actualEffort = input.actualEffort;
	}

	if (input.description !== undefined) {
		if (input.description !== null && typeof input.description !== 'string') {
			return { ok: false, message: 'description muss ein String oder null sein.' };
		}
		attrs.description = input.description;
	}

	if (input.address !== undefined) {
		if (input.address !== null && (typeof input.address !== 'string' || input.address.length > 255)) {
			return { ok: false, message: 'address muss ein String (max. 255 Zeichen) oder null sein.' };
		}
		attrs.address = input.address === null ? null : input.address.trim() === '' ? null : input.address.trim();
	}

	// Standort-Koordinaten (#1066): nur bei Auswahl eines Adress-Vorschlags gesetzt (Coordinates-only);
	// Freitext ohne Koordinat bleibt speicherbar (AK10). `null` leert beide Werte.
	// Standort-Koordinaten (#1066): nur bei Auswahl eines Adress-Vorschlags gesetzt (Coordinates-only);
	// Freitext ohne Koordinat bleibt speicherbar (AK10). Lat/lon sind ein Paar: `null` auf einer
	// Seite leert BEIDE Werte — eine Einzel-Koordinate wird paarweise zu null normalisiert.
	if (input.latitude !== undefined || input.longitude !== undefined) {
		if (
			input.latitude !== null &&
			input.latitude !== undefined &&
			(typeof input.latitude !== 'number' ||
				!Number.isFinite(input.latitude) ||
				input.latitude < -90 ||
				input.latitude > 90)
		) {
			return { ok: false, message: 'latitude muss eine Zahl zwischen -90 und 90 oder null sein.' };
		}
		if (
			input.longitude !== null &&
			input.longitude !== undefined &&
			(typeof input.longitude !== 'number' ||
				!Number.isFinite(input.longitude) ||
				input.longitude < -180 ||
				input.longitude > 180)
		) {
			return { ok: false, message: 'longitude muss eine Zahl zwischen -180 und 180 oder null sein.' };
		}
		const lat = input.latitude ?? null;
		const lon = input.longitude ?? null;
		attrs.latitude = lat !== null && lon !== null ? lat : null;
		attrs.longitude = lat !== null && lon !== null ? lon : null;
	}

	if (input.deadline !== undefined) {
		if (input.deadline === null) {
			attrs.deadline = null;
		} else if (typeof input.deadline !== 'string' || Number.isNaN(Date.parse(input.deadline))) {
			return { ok: false, message: 'deadline muss ein gültiges ISO-Datum oder null sein.' };
		} else {
			attrs.deadline = new Date(input.deadline);
		}
	}

	if (input.autoDeleteAfterDeadline !== undefined) {
		if (typeof input.autoDeleteAfterDeadline !== 'boolean') {
			return { ok: false, message: 'autoDeleteAfterDeadline muss ein Boolean sein.' };
		}
		attrs.autoDeleteAfterDeadline = input.autoDeleteAfterDeadline;
	}

	if (input.checklist !== undefined) {
		const result = validateChecklist(input.checklist);
		if (typeof result === 'string') {
			return { ok: false, message: result };
		}
		attrs.checklist = result;
	}

	// Anpinnen (#1582): `pinned` ist der einzige vom Client steuerbare Wert — `pinnedAt` ist rein
	// serverseitig abgeleitet (nicht vom Client vorgebbar) und folgt hier direkt aus `pinned`.
	if (input.pinned !== undefined) {
		if (typeof input.pinned !== 'boolean') {
			return { ok: false, message: 'pinned muss ein Boolean sein.' };
		}
		attrs.pinned = input.pinned;
		attrs.pinnedAt = input.pinned ? new Date() : null;
	}

	// Thematische Kategorie (0..1). Die Zugehörigkeit zum Konto prüft die Route gegen die DB
	// (isCategoryExistent) — hier nur die Form.
	if (input.categoryId !== undefined) {
		const result = validateCategoryId(input.categoryId);
		if (!result.ok) {
			return { ok: false, message: 'categoryId muss eine Ganzzahl >= 1 oder null sein.' };
		}
		attrs.categoryId = result.categoryId;
	}

	// Erledigt-Zeitpunkt (nur beim Übergang auf „Done" wirksam, siehe `awardScoreOnDone`): „pünktlich"
	// nachtragen heißt, die Deadline als Zeitpunkt zu schicken. Keine Task-Spalte, daher nicht in `attrs`.
	let completedAt: Date | undefined;
	if (input.completedAt !== undefined) {
		if (typeof input.completedAt !== 'string' || Number.isNaN(Date.parse(input.completedAt))) {
			return { ok: false, message: 'completedAt muss ein gültiges ISO-Datum sein.' };
		}
		completedAt = new Date(input.completedAt);
		if (completedAt.getTime() > Date.now()) {
			return { ok: false, message: 'completedAt darf nicht in der Zukunft liegen.' };
		}
	}

	let pillars: PillarContribution[] | undefined;
	if (input.pillars !== undefined) {
		if (!Array.isArray(input.pillars)) {
			return { ok: false, message: 'pillars muss eine Liste sein.' };
		}
		const result = validatePillars(input.pillars);
		if (!result.ok) {
			return { ok: false, message: `Ungültige Säulen-Beiträge. ${PILLAR_DISTRIBUTION_RULE}` };
		}
		pillars = result.pillars;
	}

	return { ok: true, attrs, pillars, completedAt };
};

/** Schreibt die Säulen-Beiträge eines Tasks neu (ersetzt vorhandene) — innerhalb einer Transaktion. */
const replaceContributions = (
	taskId: number,
	pillars: PillarContribution[],
	transaction: Transaction,
): Promise<unknown> =>
	TaskPillar.bulkCreate(
		pillars.map((entry) => ({ taskId, pillarId: entry.pillarId, share: entry.share, confidence: entry.confidence })),
		{ transaction, validate: true },
	);

/** Lädt einen Task inkl. seiner Säulen-Beiträge (für die Serialisierung). */
const findTaskWithPillars = (id: number): Promise<Task | null> => Task.findByPk(id, { include: [Pillar] });

/**
 * Vergibt beim Statuswechsel auf `Done` einen Gamification-`ScoreEntry` (Konzept §4.4) — genau
 * **einmal** je Task (`taskId` unique + `findOrCreate` ⇒ idempotent, erneutes „Done" erzeugt keinen
 * zweiten Eintrag; `erledigtAm` ist „jetzt" oder der nachgetragene Zeitpunkt, #1964). Basis-Value = `estimatedEffort × priority` (Owner-Vorgabe), pünktlich/verspätet
 * gemäß Deadline (siehe `berechneScore`).
 */
const awardScoreOnDone = async (task: Task, transaction: Transaction, erledigtAm: Date = new Date()): Promise<void> => {
	const basisPunkte = task.estimatedEffort * task.priority;
	const { punkte, pünktlich } = berechneScore(task.deadline ?? null, erledigtAm, basisPunkte);
	await ScoreEntry.findOrCreate({
		where: { taskId: task.id },
		defaults: { taskId: task.id, punkte, pünktlich, zeitpunkt: erledigtAm },
		transaction,
	});
};

/**
 * Rechnet den `ScoreEntry` eines bereits erledigten Tasks nach einer Korrektur von Aufwand,
 * Priorität oder Deadline neu (#1821) — gleiche Formel wie `awardScoreOnDone`, aber mit dem
 * gespeicherten `zeitpunkt` als Erledigt-Datum, damit Streak, Verlauf und Fürsorge unverändert bleiben.
 */
const recalculateScoreOnDoneEdit = async (task: Task, transaction: Transaction): Promise<void> => {
	const entry = await ScoreEntry.findOne({ where: { taskId: task.id }, transaction });
	if (!entry) return;
	const { punkte, pünktlich } = berechneScore(
		task.deadline ?? null,
		entry.zeitpunkt,
		task.estimatedEffort * task.priority,
	);
	await entry.update({ punkte, pünktlich }, { transaction });
};

/**
 * Baut den Task-Router. `pushSender` ist injizierbar (Vorbild `createPushRouter`), damit der
 * Versand bei fremd angelegten Aufgaben (#1224) ohne echte VAPID-Konfiguration testbar ist.
 */
export interface TasksRouterDeps {
	/** Injizierbarer Web-Push-Versand (Default: web-push); Tests reichen einen Mock herein. */
	pushSender?: PushSender;
}

export const createTasksRouter = ({ pushSender }: TasksRouterDeps = {}): Router => {
	const tasksRouter = Router();

	// GET /tasks — alle Tasks (inkl. Säulen-Beiträge) auflisten
	tasksRouter.get('/tasks', async (req: Request, res: Response<TaskDto[] | ErrorDto>) => {
		// Verpasst-Auswahl (#1964, `?missed=1`): abgeleitete Ansicht, kein neuer Status — überfällige,
		// nicht erledigte Aufgaben ohne Auto-Lösch-Häkchen (die laufen weiter in den 3-Tage-Cron) und
		// ohne Archiv. Archivierte Aufgaben erscheinen auch in der Standardliste nie mehr — nur
		// `?archived=1` liefert sie (Archiv-Ansicht).
		const missedOnly = req.query.missed === '1';
		// Archiv-Ansicht (`?archived=1`): umgekehrter Filter — nur archivierte Aufgaben.
		const archivedOnly = req.query.archived === '1';
		try {
			// #1213: Lese-Scope um selbst angelegte Aufgaben für andere Gruppenmitglieder erweitert
			// (`createdById`); Schreibzugriffe bleiben an `ownerScope` gebunden (siehe findOwnTask).
			const requester = await resolveGeoUser(req);
			const tasks = await Task.findAll({
				where: {
					...(await taskReadScope(getUserId(req), requester?.id ?? null)),
					archivedAt: archivedOnly ? { [Op.not]: null } : { [Op.is]: null },
					...(missedOnly
						? {
								deadline: { [Op.lt]: new Date() },
								status: { [Op.ne]: 'Done' },
								autoDeleteAfterDeadline: false,
							}
						: {}),
				},
				include: [Pillar],
			});
			res.json(await serializeTasksFor(req, tasks));
		} catch (error) {
			handleWriteError(res, error);
		}
	});

	// GET /tasks/nearby — offene Tasks mit Koordinaten, aufsteigend nach Distanz zur Position (#1066).
	// Muss VOR `/tasks/:id` registriert sein, damit der Pfad nicht als id gefangen wird.

	tasksRouter.get(
		'/tasks/nearby',
		requirePlanFeature('location_reminders'),
		async (req: Request, res: Response<NearbyTaskDto[] | ErrorDto>) => {
			// `Number('')` wäre 0 und damit fälschlich gültig — leere/fehlende/Array-Parameter ablehnen.
			const parseCoord = (value: unknown): number =>
				typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
			const lat = parseCoord(req.query.lat);
			const lon = parseCoord(req.query.lon);
			if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
				sendError(res, 400, 'lat und lon müssen Zahlen in gültigem Bereich sein.');
				return;
			}
			try {
				// #1098 AK6: nur Tasks innerhalb der gespeicherten Anzeige-Entfernung des Users (Default 5 km).
				// Dieselbe User-Auflösung und derselbe Default wie /geo-config (#1103 F5) — inkl.
				// Dev-Pass-Through-Nutzer, damit Dev/E2E die gespeicherte Config nicht still ignorieren.
				const geoUser = await resolveGeoUser(req);
				const maxDisplayKm = geoUser?.displayDistanceKm ?? GEO_CONFIG_DEFAULTS.displayDistanceKm;
				// AK2: nur offene Tasks MIT Koordinaten, owner-scoped (AK7), max. 10, nach Distanz aufsteigend.
				// #1518 AK5: je Serie nur die aktuelle Instanz.
				const tasks = selectSeriesRepresentatives(
					await Task.findAll({
						where: {
							status: { [Op.ne]: 'Done' },
							latitude: { [Op.ne]: null },
							longitude: { [Op.ne]: null },
							...ownerScope(getUserId(req)),
						},
					}),
				);
				const items = tasks
					.map((task) => ({
						id: task.id,
						title: task.title,
						distanceKm: Math.round(haversineKm(lat, lon, task.latitude as number, task.longitude as number) * 10) / 10,
					}))
					.sort((a, b) => a.distanceKm - b.distanceKm)
					.filter((item) => item.distanceKm <= maxDisplayKm)
					.slice(0, 10);
				res.json(items);
			} catch (error) {
				handleWriteError(res, error);
			}
		},
	);

	// POST /tasks — neuen Task anlegen
	tasksRouter.post('/tasks', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
		const validation = validateTaskFields(req.body, true);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}
		const userId = getUserId(req);
		try {
			// #1213: Ersteller auflösen (Session-Nutzer, sonst Dev-Pass-Through) und optionalen Empfänger
			// prüfen: `userId` im Body bezeichnet das Konto, dem die Aufgabe gehören soll. Ohne das Feld
			// (oder mit der eigenen ID) ändert sich am bisherigen Ablauf nichts (AK1); ein Empfänger, mit dem
			// der Aufrufer keine Gruppe teilt, wird mit 403 abgelehnt, ohne einen Datensatz anzulegen (AK2).
			const requester = await resolveGeoUser(req);
			const requesterId = requester?.id ?? null;
			// #1983 (AK5): `recipientEmail` benennt den Empfänger alternativ zur userId — eine
			// unbekannte Adresse wird zum Konto + DB-Zulassung (`delegation`) aufgelöst.
			let recipientInput: unknown = (req.body as { userId?: unknown }).userId;
			let newRecipientEmail: string | null = null;
			if ((req.body as { recipientEmail?: unknown }).recipientEmail !== undefined) {
				const emailResolution = await resolveRecipientByEmail(
					(req.body as { recipientEmail?: unknown }).recipientEmail,
				);
				if (!emailResolution.ok) {
					sendError(res, emailResolution.status, emailResolution.message);
					return;
				}
				recipientInput = emailResolution.recipientInput;
				newRecipientEmail = emailResolution.newRecipientEmail;
			}
			let recipientResolution: RecipientResolution;
			if (newRecipientEmail !== null) {
				// Frisch angelegtes Konto teilt keine Gruppe mit dem Ersteller — der Shared-Group-Check
				// entfällt für die externe Übergabe (AK5), `resolveRecipientId` liefe sonst ins 403.
				recipientResolution = { ok: true, recipientId: recipientInput as number };
			} else {
				recipientResolution = await resolveRecipientId(requesterId, recipientInput);
			}
			if (!recipientResolution.ok) {
				sendError(res, recipientResolution.status, recipientResolution.message);
				return;
			}
			const recipientId = recipientResolution.recipientId;
			// #1521 (AK1): Alternativ zur Person kann eine Gruppe Empfänger sein. Die Aufgabe entsteht
			// dann ohne Eigentümer (`userId = null`) und gehört der Gruppe, bis ein Mitglied sie erledigt.
			// Nur eigene Gruppen sind adressierbar; Person UND Gruppe zugleich ist kein gültiger Vertrag.
			let groupTargetId: number | null = null;
			const groupInput = (req.body as { groupId?: unknown }).groupId;
			if (groupInput !== undefined && groupInput !== null) {
				if (typeof groupInput !== 'number' || !Number.isInteger(groupInput)) {
					sendError(res, 400, 'groupId muss eine Ganzzahl sein.');
					return;
				}
				if (recipientId !== null) {
					sendError(res, 400, 'Eine Aufgabe kann entweder an eine Person oder an eine Gruppe gerichtet sein.');
					return;
				}
				const membership = await GroupMember.findOne({ where: { groupId: groupInput, userId: requesterId ?? -1 } });
				if (membership === null) {
					sendError(res, 403, 'Du bist kein Mitglied dieser Gruppe.');
					return;
				}
				groupTargetId = groupInput;
			}
			// #1249: Säulen gegen das Konto prüfen, dem die Aufgabe gehören wird — bei einem Empfänger
			// gegen dessen Konto statt gegen den Ersteller (Empfänger-Auflösung inkl. 403 bleibt davor).
			if (
				validation.pillars !== undefined &&
				!(await arePillarsExistent(
					validation.pillars.map((p) => p.pillarId),
					recipientId ?? userId ?? null,
				))
			) {
				sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
				return;
			}
			// #2077 (AK1): Vollverteilungs-Pflicht — eine nicht-leere Verteilung muss ALLE Säulen des
			// Kontos abdecken (Bounds/Summe prüft validateTaskFields); Teilmengen werden abgelehnt.
			if (validation.pillars !== undefined && validation.pillars.length > 0) {
				const accountPillarIds = await getAccountPillarIds(recipientId ?? userId ?? null);
				if (!coversAllAccountPillars(validation.pillars, accountPillarIds)) {
					sendError(res, 400, PILLAR_DISTRIBUTION_RULE);
					return;
				}
			}
			// Kategorie gegen dasselbe Konto prüfen wie die Säulen: Bei einer Aufgabe für ein anderes
			// Gruppenmitglied gehört sie dem Empfänger, dessen Kategorien gelten also.
			if (
				validation.attrs.categoryId !== undefined &&
				!(await isCategoryExistent(validation.attrs.categoryId, recipientId ?? userId ?? null))
			) {
				sendError(res, 400, 'categoryId verweist auf eine nicht existierende Kategorie.');
				return;
			}
			const created = await sequelize.transaction(async (transaction) => {
				// Neuen Task an den Eigentümer binden (Datenisolation, #207; Empfänger #1213, sonst der
				// eingeloggte Nutzer; `null` im Pass-Through) und den Ersteller festhalten (AK3).
				const task = await Task.create(
					{
						...validation.attrs,
						// #1521: Gruppen-Aufgabe startet ohne Eigentümer — der Claim beim Erledigen trägt ihn nach.
						userId: groupTargetId !== null ? null : (recipientId ?? userId ?? null),
						groupId: groupTargetId,
						createdById: requesterId,
					},
					{ transaction },
				);
				if (validation.pillars !== undefined && validation.pillars.length > 0) {
					await replaceContributions(task.id, validation.pillars, transaction);
				}
				return task;
			});
			// #1224: Empfänger über die fremd angelegte Aufgabe informieren — erst nach dem Commit, und
			// nur bei echter Fremd-Anlage (AK2: Selbst-Anlage bleibt ohne Nachricht). Restfehler werden
			// gefangen und nur protokolliert, damit das Anlegen unberührt bleibt (AK4).
			if (recipientId !== null) {
				try {
					await notifyTaskCreated(
						{ id: created.id, title: created.title, userId: recipientId },
						requester ? { displayName: requester.displayName } : null,
						pushSender,
					);
				} catch (error) {
					console.warn('Benachrichtigung zur neu angelegten Aufgabe fehlgeschlagen:', error);
				}
			}
			// #1983 (AK5): Benachrichtigung an die externe Adresse — E-Mail mit direktem Zugang,
			// nach dem Commit und vor der Antwort abgewartet (Nebenwirkung beobachtbar).
			const accessMailThrottled = newRecipientEmail !== null && !claimAccessMailSlot(userId ?? 0);
			if (newRecipientEmail !== null && !accessMailThrottled) {
				try {
					await sendAccountAccessMail(newRecipientEmail, {
						subject: `Aufgabe „${created.title}" bei Balamentum`,
						lines: [
							`${requester?.displayName ?? 'Jemand'} hat dir die Aufgabe „${created.title}" übergeben.`,
							'Sieh sie dir in Ruhe an — du entscheidest, was daraus wird.',
						],
					});
				} catch (error) {
					console.warn('Zugangs-Mail zur delegierten Aufgabe fehlgeschlagen:', error);
				}
			}
			// #1798 AK2: Aufgabe aus einer Fürsorge-Vorlage → anonymes Übernahme-Ereignis.
			const careTemplateKey = (req.body as { careTemplateKey?: unknown }).careTemplateKey;
			if (typeof careTemplateKey === 'string' && careTemplateKey.trim()) {
				await protokolliereCareReaktion(userId, 'uebernommen', [careTemplateKey.trim()]);
			}
			const withPillars = await findTaskWithPillars(created.id);
			if (!withPillars) {
				sendError(res, 500, 'Interner Serverfehler.');
				return;
			}
			const dto = (await serializeTasksFor(req, [withPillars]))[0];
			res.status(201).json(accessMailThrottled ? { ...dto, accessMailThrottled } : dto);
		} catch (error) {
			handleWriteError(res, error);
		}
	});

	// GET /tasks/:id — einen Task abrufen
	tasksRouter.get('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
		const id = parseId(req.params.id);
		const userId = getUserId(req);
		// Nur eigene Tasks sind auffindbar (Datenisolation, #207) — fremde → 404.
		const task = id === null ? null : await Task.findOne({ where: { id, ...ownerScope(userId) }, include: [Pillar] });
		if (!task) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		res.json((await serializeTasksFor(req, [task]))[0]);
	});

	// PATCH /tasks/:id — einen Task teilweise aktualisieren
	tasksRouter.patch('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
		const id = parseId(req.params.id);
		// Fremde Tasks sind nicht auffindbar → 404 (Datenisolation, #207, AK5). #1521: zusätzlich sind
		// unclaimte Gruppen-Aufgaben der eigenen Gruppen schreibbar — jedes Mitglied darf sie erledigen.
		const task =
			id === null
				? null
				: ((await findOwnTask(id, getUserId(req))) ?? (await findClaimableGroupTask(id, getUserId(req))));
		if (!task) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		const validation = validateTaskFields(req.body, false);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}
		const userId = getUserId(req);
		// #1252: optionaler Empfänger — Übergabe der Aufgabe an ein Gruppenmitglied. Muster
		// `POST /tasks` (#1213): ohne das Feld (oder mit der eigenen ID) ändert sich am bisherigen
		// PATCH-Ablauf nichts (AK1); ein Empfänger ohne gemeinsame Gruppe wird mit 403 abgelehnt,
		// ohne dass Feldänderungen aus demselben Request durchkommen (AK2).
		const requester = await resolveGeoUser(req);
		const requesterId = requester?.id ?? null;
		// #1983 (AK5): `recipientEmail` wie bei POST /tasks — unbekannte Adresse wird zum Konto +
		// DB-Zulassung (`delegation`) aufgelöst; bekanntes Konto läuft durch resolveRecipientId.
		let patchRecipientInput: unknown = (req.body as { userId?: unknown }).userId;
		let patchNewRecipientEmail: string | null = null;
		if ((req.body as { recipientEmail?: unknown }).recipientEmail !== undefined) {
			const emailResolution = await resolveRecipientByEmail((req.body as { recipientEmail?: unknown }).recipientEmail);
			if (!emailResolution.ok) {
				sendError(res, emailResolution.status, emailResolution.message);
				return;
			}
			patchRecipientInput = emailResolution.recipientInput;
			patchNewRecipientEmail = emailResolution.newRecipientEmail;
		}
		let recipientResolution: RecipientResolution;
		if (patchNewRecipientEmail !== null) {
			recipientResolution = { ok: true, recipientId: patchRecipientInput as number };
		} else {
			recipientResolution = await resolveRecipientId(requesterId, patchRecipientInput);
		}
		if (!recipientResolution.ok) {
			sendError(res, recipientResolution.status, recipientResolution.message);
			return;
		}
		const recipientId = recipientResolution.recipientId;
		// #1521 (AK3–AK5): Erledigt ein Mitglied eine unclaimte Gruppen-Aufgabe, übernimmt es sie mit
		// demselben Request („Claim") — `awardScoreOnDone` hängt den ScoreEntry über `taskId` an den
		// Task, dessen `userId` nach dem Commit der Erlediger ist, damit landet die Gutschrift bei ihm.
		const claimUserId =
			task.groupId != null && task.userId == null && recipientId === null && validation.attrs.status === 'Done'
				? (userId ?? null)
				: null;
		// Konto, auf das Säulen/Kategorie umgehängt werden: bei einer Übergabe der Empfänger (#1252),
		// beim Gruppen-Claim der Erlediger (#1521) — sonst keines.
		const remapTargetId = recipientId ?? claimUserId;
		// #1249/#1252: Säulen gegen das Konto prüfen, dem die Aufgabe nach diesem Request gehört —
		// bei einer Übergabe gegen das Empfänger-Konto statt gegen den Aufrufer.
		if (
			validation.pillars !== undefined &&
			!(await arePillarsExistent(
				validation.pillars.map((p) => p.pillarId),
				recipientId ?? userId ?? null,
			))
		) {
			sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
			return;
		}
		// #2077 (AK1): Vollverteilungs-Pflicht — siehe POST /tasks.
		if (validation.pillars !== undefined && validation.pillars.length > 0) {
			const accountPillarIds = await getAccountPillarIds(recipientId ?? userId ?? null);
			if (!coversAllAccountPillars(validation.pillars, accountPillarIds)) {
				sendError(res, 400, PILLAR_DISTRIBUTION_RULE);
				return;
			}
		}
		// Kategorie gegen dasselbe Konto prüfen wie die Säulen (bei Übergabe das Empfänger-Konto).
		if (
			validation.attrs.categoryId !== undefined &&
			!(await isCategoryExistent(validation.attrs.categoryId, recipientId ?? userId ?? null))
		) {
			sendError(res, 400, 'categoryId verweist auf eine nicht existierende Kategorie.');
			return;
		}
		// #1252 (AK7): Hängt die Aufgabe in irgendeine Richtung an Aufgaben, die der Empfänger nicht
		// sieht (weder Eigentümer noch Ersteller mit aktueller Gruppenmitgliedschaft — Spiegel des
		// Lese-Scopes `taskReadScope`), lehnt der Server die Übergabe VOR der Transaktion ab: keine
		// halb übergebene Aufgabe, Feldänderungen aus demselben Request werden mit zurückgewiesen.
		if (recipientId !== null) {
			const neighbors = [...(await task.getDependencies()), ...(await task.getDependents())];
			if (neighbors.length > 0) {
				const sharedByRecipient = new Set(await loadSharedUserIds(recipientId));
				const visibleToRecipient = (other: Task): boolean =>
					other.userId === recipientId ||
					(other.createdById === recipientId && sharedByRecipient.has(other.userId ?? -1));
				if (neighbors.some((other) => !visibleToRecipient(other))) {
					sendError(
						res,
						409,
						'Die Aufgabe hängt an Aufgaben, die der Empfänger nicht sehen kann. Abhängigkeiten entfernen oder den Empfänger wechseln.',
					);
					return;
				}
			}
		}
		// Unteraufgaben-Done-Guard (#246, AK5; Kanten-Richtung korrigiert in #336): Ein Task darf nur auf
		// „Done" wechseln, wenn keine seiner direkten Unteraufgaben offen ist. Eine Unteraufgabe wird über
		// den realen „Unteraufgabe anlegen"-Flow (`TaskForm.tsx`) als **Vorgänger** der Eltern-Aufgabe
		// angelegt (`POST /tasks/{parentId}/dependencies` mit `dependingTaskId = childId`) → die direkten
		// Unteraufgaben stehen in `parent.getDependencies()`, nicht in `getDependents()`. Zuvor prüfte der
		// Guard die entgegengesetzte Richtung und griff für real angelegte Unteraufgaben daher nie.
		if (validation.attrs.status === 'Done') {
			const subtasks = await task.getDependencies();
			const hasOpenSubtask = subtasks.some((sub) => sub.status !== 'Done');
			if (hasOpenSubtask) {
				sendError(
					res,
					409,
					'Der Task kann nicht auf „Erledigt" gesetzt werden, solange noch offene Unteraufgaben existieren.',
				);
				return;
			}
		}
		try {
			// Status vor dem Update festhalten, um den echten Übergang nach „Done" zu erkennen.
			const warVorherDone = task.status === 'Done';
			// AK2 (#120): Eine individuelle Änderung an einer generierten Serien-Instanz markiert sie als
			// Ausnahme — der Generator lässt `isException`-Instanzen unangetastet und das Template bleibt
			// unberührt. Bei gewöhnlichen Tasks (kein `seriesId`) bleibt das Feld unverändert.
			// #1252 (AK5): Eine Übergabe schreibt NUR die Eigentumsfelder — `userId` = Empfänger und
			// `createdById` = übergebender Eigentümer (AK4), alle anderen Attribute bleiben unberührt.
			// Kategorie bei einer Übergabe umhängen (Regel wie bei den Säulen, #1252 AK6): Die bisherige
			// Kategorie gehört dem alten Eigentümer. Der Empfänger übernimmt sie, wenn er eine gleichen
			// Namens hat, sonst verliert die Aufgabe die Zuordnung — nie zeigt sie auf fremde Stammdaten.
			const handoverCategoryId =
				remapTargetId !== null && validation.attrs.categoryId === undefined && task.categoryId != null
					? await remapCategoryForRecipient(task.categoryId, remapTargetId)
					: undefined;
			// Verschiebe-Zähler (#1964, AK3): nur ein PATCH, der die Deadline auf einen streng späteren
			// Zeitpunkt setzt, zählt als Verschiebung — gleichbleibende/frühere Deadlines und Patches
			// ohne `deadline` nicht (PO-Entscheidung Q3: jede Verschiebung nach hinten zählt, auch an
			// Serien-Instanzen — der Zähler liegt als Spalte am Task).
			const verschobDeadline = validation.attrs.deadline;
			const istVerschoben =
				verschobDeadline instanceof Date &&
				task.deadline != null &&
				verschobDeadline.getTime() > new Date(task.deadline).getTime();
			const attrs = {
				...validation.attrs,
				...(istVerschoben ? { postponeCount: task.postponeCount + 1 } : {}),
				...(task.seriesId != null ? { isException: true } : {}),
				...(recipientId !== null ? { userId: recipientId, createdById: requesterId } : {}),
				// #1521: Claim — der Erlediger wird Eigentümer, `createdById` bleibt beim Anleger.
				...(claimUserId !== null ? { userId: claimUserId } : {}),
				...(handoverCategoryId !== undefined ? { categoryId: handoverCategoryId } : {}),
			};
			// #1363: Meilenstein-Stand des Eigentümers vor dem Statuswechsel-Commit festhalten — nur bei
			// echtem Übergang auf „Done" (gleiche Bedingung wie `awardScoreOnDone` unten), sonst unnötige
			// Abfrage bei jedem PATCH. Bei einer gleichzeitigen Übergabe (#1252, `recipientId !== null`)
			// entfällt der Check bewusst: `awardScoreOnDone` hängt den `ScoreEntry` per `taskId` an den
			// Task, dessen `userId` nach dem Commit bereits der Empfänger ist — `meilensteinStandVon`
			// filtert aber live über `Task.userId` und würde den alten Eigentümer nie treffen (Review
			// #1389, Finding #1). Der Empfänger selbst wird ebenfalls nicht geprüft, da die Übergabe kein
			// eigener „Done"-Verdienst des Empfängers ist.
			// #1521 (Review-Finding 1): Bei einem Gruppen-Claim ist `task.userId` vor dem Commit noch
			// `null` — der Erlediger steht nur in `claimUserId`. Ohne die Auflösung hier bliebe
			// `meilensteinUserId` null und der Meilenstein-Push zur erledigten Gruppen-Aufgabe entfiele.
			const meilensteinUserId = claimUserId ?? task.userId;
			const istDoneUebergang = recipientId === null && !warVorherDone && attrs.status === 'Done';
			const meilensteineVorher =
				istDoneUebergang && meilensteinUserId != null ? await meilensteinStandVon(meilensteinUserId) : null;
			await sequelize.transaction(async (transaction) => {
				await task.update(attrs, { transaction });
				// #1252 (AK6): Bei einer Übergabe (ohne gleichzeitig gesendete `pillars` — die wären
				// bereits gegen das Empfänger-Konto validiert und ersetzen unten komplett) dürfen Beiträge
				// nicht auf Säulen des bisherigen Eigentümers zeigen: Übernahme per gleichem Säulen-Namen
				// des Empfängers (#1249-Regel), sonst verwerfen. Nur die Eigentumsfelder ändern sich.
				if (remapTargetId !== null && validation.pillars === undefined) {
					const contributions = await TaskPillar.findAll({ where: { taskId: task.id }, transaction });
					if (contributions.length > 0) {
						const oldPillars = await Pillar.findAll({
							where: { id: contributions.map((entry) => entry.pillarId) },
						});
						const names = oldPillars.map((pillar) => pillar.name);
						const replacements =
							names.length > 0 ? await Pillar.findAll({ where: { userId: remapTargetId, name: names } }) : [];
						const byName = new Map(replacements.map((pillar) => [pillar.name, pillar]));
						// #2077 (AK4): Die remappten Anteile sind die Vorgabe — aufgefüllt wird zu einer
						// gültigen Vollverteilung über ALLE Säulen des Empfängers (jeder Anteil 5–80,
						// Summe 100). Säulen ohne Gegenstück werden nicht mehr verworfen, sondern
						// auf Mindestanteil gesetzt; ein Empfänger ohne Säulen bekommt keine Beiträge.
						const remapped = new Map(
							contributions.flatMap((entry) => {
								const source = oldPillars.find((pillar) => pillar.id === entry.pillarId);
								const target = source ? byName.get(source.name) : undefined;
								return target ? [[target.id, entry] as const] : [];
							}),
						);
						const recipientPillars = await Pillar.findAll({
							where: { userId: remapTargetId },
							order: [['id', 'ASC']],
							transaction,
						});
						const mapped = buildHandoverRows(recipientPillars, remapped, (pillarId, share, confidence) => ({
							taskId: task.id,
							pillarId,
							share,
							confidence,
						}));
						await TaskPillar.destroy({ where: { taskId: task.id }, transaction });
						if (mapped.length > 0) {
							await TaskPillar.bulkCreate(mapped, { transaction, validate: true });
						}
					}
				}
				// `pillars` fehlt → Beiträge unverändert lassen; gesetzt (auch `[]`) → komplett ersetzen.
				if (validation.pillars !== undefined) {
					await TaskPillar.destroy({ where: { taskId: task.id }, transaction });
					if (validation.pillars.length > 0) {
						await replaceContributions(task.id, validation.pillars, transaction);
					}
				}
				// Punkte nur beim echten Übergang auf „Done" vergeben (vorher ≠ Done, jetzt Done) — kein
				// überflüssiges findOrCreate bei weiteren PATCHes eines bereits erledigten Tasks.
				if (!warVorherDone && task.status === 'Done') {
					await awardScoreOnDone(task, transaction, validation.completedAt);
				}
				// #1821: Korrektur an einem erledigten Task — Punkte neu berechnen, wenn Aufwand, Priorität
				// oder Deadline sich ändern; der Eintrag bleibt erhalten (kein neuer `zeitpunkt`).
				if (
					warVorherDone &&
					task.status === 'Done' &&
					['estimatedEffort', 'priority', 'deadline'].some((key) => key in validation.attrs)
				) {
					await recalculateScoreOnDoneEdit(task, transaction);
				}
				// Score-Rücknahme beim Wiedereröffnen (#228, AK-5): War der Task vorher „Done" und ist er
				// jetzt nicht mehr erledigt, wird der beim Erledigen vergebene ScoreEntry wieder entfernt.
				// Ein erneutes „Done" vergibt dann genau einen neuen Eintrag (keine Doppelzählung).
				if (warVorherDone && task.status !== 'Done') {
					await ScoreEntry.destroy({ where: { taskId: task.id }, transaction });
				}
			});
			// #1989: KPI-Protokollierung der Erledigung — am Registrierungstag `aktivierung`, sonst
			// Tages-`aktivitaet`; Nutzer = Task-Eigentümer nach Claim (#1521). Erst nach dem Commit,
			// und ein Fehler bleibt folgenlos für den PATCH (Muster #1224/#1363).
			if (istDoneUebergang && task.userId != null) {
				try {
					const eigentuemer = await User.findByPk(task.userId, { attributes: ['id', 'createdAt'] });
					if (eigentuemer) {
						await protokolliereErledigung(eigentuemer.id, eigentuemer.createdAt);
					}
				} catch (error) {
					console.warn('KPI-Erledigung nicht protokolliert:', error);
				}
			}
			// #1983 (AK5): Zugangs-Mail an die externe Adresse — nach dem Commit und vor der Antwort
			// abgewartet; ein Versandfehler lässt die Übergabe unberührt (Muster #1224/#1363).
			const accessMailThrottled = patchNewRecipientEmail !== null && !claimAccessMailSlot(getUserId(req) ?? 0);
			if (patchNewRecipientEmail !== null && !accessMailThrottled) {
				try {
					await sendAccountAccessMail(patchNewRecipientEmail, {
						subject: `Aufgabe „${task.title}" bei Balamentum`,
						lines: [
							`${requester?.displayName ?? 'Jemand'} hat dir die Aufgabe „${task.title}" übergeben.`,
							'Sieh sie dir in Ruhe an — du entscheidest, was daraus wird.',
						],
					});
				} catch (error) {
					console.warn('Zugangs-Mail zur übergebenen Aufgabe fehlgeschlagen:', error);
				}
			}
			// #1363: Nach dem Commit erneut den Meilenstein-Stand ermitteln und neu erreichte Schwellen
			// melden — erst nach dem Commit, damit die Punkte-/Streak-Vergabe bereits eingerechnet ist.
			// Wie bei #1224 (`notifyTaskCreated`) bleibt ein Versandfehler folgenlos für den PATCH.
			if (istDoneUebergang && meilensteineVorher && meilensteinUserId != null) {
				try {
					const meilensteineNachher = await meilensteinStandVon(meilensteinUserId);
					await notifyReachedMilestones(meilensteinUserId, meilensteineVorher, meilensteineNachher, pushSender);
				} catch (error) {
					console.warn('Meilenstein-Benachrichtigung fehlgeschlagen:', error);
				}
			}
			// #1391: Den Ersteller über die erledigte, von ihm fremd angelegte Aufgabe informieren —
			// erst nach dem Commit und nur beim echten Übergang auf „Done" (`istDoneUebergang` schließt
			// eine gleichzeitige Übergabe bereits aus, siehe oben). Selbst angelegte Aufgaben
			// (`createdById` fehlt oder ist der Eigentümer selbst) bleiben ohne Nachricht (AK3).
			// Wie bei #1224/#1363 bleibt ein Versandfehler folgenlos für den PATCH (AK5).
			if (istDoneUebergang && task.createdById != null && task.createdById !== task.userId) {
				try {
					await notifyTaskCompleted(
						{ id: task.id, title: task.title, createdById: task.createdById },
						requester ? { displayName: requester.displayName } : null,
						pushSender,
					);
				} catch (error) {
					console.warn('Benachrichtigung zur erledigten Aufgabe fehlgeschlagen:', error);
				}
			}
			const withPillars = await findTaskWithPillars(task.id);
			if (!withPillars) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			const dto = serializeTask(withPillars);
			res.json(accessMailThrottled ? { ...dto, accessMailThrottled } : dto);
		} catch (error) {
			handleWriteError(res, error);
		}
	});

	// POST /tasks/:id/archive — Aufgabe archivieren (#1964): raus aus Aufgabenliste und
	// Verpasst-Bereich, ohne sie zu löschen und ohne Statuswechsel (Score/Streak unberührt).
	tasksRouter.post('/tasks/:id/archive', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
		const id = parseId(req.params.id);
		// Fremde Tasks sind nicht auffindbar → 404 (Datenisolation, #207).
		const task = id === null ? null : await findOwnTask(id, getUserId(req));
		if (!task) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		try {
			await task.update({ archivedAt: new Date() });
			const withPillars = await findTaskWithPillars(task.id);
			if (!withPillars) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			res.json(serializeTask(withPillars));
		} catch (error) {
			handleWriteError(res, error);
		}
	});

	// POST /tasks/:id/unarchive — Aufgabe wiederherstellen: zurück in Liste (und ggf. Verpasst-Bereich).
	tasksRouter.post('/tasks/:id/unarchive', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
		const id = parseId(req.params.id);
		const task = id === null ? null : await findOwnTask(id, getUserId(req));
		if (!task) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		try {
			await task.update({ archivedAt: null });
			const withPillars = await findTaskWithPillars(task.id);
			if (!withPillars) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			res.json(serializeTask(withPillars));
		} catch (error) {
			handleWriteError(res, error);
		}
	});

	// DELETE /tasks/:id — einen Task löschen
	tasksRouter.delete('/tasks/:id', async (req: Request, res: Response<ErrorDto>) => {
		const id = parseId(req.params.id);
		// Fremde Tasks sind nicht auffindbar → 404 (Datenisolation, #207, AK5).
		const task = id === null ? null : await findOwnTask(id, getUserId(req));
		if (!task) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		await task.destroy();
		res.status(204).send();
	});

	// POST /tasks/:id/dependencies — Abhängigkeit (Vorgänger) hinzufügen
	tasksRouter.post(
		'/tasks/:id/dependencies',
		requirePlanFeature('graph_write'),
		// #1782: einfache Abhängigkeiten gelten für jedes Paket, ein Gewicht abseits des Defaults 1 erst ab Plus
		// (die App schickt das Default-Gewicht immer mit).
		requirePlanFeature('graph_weight', (req) => {
			const weight = (req.body as { weight?: unknown } | undefined)?.weight;
			return weight !== undefined && weight !== 1;
		}),
		async (req: Request, res: Response<TaskDto | ErrorDto>) => {
			const id = parseId(req.params.id);
			if (id === null) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}

			const body: unknown = req.body;
			if (typeof body !== 'object' || body === null) {
				sendError(res, 400, 'Request-Body muss ein Objekt sein.');
				return;
			}
			const input = body as Record<string, unknown>;

			if (
				typeof input.dependingTaskId !== 'number' ||
				!Number.isInteger(input.dependingTaskId) ||
				input.dependingTaskId < 1
			) {
				sendError(res, 400, 'dependingTaskId muss eine Ganzzahl >= 1 sein.');
				return;
			}
			if (
				input.weight !== undefined &&
				(typeof input.weight !== 'number' || !Number.isFinite(input.weight) || input.weight < 0.1 || input.weight > 1)
			) {
				sendError(res, 400, 'weight muss eine endliche Zahl zwischen 0,1 und 1 sein.');
				return;
			}
			const weight = typeof input.weight === 'number' ? input.weight : 1;

			// Beide Enden müssen dem Nutzer gehören (Datenisolation, #207) — fremde Tasks → 404.
			const userId = getUserId(req);
			const dependentTask = await findOwnTask(id, userId);
			if (!dependentTask) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			const dependingTask = await findOwnTask(input.dependingTaskId, userId);
			if (!dependingTask) {
				sendError(res, 404, 'Abhängiger Task (dependingTaskId) nicht gefunden.');
				return;
			}

			if (await wouldCreateCycle(dependentTask, dependingTask)) {
				sendError(res, 409, 'Abhängigkeit kann nicht hinzugefügt werden: Es würde ein Zyklus entstehen.');
				return;
			}

			try {
				// Idempotent: Besteht die Kante bereits, aktualisiert addDependency() nur das Gewicht der
				// vorhandenen Join-Zeile (kein Duplikat, kein Constraint-Fehler) — die Antwort bleibt 201.
				await dependentTask.addDependency(dependingTask, { through: { weight } });
				const withPillars = await findTaskWithPillars(dependentTask.id);
				if (!withPillars) {
					sendError(res, 404, 'Task nicht gefunden.');
					return;
				}
				res.status(201).json(serializeTask(withPillars));
			} catch (error) {
				handleWriteError(res, error);
			}
		},
	);

	// DELETE /tasks/:id/dependencies/:depId — Abhängigkeit (Vorgänger) entfernen
	tasksRouter.delete(
		'/tasks/:id/dependencies/:depId',
		requirePlanFeature('graph_write'),
		async (req: Request, res: Response<ErrorDto>) => {
			const id = parseId(req.params.id);
			const depId = parseId(req.params.depId);
			const task = id === null ? null : await findOwnTask(id, getUserId(req));
			if (!task) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			if (depId === null) {
				sendError(res, 404, 'Abhängigkeit nicht gefunden.');
				return;
			}
			// Existenz der Kante prüfen, damit ein stilles "Löschen" einer nicht vorhandenen Abhängigkeit
			// laut Vertrag mit 404 (statt 204) beantwortet wird.
			const dependencies = await task.getDependencies();
			if (!dependencies.some((dependency) => dependency.id === depId)) {
				sendError(res, 404, 'Abhängigkeit nicht gefunden.');
				return;
			}
			await task.removeDependency(depId);
			res.status(204).send();
		},
	);

	return tasksRouter;
};
