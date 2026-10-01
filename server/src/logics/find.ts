import { Pillar, ScoreEntry, Task } from '../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from './score.js';
import { selectSeriesRepresentatives, filterVorlauf } from './series.js';
import type { PillarWithContribution } from '../models/task.js';

/**
 * Lädt alle offenen Tasks (inkl. Säulen-Beiträge) und filtert die mit noch offener Abhängigkeit
 * heraus — gemeinsame Vorstufe der Bewertung `bewerteKandidaten` (Grundlage von `/next` und `/suggestions`).
 * Der Abhängigkeitsfilter (AC3) bleibt damit für beide Wege identisch.
 */
const ladeFreieTasks = async (userId?: number, now: Date = new Date()): Promise<Task[]> => {
	// #1518: je Serie nur die aktuelle Instanz (deckt /next, /suggestions und MCP next_task).
	const representatives = selectSeriesRepresentatives(
		await Task.findAll({
			where: {
				status: ['Open', 'In process'],
				// Datenisolation (#207, AK5): auf den eingeloggten Nutzer filtern, sofern vorhanden.
				...(userId !== undefined ? { userId } : {}),
			},
			include: [Pillar],
		}),
	);
	// #1641: Aufgaben mit Datum mehr als VORLAUF_TAGE Kalendertage in der Zukunft zurückhalten.
	const tasks = filterVorlauf(representatives, now);

	const independentTasks: Task[] = [];
	for (const task of tasks) {
		const dependencies = await task.getDependencies();
		const hasUnfinishedDependencies = dependencies.some((dep) => dep.status !== 'Done');
		if (!hasUnfinishedDependencies) {
			independentTasks.push(task);
		}
	}
	return independentTasks;
};

/** GET /next (#2043): Rang 1 derselben Bewertung, die `/suggestions` ordnet — `null` ohne freie Tasks. */
export const findNextBewertung = async (userId?: number): Promise<Bewertung | null> => {
	const [erster] = await bewerteKandidaten(userId);
	return erster ?? null;
};

export const findNextImportantTask = async (userId?: number): Promise<Task | null> =>
	(await findNextBewertung(userId))?.task ?? null;

// ── Vorschlags-Engine (#122, Konzept §4.3) ──────────────────────────────────────────────────────
//
// Scoring-Vertrag (deterministische Defaults aus Triage/Owner-Kommentar):
//   score     = W_PRIO·nPrio + W_UNLOCK·nUnlock + W_BALANCE·nBalance + W_DEADLINE·nDeadline
//               + W_EFFORT·nEffort                                         (#2043, gilt auch für /next)
//   nPrio     = (priority − 1) / 4                                       // 1→0.0, 3→0.5, 5→1.0
//   nUnlock   = min(1, offene Nachfolger / UNLOCK_DECKEL)                // keine Nachfolger → 0
//   nEffort   = 1 − estimatedEffort                                      // 0.1→0.9, 1→0.0
//   nDeadline = überfällig 1.0 · heute 0.8 · ≤7 Tage 0.5 · >7 Tage 0.2 · keine 0.0
//   nBalance  = Σ (shareᵢ/100)·nDefizitᵢ,  nDefizit = soll>0 ? max(0, soll−ist)/soll : 0
//               soll = weight/Σweights,  ist = punkteSäule/Σpunkte (aggregierePunkteProSaeule)
// Post-Filter (ändert das Ranking nicht): MAX_PRO_SAEULE je Säule, Gesamtliste ≤ MAX_VORSCHLAEGE.

const W_PRIO = 0.5;
const W_DEADLINE = 0.3;
const W_BALANCE = 0.2;
const W_UNLOCK = 0.2;
const W_EFFORT = 0.1;

/** Ab so vielen offenen Nachfolgern ist die Entsperr-Wirkung voll (nUnlock = 1). */
const UNLOCK_DECKEL = 3;

/** Prozent-Normierung der `share`-Werte (0–100 ⇒ 0–1). */
const PERCENT = 100;
/** Millisekunden je Tag — für die Deadline-Nähe (Tagesdifferenz). */
const TAG_MS = 24 * 60 * 60 * 1000;

/** Überlastungsschutz (Work-Life-Balance): Obergrenzen für die Vorschlagsliste. */
const MAX_PRO_SAEULE = 2;
const MAX_VORSCHLAEGE = 5;

/** Priorität (1–5) auf 0–1 normieren. */
const normPriority = (priority: number): number => (priority - 1) / 4;

/** Deadline-Nähe als Faktor (0–1); je dringlicher, desto höher. */
const normDeadline = (deadline: Date | null | undefined, jetzt: Date): number => {
	if (!deadline) {
		return 0;
	}
	// Auf ganze Tage gerundete Differenz (kalendertag-unabhängig genug für die Buckets).
	const heuteMitternacht = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();
	const zielMitternacht = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
	const diffTage = Math.round((zielMitternacht - heuteMitternacht) / TAG_MS);
	if (diffTage < 0) {
		return 1.0; // überfällig
	}
	if (diffTage === 0) {
		return 0.8; // heute fällig
	}
	if (diffTage <= 7) {
		return 0.5; // demnächst
	}
	return 0.2; // weiter in der Zukunft
};

/** Entsperr-Wirkung (0–1): Zahl der noch offenen Nachfolger, gedeckelt. */
const normUnlock = async (task: Task): Promise<number> => {
	const offen = (await task.getDependents()).filter((nachfolger) => nachfolger.status !== 'Done').length;
	return Math.min(1, offen / UNLOCK_DECKEL);
};

/** Aufwand (0.1–1) als Faktor; geringer Aufwand ⇒ höherer Wert. */
const normEffort = (estimatedEffort: number): number => 1 - estimatedEffort;

/** Soll-Anteil je Säule (`weight/Σweights`) — leere Map, wenn keine Gewichte vorliegen. */
const sollProSaeule = (pillars: Pillar[]): Map<number, number> => {
	const summeGewichte = pillars.reduce((sum, p) => sum + p.weight, 0);
	const soll = new Map<number, number>();
	if (summeGewichte <= 0) {
		return soll;
	}
	for (const pillar of pillars) {
		soll.set(pillar.id, pillar.weight / summeGewichte);
	}
	return soll;
};

/** Ist-Anteil je Säule (`punkteSäule/Σpunkte`) aus den vergebenen Gamification-Punkten. */
const istProSaeule = (summen: Map<number, number>): Map<number, number> => {
	const summePunkte = [...summen.values()].reduce((sum, punkte) => sum + punkte, 0);
	const ist = new Map<number, number>();
	if (summePunkte <= 0) {
		return ist;
	}
	for (const [pillarId, punkte] of summen) {
		ist.set(pillarId, punkte / summePunkte);
	}
	return ist;
};

/** Balance-Korrektur eines Tasks: Säulen mit Defizit (`soll > ist`) gewichten ihn hoch. */
const normBalance = (
	pillars: PillarWithContribution[],
	soll: Map<number, number>,
	ist: Map<number, number>,
): number => {
	let summe = 0;
	for (const pillar of pillars) {
		const s = soll.get(pillar.id) ?? 0;
		if (s <= 0) {
			continue;
		}
		const i = ist.get(pillar.id) ?? 0;
		const defizit = Math.max(0, s - i) / s;
		summe += (pillar.TaskPillar.share / PERCENT) * defizit;
	}
	return summe;
};

export interface Bewertung {
	task: Task;
	score: number;
	beitraege: { prio: number; entsperr: number; balance: number; deadline: number; aufwand: number };
}

/**
 * Gemeinsame Fünf-Faktor-Bewertung (#2043) der freien Tasks, vor dem Post-Filter, nach Score
 * absteigend. Grundlage von `findNextImportantTask` (Rang 1) und `findSuggestedTasks` (Liste).
 */
export const bewerteKandidaten = async (userId?: number, now: Date = new Date()): Promise<Bewertung[]> => {
	const kandidaten = await ladeFreieTasks(userId, now);
	if (kandidaten.length === 0) {
		return [];
	}

	// Balance-Stand: Soll-Anteile aus den Säulen-Gewichten, Ist-Anteile aus den vergebenen Punkten.
	// Säulen sind globale Stammdaten (für alle Nutzer identisch) — bewusst ohne `userId`-Filter,
	// sonst bekäme ein Nutzer ohne eigene (NULL-owned) Säulen eine leere Soll-Verteilung.
	const pillars = await Pillar.findAll();
	const soll = sollProSaeule(pillars);

	const scoreEintraege = await ScoreEntry.findAll({
		include: [
			{
				model: Task,
				where: userId !== undefined ? { userId } : undefined,
				required: userId !== undefined,
				include: [Pillar],
			},
		],
	});
	const punkteBeitraege: PunkteBeitrag[] = scoreEintraege.map((entry) => {
		const taskPillars: PillarWithContribution[] = entry.Task?.Pillars ?? [];
		return {
			punkte: entry.punkte,
			beitraege: taskPillars.map((pillar) => ({ pillarId: pillar.id, share: pillar.TaskPillar.share })),
		};
	});
	const ist = istProSaeule(aggregierePunkteProSaeule(punkteBeitraege));

	const bewertet: Bewertung[] = [];
	for (const task of kandidaten) {
		const beitraege = {
			prio: W_PRIO * normPriority(task.priority),
			entsperr: W_UNLOCK * (await normUnlock(task)),
			balance: W_BALANCE * normBalance(task.Pillars ?? [], soll, ist),
			deadline: W_DEADLINE * normDeadline(task.deadline ?? null, now),
			aufwand: W_EFFORT * normEffort(task.estimatedEffort),
		};
		const score = Object.values(beitraege).reduce((summe, beitrag) => summe + beitrag, 0);
		bewertet.push({ task, score, beitraege });
	}

	// Höchster Score zuerst; bei Gleichstand höhere Priorität, dann stabile id-Reihenfolge.
	bewertet.sort((a, b) => b.score - a.score || b.task.priority - a.task.priority || a.task.id - b.task.id);
	return bewertet;
};

/**
 * „Was ist jetzt dran?"-Liste (#122): die Bewertung aus `bewerteKandidaten`, danach der
 * Überlastungsschutz als Post-Filter (ändert das Ranking nicht).
 */
export const findSuggestedBewertungen = async (userId?: number): Promise<Bewertung[]> => {
	const bewertet = await bewerteKandidaten(userId);

	// Überlastungsschutz: höchstens MAX_PRO_SAEULE Tasks je Säule, insgesamt ≤ MAX_VORSCHLAEGE.
	const proSaeule = new Map<number, number>();
	const liste: Bewertung[] = [];
	for (const eintrag of bewertet) {
		const { task } = eintrag;
		if (liste.length >= MAX_VORSCHLAEGE) {
			break;
		}
		const taskPillars = task.Pillars ?? [];
		const ueberlastet = taskPillars.some((pillar) => (proSaeule.get(pillar.id) ?? 0) >= MAX_PRO_SAEULE);
		if (ueberlastet) {
			continue; // weitere Tasks dieser Säule zurückstellen
		}
		liste.push(eintrag);
		for (const pillar of taskPillars) {
			proSaeule.set(pillar.id, (proSaeule.get(pillar.id) ?? 0) + 1);
		}
	}
	return liste;
};

export const findSuggestedTasks = async (userId?: number): Promise<Task[]> =>
	(await findSuggestedBewertungen(userId)).map(({ task }) => task);

/** Score-Aufschlüsselung (#2044): Beiträge 1:1 aus `Bewertung`; Beitrag 0 ⇒ Schlüssel fehlt. */
export const toScoreBreakdown = ({ score, beitraege }: Bewertung) => {
	const faktoren = {
		priority: beitraege.prio,
		unlock: beitraege.entsperr,
		balance: beitraege.balance,
		deadline: beitraege.deadline,
		effort: beitraege.aufwand,
	};
	return {
		total: score,
		...Object.fromEntries(Object.entries(faktoren).filter(([, beitrag]) => beitrag !== 0)),
	};
};
