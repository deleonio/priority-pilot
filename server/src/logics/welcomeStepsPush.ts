import { Task, User } from '../models/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { type PushSender } from './push.js';
import { nutzerZeitzone, tagIn } from './streak.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { PUSH_TARGETS } from './pushTargets.js';

/**
 * Fachlicher Push-Trigger „Willkommensschritte" (#2855 AK5): erinnert genau am zweiten lokalen
 * Kalendertag nach der Registrierung an die ersten Schritte — nur bei Nutzern ohne einzige
 * Aufgabe (Server-Kriterium; der localStorage-Zustand `pp-welcome-steps` der Willkommens-Card
 * ist serverseitig unsichtbar). Der Dedup-Schlüssel ist die Konto-Id: genau ein Push je Konto,
 * unabhängig vom Datum. Schalter: `users.taskPushEnabled` (Gruppe Aufgaben).
 * Ton nach `docs/fuersorge-tonalitaet.md`: ermutigend, klein anfangen.
 */

const KIND = 'welcome-steps';

const TEXTE: Record<CareSprache, { title: string; body: string }> = {
	de: {
		title: 'Deine ersten Schritte',
		body: 'Noch keine Aufgabe angelegt? Ein kleiner erster Schritt genügt – wir zeigen dir, wie es losgeht.',
	},
	en: {
		title: 'Your first steps',
		body: 'No task yet? One small first step is enough – we will show you how to get started.',
	},
};

const TAG_MS = 24 * 60 * 60 * 1000;

/** Tagesabstand zweier `YYYY-MM-DD`-Strings (Zivilrechnung, `spaeter` − `frueher`). */
const tageZwischen = (frueher: string, spaeter: string): number => {
	const [fJahr, fMonat, fTag] = frueher.split('-').map(Number) as [number, number, number];
	const [sJahr, sMonat, sTag] = spaeter.split('-').map(Number) as [number, number, number];
	return Math.round((Date.UTC(sJahr, sMonat - 1, sTag) - Date.UTC(fJahr, fMonat - 1, fTag)) / TAG_MS);
};

/**
 * Versendet genau einen Willkommensschritte-Push je Konto — am lokalen Tag 2 nach
 * `users.createdAt`, solange der Nutzer keine Aufgabe hat.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runWelcomeStepsPush = async (
	now: Date = new Date(),
	send?: PushSender,
): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		if (user.taskPushEnabled === false) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		const registrierungsTag = tagIn(user.createdAt, zeitzone);
		if (tageZwischen(registrierungsTag, tagIn(now, zeitzone)) !== 2) {
			continue;
		}
		if ((await Task.count({ where: { userId: user.id } })) > 0) {
			continue;
		}
		const { sent } = await sendDedupedPush(
			user.id,
			KIND,
			String(user.id),
			{ ...TEXTE[spracheVon(user.sprache)], url: PUSH_TARGETS.welcomeSteps },
			send,
			now,
		);
		if (sent > 0) {
			usersNotified++;
		}
	}
	return { usersNotified };
};
