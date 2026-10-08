import { NotificationLog, User } from '../models/index.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendPushToUser, type PushSender } from './push.js';

/**
 * Fachlicher Push-Trigger „Meilenstein erreicht" (#1363): überschreitet ein Nutzer beim Erledigen
 * einer Aufgabe eine Streak- oder Punkte-Schwelle (`berechneMeilensteine`, `logics/milestones.ts`),
 * erhält er je neu erreichtem Meilenstein genau eine lobende Push-Nachricht. Wie
 * {@link notifyTaskCreated} verhindert der Auslöser über {@link NotificationLog} (eigener `kind`,
 * `dedupeKey` = `<userId>:<schluessel>`) eine doppelte Meldung — auch über Prozessgrenzen hinweg.
 */

const KIND = 'milestone';

interface Meilenstein {
	schluessel: string;
	typ: 'streak' | 'punkte';
	schwelle: number;
	erreicht: boolean;
}

/** Lobender Nachrichtentext je Meilenstein-Typ. */
const TEXTE: Record<CareSprache, { titel: string; streak: string; punkte: string }> = {
	de: {
		titel: 'Meilenstein erreicht!',
		streak: '{n} Tage Streak am Stück — stark durchgehalten!',
		punkte: '{n} Punkte gesammelt — weiter so!',
	},
	en: {
		titel: 'Milestone reached!',
		streak: '{n}-day streak in a row — great perseverance!',
		punkte: '{n} points collected — keep it up!',
	},
};

const meilensteinText = (meilenstein: Meilenstein, sprache: CareSprache): { title: string; body: string } => {
	const texte = TEXTE[sprache];
	const streak = meilenstein.typ === 'streak';
	return {
		title: `${texte.titel} ${streak ? '🔥' : '🎉'}`,
		body: (streak ? texte.streak : texte.punkte).replace('{n}', String(meilenstein.schwelle)),
	};
};

/**
 * Benachrichtigt den Nutzer über neu erreichte Meilensteine — der Übergang `erreicht: false` (vorher)
 * → `erreicht: true` (nachher) je `schluessel`. Mehrere gleichzeitig neu erreichte Meilensteine lösen
 * mehrere Nachrichten aus (kein Bündeln). Bereits vorher erreichte Meilensteine (kein echter Übergang)
 * und bereits protokollierte (Dedupe über `NotificationLog`) lösen nichts aus.
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const notifyReachedMilestones = async (
	userId: number,
	vorher: Meilenstein[],
	nachher: Meilenstein[],
	send?: PushSender,
): Promise<void> => {
	const warVorherErreicht = new Set(vorher.filter((m) => m.erreicht).map((m) => m.schluessel));
	const neuErreicht = nachher.filter((m) => m.erreicht && !warVorherErreicht.has(m.schluessel));

	const sprache =
		neuErreicht.length > 0 ? spracheVon((await User.findByPk(userId, { attributes: ['sprache'] }))?.sprache) : 'de';
	for (const meilenstein of neuErreicht) {
		const dedupeKey = `${userId}:${meilenstein.schluessel}`;
		const alreadySent = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
		if (alreadySent) {
			continue;
		}
		const { sent } = await sendPushToUser(userId, { ...meilensteinText(meilenstein, sprache), url: '/' }, send);
		if (sent > 0) {
			await NotificationLog.create({ userId, kind: KIND, dedupeKey, sentAt: new Date() });
		}
	}
};
