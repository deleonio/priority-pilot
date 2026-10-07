import { Op } from 'sequelize';
import { Pillar, ScoreEntry, Task } from '../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from './score.js';
import { selectSeriesRepresentatives, filterVorlauf } from './series.js';
import type { PillarWithContribution } from '../models/task.js';

/** Dauer des „Kurz zurückstellen" (#2244) in Stunden — Vorschlagskarte „Nächste Aufgabe". */
export const ZURUECKSTELLEN_STUNDEN = 3;

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
	// #2244: kurz zurückgestellte Aufgaben bis zum Ablauf ausblenden (gilt für /next, /suggestions, MCP).
	const tasks = filterVorlauf(representatives, now).filter(
		(task) => task.snoozedUntil == null || task.snoozedUntil.getTime() <= now.getTime(),
	);

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

/** Kalendertage bis zur Frist (auf ganze Tage gerundete Mitternachts-Differenz); negativ = überfällig. */
const tageBisFrist = (deadline: Date, jetzt: Date): number => {
	const heuteMitternacht = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();
	const zielMitternacht = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime();
	return Math.round((zielMitternacht - heuteMitternacht) / TAG_MS);
};

/** Deadline-Nähe als Faktor (0–1); je dringlicher, desto höher. */
const normDeadline = (deadline: Date | null | undefined, jetzt: Date): number => {
	if (!deadline) {
		return 0;
	}
	const diffTage = tageBisFrist(deadline, jetzt);
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

/** Entsperr-Wirkung (0–1): Zahl der noch offenen Nachfolger, gedeckelt; Zahl mitgeliefert (#1985). */
const normUnlock = async (task: Task): Promise<{ offen: number; wert: number }> => {
	const offen = (await task.getDependents()).filter((nachfolger) => nachfolger.status !== 'Done').length;
	return { offen, wert: Math.min(1, offen / UNLOCK_DECKEL) };
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

/**
 * Balance-Korrektur eines Tasks: Säulen mit Defizit (`soll > ist`) gewichten ihn hoch; die Namen
 * der Defizit-Säulen reisen mit (#1985, Begründungssatz der Karte).
 */
const normBalance = (
	pillars: PillarWithContribution[],
	soll: Map<number, number>,
	ist: Map<number, number>,
): { wert: number; defizitSaeulen: string[] } => {
	let summe = 0;
	const defizitSaeulen: string[] = [];
	for (const pillar of pillars) {
		const s = soll.get(pillar.id) ?? 0;
		if (s <= 0) {
			continue;
		}
		const i = ist.get(pillar.id) ?? 0;
		const defizit = Math.max(0, s - i) / s;
		if (defizit > 0) {
			defizitSaeulen.push(pillar.name);
		}
		summe += (pillar.TaskPillar.share / PERCENT) * defizit;
	}
	return { wert: summe, defizitSaeulen };
};

export interface Bewertung {
	task: Task;
	score: number;
	beitraege: { prio: number; entsperr: number; balance: number; deadline: number; aufwand: number };
	/** Rohwerte je Faktor für die Begründungssätze der Karte (#1985), additiv zu `beitraege`. */
	kontext: { defizitSaeulen: string[]; offeneNachfolger: number; tageBisFrist: number | null };
}

/** Strukturierte Begründungswerte (#1985): je Faktor mit Beitrag > 0 ein Schlüssel. */
export interface TaskReasons {
	balance?: { pillars: string[] };
	unlock?: { openCount: number };
	deadline?: { date: string; daysUntil: number };
	priority?: { priority: number };
	/** Aufteilen-Hinweis (#1994): Verschiebe-Zähler der empfohlenen Aufgabe, nur bei erkanntem Muster. */
	split?: { postponeCount: number };
}

/** Aufteilen-Hinweis (#1994): ab diesem Aufwands-Bruchteil gilt eine Aufgabe als groß. */
const SPLIT_MIN_EFFORT = 0.6;
/** Aufteilen-Hinweis (#1994): ab so vielen Verschiebungen gilt eine Aufgabe als wiederholt verschoben. */
const SPLIT_MIN_POSTPONES = 2;
/** Aufteilen-Hinweis (#1994): Muster erkannt ab so vielen großen, wiederholt verschobenen offenen Aufgaben. */
const SPLIT_MIN_TASKS = 3;

/**
 * Aufteilen-Hinweis (#1994): `{ postponeCount }` für die empfohlene Aufgabe, wenn der Nutzer
 * mindestens `SPLIT_MIN_TASKS` offene Aufgaben mit Aufwand ≥ `SPLIT_MIN_EFFORT` und
 * `postponeCount` ≥ `SPLIT_MIN_POSTPONES` hat und diese Aufgabe selbst dazugehört; sonst `undefined`.
 * Ändert die Bewertung nicht — reine Zusatzbegründung.
 */
export const erkenneAufteilenHinweis = async (
	task: Task,
	userId?: number,
): Promise<TaskReasons['split'] | undefined> => {
	const gehoert = task.estimatedEffort >= SPLIT_MIN_EFFORT && task.postponeCount >= SPLIT_MIN_POSTPONES;
	if (!gehoert) {
		return undefined;
	}
	const anzahl = await Task.count({
		where: {
			// Wie bei `/next` ohne Anmeldung (Dev): alle Tasks, sonst Datenisolation auf den Nutzer.
			...(userId !== undefined ? { userId } : {}),
			status: ['Open', 'In process'],
			estimatedEffort: { [Op.gte]: SPLIT_MIN_EFFORT },
			postponeCount: { [Op.gte]: SPLIT_MIN_POSTPONES },
		},
	});
	return anzahl >= SPLIT_MIN_TASKS ? { postponeCount: task.postponeCount } : undefined;
};

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
		const entsperr = await normUnlock(task);
		const balance = normBalance(task.Pillars ?? [], soll, ist);
		const beitraege = {
			prio: W_PRIO * normPriority(task.priority),
			entsperr: W_UNLOCK * entsperr.wert,
			balance: W_BALANCE * balance.wert,
			deadline: W_DEADLINE * normDeadline(task.deadline ?? null, now),
			aufwand: W_EFFORT * normEffort(task.estimatedEffort),
		};
		const score = Object.values(beitraege).reduce((summe, beitrag) => summe + beitrag, 0);
		bewertet.push({
			task,
			score,
			beitraege,
			kontext: {
				defizitSaeulen: balance.defizitSaeulen,
				offeneNachfolger: entsperr.offen,
				tageBisFrist: task.deadline != null ? tageBisFrist(task.deadline, now) : null,
			},
		});
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

/**
 * Begründungswerte der Karte (#1985): je Faktor mit Beitrag > 0 der Rohwert — Spiegel der
 * `toScoreBreakdown`-Konvention (Beitrag 0 ⇒ Schlüssel fehlt); ganz ohne Anteile `undefined`,
 * damit `reasons` im DTO von `GET /next` komplett entfällt.
 */
export const toReasons = ({ task, beitraege, kontext }: Bewertung): TaskReasons | undefined => {
	const reasons: TaskReasons = {};
	// Balance an den Defizit-Säulen des Tasks gebunden (nicht am Beitrag — ein Task mit share 0
	// hat trotzdem eine Begründung, der Vertrag folgt TF1 in suggestions.test.ts).
	if (kontext.defizitSaeulen.length > 0) {
		reasons.balance = { pillars: kontext.defizitSaeulen };
	}
	if (beitraege.entsperr > 0) {
		reasons.unlock = { openCount: kontext.offeneNachfolger };
	}
	if (beitraege.deadline > 0 && task.deadline != null && kontext.tageBisFrist !== null) {
		reasons.deadline = { date: task.deadline.toISOString().slice(0, 10), daysUntil: kontext.tageBisFrist };
	}
	if (beitraege.prio > 0) {
		reasons.priority = { priority: task.priority };
	}
	return Object.keys(reasons).length > 0 ? reasons : undefined;
};
