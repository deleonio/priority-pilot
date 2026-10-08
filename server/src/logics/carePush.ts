import { NotificationLog, Pillar, ScoreEntry, Task, User } from '../models/index.js';
import type { PillarWithContribution } from '../models/task.js';
import { bewerteCareDefizit } from './careDeficit.js';
import type { BalanceSaeule, KadenzTask } from './heartBalance.js';
import { CARE_SPRACHEN, spracheVon, type CareSprache } from './careSuggestionData.js';
import { sendPushToUser, type PushSender } from './push.js';
import { istGueltigeZeitzone } from './streak.js';

/**
 * Fachlicher Push-Trigger „Fürsorge-Hinweise“ (#1794): schickt höchstens **einen** gebündelten
 * Push je Nutzer und lokalem Kalendertag, wenn eine Säule deutlich defizitär oder überlastet ist
 * (Auswertung über {@link bewerteCareDefizit} aus #1790 — Konstanten werden importiert, nie
 * kopiert). Zwischen 21:00 und 08:00 der Nutzer-Zeitzone wird nicht zugestellt; ohne gültige
 * Zeitzone fällt der Lauf auf UTC zurück (AK8). Der eigene Schalter `users.carePushEnabled`
 * stoppt nur diesen Trigger — Frist-Erinnerungen (`dueTaskReminders.ts`) bleiben unberührt.
 *
 * Muster: `dueTaskReminders.ts` (gebündelte Nachricht, NotificationLog-Dedup erst nach
 * `sent > 0`, injizierbarer PushSender). Der Dedup-Key ist `<userId>:<lokalesISO-Datum>` —
 * das lokale Datum folgt der Nutzer-Zeitzone (Intl), nicht UTC.
 */

const KIND = 'care-push';

type CareSituation = 'defizit' | 'ueberlast';

/** Titel/Text einer Push-Nachricht (der Service Worker `push-sw.js` liest genau diese Felder). */
export interface CarePushText {
	titel: string;
	text: string;
}

/** Ein Katalog-Eintrag: Volltexte je Situation und kanonischer Säule (`pillarData.ts`-Ids 1–5). */
export interface CarePushKatalogEintrag {
	situation: CareSituation;
	saeuleId: number;
	texte: Record<CareSprache, CarePushText>;
}

/**
 * Volltexte aus dem Ton-Leitfaden (`docs/fuersorge-tonalitaet.md` §4/§5) — warm, nicht belehrend,
 * ein bis zwei Sätze. Erste Aufzählungsebene: Situation, zweite: Säule-Id, dritte: Sprache.
 */
const VOLLTEXTE: Record<CareSituation, Record<number, Record<CareSprache, string>>> = {
	defizit: {
		1: {
			de: 'Dein Körper könnte eine Pause gebrauchen. Ein kurzer Spaziergang oder etwas früher ins Bett tut heute schon viel – klein anfangen zählt.',
			en: 'Your body could use a break. A short walk or an earlier night’s sleep already helps a lot – starting small counts.',
		},
		2: {
			de: 'Innere Pausen sind gerade knapp. Fünf Minuten ohne Bildschirm zum Durchatmen können heute schon spürbar entlasten.',
			en: 'Moments of rest are in short supply right now. Five screen-free minutes to breathe can already bring noticeable relief today.',
		},
		3: {
			de: 'Ein kurzes „Wie geht’s?“ an einen Menschen, der dir wichtig ist, könnte heute guttun – für euch beide.',
			en: 'A quick „How are you?“ to someone who matters to you could do good today – for both of you.',
		},
		4: {
			de: 'Ein kleiner, abgeschlossener Schritt kann heute guttun: eine Sache anfangen und zu Ende bringen. Fortschritt darf klein sein.',
			en: 'One small completed step can feel good today: start one thing and see it through. Progress is allowed to be small.',
		},
		5: {
			de: 'Was gibt dir gerade Halt? Eine kurze Notiz über das, was dir wichtig ist, kann heute Orientierung schenken.',
			en: 'What gives you a sense of grounding right now? A short note about what matters to you can offer orientation today.',
		},
	},
	ueberlast: {
		1: {
			de: 'Du hast deinen Körper zuletzt viel gefordert. Es ist gut, heute bewusst etwas kürzer zu treten – Regeneration ist Teil des Plans.',
			en: 'You have asked a lot of your body lately. It’s good to take it a little easier today – recovery is part of the plan.',
		},
		2: {
			de: 'Viele Gedanken wollen gerade Platz. Nimm dir für heute eine Sache weniger vor – dein Kopf darf Auszeit haben.',
			en: 'A lot of thoughts are competing for space. Plan one thing less for today – your mind deserves a break.',
		},
		3: {
			de: 'Du bist zuletzt viel für andere da gewesen. Es ist in Ordnung, heute Kraft für dich zu sammeln.',
			en: 'You have been there a lot for others lately. It is okay to gather some strength for yourself today.',
		},
		4: {
			de: 'Deine Liste ist lang, dein Tag hat Grenzen. Wähle eine Sache, die heute wirklich zählt – der Rest darf warten.',
			en: 'Your list is long and your day has limits. Pick the one thing that truly matters today – the rest can wait.',
		},
		5: {
			de: 'Nicht jede Frage braucht heute eine Antwort. Es ist erlaubt, das große Ganze eine Weile ruhen zu lassen.',
			en: 'Not every question needs an answer today. It is allowed to let the big picture rest for a while.',
		},
	},
};

/**
 * Teilt einen Volltext in Push-Titel (erster Satz) und Push-Text (Rest). Satzenden werden nur
 * bei Satzzeichen gefolgt von Leerzeichen und anschließendem Buchstaben erkannt — verhindert
 * falsche Splits an Abkürzungen und innerhalb französischer/Anführungs-Zitate („… ? “).
 */
const splitTitelText = (volltext: string): CarePushText => {
	for (let i = 0; i < volltext.length - 2; i++) {
		const zeichen = volltext[i];
		const satzende = zeichen === '.' || zeichen === '!' || zeichen === '?';
		if (satzende && volltext[i + 1] === ' ' && /\p{L}/u.test(volltext[i + 2])) {
			const text = volltext.slice(i + 2).trim();
			return { titel: volltext.slice(0, i + 1), text: text || volltext };
		}
	}
	return { titel: volltext, text: volltext };
};

/** Katalog je Situation × kanonischer Säule × Sprache — verbraucht von Tests und {@link pushTextFuer}. */
export const CARE_PUSH_TEXTE: CarePushKatalogEintrag[] = Object.entries(VOLLTEXTE).flatMap(([situation, jeSaeule]) =>
	Object.entries(jeSaeule).map(([saeuleId, texte]) => {
		const katalogtexte = {} as Record<CareSprache, CarePushText>;
		for (const sprache of CARE_SPRACHEN) {
			katalogtexte[sprache] = splitTitelText(texte[sprache]);
		}
		return {
			situation: situation as CareSituation,
			saeuleId: Number(saeuleId),
			texte: katalogtexte,
		};
	}),
);

/** Generische Fallback-Texte für unbekannte (eigene) Säulen — ebenso warm und kurz, je Sprache. */
const FALLBACK: Record<CareSituation, Record<CareSprache, CarePushText>> = {
	defizit: {
		de: {
			titel: 'Eine deiner Säulen kommt gerade zu kurz.',
			text: 'Ein kleiner Schritt heute genügt – klein anfangen zählt.',
		},
		en: {
			titel: 'One of your pillars is running low right now.',
			text: 'One small step today is enough – starting small counts.',
		},
	},
	ueberlast: {
		de: { titel: 'Eine deiner Säulen trägt gerade viel.', text: 'Erlaube dir heute, etwas kürzer zu treten.' },
		en: {
			titel: 'One of your pillars is carrying a lot right now.',
			text: 'It is okay to take it a little easier today.',
		},
	},
};

/** Text zur Situation und Säule; unbekannte Säulen (Id > 5) bekommen den generischen Fallback. */
export const pushTextFuer = (situation: CareSituation, saeuleId: number, sprache: CareSprache): CarePushText =>
	CARE_PUSH_TEXTE.find((eintrag) => eintrag.situation === situation && eintrag.saeuleId === saeuleId)?.texte[sprache] ??
	FALLBACK[situation][sprache];

/** Lokales ISO-Datum (`YYYY-MM-DD`) in der Nutzer-Zeitzone; ohne gültige Zone in UTC. */
const lokalesDatum = (datum: Date, zeitzone: string | null): string =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: zeitzone ?? 'UTC',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(datum);

/** Stunde (0–23, `h23`) und Minute in der Zeitzone. */
export const uhrzeitIn = (datum: Date, zeitzone: string): { stunde: number; minute: number } => {
	const teile = new Intl.DateTimeFormat('en-GB', {
		timeZone: zeitzone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(datum);
	const [stunde, minute] = teile.split(':').map(Number);
	return { stunde, minute };
};

/** Ruhezeit 21:00–08:00 (Grenze 08:00 selbst ist erlaubt) in der Nutzer-Zeitzone. */
const istRuhezeit = (datum: Date, zeitzone: string): boolean => {
	const { stunde } = uhrzeitIn(datum, zeitzone);
	return stunde >= 21 || stunde < 8;
};

/**
 * Versendet je Nutzer höchstens eine Fürsorge-Nachricht pro lokalem Kalendertag. Ruhezeit-Skip
 * und Schalter-aus schreiben bewusst **keinen** Log-Eintrag — sonst würde der fehlgeschlagene/
 * blockierte Lauf den eigentlichen Versand am selben Tag wegdeduppen.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runCarePush = async (now: Date = new Date(), send?: PushSender): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		// AK4: der eigene Schalter stoppt nur den Fürsorge-Push (Default ein — der Schalter „schaltet ab“).
		if (user.carePushEnabled === false) {
			continue;
		}
		const saeulen = await Pillar.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] });
		if (saeulen.length === 0) {
			continue;
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
		const defizite = bewerteCareDefizit(balanceSaeulen, kadenzTasks, now);
		// Überlast hat Vorrang (Erlaubnis zum Kürzen schlägt den Schritt-Vorschlag), sonst die erste
		// defizitäre Säule (Ids aufsteigend — `bewerteCareDefizit` behält die Reihenfolge bei).
		const ueberlastete = defizite.filter((eintrag) => eintrag.ueberlast);
		const defizitaere = defizite.filter((eintrag) => eintrag.defizitaer);
		const situation: CareSituation | null =
			ueberlastete.length > 0 ? 'ueberlast' : defizitaere.length > 0 ? 'defizit' : null;
		if (!situation) {
			continue;
		}
		const betroffeneSaeule = (ueberlastete.length > 0 ? ueberlastete : defizitaere)[0];
		// AK2/AK8: Ruhezeit in der Nutzer-Zeitzone; ungültige/fehlende Zone fällt auf 'UTC' zurück.
		const zeitzone = istGueltigeZeitzone(user.zeitzone ?? undefined) ? (user.zeitzone as string) : 'UTC';
		if (istRuhezeit(now, zeitzone)) {
			continue;
		}
		const dedupeKey = `${user.id}:${lokalesDatum(now, zeitzone)}`;
		const bereitsGesendet = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
		if (bereitsGesendet) {
			continue;
		}
		const sprache = spracheVon(user.sprache);
		const text = pushTextFuer(situation, betroffeneSaeule.id, sprache);
		const { sent } = await sendPushToUser(user.id, { title: text.titel, body: text.text, url: '/' }, send);
		if (sent > 0) {
			await NotificationLog.create({ userId: user.id, kind: KIND, dedupeKey, sentAt: now });
			usersNotified++;
		}
	}
	return { usersNotified };
};
