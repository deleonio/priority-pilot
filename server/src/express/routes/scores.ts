import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { Dependency, Pillar, ScoreEntry, Task, MissedTask, User } from '../../models/index.js';
import { adviseActivitiesWithMistral, type ActivityAdvisor } from '../../llm/llm.js';
import { effectivePlan } from '../../logics/plans.js';
import { createAiQuotaCounter } from '../aiQuotaMeter.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from '../../logics/score.js';
import {
	berechneStreak,
	berechneWochenAusgewogen,
	istGueltigeZeitzone,
	streakZeitpunkte,
	tagIn,
} from '../../logics/streak.js';
import { meilensteinStandVon } from '../../logics/milestones.js';
import MilestoneReached from '../../models/milestoneReached.js';
import { berechneLebensbalanceNachKadenz } from '../../logics/heartBalance.js';
import { berechneBalanceVerlauf, istGueltigesDatum, zeitraumInTagen } from '../../logics/balanceHistory.js';
import { resolvePillarDescription } from '../../models/pillarData.js';
import CareSuggestionDismissal from '../../models/careSuggestionDismissal.js';
import CareSuggestionRejection from '../../models/careSuggestionRejection.js';
import type { PillarWithContribution } from '../../models/task.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import {
	PAUSE_VORLAGE_KEY,
	saeulenBeitraegeFuerZiel,
	waehleCareVorschlaege,
	waehleErholungsVorschlaege,
	type CareAufgabe,
	type CareVorlage,
} from '../../logics/careSuggestions.js';
import { CARE_SPRACHEN, CARE_VORLAGEN, type CareSprache } from '../../logics/careSuggestionData.js';
import { bewerteCareDefizit } from '../../logics/careDeficit.js';
import { protokolliereCareReaktion } from '../../logics/careWirkung.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];
type ScoreEntryDto = components['schemas']['ScoreEntry'];
type PillarScoreDto = components['schemas']['PillarScore'];
type StreakDto = components['schemas']['Streak'];
type MilestoneDto = components['schemas']['Milestone'];
type MissedTasksSummaryDto = components['schemas']['MissedTasksSummary'];
type BalanceStatusDto = components['schemas']['BalanceStatus'];
type BalanceHistoryEntryDto = components['schemas']['BalanceHistoryEntry'];
type MonthlyRecapDto = components['schemas']['MonthlyRecap'];
type YearlyRecapDto = components['schemas']['YearlyRecap'];
type CareVorschlagDto = components['schemas']['CareVorschlag'];
type CareRejectionDto = components['schemas']['CareSuggestionRejection'];

/** Ein Zeitraum darf höchstens so viele Tage umfassen — deckelt die Antwortgröße von `/scores/balance/history`. */
const MAX_BALANCE_HISTORY_TAGE = 366;

/** Maximale Anzahl der in der Zusammenfassung mitgelieferten Einzel-Einträge. */
const MISSED_TASKS_LIST_LIMIT = 20;

/** Löst den `sprache`-Query-Parameter auf: bekannte App-Sprache oder Default `de`. */
const loeseSprache = (query: unknown): CareSprache =>
	typeof query === 'string' && (CARE_SPRACHEN as readonly string[]).includes(query) ? (query as CareSprache) : 'de';

export const scoresRouter = Router();

// GET /scores — vergebene Gamification-Punkte je erledigtem Task.
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/by-pillar).
scoresRouter.get('/scores', async (req: Request, res: Response<ScoreEntryDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)) }],
			order: [['id', 'ASC']],
		});
		res.json(
			entries.map((entry) => ({
				taskId: entry.taskId,
				punkte: entry.punkte,
				pünktlich: entry.pünktlich,
				zeitpunkt: entry.zeitpunkt.toISOString(),
			})),
		);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/by-pillar — Punkte anteilig (über `share`) je Säule aggregiert (Balance-Stand).
// Nur Tasks des eingeloggten Nutzers (AK5, #422).
scoresRouter.get('/scores/by-pillar', async (req: Request, res: Response<PillarScoreDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)), include: [Pillar] }],
		});
		const beitraege: PunkteBeitrag[] = entries.map((entry) => {
			const pillars: PillarWithContribution[] = entry.Task?.Pillars ?? [];
			return {
				punkte: entry.punkte,
				beitraege: pillars.map((pillar) => ({ pillarId: pillar.id, share: pillar.TaskPillar.share })),
			};
		});
		const summen = aggregierePunkteProSaeule(beitraege);
		res.json([...summen.entries()].map(([pillarId, punkte]) => ({ pillarId, punkte })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/** Säulen einer erledigten Aufgabe, die für „Wochen ausgewogen" zählen (#1971): Anteil > 0. */
const saeulenIdsVon = (pillars: PillarWithContribution[] | undefined): number[] =>
	(pillars ?? []).filter((pillar) => pillar.TaskPillar.share > 0).map((pillar) => pillar.id);

// GET /scores/streak — Kalendertage in Folge mit mindestens einer Erledigung plus Bestmarke (#1360).
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/by-pillar).
scoresRouter.get('/scores/streak', async (req: Request, res: Response<StreakDto | ErrorDto>) => {
	try {
		const userId = getUserId(req);
		const [entries, saeulen] = await Promise.all([
			ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId), include: [Pillar] }] }),
			Pillar.findAll({ where: ownerScope(userId) }),
		]);
		// Der Client schickt seine IANA-Zeitzone mit (`?tz=`); ohne oder mit unbekanntem Wert wertet
		// der Server in seiner eigenen Zeitzone aus — die Anzeige verschiebt sich, es gibt keinen Fehler.
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { aktuell, best, aktiveTage } = berechneStreak(
			streakZeitpunkte(
				entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
				zeitZone,
			),
			new Date(),
			zeitZone,
		);
		const wochenAusgewogen = berechneWochenAusgewogen(
			entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, saeulenIds: saeulenIdsVon(entry.Task?.Pillars) })),
			saeulen,
			new Date(),
			zeitZone,
		);
		res.json({ aktuell, best, letzterTag: aktiveTage[aktiveTage.length - 1] ?? null, wochenAusgewogen });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/milestones — feste Streak-/Punkte-Stufen, rückwirkend aus Bestandsdaten (#1362),
// einmal erreicht bleibt erreicht (#1965): Stand, Merge und Persistierung in `meilensteinStandVon`
// (Scoping dort, Muster /scores/streak).
scoresRouter.get('/scores/milestones', async (req: Request, res: Response<MilestoneDto[] | ErrorDto>) => {
	try {
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		res.json(await meilensteinStandVon(getUserId(req), zeitZone));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/missed — Aufgaben, die der Auto-Delete-Cron wegen abgelaufener Deadline gelöscht hat
// (Sichtbarkeit im Bewertungssystem, rein informativ). Fließt bewusst NICHT in `berechneScore`,
// `berechneStreak` oder `berechneMeilensteine` ein — keine Minuspunkte, kein Streak-Malus. Da die
// Original-Aufgabe nach dem Löschen nicht mehr existiert, gibt es keine `Task`-Assoziation zu scopen;
// `userId` ist auf `MissedTask` denormalisiert (siehe models/index.ts).
scoresRouter.get('/scores/missed', async (req: Request, res: Response<MissedTasksSummaryDto | ErrorDto>) => {
	try {
		const { count: anzahl, rows: entries } = await MissedTask.findAndCountAll({
			where: ownerScope(getUserId(req)),
			order: [['verpasstAm', 'DESC']],
			limit: MISSED_TASKS_LIST_LIMIT,
		});
		res.json({
			anzahl,
			eintraege: entries.map((entry) => ({
				taskId: entry.taskId,
				title: entry.title,
				deadline: entry.deadline.toISOString(),
				verpasstAm: entry.verpasstAm.toISOString(),
			})),
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/balance — der Stand des Dashboard-Herzens in einer Antwort (#1423): Füllstand, Säulen
// mit Punktestand und Gewichtung, Streak und die erreichten Meilensteine. Bündelt, was ein
// MCP-Client sonst über drei Aufrufe zusammensuchen müsste.
//
// Punktequelle ist — wie beim Herzen selbst — der anteilig auf die Säulen verteilte **erledigte
// Aufwand** (siehe logics/heartBalance.ts), NICHT die Gamification-Punkte aus /scores/by-pillar.
// Gescopet wird strikt mit `ownerScope` auf Säulen und Tasks: die seit #1213 breitere Task-Leseliste
// (gruppengeteilte fremde Aufgaben, routes/tasks.ts) gehört bewusst nicht in die eigene Balance.
scoresRouter.get('/scores/balance', async (req: Request, res: Response<BalanceStatusDto | ErrorDto>) => {
	try {
		const userId = getUserId(req);
		const [saeulen, tasks, entries] = await Promise.all([
			Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
			Task.findAll({ where: ownerScope(userId), include: [Pillar] }),
			ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
		]);

		// Kadenz-Modell (#1638): der Füllstand misst die Erledigungen der letzten 28 Tage gegen den
		// Soll-Rhythmus je Säule; Erledigt-Zeitpunkt ist `ScoreEntry.zeitpunkt` (ohne Eintrag: nur `punkte`).
		const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));
		const balanceSaeulen = saeulen.map((saeule) => ({
			id: saeule.id,
			key: saeule.key,
			name: saeule.name,
			weight: saeule.weight,
		}));
		const kadenzTasks = tasks.map((task) => ({
			status: task.status,
			estimatedEffort: task.estimatedEffort,
			pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
				pillarId: pillar.id,
				share: pillar.TaskPillar.share,
			})),
			erledigtAm: zeitpunktProTask.get(task.id) ?? null,
		}));
		const jetzt = new Date();
		const balance = berechneLebensbalanceNachKadenz(balanceSaeulen, kadenzTasks, jetzt);
		const defizite = bewerteCareDefizit(balanceSaeulen, kadenzTasks, jetzt);

		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { aktuell, best, aktiveTage } = berechneStreak(
			streakZeitpunkte(
				entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
				zeitZone,
			),
			new Date(),
			zeitZone,
		);

		// Säulen je Erledigung aus der schon geladenen Task-Liste — kein weiterer findAll (#2157).
		const saeulenIdsProTask = new Map(tasks.map((task) => [task.id, saeulenIdsVon(task.Pillars)]));
		const wochenAusgewogen = berechneWochenAusgewogen(
			entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, saeulenIds: saeulenIdsProTask.get(entry.taskId) ?? [] })),
			saeulen,
			new Date(),
			zeitZone,
		);

		// Die bereits geladene ScoreEntry-Liste an `meilensteinStandVon` durchreichen (#2150):
		// ein Balance-Request liest ScoreEntries nur einmal (sonst zweiter findAll in der Logik).
		// Seit #2157 auch die berechneten Werte: die Streak-Berechnung läuft je Request genau einmal.
		const punkteSumme = entries.reduce((summe, entry) => summe + entry.punkte, 0);
		const meilensteinStand = await meilensteinStandVon(userId, zeitZone, {
			entries,
			bestStreak: best,
			punkteSumme,
		});

		res.json({
			// Eine Dezimalstelle: der Füllstand schwankt mit jeder Erledigung, mehr Stellen wären
			// Rauschen. Die Säulen-Punkte bleiben roh, damit ein Client selbst weiterrechnen kann.
			fuellstandProzent: Math.round(balance.fill * 1000) / 10,
			hatPunkte: balance.hasPoints,
			// Trend/Defizit je Säule aus `bewerteCareDefizit` (#1796) — dieselbe Quelle wie /scores/care-suggestions.
			saeulen: balance.saeulen.map((saeule) => {
				const bewertung = defizite.find((defizit) => defizit.id === saeule.id);
				return { ...saeule, trend: bewertung?.trend ?? 'stabil', defizitaer: bewertung?.defizitaer ?? false };
			}),
			streak: { aktuell, best, letzterTag: aktiveTage[aktiveTage.length - 1] ?? null, wochenAusgewogen },
			// Nur die erreichten Stufen: die vollständige Stufenliste liefert /scores/milestones.
			// Sticky-Stand (#1965): einmal erreichte Stufen bleiben erhalten, der Leselauf persistiert.
			meilensteine: meilensteinStand.filter((meilenstein) => meilenstein.erreicht),
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/balance/history — Verlauf der Lebensbalance über einen Zeitraum (#1424): je Kalendertag
// des geschlossenen Intervalls `[von, bis]` genau ein Eintrag, kumulierend gerechnet aus den
// Erledigungszeitpunkten (`ScoreEntry.zeitpunkt`). Gescopet wie `/scores/balance` strikt mit
// `ownerScope` auf Säulen und Tasks.
scoresRouter.get(
	'/scores/balance/history',
	async (req: Request, res: Response<BalanceHistoryEntryDto[] | ErrorDto>) => {
		try {
			const { von, bis } = req.query;
			if (typeof von !== 'string' || typeof bis !== 'string') {
				sendError(res, 400, '"von" und "bis" sind Pflichtparameter (Format YYYY-MM-DD).');
				return;
			}
			if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) {
				sendError(res, 400, '"von" und "bis" müssen ein existierendes Datum im Format YYYY-MM-DD angeben.');
				return;
			}
			if (bis < von) {
				sendError(res, 400, '"bis" darf nicht vor "von" liegen.');
				return;
			}
			if (zeitraumInTagen(von, bis) > MAX_BALANCE_HISTORY_TAGE) {
				sendError(res, 400, `Der Zeitraum darf höchstens ${MAX_BALANCE_HISTORY_TAGE} Tage umfassen.`);
				return;
			}

			const userId = getUserId(req);
			const [saeulen, tasks, entries] = await Promise.all([
				Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
				Task.findAll({ where: { ...ownerScope(userId), status: 'Done' }, include: [Pillar] }),
				ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
			]);
			const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));

			const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
			const zeitZone = istGueltigeZeitzone(angefragteZone)
				? angefragteZone
				: Intl.DateTimeFormat().resolvedOptions().timeZone;

			const verlauf = berechneBalanceVerlauf(
				saeulen.map((saeule) => ({ id: saeule.id, key: saeule.key, name: saeule.name, weight: saeule.weight })),
				tasks.map((task) => ({
					status: task.status,
					estimatedEffort: task.estimatedEffort,
					pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
						pillarId: pillar.id,
						share: pillar.TaskPillar.share,
					})),
					zeitpunkt: zeitpunktProTask.get(task.id) ?? null,
				})),
				von,
				bis,
				zeitZone,
			);

			res.json(verlauf);
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

// GET /scores/monthly-recap — Monatsrückblick (#1995): Säulen-Differenz im Monatsfenster — exakt
// die Wochenkarten-Rechnung (#1968, Fenster letzter Tag des Vormonats bis letzter Tag des Monats,
// Spiegel über /scores/balance/history) —, der Streak-Stand zum Monatsende in der Nutzerzeitzone
// und die im Monat neu erreichten Meilensteine (`MilestoneReached.zeitpunkt` — der sticky Bestand
// bleibt außen vor, Auswahl strikt über den Zeitpunkt). Eine Antwort statt drei Roundtrips.
// Gescopet wie /scores/balance strikt mit `ownerScope`.
const MONAT_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Letzter Kalendertag des Monats `JJJJ-MM` als `YYYY-MM-DD`. */
const letzterTagVon = (monat: string): string => {
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	return new Date(Date.UTC(jahr, monatNr, 0)).toISOString().slice(0, 10);
};

/** Vormonat eines Monats `JJJJ-MM` als `JJJJ-MM` (Jahreswechsel-sicher). */
const vormonatVon = (monat: string): string => {
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	return `${jahr + Math.floor((monatNr - 2) / 12)}-${String(((monatNr + 10) % 12) + 1).padStart(2, '0')}`;
};

/**
 * UTC-Zeitpunkt 12:00 eines lokalen Kalendertags in `zeitZone` — Streak-Stichtag „Monatsende".
 * Die Mittagsstunde hält DST-Nähte fern; der Offset wird über `Intl` an genau dieser Naht
 * zurückgerechnet (ein Anker `Date.UTC(jahr, monat, 0) - 1` läge in Zeitzonen östlich von UTC
 * schon im Folgemonat).
 */
const mittagDesTags = (tag: string, zeitZone: string): Date => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number) as [number, number, number];
	const naive = Date.UTC(jahr, monat - 1, tagImMonat, 12);
	const teile = new Intl.DateTimeFormat('en-US', {
		timeZone: zeitZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(new Date(naive));
	const teil = (typ: Intl.DateTimeFormatPartTypes): number => Number(teile.find((p) => p.type === typ)?.value ?? 0);
	const alsUtc = Date.UTC(teil('year'), teil('month') - 1, teil('day'), teil('hour'), teil('minute'), teil('second'));
	return new Date(naive - (alsUtc - naive));
};

scoresRouter.get('/scores/monthly-recap', async (req: Request, res: Response<MonthlyRecapDto | ErrorDto>) => {
	try {
		const monat = typeof req.query.monat === 'string' ? req.query.monat : '';
		if (!MONAT_REGEX.test(monat)) {
			sendError(
				res,
				400,
				'"monat" ist ein Pflichtparameter und muss einen echten Kalendermonat im Format JJJJ-MM benennen.',
			);
			return;
		}
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const userId = getUserId(req);
		const [saeulen, tasks, entries, eigeneMeilensteine] = await Promise.all([
			Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
			Task.findAll({ where: { ...ownerScope(userId), status: 'Done' }, include: [Pillar] }),
			ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
			MilestoneReached.findAll({ where: ownerScope(userId), order: [['zeitpunkt', 'ASC']] }),
		]);
		const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));

		const verlauf = berechneBalanceVerlauf(
			saeulen.map((saeule) => ({ id: saeule.id, key: saeule.key, name: saeule.name, weight: saeule.weight })),
			tasks.map((task) => ({
				status: task.status,
				estimatedEffort: task.estimatedEffort,
				pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
					pillarId: pillar.id,
					share: pillar.TaskPillar.share,
				})),
				zeitpunkt: zeitpunktProTask.get(task.id) ?? null,
			})),
			letzterTagVon(vormonatVon(monat)),
			letzterTagVon(monat),
			zeitZone,
		);
		// Wochenkarten-Muster: Differenz aus dem kumulativen Verlauf — Stand am Monatsende minus
		// Stand zum Fenstereintritt (letzter Tag des Vormonats), eine Dezimalstelle.
		const standFensterEintritt = new Map((verlauf[0]?.saeulen ?? []).map((s) => [s.id, s.punkte]));
		const monatsSaeulen = (verlauf[verlauf.length - 1]?.saeulen ?? []).map((s) => ({
			id: s.id,
			name: s.name,
			punkte: Math.round((s.punkte - (standFensterEintritt.get(s.id) ?? 0)) * 10) / 10,
		}));

		const { aktuell } = berechneStreak(
			streakZeitpunkte(
				entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
				zeitZone,
			),
			mittagDesTags(letzterTagVon(monat), zeitZone),
			zeitZone,
		);

		res.json({
			monat,
			saeulen: monatsSaeulen,
			streak: aktuell,
			meilensteine: eigeneMeilensteine
				.filter((meilenstein) => tagIn(meilenstein.zeitpunkt, zeitZone).slice(0, 7) === monat)
				.map((meilenstein) => ({ schluessel: meilenstein.schluessel, zeitpunkt: meilenstein.zeitpunkt.toISOString() })),
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/yearly-recap — Jahresrückblick (#1997, Balamentum Wrapped): fünf Kennzahlen des
// Kalenderjahres in der Nutzerzeitzone, Erledigt-Zeitpunkt = `ScoreEntry.zeitpunkt`. Stunden =
// `actualEffort ?? estimatedEffort`; Projekt = im Jahr erledigte Oberaufgabe mit mindestens einer
// Unteraufgabe (`Dependency`); stärkste Säule = größte Differenz des kumulativen Verlaufs
// (Wochen-/Monatskarten-Rechnung). Enthält keine Aufgabeninhalte; gescopet mit `ownerScope`.
const JAHR_REGEX = /^\d{4}$/;

scoresRouter.get('/scores/yearly-recap', async (req: Request, res: Response<YearlyRecapDto | ErrorDto>) => {
	try {
		const jahrText = typeof req.query.jahr === 'string' ? req.query.jahr : '';
		if (!JAHR_REGEX.test(jahrText)) {
			sendError(res, 400, '"jahr" ist ein Pflichtparameter und muss ein vierstelliges Jahr (JJJJ) benennen.');
			return;
		}
		const jahr = Number(jahrText);
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;
		const imJahr = (zeitpunkt: Date): boolean => tagIn(zeitpunkt, zeitZone).slice(0, 4) === jahrText;

		const userId = getUserId(req);
		const [saeulen, tasks, entries] = await Promise.all([
			Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
			Task.findAll({ where: { ...ownerScope(userId), status: 'Done' }, include: [Pillar] }),
			ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
		]);
		const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));
		const erledigtImJahr = tasks.filter((task) => {
			const zeitpunkt = zeitpunktProTask.get(task.id);
			return zeitpunkt !== undefined && imJahr(zeitpunkt);
		});

		const stunden = erledigtImJahr.reduce((summe, task) => summe + (task.actualEffort ?? task.estimatedEffort), 0);
		const eltern = await Dependency.findAll({
			where: { dependentTaskId: erledigtImJahr.map((task) => task.id) },
			attributes: ['dependentTaskId'],
		});

		const verlauf = berechneBalanceVerlauf(
			saeulen.map((saeule) => ({ id: saeule.id, key: saeule.key, name: saeule.name, weight: saeule.weight })),
			tasks.map((task) => ({
				status: task.status,
				estimatedEffort: task.estimatedEffort,
				pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
					pillarId: pillar.id,
					share: pillar.TaskPillar.share,
				})),
				zeitpunkt: zeitpunktProTask.get(task.id) ?? null,
			})),
			`${jahr - 1}-12-31`,
			`${jahr}-12-31`,
			zeitZone,
		);
		const standVorjahr = new Map((verlauf[0]?.saeulen ?? []).map((s) => [s.id, s.punkte]));
		const saeulenDifferenz = (verlauf[verlauf.length - 1]?.saeulen ?? []).map((s) => ({
			id: s.id,
			name: s.name,
			punkte: Math.round((s.punkte - (standVorjahr.get(s.id) ?? 0)) * 10) / 10,
		}));
		// Ohne Punkte oder ohne Unterschied (z. B. nur nicht zugeordnete Aufgaben, die nach Gewicht
		// gleich verteilt werden) gibt es keine stärkste Säule.
		const staerkste = saeulenDifferenz.reduce<(typeof saeulenDifferenz)[number] | null>(
			(beste, saeule) => (saeule.punkte > (beste?.punkte ?? 0) ? saeule : beste),
			null,
		);
		const alleGleich = saeulenDifferenz.every((saeule) => saeule.punkte === saeulenDifferenz[0]?.punkte);

		const { best } = berechneStreak(
			streakZeitpunkte(
				entries.map((entry) => ({ zeitpunkt: entry.zeitpunkt, deadline: entry.Task?.deadline })),
				zeitZone,
			).filter(imJahr),
			mittagDesTags(`${jahr}-12-31`, zeitZone),
			zeitZone,
		);

		res.json({
			jahr,
			erledigteAufgaben: erledigtImJahr.length,
			stunden: Math.round(stunden * 10) / 10,
			laengsterStreak: best,
			staerksteSaeule: alleGleich ? null : staerkste,
			abgeschlosseneProjekte: new Set(eltern.map((e) => e.get('dependentTaskId'))).size,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

/** Obergrenze der bisherigen Aufgaben, die der Berater als Kontext bekommt — hält den Prompt klein. */
const KI_KONTEXT_AUFGABEN = 20;

/**
 * KI-Ergänzung der Fürsorge-Vorschläge für Plus und Pro (#1804): ein Berater-Vorschlag zur ersten
 * defizitären Säule aus den eigenen bisherigen Aufgaben. Höchstens ein Aufruf je Nutzer und
 * Kalendertag (UTC) — `GET /scores/care-suggestions` lädt bei jedem Dashboard-Aufruf; der Tagescache
 * liegt im Speicher (nach Neustart darf neu gebucht werden), Schlüssel wie `fairUseKey` mit
 * `createdAt`, damit eine wiederverwendete ID nichts erbt. Gebucht über `createAiQuotaCounter`
 * (#1783); Drossel, Fehler oder leere Antwort liefern `undefined` — die Antwort bleibt dann bei
 * Bestand und Vorlagen, ohne Fehlerfeld.
 */
const createKiVorschlagErmittler = (advisor: ActivityAdvisor) => {
	const tagesCache = new Map<string, { tag: string; vorschlag: Promise<CareVorschlagDto | undefined> }>();

	const ermittle = async (
		userId: number,
		saeule: Pillar,
		saeulen: Pillar[],
		aufgaben: CareAufgabe[],
	): Promise<CareVorschlagDto | undefined> => {
		const zaehler = await createAiQuotaCounter(userId, false);
		if (zaehler && !(await zaehler.book())) {
			return undefined;
		}
		let vorschlag: CareVorschlagDto | undefined;
		try {
			const titel = aufgaben.slice(-KI_KONTEXT_AUFGABEN).map((aufgabe) => aufgabe.titel);
			const [advice] = await advisor(
				{
					question: `Bisherige Aufgaben: ${titel.join('; ')}. Schlage genau eine Aktivität für die Säule „${saeule.name}“ vor, die zu diesen Aufgaben passt.`,
					pillars: [{ id: saeule.id, name: saeule.name, description: resolvePillarDescription(saeule) }],
				},
				undefined,
				userId,
			);
			if (advice) {
				vorschlag = {
					typ: 'ki',
					titel: advice.activity,
					beschreibung: advice.reason,
					// #2075 AK4: dieselbe vollständige Verteilung wie Vorlagen- und Regelpfad.
					saeulenBeitraege: saeulenBeitraegeFuerZiel(saeule.id, saeulen),
					saeuleId: saeule.id,
					saeuleName: saeule.name,
					anlass: 'defizit',
				};
			}
		} catch {
			vorschlag = undefined;
		}
		if (vorschlag === undefined) {
			await zaehler?.refund();
		}
		return vorschlag;
	};

	return async (
		userId: number | undefined,
		saeule: Pillar | undefined,
		saeulen: Pillar[],
		aufgaben: CareAufgabe[],
		jetzt: Date,
	): Promise<CareVorschlagDto | undefined> => {
		if (typeof userId !== 'number' || saeule === undefined) {
			return undefined;
		}
		const user = await User.findByPk(userId);
		if (user === null || effectivePlan(user.plan) === 'free') {
			return undefined;
		}
		const key = `${user.id}:${user.createdAt.getTime()}`;
		const tag = jetzt.toISOString().slice(0, 10);
		const gespeichert = tagesCache.get(key);
		if (gespeichert?.tag === tag) {
			return gespeichert.vorschlag;
		}
		// #1873: das laufende Promise ohne `await` dazwischen eintragen — parallele Abrufe teilen
		// einen Beraterlauf und eine Buchung.
		const vorschlag = ermittle(userId, saeule, saeulen, aufgaben);
		tagesCache.set(key, { tag, vorschlag });
		// Ein abgelehntes Promise nicht den Tag über cachen — sonst wirft jeder weitere Abruf erneut.
		vorschlag.catch(() => {
			if (tagesCache.get(key)?.vorschlag === vorschlag) {
				tagesCache.delete(key);
			}
		});
		return vorschlag;
	};
};

// GET /scores/care-suggestions — konkrete Vorschläge gegen ein Balance-Defizit (#1791): je
// defizitärer Säule (Defizit-Quelle ist `bewerteCareDefizit` aus #1790, nicht kopiert) bis zu
// drei Einträge — zuerst eigene offene Aufgaben dieser Säule, sonst kuratierte Vorlagen aus
// `careSuggestionData.ts`. Meldet `bewerteCareDefizit` Überlast, stehen davor Erholungsvorschläge
// (`anlass: 'ueberlast'`, #1795). `?sprache=` wählt die Sprache der Vorlagen-Texte (Default `de`).
// Gilt vollständig im Free-Paket (Epic #1780) — bewusst ohne planGuard; Plus/Pro erhalten bei einem
// Defizit ohne Überlast zusätzlich einen KI-Vorschlag an erster Stelle (#1804, #1873,
// `createKiVorschlagErmittler`). Gescopet wie
// `/scores/balance` strikt mit `ownerScope` auf Säulen und Tasks. Factory, damit Tests den Berater
// injizieren (Muster `createPillarAdvisorRouter`).
export const createCareSuggestionsRouter = (advisor: ActivityAdvisor = adviseActivitiesWithMistral): Router => {
	const router = Router();
	const ermittleKiVorschlag = createKiVorschlagErmittler(advisor);

	router.get(
		'/scores/care-suggestions',
		async (req: Request, res: Response<{ vorschlaege: CareVorschlagDto[] } | ErrorDto>) => {
			try {
				const userId = getUserId(req);
				const sprache = loeseSprache(req.query.sprache);
				const jetzt = new Date();
				const [saeulen, tasks, entries, ablehnungen] = await Promise.all([
					Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
					// #1873: nach Anlage sortiert, damit der Berater-Kontext (`slice(-20)`) die neuesten Aufgaben meint.
					Task.findAll({
						where: ownerScope(userId),
						include: [Pillar],
						order: [
							['createdAt', 'ASC'],
							['id', 'ASC'],
						],
					}),
					ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
					CareSuggestionDismissal.findAll({ where: ownerScope(userId) }),
				]);
				const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));

				const aufgaben: CareAufgabe[] = tasks.map((task) => ({
					id: task.id,
					titel: task.title,
					beschreibung: task.description ?? null,
					status: task.status,
					pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
						pillarId: pillar.id,
						share: pillar.TaskPillar.share,
					})),
				}));
				// Texte bereits in Zielsprache auflösen — die Auswahl-Logik bleibt text- und DB-frei.
				const vorlagen: CareVorlage[] = CARE_VORLAGEN.map((vorlage) => ({
					key: vorlage.key,
					saeuleId: vorlage.saeuleId,
					texte: vorlage.texte[sprache],
				}));

				const defizite = bewerteCareDefizit(
					saeulen.map((saeule) => ({ id: saeule.id, key: saeule.key, name: saeule.name, weight: saeule.weight })),
					tasks.map((task) => ({
						status: task.status,
						estimatedEffort: task.estimatedEffort,
						pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
							pillarId: pillar.id,
							share: pillar.TaskPillar.share,
						})),
						erledigtAm: zeitpunktProTask.get(task.id) ?? null,
					})),
					jetzt,
				);

				const ablehnungenDto = ablehnungen.map((ablehnung) => ({
					templateKey: ablehnung.templateKey,
					abgelehntAm: ablehnung.abgelehntAm,
				}));
				// #1795: bei Überlast Erholung (Pause, Körper, Mentale Gesundheit) VOR den Defizit-Vorschlägen.
				const ueberlasteIds = defizite.filter((defizit) => defizit.ueberlast).map((defizit) => defizit.id);
				const erholung: CareVorschlagDto[] =
					ueberlasteIds.length > 0
						? waehleErholungsVorschlaege(saeulen, ueberlasteIds, vorlagen, ablehnungenDto, jetzt).map((vorschlag) => ({
								...vorschlag,
								saeuleName: saeulen.find((saeule) => saeule.id === vorschlag.saeuleId)?.name ?? '',
								anlass: 'ueberlast' as const,
							}))
						: [];

				const defizitVorschlaege: CareVorschlagDto[] = defizite
					.filter((defizit) => defizit.defizitaer)
					.flatMap((defizit) => {
						const saeule = { id: defizit.id, name: defizit.name, weight: 0 };
						const vorlagenDerSaeule = vorlagen.filter(
							(vorlage) => vorlage.saeuleId === saeule.id && vorlage.key !== PAUSE_VORLAGE_KEY,
						);
						return waehleCareVorschlaege(saeule, saeulen, aufgaben, vorlagenDerSaeule, ablehnungenDto, jetzt).map(
							(vorschlag) => ({
								...vorschlag,
								saeuleId: defizit.id,
								saeuleName: defizit.name,
								anlass: 'defizit' as const,
							}),
						);
					});
				const ersteDefizitSaeule = saeulen.find((saeule) => defizite.some((d) => d.defizitaer && d.id === saeule.id));
				// #1873: KI vor den Defizit-Vorschlägen (der Hinweis zeigt nur den ersten); bei Überlast steht
				// Erholung vorn — dann kein Beraterlauf, damit nur gebucht wird, was angezeigt werden kann.
				const ki =
					erholung.length > 0
						? undefined
						: await ermittleKiVorschlag(userId, ersteDefizitSaeule, saeulen, aufgaben, jetzt);
				const vorschlaege = [...erholung, ...(ki ? [ki] : []), ...defizitVorschlaege];

				// #1798 AK1: angezeigte Vorlagen anonym zählen (je Nutzer, Vorlage und Woche einmal).
				const angezeigt = vorschlaege.flatMap((v) => (v.typ === 'vorlage' && v.templateKey ? [v.templateKey] : []));
				await protokolliereCareReaktion(userId, 'angezeigt', angezeigt, jetzt);
				res.json({ vorschlaege });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	return router;
};

// POST /scores/care-suggestions/dismissals — eine Vorlage ablehnen (#1791, AK4): der
// `templateKey` ist der sprachunabhängige Stammdaten-Schlüssel; die Ablehnung unterdrückt die
// Vorlage für `CARE_ABLEHNUNG_TAGE` ab jetzt. Wiederholtes Ablehnen aktualisiert den bestehenden
// Eintrag, statt Zeilen zu häufen.
scoresRouter.post(
	'/scores/care-suggestions/dismissals',
	async (req: Request, res: Response<Record<string, never> | ErrorDto>) => {
		try {
			const templateKey = typeof req.body?.templateKey === 'string' ? req.body.templateKey.trim() : '';
			if (!templateKey) {
				sendError(res, 400, '"templateKey" ist erforderlich.');
				return;
			}
			const userId = getUserId(req);
			const bestehend = await CareSuggestionDismissal.findOne({
				where: { ...ownerScope(userId), templateKey },
			});
			const abgelehntAm = new Date();
			if (bestehend) {
				await bestehend.update({ abgelehntAm });
			} else {
				await CareSuggestionDismissal.create({ userId, templateKey, abgelehntAm });
			}
			await protokolliereCareReaktion(userId, 'abgelehnt', [templateKey], abgelehntAm);
			res.status(204).send();
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

// Gründe der Grundauswahl „Nicht jetzt" (#1977) — sprachunabhängige Werte wie `templateKey`,
// Anzeige-Texte kommen aus den Locales (`care.reason.*`).
const REJECTION_GRUENDE = [
	'zu-gross',
	'gerade-nicht-moeglich',
	'keine-energie',
	'warte-auf-jemanden',
	'falsche-prioritaet',
] as const;

// POST /scores/care-suggestions/rejections — „Nicht jetzt" mit Grund erfassen (#1977, AK2): jede
// Entscheidung wird als eigener Eintrag mit sprachunabhängigem `grund` und genau einem Bezug
// (`taskId` oder `templateKey`) erfasst; KI-Vorschläge ohne stabilen Schlüssel erreichen den
// Endpoint nicht. Ungültige Payloads antworten 400, Historie je Aufgabe über GET abrufbar.
scoresRouter.post(
	'/scores/care-suggestions/rejections',
	async (req: Request, res: Response<Record<string, never> | ErrorDto>) => {
		try {
			const grund = typeof req.body?.grund === 'string' ? req.body.grund : '';
			if (!(REJECTION_GRUENDE as readonly string[]).includes(grund)) {
				sendError(
					res,
					400,
					'"grund" ist erforderlich (zu-gross, gerade-nicht-moeglich, keine-energie, warte-auf-jemanden, falsche-prioritaet).',
				);
				return;
			}
			const taskId =
				typeof req.body?.taskId === 'number' && Number.isInteger(req.body.taskId) ? req.body.taskId : undefined;
			const templateKey = typeof req.body?.templateKey === 'string' ? req.body.templateKey.trim() : '';
			if ((taskId === undefined) === (templateKey === '')) {
				sendError(res, 400, 'Genau ein Bezug ist erforderlich: "taskId" oder "templateKey".');
				return;
			}
			const userId = getUserId(req);
			const abgelehntAm = new Date();
			await CareSuggestionRejection.create({
				userId,
				grund,
				taskId: taskId ?? null,
				templateKey: templateKey || null,
				abgelehntAm,
			});
			// Wirkungsmessung (#1798) zählt nur Vorlagen-Schlüssel — Aufgaben-Ablehnungen bleiben ungezählt.
			if (templateKey) {
				await protokolliereCareReaktion(userId, 'abgelehnt', [templateKey], abgelehntAm);
			}
			res.status(204).send();
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

// GET /scores/care-suggestions/rejections — Ablehnungs-Historie (#1977, AK4): ohne Filter alle
// eigenen Einträge, mit `?taskId=` nur die einer Aufgabe (aufsteigend). Strenger `ownerScope` —
// Einträge fremder Nutzer bleiben unsichtbar (leere Liste statt 403/404).
scoresRouter.get(
	'/scores/care-suggestions/rejections',
	async (req: Request, res: Response<CareRejectionDto[] | ErrorDto>) => {
		try {
			const userId = getUserId(req);
			const taskId =
				typeof req.query.taskId === 'string' && req.query.taskId !== '' ? Number(req.query.taskId) : undefined;
			const eintraege = await CareSuggestionRejection.findAll({
				where: { ...ownerScope(userId), ...(Number.isInteger(taskId) ? { taskId } : {}) },
				order: [
					['abgelehntAm', 'ASC'],
					['id', 'ASC'],
				],
			});
			res.json(eintraege.map((eintrag) => ({ grund: eintrag.grund, abgelehntAm: eintrag.abgelehntAm.toISOString() })));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
