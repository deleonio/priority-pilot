import { Op } from 'sequelize';
import { NotificationLog, Task, User } from '../models/index.js';
import { istRuhezeit } from './carePush.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendDedupedPush } from './dedupedPush.js';
import { effectivePlan } from './plans.js';
import { type PushSender } from './push.js';
import { PUSH_TARGETS } from './pushTargets.js';
import { nutzerZeitzone, tagIn } from './streak.js';

/**
 * Tipps-Hinweis „Funktionen, die zu dir passen“ (#2856, push-konzept.md §8): Werbung mit strengeren
 * Regeln als alle anderen Pushes — nur mit Opt-in (`tipPushEnabled`, Default aus), nur für
 * Free-Konten, nie in den ersten 7 Tagen nach der Registrierung, höchstens alle 30 Tage genau
 * ein Push. Nutzungssignal (mindestens drei Aufgaben): mit Koordinaten → Ortserinnerungen,
 * für andere angelegt → Gruppen; beide Signale → Ort zuerst. Ruhezeit-Skip OHNE Log-Eintrag
 * (sonst frisst die Dedupe die Nachholung, Muster {@link ./aboPush.js}); das 30-Tage-Fenster-Gate
 * liest NotificationLog (`sentAt >= now − 30 Tage`), der DedupeKey trägt den lokalen Kalendertag —
 * ein statischer Schlüssel würde aus „höchstens alle 30 Tage“ „einmal jemals“ machen. Versand über
 * {@link sendDedupedPush} (Budget-Tor + Gruppen-Tag; KEIN Service-Kind, verdrängte Sends bleiben
 * ohne Log und blocken das Fenster nicht). Tap-Ziel `/settings/pakete`. Texte bieten einen Nutzen
 * an, ohne Fürsorge/Balance mit einem Kauf zu verknüpfen (ADR 0018 Grundsatz 3,
 * docs/fuersorge-tonalitaet.md). Muster: `aboPush.ts`, `monthlyRecapPush.ts`.
 */

export const TIP_PUSH_KIND = 'tip-push';

const TAG_MS = 24 * 60 * 60 * 1000;
/** Mindestalter des Kontos (§8: nie in den ersten 7 Tagen nach der Registrierung). */
const MINDESTALTER_TAGE = 7;
/** Fenster-Gate: kein zweiter Hinweis binnen 30 Tagen nach der letzten Zustellung (§8). */
const FENSTER_MS = 30 * TAG_MS;
/** Nutzungssignal: mindestens so viele passende Aufgaben je Art (§8-Kandidaten). */
const SIGNAL_SCHWELLE = 3;

type TipArt = 'ort' | 'gruppe';

export const TIP_PUSH_TEXTE: Record<TipArt, Record<CareSprache, { title: string; body: string }>> = {
	ort: {
		de: {
			title: 'Erinnerungen an deinen Orten',
			body: 'Deine Aufgaben mit Ort können sich melden, wenn du in der Nähe bist. Das kann Plus.',
		},
		en: {
			title: 'Reminders at your places',
			body: 'Your tasks with a place can remind you when you are nearby. Plus can do that.',
		},
	},
	gruppe: {
		de: {
			title: 'Gemeinsam mit Gruppen',
			body: 'Du legst schon Aufgaben für andere an. Mit Gruppen teilst du sie an einem Ort – das kann Plus.',
		},
		en: {
			title: 'Together with groups',
			body: 'You already create tasks for others. Groups keep them in one place – Plus can do that.',
		},
	},
};

/**
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runTipPush = async (now: Date = new Date(), send?: PushSender): Promise<{ sends: number }> => {
	const users = await User.findAll();
	let sends = 0;
	for (const user of users) {
		// Einwilligung (Schalter „Tipps und Angebote“, Default aus — Livegang-Gate AK7).
		if (!user.tipPushEnabled) {
			continue;
		}
		// Nur für Free-Konten (§8); unbekannte Paketwerte gelten als free (`effectivePlan`).
		if (effectivePlan(user.plan) !== 'free') {
			continue;
		}
		// Nie in den ersten 7 Tagen nach der Registrierung (§8).
		if (user.createdAt != null && now.getTime() - user.createdAt.getTime() < MINDESTALTER_TAGE * TAG_MS) {
			continue;
		}
		const zeitzone = nutzerZeitzone(user.zeitzone);
		// Ruhezeit-Skip schreibt bewusst keinen Log-Eintrag — sonst würde der blockierte Lauf die
		// Nachholung im Tagesfenster wegdeduppen (Muster aboPush).
		if (istRuhezeit(now, zeitzone)) {
			continue;
		}
		// 30-Tage-Fenster (§8): die letzte Zustellung dieses Kinds blockt.
		const zugestellt = await NotificationLog.findOne({
			where: { kind: TIP_PUSH_KIND, userId: user.id, sentAt: { [Op.gte]: new Date(now.getTime() - FENSTER_MS) } },
		});
		if (zugestellt) {
			continue;
		}
		// Nutzungssignal Ort zuerst (§8); „Aufgaben mit Ort“ = Koordinaten gesetzt, Freitext-Adressen zählen nicht.
		const ortsAufgaben = await Task.count({ where: { userId: user.id, latitude: { [Op.ne]: null } } });
		let art: TipArt | null = ortsAufgaben >= SIGNAL_SCHWELLE ? 'ort' : null;
		if (art === null) {
			// „Für andere angelegt“: eigene Autorenschaft UND fremder Empfänger ODER Gruppe.
			const fremdAufgaben = await Task.count({
				where: {
					createdById: user.id,
					[Op.or]: [{ userId: { [Op.ne]: user.id } }, { groupId: { [Op.ne]: null } }],
				},
			});
			art = fremdAufgaben >= SIGNAL_SCHWELLE ? 'gruppe' : null;
		}
		if (art === null) {
			continue;
		}
		// DedupeKey mit Zeitbezug (lokaler Kalendertag) — statisch wäre „einmal jemals“ statt „alle 30 Tage“.
		const dedupeKey = `${user.id}:${tagIn(now, zeitzone)}`;
		const { sent } = await sendDedupedPush(
			user.id,
			TIP_PUSH_KIND,
			dedupeKey,
			{ ...TIP_PUSH_TEXTE[art][spracheVon(user.sprache)], url: PUSH_TARGETS.tipps },
			send,
			// Fenster-Gate und Budget folgen dem Laufzeitpunkt, nicht der Wanduhr (Scheduler-Tick).
			now,
		);
		if (sent > 0) {
			sends += 1;
		}
	}
	return { sends };
};
