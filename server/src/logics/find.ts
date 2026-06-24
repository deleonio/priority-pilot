import { Pillar, ScoreEntry, Task } from '../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from './score.js';
import type { PillarWithContribution } from '../models/task.js';

/**
 * Lädt alle offenen Tasks (inkl. Säulen-Beiträge) und filtert die mit noch offener Abhängigkeit
 * heraus — gemeinsame Vorstufe von `findNextImportantTask` (Top-1) und `findSuggestedTasks` (Liste).
 * Der Abhängigkeitsfilter (AC3) bleibt damit für beide Wege identisch.
 */
const ladeFreieTasks = async (): Promise<Task[]> => {
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
		include: [Pillar],
	});

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

export const findNextImportantTask = async (): Promise<Task | null> => {
	// Alle offenen, nicht blockierten Tasks — inkl. Säulen-Beiträge, damit der zurückgegebene Task
	// direkt serialisierbar ist (GET /next gibt einen vollständigen Task zurück).
	const independentTasks = await ladeFreieTasks();

	// Höhere Priorität zuerst
	independentTasks.sort((a, b) => b.priority - a.priority);

	// Gib den wichtigsten Task aus der sortierten Liste zurück
	return independentTasks.length > 0 ? independentTasks[0] : null;
};

// ── Vorschlags-Engine (#122, Konzept §4.3) ──────────────────────────────────────────────────────
//
// Scoring-Vertrag (deterministische Defaults aus Triage/Owner-Kommentar):
//   score     = W_PRIO·nPrio + W_DEADLINE·nDeadline + W_BALANCE·nBalance
//   nPrio     = (priority − 1) / 4                                       // 1→0.0, 3→0.5, 5→1.0
//   nDeadline = überfällig 1.0 · heute 0.8 · ≤7 Tage 0.5 · >7 Tage 0.2 · keine 0.0
//   nBalance  = Σ (shareᵢ/100)·nDefizitᵢ,  nDefizit = soll>0 ? max(0, soll−ist)/soll : 0
//               soll = weight/Σweights,  ist = punkteSäule/Σpunkte (aggregierePunkteProSaeule)
// Post-Filter (ändert das Ranking nicht): MAX_PRO_SAEULE je Säule, Gesamtliste ≤ MAX_VORSCHLAEGE.

const W_PRIO = 0.5;
const W_DEADLINE = 0.3;
const W_BALANCE = 0.2;

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

/**
 * „Was ist jetzt dran?"-Liste (#122): die nach Score sortierte, post-gefilterte Vorschlagsliste.
 * Der Abhängigkeitsfilter aus `findNextImportantTask` bleibt vorgeschaltet (AC3); danach werden
 * Priorität, Deadline-Nähe und Balance-Korrektur kombiniert und der Überlastungsschutz angewandt.
 */
export const findSuggestedTasks = async (): Promise<Task[]> => {
	const kandidaten = await ladeFreieTasks();
	if (kandidaten.length === 0) {
		return [];
	}

	// Balance-Stand: Soll-Anteile aus den Säulen-Gewichten, Ist-Anteile aus den vergebenen Punkten.
	const pillars = await Pillar.findAll();
	const soll = sollProSaeule(pillars);

	const scoreEintraege = await ScoreEntry.findAll({ include: [{ model: Task, include: [Pillar] }] });
	const beitraege: PunkteBeitrag[] = scoreEintraege.map((entry) => {
		const taskPillars: PillarWithContribution[] = entry.Task?.Pillars ?? [];
		return {
			punkte: entry.punkte,
			beitraege: taskPillars.map((pillar) => ({ pillarId: pillar.id, share: pillar.TaskPillar.share })),
		};
	});
	const ist = istProSaeule(aggregierePunkteProSaeule(beitraege));

	const jetzt = new Date();
	const bewertet = kandidaten.map((task) => {
		const score =
			W_PRIO * normPriority(task.priority) +
			W_DEADLINE * normDeadline(task.deadline ?? null, jetzt) +
			W_BALANCE * normBalance(task.Pillars ?? [], soll, ist);
		return { task, score };
	});

	// Höchster Score zuerst; bei Gleichstand höhere Priorität, dann stabile id-Reihenfolge.
	bewertet.sort((a, b) => b.score - a.score || b.task.priority - a.task.priority || a.task.id - b.task.id);

	// Überlastungsschutz: höchstens MAX_PRO_SAEULE Tasks je Säule, insgesamt ≤ MAX_VORSCHLAEGE.
	const proSaeule = new Map<number, number>();
	const liste: Task[] = [];
	for (const { task } of bewertet) {
		if (liste.length >= MAX_VORSCHLAEGE) {
			break;
		}
		const taskPillars = task.Pillars ?? [];
		const ueberlastet = taskPillars.some((pillar) => (proSaeule.get(pillar.id) ?? 0) >= MAX_PRO_SAEULE);
		if (ueberlastet) {
			continue; // weitere Tasks dieser Säule zurückstellen
		}
		liste.push(task);
		for (const pillar of taskPillars) {
			proSaeule.set(pillar.id, (proSaeule.get(pillar.id) ?? 0) + 1);
		}
	}
	return liste;
};
