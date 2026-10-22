import { Op } from 'sequelize';
import { NotificationLog, Pillar, ScoreEntry, Task, User } from '../models/index.js';
import type { PillarWithContribution } from '../models/task.js';
import { bewerteCareDefizit } from './careDeficit.js';
import { sendDedupedPush } from './dedupedPush.js';
import { uhrzeitIn } from './carePush.js';
import type { BalanceSaeule, KadenzTask } from './heartBalance.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { type PushSender } from './push.js';
import { isoWocheIn, nutzerZeitzone, tagIn } from './streak.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachliche Push-Trigger „Lob" (#2855 AK1) und „Willkommen zurück" (#2855 AK6) — die beiden
 * Fürsorge-Anlässe im Fenster Tag 09–18 Ortszeit (`push-konzept.md` §3/§7.1), das die Ruhezeit
 * 21–07 mit abdeckt; das Budget-Tor läuft über die gemeinsame Mechanik aus `dedupedPush.ts`
 * (die selbst keine Uhrzeit prüft). Das Lob honoriert eine ausgewogene Woche, wenn {@link bewerteCareDefizit}
 * weder ein Defizit noch eine Überlast meldet; am lokalen Tag eines `care-push`-Versands bleibt
 * es aus (Fürsorge schlägt Lob). Willkommen zurück erreicht Nutzer nach sieben Tagen ohne
 * angelegte oder erledigte Aufgabe — ältere Historie ist unschädlich.
 *
 * Ton nach `docs/fuersorge-tonalitaet.md` (echte Anerkennung bzw. ein kleiner Einstieg, ohne
 * Vorwurf). Schalter: `users.carePushEnabled` (Gruppe Fürsorge). Muster: {@link sendDedupedPush}
 * mit injizierbarem PushSender, Protokoll nur bei `sent > 0`.
 */

const KIND_LOB = 'appreciation';
const KIND_WILLKOMMEN = 'welcome-back';

const LOB_TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Deine Woche ist im Gleichgewicht',
		body: 'Deine Kraft ist gerade gut verteilt – das ist dein Verdienst. Ein Blick auf die Balance zeigt, was gut läuft.',
	},
	en: {
		title: 'Your week is in balance',
		body: 'Your energy is well distributed right now – that is your doing. A look at your balance shows what is working.',
	},
};

const WILLKOMMEN_TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Schön, dass du wieder da bist',
		body: 'Hier ist nichts verloren gegangen. Ein kleiner Schritt heute genügt, um wieder einzusteigen.',
	},
	en: {
		title: 'Good to have you back',
		body: 'Nothing has been lost. One small step today is enough to get going again.',
	},
};

const SIEBEN_TAGE_MS = 7 * 24 * 60 * 60 * 1000;
const DREISSIG_TAGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fenster Tag 09–18 Ortszeit (Anfang inklusive, Ende exklusiv) — Muster `istImFenster` aus
 * `carePush.ts`; `sendDedupedPush` prüft selbst keine Uhrzeit, das Gate gehört zum Trigger.
 */
const istImTagesfenster = (now: Date, zeitzone: string): boolean => {
	const { stunde } = uhrzeitIn(now, zeitzone);
	return stunde >= 9 && stunde < 18;
};

/**
 * Care-Auswertung je Nutzer — dasselbe Sammeln wie `runCarePush` (`carePush.ts`): Säulen in
 * Id-Ordnung, Aufgaben mit Säulen-Beiträgen, Erledigungszeitpunkte aus `ScoreEntry`. Gibt `null`
 * zurück, wenn der Nutzer keine Säule hat (keine Bewertung möglich).
 */
const careDefiziteFuer = async (user: User, now: Date) => {
	const saeulen = await Pillar.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] });
	if (saeulen.length === 0) {
		return null;
	}
	const tasks = await Task.findAll({ where: { userId: user.id }, include: [Pillar] });
	const entries = await ScoreEntry.findAll({ include: [{ model: Task, where: { userId: user.id } }] });
	const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));
	const kadenzTasks: KadenzTask[] = tasks.map((task) => ({
		status: task.status,
		estimatedEffort: task.estimatedEffort,
		pillars: ((task.Pillars ?? []) as PillarWithContribution[]).map((pillar) => ({
			pillarId: pillar.id,
			share: pillar.TaskPillar.share,
		})),
		erledigtAm: zeitpunktProTask.get(task.id) ?? null,
	}));
	const balanceSaeulen: BalanceSaeule[] = saeulen.map((saeule) => ({
		id: saeule.id,
		key: saeule.key,
		name: saeule.name,
		weight: saeule.weight,
	}));
	return bewerteCareDefizit(balanceSaeulen, kadenzTasks, now);
};

/**
 * Versendet höchstens ein Lob je Nutzer und ISO-Woche — Voraussetzung ist eine ausgewogene
 * Auswertung ohne `care-push`-Versand am selben lokalen Tag; Versandfenster ist Tag 09–18
 * Ortszeit (der stündliche Scheduler feuert sonst auch nachts).
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runAppreciationPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.carePushEnabled === false) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		if (!istImTagesfenster(now, zeitzone)) {
			continue;
		}
		const defizite = await careDefiziteFuer(user, now);
		if (defizite === null || defizite.some((eintrag) => eintrag.defizitaer || eintrag.ueberlast)) {
			continue;
		}
		// Nie am selben lokalen Tag wie ein Fürsorge-Hinweis — gleicher Dedup-Schlüssel wie `runCarePush`.
		const careHeute = await NotificationLog.findOne({
			where: { kind: 'care-push', userId: user.id, dedupeKey: `${user.id}:${tagIn(now, zeitzone)}` },
		});
		if (careHeute) {
			continue;
		}
		const dedupeKey = `${user.id}:${isoWocheIn(now, zeitzone)}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND_LOB,
			dedupeKey,
			{ ...LOB_TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.appreciation },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};

/**
 * Versendet eine Willkommen-zurück-Nachricht an Nutzer ohne angelegte (`Task.createdAt`) oder
 * erledigte (`ScoreEntry.zeitpunkt`) Aufgabe in den letzten sieben Tagen — höchstens einmal je
 * 30 Tage, geprüft über `NotificationLog`-Einträge des Kinds (`sentAt`-Rückblick; der
 * Dedup-Schlüssel wechselt täglich, hält die Sperre also selbst nicht). Versandfenster ist
 * Tag 09–18 Ortszeit — sonst feuerte der stündliche Scheduler nachts, sobald die Sperre abläuft.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runWelcomeBackPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.carePushEnabled === false) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		if (!istImTagesfenster(now, zeitzone)) {
			continue;
		}
		const seitSiebenTagen = new Date(now.getTime() - SIEBEN_TAGE_MS);
		const frischeTasks = await Task.findAll({
			where: { userId: user.id, createdAt: { [Op.gt]: seitSiebenTagen } },
			attributes: ['id'],
		});
		if (frischeTasks.length > 0) {
			continue;
		}
		const frischeErledigungen = await ScoreEntry.findAll({
			where: { zeitpunkt: { [Op.gt]: seitSiebenTagen } },
			include: [{ model: Task, where: { userId: user.id }, attributes: ['id'] }],
		});
		if (frischeErledigungen.length > 0) {
			continue;
		}
		const seitDreissigTagen = await NotificationLog.findOne({
			where: {
				kind: KIND_WILLKOMMEN,
				userId: user.id,
				sentAt: { [Op.gte]: new Date(now.getTime() - DREISSIG_TAGE_MS) },
			},
		});
		if (seitDreissigTagen) {
			continue;
		}
		const dedupeKey = `${user.id}:welcome-back:${tagIn(now, zeitzone)}`;
		const { sent } = await sendDedupedPush(
			user.id,
			KIND_WILLKOMMEN,
			dedupeKey,
			{ ...WILLKOMMEN_TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.welcomeBack },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
