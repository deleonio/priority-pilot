import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, handleWriteError, parseId } from '../http-error.js';
import { Op, Transaction, type WhereOptions } from 'sequelize';
import sequelize from '../../database.js';
import { GroupMember, Pillar, Series, SeriesPillar, Task, TaskPillar } from '../../models/index.js';
import type { SeriesRhythm } from '../../models/series.js';
import { generateDueInstances, materializeDueSeries } from '../../logics/series.js';
import { arePillarsExistent, validatePillars, type PillarContribution } from '../../logics/pillarContributions.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { serializeTask, loadUserNames } from './tasks.js';
import { resolveGeoUser } from './geoConfig.js';
import type { components } from '../../api';

type SeriesDto = components['schemas']['Series'];
type TaskDto = components['schemas']['Task'];
type SeriesGenerateAllResultDto = components['schemas']['SeriesGenerateAllResult'];
type ErrorDto = components['schemas']['Error'];

const VALID_RHYTHMS: readonly SeriesRhythm[] = [
	'daily',
	'weekly',
	'monthly',
	'weekdays',
	'weekend',
	'mon',
	'tue',
	'wed',
	'thu',
	'fri',
	'sat',
	'sun',
];

/**
 * Ziel-UTC-Wochentag je `mon`…`sun`-Rhythmus (0=So … 6=Sa). `undefined` für alle anderen Rhythmen,
 * die keinen festen Wochentag implizieren (`daily`/`weekly`/`monthly`/`weekdays`/`weekend`).
 *
 * Wird benutzt, um sicherzustellen, dass bei `mon`…`sun` das `startDate` tatsächlich auf dem
 * benannten Wochentag liegt — sonst würde `nextOccurrence` (das schlicht +7 Tage addiert) die
 * Termine auf den Wochentag des Start-Datums legen, nicht auf den suggerierten Namen.
 */
const RHYTHM_WEEKDAY: ReadonlyMap<SeriesRhythm, number> = new Map([
	['sun', 0],
	['mon', 1],
	['tue', 2],
	['wed', 3],
	['thu', 4],
	['fri', 5],
	['sat', 6],
]);

/**
 * Produktpolicy: maximale Vorlauf-Horizont in Tagen, den `/series/generate-all`
 * materialisiert. Verhindert, dass bei jedem Cron-Lauf ein unbegrenztes Fenster
 * erzeugt wird — es wird nur bis "heute + N Tage" vorlaufend angelegt.
 */
const GENERATE_HORIZON_DAYS = 30;

/** Validierte Template-Attribute, wie sie an das Sequelize-Modell übergeben werden. */
interface SeriesAttributes {
	title?: string;
	rhythm?: SeriesRhythm;
	priority?: number;
	estimatedEffort?: number;
	active?: boolean;
	startDate?: Date;
	description?: string | null;
	address?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	autoDeleteAfterDeadline?: boolean;
}

type ValidationResult =
	{ ok: true; attrs: SeriesAttributes; pillars: PillarContribution[] | undefined } | { ok: false; message: string };

const isRhythm = (value: unknown): value is SeriesRhythm =>
	typeof value === 'string' && VALID_RHYTHMS.some((rhythm) => rhythm === value);

/**
 * Kontext für die Ersteller-/Empfänger-Kennzeichen des Series-DTO (#1222, Muster `TaskSerializeContext`
 * in routes/tasks.ts #1213): `requesterId` entscheidet, ob `forUserId`/`forUserName` gesetzt werden
 * (nur der Ersteller sieht das „Für:"-Kennzeichen), `names` liefert Anzeigenamen (E-Mail-Fallback)
 * der referenzierten Konten. Ohne Kontext bleiben die Kennzeichen-Felder null — der DTO-Vertrag
 * erlaubt das.
 */
interface SeriesSerializeContext {
	requesterId?: number | null;
	names?: Map<number, string>;
}

/**
 * Wandelt ein Serien-Template in die im API-Vertrag definierte Form um. Die Säulen-Vorlage stammt
 * aus der **eager-geladenen** Assoziation `series.Pillars` (`include: [Pillar]`); fehlt sie, gilt
 * „keine Säulen". Die Beiträge sind nach `pillarId` sortiert (deterministische Reihenfolge).
 */
const serializeSeries = (series: Series, context: SeriesSerializeContext = {}): SeriesDto => {
	// #1222: Ersteller-Kennzeichen. `forUserId`/`forUserName` nur aus Sicht des Erstellers — der
	// Empfänger bekommt kein „Für:"-Kennzeichen für die eigene Serie, der Ersteller einer
	// Selbst-Anlage ebenso wenig (userId == createdById).
	const createdBy = series.createdById ?? null;
	const handedOff =
		createdBy !== null &&
		context.requesterId != null &&
		context.requesterId === createdBy &&
		series.userId != null &&
		series.userId !== createdBy;
	return {
		id: series.id,
		title: series.title,
		rhythm: series.rhythm,
		priority: series.priority,
		estimatedEffort: series.estimatedEffort,
		active: series.active,
		startDate: series.startDate.toISOString(),
		description: series.description ?? null,
		address: series.address ?? null,
		latitude: series.latitude ?? null,
		longitude: series.longitude ?? null,
		autoDeleteAfterDeadline: series.autoDeleteAfterDeadline ?? false,
		userId: series.userId ?? null,
		createdById: createdBy,
		createdByName: createdBy !== null ? (context.names?.get(createdBy) ?? null) : null,
		forUserId: handedOff ? series.userId : null,
		forUserName: handedOff ? (context.names?.get(series.userId as number) ?? null) : null,
		pillars: (series.Pillars ?? [])
			.map((pillar) => ({
				pillarId: pillar.id,
				share: pillar.SeriesPillar.share,
				confidence: pillar.SeriesPillar.confidence,
			}))
			.sort((a, b) => a.pillarId - b.pillarId),
	};
};

/**
 * Lädt die Anzeigenamen für die Kennzeichen-Felder einer Serienliste (Muster `serializeSeriesFor`
 * in routes/tasks.ts #1213) — ein Sammel-Query statt je Serie.
 */
const serializeSeriesFor = async (req: Request, seriesList: Series[]): Promise<SeriesDto[]> => {
	const requester = await resolveGeoUser(req);
	const requesterId = requester?.id ?? null;
	const names = await loadUserNames(seriesList.flatMap((series) => [series.createdById ?? 0, series.userId ?? 0]));
	return seriesList.map((series) => serializeSeries(series, { requesterId, names }));
};

/**
 * Lese-Scope der Serien-Liste (#1222, AK5): eigene Serien (`ownerScope`) ODER Serien, die der
 * Nutzer für ein anderes Gruppenmitglied angelegt hat (`createdById`). Der Schreib-Scope
 * (`findSeriesWithPillars`, PATCH/DELETE) bleibt ausschließlich `ownerScope` — der Ersteller einer
 * fremden Serie erhält dort 404. Ohne Session (Pass-Through) unverändert; Serien ohne
 * `createdById` (NULL) sind über den `userId`-Zweig abgedeckt (AK7, NULL-sicher).
 */
const seriesReadScope = (userId: number | undefined, requesterId: number | null): WhereOptions =>
	userId === undefined
		? {}
		: requesterId === null
			? { userId }
			: { [Op.or]: [{ userId }, { createdById: requesterId }] };

/**
 * Validiert den Request-Body für Anlegen/Aktualisieren eines Templates. `isPost` signalisiert
 * einen POST-Request (erzwingt title + startDate als Pflichtfelder); bei einer Teil-Aktualisierung sind alle Felder optional.
 *
 * `existing` (nur bei PATCH gesetzt) liefert die in der DB gespeicherten `rhythm`/`startDate`-Werte,
 * damit die Wochentag-Konsistenz-Prüfung auch bei einem Teil-PATCH greift, der nur eines der beiden
 * Felder enthält (z. B. nur `rhythm` oder nur `startDate`): die Prüfung bildet dann die effektiven
 * Werte (`gesendet ?? gespeichert`) und verhindert so eine inkonsistente Kombination.
 */
const validateSeriesFields = (
	body: unknown,
	isPost: boolean,
	existing?: Pick<Series, 'rhythm' | 'startDate'>,
): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const input = body as Record<string, unknown>;
	const attrs: SeriesAttributes = {};

	if (input.title !== undefined) {
		if (typeof input.title !== 'string' || input.title.trim() === '') {
			return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
		}
		attrs.title = input.title.trim();
	}
	if (isPost && attrs.title === undefined) {
		return { ok: false, message: 'title ist erforderlich.' };
	}

	if (input.rhythm !== undefined) {
		if (!isRhythm(input.rhythm)) {
			return {
				ok: false,
				message:
					'rhythm muss "daily", "weekly", "monthly", "weekdays", "weekend", "mon", "tue", "wed", "thu", "fri", "sat" oder "sun" sein.',
			};
		}
		attrs.rhythm = input.rhythm;
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
	if (isPost && attrs.priority === undefined) {
		return { ok: false, message: 'priority ist erforderlich.' };
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
	if (isPost && attrs.estimatedEffort === undefined) {
		return { ok: false, message: 'estimatedEffort ist erforderlich.' };
	}

	if (input.active !== undefined) {
		if (typeof input.active !== 'boolean') {
			return { ok: false, message: 'active muss ein Boolean sein.' };
		}
		attrs.active = input.active;
	}

	if (input.startDate !== undefined) {
		if (typeof input.startDate !== 'string' || Number.isNaN(Date.parse(input.startDate))) {
			return { ok: false, message: 'startDate muss ein gültiges ISO-Datum sein.' };
		}
		attrs.startDate = new Date(input.startDate);
	}
	if (isPost && attrs.startDate === undefined) {
		return { ok: false, message: 'startDate ist erforderlich.' };
	}

	if (input.description !== undefined) {
		if (input.description !== null && typeof input.description !== 'string') {
			return { ok: false, message: 'description muss ein String oder null sein.' };
		}
		attrs.description = input.description;
	}

	// Ortsbezug der Serie (#1063): Validierung analog `Task.address` (routes/tasks.ts) — String ≤ 255
	// oder null; trim/leerer String wird wie null behandelt.
	if (input.address !== undefined) {
		if (input.address !== null && (typeof input.address !== 'string' || input.address.length > 255)) {
			return { ok: false, message: 'address muss ein String (max. 255 Zeichen) oder null sein.' };
		}
		attrs.address = input.address === null ? null : input.address.trim() === '' ? null : input.address.trim();
	}

	// Standort-Koordinaten der Serie (#1066), analog `Task.latitude/longitude`: Zahl im gültigen
	// Bereich oder null; Freitext ohne Koordinat bleibt speicherbar (AK10).
	// Standort-Koordinaten der Serie (#1066): nur bei Auswahl eines Adress-Vorschlags gesetzt (Coordinates-only);
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

	if (input.autoDeleteAfterDeadline !== undefined) {
		if (typeof input.autoDeleteAfterDeadline !== 'boolean') {
			return { ok: false, message: 'autoDeleteAfterDeadline muss ein Boolean sein.' };
		}
		attrs.autoDeleteAfterDeadline = input.autoDeleteAfterDeadline;
	}

	// Konsistenz-Prüfung für wochentag-basierte Rhythmen (`mon`…`sun`): der Rhythmus-Name
	// suggeriert einen festen Wochentag. Da `nextOccurrence` für diese Rhythmen schlicht +7 Tage
	// addiert (Anker liegt „definitionsgemäß" auf dem Tag), würde ein `startDate` auf einem
	// *anderen* Wochentag die Termine stillschweigend auf den falschen Tag legen — der Name
	// bestimmte dann nicht den Wochentag. Wir lehnen diese Kombination daher explizit ab (400),
	// statt eine irreführende Serie zu speichern.
	//
	// Bei POST sind beide Felder Pflicht. Bei PATCH kann nur eines der beiden gesendet werden;
	// in dem Fall ziehen wir den jeweils anderen Wert aus der bestehenden DB-Instanz (`existing`),
	// damit auch ein Teil-PATCH keine inkonsistente Kombination hinterlässt (z. B. nur
	// `rhythm: "wed"` auf einer Serie mit `startDate`=Montag).
	const effRhythm = attrs.rhythm ?? existing?.rhythm;
	const effStartDate = attrs.startDate ?? existing?.startDate;
	const targetWeekday = effRhythm !== undefined ? RHYTHM_WEEKDAY.get(effRhythm) : undefined;
	if (targetWeekday !== undefined && effStartDate !== undefined) {
		if (effStartDate.getUTCDay() !== targetWeekday) {
			const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
			return {
				ok: false,
				message: `rhythm "${effRhythm}" erfordert ein startDate an einem ${weekdayNames[targetWeekday]}.`,
			};
		}
	}

	let pillars: PillarContribution[] | undefined;
	if (input.pillars !== undefined) {
		if (!Array.isArray(input.pillars)) {
			return { ok: false, message: 'pillars muss eine Liste sein.' };
		}
		const result = validatePillars(input.pillars);
		if (!result.ok) {
			return { ok: false, message: 'pillars ist ungültig (Beiträge, Summe der share oder Duplikate).' };
		}
		pillars = result.pillars;
	}

	return { ok: true, attrs, pillars };
};

/**
 * Lädt ein Serien-Template inkl. seiner Säulen-Vorlage (für die Serialisierung).
 * #1157: Datenisolation — `ownerScope(userId)` filtert auf die eigene Serie (Pass-Through bei
 * undefined userId, vgl. pillars.ts).
 */
const findSeriesWithPillars = (id: number, userId: number | undefined): Promise<Series | null> =>
	Series.findOne({ where: { id, ...ownerScope(userId) }, include: [Pillar] });

/** Schreibt die Säulen-Vorlage einer Serie neu (ersetzt vorhandene) — innerhalb einer Transaktion. */
const replaceContributions = (
	seriesId: number,
	pillars: PillarContribution[],
	transaction: Transaction,
): Promise<unknown> =>
	SeriesPillar.bulkCreate(
		pillars.map((entry) => ({
			seriesId,
			pillarId: entry.pillarId,
			share: entry.share,
			confidence: entry.confidence,
		})),
		{ transaction, validate: true },
	);

export const seriesRouter = Router();

// GET /series — alle Serien-Templates auflisten
seriesRouter.get('/series', async (req: Request, res: Response<SeriesDto[] | ErrorDto>) => {
	try {
		// #1157: nur die eigenen Serien-Templates; #1222 zusätzlich die fremden, die der Nutzer
		// für ein anderes Gruppenmitglied angelegt hat (Pass-Through ohne Auth bleibt erhalten).
		const all = await Series.findAll({
			where: seriesReadScope(getUserId(req), (await resolveGeoUser(req))?.id ?? null),
			order: [['id', 'ASC']],
			include: [Pillar],
		});
		res.json(await serializeSeriesFor(req, all));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series — neues Serien-Template anlegen
seriesRouter.post('/series', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const validation = validateSeriesFields(req.body, true);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (
		validation.pillars !== undefined &&
		!(await arePillarsExistent(validation.pillars.map((entry) => entry.pillarId)))
	) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		// #1222: Ersteller auflösen (Session-Nutzer, sonst Dev-Pass-Through) und optionalen Empfänger
		// prüfen — Muster `POST /tasks` (#1213): `userId` im Body bezeichnet das Konto, dem die Serie
		// gehören soll. Ohne das Feld (oder mit der eigenen ID) ändert sich am bisherigen Ablauf nichts
		// (AK1); ein Empfänger, mit dem der Aufrufer keine Gruppe teilt, wird mit 403 abgelehnt, ohne
		// einen Datensatz anzulegen (AK2).
		const requester = await resolveGeoUser(req);
		const requesterId = requester?.id ?? null;
		let recipientId: number | null = null;
		const recipientInput = (req.body as { userId?: unknown }).userId;
		if (recipientInput !== undefined) {
			if (typeof recipientInput !== 'number' || !Number.isInteger(recipientInput)) {
				sendError(res, 400, 'userId muss eine Ganzzahl sein.');
				return;
			}
			if (recipientInput !== requesterId) {
				const ownGroups = await GroupMember.findAll({ where: { userId: requesterId ?? -1 } });
				const shared = await GroupMember.findOne({
					where: { groupId: ownGroups.map((membership) => membership.groupId), userId: recipientInput },
				});
				if (shared === null) {
					sendError(res, 403, 'Der Empfänger teilt keine Gruppe mit dir.');
					return;
				}
				recipientId = recipientInput;
			}
		}
		const created = await sequelize.transaction(async (transaction) => {
			const series = await Series.create(
				// An den Eigentümer binden (Datenisolation, #244; Empfänger #1222, sonst der eingeloggte
				// Nutzer) und den Ersteller festhalten (AK3).
				{ ...validation.attrs, userId: recipientId ?? getUserId(req) ?? null, createdById: requesterId },
				{ transaction },
			);
			if (validation.pillars !== undefined && validation.pillars.length > 0) {
				await replaceContributions(series.id, validation.pillars, transaction);
			}
			return series;
		});
		// #1222: Angelegt-Objekt ohne Owner-Scope nachladen — bei einer Empfänger-Serie ist der
		// Ersteller nicht Eigentümer und fände sie über `findSeriesWithPillars` nicht wieder (500).
		const withPillars = await Series.findOne({ where: { id: created.id }, include: [Pillar] });
		if (!withPillars) {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		const names = await loadUserNames([withPillars.createdById ?? 0, withPillars.userId ?? 0]);
		res.status(201).json(serializeSeries(withPillars, { requesterId, names }));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series/generate-all — fällige Instanzen aller aktiven Serien materialisieren (idempotent).
// MUSS vor den `/series/:id`-Routen stehen, damit `generate-all` nicht als `:id` gematcht wird.
seriesRouter.post(
	'/series/generate-all',
	async (req: Request, res: Response<SeriesGenerateAllResultDto | ErrorDto>) => {
		const userId = getUserId(req);
		try {
			const until = new Date();
			until.setUTCDate(until.getUTCDate() + GENERATE_HORIZON_DAYS);
			const created = await materializeDueSeries(userId, until);
			res.json({ created: created.length });
		} catch (error) {
			handleWriteError(res, error);
		}
	},
);

// GET /series/:id — ein Serien-Template abrufen
seriesRouter.get('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	// #1157: fremde Serien-ID → 404 (wie Tasks/Pillars).
	const series = id === null ? null : await findSeriesWithPillars(id, getUserId(req));
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	res.json(serializeSeries(series));
});

// PATCH /series/:id — ein Serien-Template teilweise aktualisieren (gilt nur für künftige Instanzen)
seriesRouter.patch('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	// #1157: fremde Serien-ID → 404 (wie Tasks/Pillars).
	const series =
		id === null ? null : await Series.findOne({ where: { id, ...ownerScope(getUserId(req)) }, include: [Pillar] });
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const validation = validateSeriesFields(req.body, false, series);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (
		validation.pillars !== undefined &&
		!(await arePillarsExistent(validation.pillars.map((entry) => entry.pillarId)))
	) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	// #553: `applyToInstances=true` kaskadiert die im Serie-Edit GEÄNDERTEN kaskadierbaren Felder auf
	// alle bestehenden Instanzen. `rhythm`/`startDate`/`active` werden bewusst NICHT übernommen.
	const body = typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
	const applyToInstances = body.applyToInstances === true;
	try {
		await sequelize.transaction(async (transaction) => {
			await series.update(validation.attrs, { transaction });
			// `pillars` fehlt → Vorlage unverändert lassen; gesetzt (auch `[]`) → komplett ersetzen.
			if (validation.pillars !== undefined) {
				await SeriesPillar.destroy({ where: { seriesId: series.id }, transaction });
				if (validation.pillars.length > 0) {
					await replaceContributions(series.id, validation.pillars, transaction);
				}
			}
			// Kaskade auf bestehende Instanzen: pro Instanz NUR die geänderten kaskadierbaren Felder
			// überschreiben (inkl. `isException`-Instanzen). rhythm/startDate/active bleiben außen vor.
			// #555: Erledigte ("Done") Instanzen werden von der Kaskade ausgenommen — sie bleiben
			// unverändert, sodass abgeschlossene Aufgaben nicht nachträglich überschrieben werden.
			const openInstancesWhere = { seriesId: series.id, status: { [Op.ne]: 'Done' as const } };
			if (applyToInstances) {
				const instanceAttrs: SeriesAttributes = {};
				if (validation.attrs.title !== undefined) instanceAttrs.title = validation.attrs.title;
				if (validation.attrs.priority !== undefined) instanceAttrs.priority = validation.attrs.priority;
				if (validation.attrs.estimatedEffort !== undefined) {
					instanceAttrs.estimatedEffort = validation.attrs.estimatedEffort;
				}
				if (validation.attrs.description !== undefined) instanceAttrs.description = validation.attrs.description;
				if (validation.attrs.address !== undefined) instanceAttrs.address = validation.attrs.address;
				if (validation.attrs.latitude !== undefined) instanceAttrs.latitude = validation.attrs.latitude;
				if (validation.attrs.longitude !== undefined) instanceAttrs.longitude = validation.attrs.longitude;
				if (validation.attrs.autoDeleteAfterDeadline !== undefined) {
					instanceAttrs.autoDeleteAfterDeadline = validation.attrs.autoDeleteAfterDeadline;
				}
				if (Object.keys(instanceAttrs).length > 0) {
					await Task.update(instanceAttrs, { where: openInstancesWhere, transaction });
				}
				// Geänderte Säulen-Vorlage als TaskPillar-Beiträge auf jede (nicht-erledigte) Instanz übernehmen.
				if (validation.pillars !== undefined) {
					const seriesPillars = validation.pillars;
					const instances = await Task.findAll({
						where: openInstancesWhere,
						attributes: ['id'],
						transaction,
					});
					for (const inst of instances) {
						await TaskPillar.destroy({ where: { taskId: inst.id }, transaction });
					}
					if (seriesPillars.length > 0 && instances.length > 0) {
						await TaskPillar.bulkCreate(
							instances.flatMap((inst) =>
								seriesPillars.map((pillar) => ({
									taskId: inst.id,
									pillarId: pillar.pillarId,
									share: pillar.share,
									confidence: pillar.confidence,
								})),
							),
							{ transaction, validate: true },
						);
					}
				}
			}
		});
		const withPillars = await findSeriesWithPillars(series.id, getUserId(req));
		if (!withPillars) {
			sendError(res, 404, 'Serie nicht gefunden.');
			return;
		}
		res.json(serializeSeries(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// DELETE /series/:id — ein Serien-Template löschen.
// Query `cascade=true`: zusätzlich alle Instanzen (Tasks mit `seriesId = :id`) löschen.
// Default (`cascade=false`): nur das Template; die Instanzen bleiben erhalten und werden von der
// Serie ABGEKOPPELT (`seriesId → null`). Ihre Provenienz (`originSeriesId`) bleibt dauerhaft
// erhalten — so lassen sich ehemalige Instanzen später noch gruppieren/filtern. Beide Pfade laufen
// in einer Transaktion, damit Instanz- und Serien-Löschung/-Abkopplung atomar sind.
seriesRouter.delete('/series/:id', async (req: Request, res: Response<ErrorDto>) => {
	const id = parseId(req.params.id);
	// #1157: fremde Serien-ID → 404 (wie Tasks/Pillars).
	const series = id === null ? null : await Series.findOne({ where: { id, ...ownerScope(getUserId(req)) } });
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const cascade = req.query.cascade === 'true';
	try {
		await sequelize.transaction(async (transaction) => {
			if (cascade) {
				// #555: Beim Kaskaden-Löschen werden NUR nicht-erledigte Instanzen entfernt; erledigte
				// ("Done") bleiben erhalten und werden — analog zu `cascade=false` — von der Serie
				// abgekoppelt (`seriesId → null`), während ihre Provenienz (`originSeriesId`) erhalten
				// bleibt. Die Serie-Definition wird in beiden Fällen gelöscht.
				await Task.destroy({
					where: { seriesId: series.id, status: { [Op.ne]: 'Done' } },
					transaction,
				});
				await Task.update({ seriesId: null }, { where: { seriesId: series.id, status: 'Done' }, transaction });
			} else {
				// Abkoppeln: aus den ehemaligen Instanzen werden eigenständige Aufgaben. `originSeriesId`
				// bleibt unangetastet und hält die Herkunft fest.
				await Task.update({ seriesId: null }, { where: { seriesId: series.id }, transaction });
			}
			await series.destroy({ transaction });
		});
		res.status(204).send();
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series/:id/generate — fällige Instanzen bis `until` materialisieren (idempotent)
seriesRouter.post('/series/:id/generate', async (req: Request, res: Response<TaskDto[] | ErrorDto>) => {
	const id = parseId(req.params.id);
	// #1157: fremde Serien-ID → 404 (wie Tasks/Pillars).
	const series = id === null ? null : await Series.findOne({ where: { id, ...ownerScope(getUserId(req)) } });
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const body: unknown = req.body;
	if (typeof body !== 'object' || body === null) {
		sendError(res, 400, 'Request-Body muss ein Objekt sein.');
		return;
	}
	const until = (body as Record<string, unknown>).until;
	if (typeof until !== 'string' || Number.isNaN(Date.parse(until))) {
		sendError(res, 400, 'until muss ein gültiges ISO-Datum sein.');
		return;
	}
	try {
		const instances = await generateDueInstances(series, { until: new Date(until) });
		res.status(201).json(instances.map((task) => serializeTask(task)));
	} catch (error) {
		handleWriteError(res, error);
	}
});
