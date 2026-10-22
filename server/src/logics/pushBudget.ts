import { NotificationLog, User } from '../models/index.js';
import { Op } from 'sequelize';
import { nutzerZeitzone, tagIn } from './streak.js';

/**
 * Push-Budget (#2853, Konzept §4): höchstens drei fachliche Pushes je Nutzer und lokalem Tag.
 * Gezählt wird über Marker-Zeilen (`kind = BUDGET_KIND`) in `notification_logs` — keine neue
 * Tabelle. Service-Nachrichten zählen nicht und werden nie verdrängt. Das Tor selbst sitzt in
 * {@link ./dedupedPush.js} (`sendDedupedPush`/`sendDedupedPushBulk`). Die §4-Auswahl je
 * Scheduler-Tick (F1.2) läuft strukturell: der Scheduler sendet je Tick in Vorrang-Ordnung
 * ({@link vorrangVon}), das per-Send-Tor macht daraus die gemeinsame Auswahl des Ticks — über den
 * Tagesverlauf bleibt es First-Come-First-Served.
 */

/** Marker-KIND: je zugestelltem fachlichen Push entsteht eine Zeile mit dem lokalen Tag im `dedupeKey`. */
export const BUDGET_KIND = 'push-budget';

/** Grenze je Nutzer und lokalem Kalendertag (Konzept §4). */
const BUDGET_GRENZE = 3;

/**
 * Kinds der Service-Nachrichten (Gruppe Abo & Rechnungen, Konzept §7.3) — umgehen das Budget.
 * Die Liste ist bewusst veränderlich, damit Tests ein Kind probehalber aufnehmen können.
 */
export const SERVICE_KINDS: string[] = ['abo-service'];

/** Ob ein Kind unter das Budget fällt (Service-Nachrichten nicht). */
export const istServiceKind = (kind: string): boolean => SERVICE_KINDS.includes(kind);

/**
 * §4-Stufen der Vorrang-Ordnung (von oben nach unten): Kinds derselben Stufe teilen ihren Rang
 * ({@link vorrangVon}), die Reihenfolge innerhalb einer Stufe bleibt der Kandidaten-Reihenfolge
 * überlassen (stabile Sortierung). Unbekannte Kinds (kein §4-Platz) sortiert der rohe Stufen-Index
 * mit −1 nach vorn — Registrierung ist Pflicht (VORRANG-Falle).
 */
const VORRANG: string[][] = [
	// §4 Stufe 1 (#2854): die Gruppeneinladung neben task-created, vor geo-nearby-task.
	['task-created', 'group-invitation'],
	['task-completed'],
	['series-generated'],
	['geo-nearby-task'],
	// #2854: Beitritt und Challenge — vor daily-digest (AK6 bindet nur nach oben).
	['group-member', 'group-challenge'],
	['daily-digest'],
	['due-task'],
	['daily-top-tasks'],
	['care-push'],
	['streak-reminder'],
	['milestone'],
	['monthly-recap'],
];

/**
 * Wählt aus `kandidaten` höchstens `freie` nach Vorrang (Konzept §4) aus — der beobachtbare
 * Vertrag der Ordnung; das Tor fragt sie je Send (`passtImBudget`).
 */
export const waehleImBudget = (kandidaten: string[], freie: number): string[] =>
	[...kandidaten]
		.sort((a, b) => VORRANG.findIndex((stufe) => stufe.includes(a)) - VORRANG.findIndex((stufe) => stufe.includes(b)))
		.slice(0, Math.max(freie, 0));

/** §4-Rang eines Kinds (Stufen-Index, 0 = höchster Vorrang, unbekannt = hinten) — Ordnung der Trigger je Scheduler-Tick (F1.2). */
export const vorrangVon = (kind: string): number => {
	const rang = VORRANG.findIndex((stufe) => stufe.includes(kind));
	return rang === -1 ? VORRANG.length : rang;
};

/** Gruppen-Tag je Push-Art (Konzept §2.3); Ortserinnerung und Serien zählen zur Aufgabengruppe. */
const TAGS: Record<string, string> = {
	'due-task': 'pp-aufgaben',
	'daily-top-tasks': 'pp-aufgaben',
	'daily-digest': 'pp-aufgaben',
	'task-created': 'pp-aufgaben',
	'task-completed': 'pp-aufgaben',
	'series-generated': 'pp-aufgaben',
	'geo-nearby-task': 'pp-aufgaben',
	'group-invitation': 'pp-gruppen',
	'group-member': 'pp-gruppen',
	'group-challenge': 'pp-gruppen',
	'care-push': 'pp-fuersorge',
	'streak-reminder': 'pp-fuersorge',
	milestone: 'pp-erfolge',
	'monthly-recap': 'pp-erfolge',
	'abo-service': 'pp-abo',
};

/** Gruppen-Tag eines Kinds — für noch nicht zugeordnete Kinds die Aufgabengruppe als Fallback. */
export const tagVon = (kind: string): string => TAGS[kind] ?? 'pp-aufgaben';

/** Prefix der Budget-Marker je Nutzer und lokalem Tag (`users.zeitzone`, Fallback UTC). */
const budgetPrefix = async (userId: number | undefined, sentAt: Date): Promise<string> => {
	const recipient = userId === undefined ? undefined : await User.findByPk(userId, { attributes: ['zeitzone'] });
	return `${userId}:${tagIn(sentAt, nutzerZeitzone(recipient?.zeitzone))}`;
};

/** Ob der fachliche Push `kind` noch ins Tagesbudget passt (`false` = verdrängt, Konzept §4). */
export const passtImBudget = async (userId: number | undefined, kind: string, sentAt: Date): Promise<boolean> => {
	if (istServiceKind(kind)) {
		return true;
	}
	const freie =
		BUDGET_GRENZE -
		(await NotificationLog.count({
			where: {
				kind: BUDGET_KIND,
				userId: userId ?? null,
				dedupeKey: { [Op.like]: `${await budgetPrefix(userId, sentAt)}:%` },
			},
		}));
	return waehleImBudget([kind], freie).length > 0;
};

/**
 * Budget-Marker nach zugestelltem fachlichen Push — Verdrängte und Fehlzustellungen bleiben ohne
 * Zeile. Der Schlüssel nimmt den eindeutigen Fach-Schlüssel auf (UNIQUE `kind`+`dedupeKey` in
 * `notification_logs` erlaubt je Tag so viele Marker wie Sends).
 */
export const protokolliereBudget = async (
	userId: number | undefined,
	fachSchluessel: string,
	sentAt: Date,
): Promise<void> => {
	const dedupeKey = `${await budgetPrefix(userId, sentAt)}:${fachSchluessel}`;
	await NotificationLog.create({ userId, kind: BUDGET_KIND, dedupeKey, sentAt });
};
