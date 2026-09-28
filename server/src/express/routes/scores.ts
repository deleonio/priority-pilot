import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { Pillar, ScoreEntry, Task, MissedTask } from '../../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from '../../logics/score.js';
import { berechneStreak, istGueltigeZeitzone } from '../../logics/streak.js';
import { berechneMeilensteine } from '../../logics/milestones.js';
import { berechneLebensbalanceNachKadenz } from '../../logics/heartBalance.js';
import { berechneBalanceVerlauf, istGueltigesDatum, zeitraumInTagen } from '../../logics/balanceHistory.js';
import CareSuggestionDismissal from '../../models/careSuggestionDismissal.js';
import type { PillarWithContribution } from '../../models/task.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import {
	waehleCareVorschlaege,
	type CareAufgabe,
	type CareVorschlag,
	type CareVorlage,
} from '../../logics/careSuggestions.js';
import { CARE_SPRACHEN, CARE_VORLAGEN, type CareSprache } from '../../logics/careSuggestionData.js';
import { bewerteCareDefizit } from '../../logics/careDeficit.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];
type ScoreEntryDto = components['schemas']['ScoreEntry'];
type PillarScoreDto = components['schemas']['PillarScore'];
type StreakDto = components['schemas']['Streak'];
type MilestoneDto = components['schemas']['Milestone'];
type MissedTasksSummaryDto = components['schemas']['MissedTasksSummary'];
type BalanceStatusDto = components['schemas']['BalanceStatus'];
type BalanceHistoryEntryDto = components['schemas']['BalanceHistoryEntry'];

/** Ein Zeitraum darf höchstens so viele Tage umfassen — deckelt die Antwortgröße von `/scores/balance/history`. */
const MAX_BALANCE_HISTORY_TAGE = 366;

/** Maximale Anzahl der in der Zusammenfassung mitgelieferten Einzel-Einträge. */
const MISSED_TASKS_LIST_LIMIT = 20;

/** Ein Vorschlags-Dto: die reine Logik-Antwort, angereichert um Säulen-Bezug (`saeuleId`/`saeuleName`). */
type CareVorschlagDto = CareVorschlag & { saeuleId: number; saeuleName: string };

/** Löst den `sprache`-Query-Parameter auf: bekannte App-Sprache oder Default `de`. */
const loeseSprache = (query: unknown): CareSprache =>
	typeof query === 'string' && (CARE_SPRACHEN as readonly string[]).includes(query) ? (query as CareSprache) : 'de';

export const scoresRouter = Router();

// GET /scores — vergebene Gamification-Punkte je erledigtem Task.
scoresRouter.get('/scores', async (_req: Request, res: Response<ScoreEntryDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({ order: [['id', 'ASC']] });
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

// GET /scores/streak — Kalendertage in Folge mit mindestens einer Erledigung plus Bestmarke (#1360).
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/by-pillar); `GET /scores` ist
// ungescopet und deshalb bewusst NICHT die Quelle.
scoresRouter.get('/scores/streak', async (req: Request, res: Response<StreakDto | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)) }],
		});
		// Der Client schickt seine IANA-Zeitzone mit (`?tz=`); ohne oder mit unbekanntem Wert wertet
		// der Server in seiner eigenen Zeitzone aus — die Anzeige verschiebt sich, es gibt keinen Fehler.
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { aktuell, best, aktiveTage } = berechneStreak(
			entries.map((entry) => entry.zeitpunkt),
			new Date(),
			zeitZone,
		);
		res.json({ aktuell, best, letzterTag: aktiveTage[aktiveTage.length - 1] ?? null });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/milestones — feste Streak-/Punkte-Stufen, rückwirkend aus Bestandsdaten (#1362).
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/streak); `GET /scores` ist
// ungescopet und deshalb bewusst NICHT die Quelle.
scoresRouter.get('/scores/milestones', async (req: Request, res: Response<MilestoneDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)) }],
		});

		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { best } = berechneStreak(
			entries.map((entry) => entry.zeitpunkt),
			new Date(),
			zeitZone,
		);
		const punkteSumme = entries.reduce((summe, entry) => summe + entry.punkte, 0);

		res.json(berechneMeilensteine({ bestStreak: best, punkteSumme }));
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
		const balance = berechneLebensbalanceNachKadenz(
			saeulen.map((saeule) => ({ id: saeule.id, name: saeule.name, weight: saeule.weight })),
			tasks.map((task) => ({
				status: task.status,
				estimatedEffort: task.estimatedEffort,
				pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
					pillarId: pillar.id,
					share: pillar.TaskPillar.share,
				})),
				erledigtAm: zeitpunktProTask.get(task.id) ?? null,
			})),
			new Date(),
		);

		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { aktuell, best, aktiveTage } = berechneStreak(
			entries.map((entry) => entry.zeitpunkt),
			new Date(),
			zeitZone,
		);
		const punkteSumme = entries.reduce((summe, entry) => summe + entry.punkte, 0);

		res.json({
			// Eine Dezimalstelle: der Füllstand schwankt mit jeder Erledigung, mehr Stellen wären
			// Rauschen. Die Säulen-Punkte bleiben roh, damit ein Client selbst weiterrechnen kann.
			fuellstandProzent: Math.round(balance.fill * 1000) / 10,
			hatPunkte: balance.hasPoints,
			saeulen: balance.saeulen,
			streak: { aktuell, best, letzterTag: aktiveTage[aktiveTage.length - 1] ?? null },
			// Nur die erreichten Stufen: die vollständige Stufenliste liefert /scores/milestones.
			meilensteine: berechneMeilensteine({ bestStreak: best, punkteSumme }).filter(
				(meilenstein) => meilenstein.erreicht,
			),
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
				saeulen.map((saeule) => ({ id: saeule.id, name: saeule.name, weight: saeule.weight })),
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

// GET /scores/care-suggestions — konkrete Vorschläge gegen ein Balance-Defizit (#1791): je
// defizitärer Säule (Defizit-Quelle ist `bewerteCareDefizit` aus #1790, nicht kopiert) bis zu
// drei Einträge — zuerst eigene offene Aufgaben dieser Säule, sonst kuratierte Vorlagen aus
// `careSuggestionData.ts`. `?sprache=` wählt die Sprache der Vorlagen-Texte (Default `de`).
// Gilt vollständig im Free-Paket (Epic #1780) — bewusst ohne planGuard; #1804 (KI-Vorschläge
// Plus/Pro) ergänzt später dieselbe Antwortform. Gescopet wie `/scores/balance` strikt mit
// `ownerScope` auf Säulen und Tasks.
scoresRouter.get(
	'/scores/care-suggestions',
	async (req: Request, res: Response<{ vorschlaege: CareVorschlagDto[] } | ErrorDto>) => {
		try {
			const userId = getUserId(req);
			const sprache = loeseSprache(req.query.sprache);
			const jetzt = new Date();
			const [saeulen, tasks, entries, ablehnungen] = await Promise.all([
				Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
				Task.findAll({ where: ownerScope(userId), include: [Pillar] }),
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
				saeulen.map((saeule) => ({ id: saeule.id, name: saeule.name, weight: saeule.weight })),
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

			const vorschlaege: CareVorschlagDto[] = defizite
				.filter((defizit) => defizit.defizitaer)
				.flatMap((defizit) => {
					const saeule = { id: defizit.id, name: defizit.name, weight: 0 };
					const vorlagenDerSaeule = vorlagen.filter((vorlage) => vorlage.saeuleId === saeule.id);
					return waehleCareVorschlaege(
						saeule,
						aufgaben,
						vorlagenDerSaeule,
						ablehnungen.map((ablehnung) => ({
							templateKey: ablehnung.templateKey,
							abgelehntAm: ablehnung.abgelehntAm,
						})),
						jetzt,
					).map((vorschlag) => ({ ...vorschlag, saeuleId: defizit.id, saeuleName: defizit.name }));
				});

			res.json({ vorschlaege });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

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
			res.status(204).send();
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
