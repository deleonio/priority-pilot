// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) — das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// „Kosten-Uebersicht" (woechentlich, read-only) in die Job-Summary:
//   node .github/scripts/tokens-report.ts --dir .costs [--baseline 2026-W35]
//
// FOKUS-MODUS (--issues 1752,1754 — im Workflow der Dispatch-Input „issues"): rendert
// statt des Wochen-Reports nur die Läufe der gewählten Tickets und stellt sie je Phase
// den anderen Läufen derselben Phase gegenüber (Setup-Vergleich, z. B. :free-Modell).
// Die Ticket-Tabelle des Voll-Reports zeigt bewusst nur die Top 10 — die Voll-Liste
// sprengte die GitHub-Summary und diente der kontinuierlichen Optimierung nicht.
//
// BEZUGSEINHEIT: Ticket-Kohorte je Abschlusswoche (Woche des Siegels). Wochen-Werte
// „je Ticket" summieren das GANZE Ticket in seiner Abschlusswoche — nicht die Läufe, die
// zufällig in der Woche liefen, geteilt durch die Tickets, die die Woche „berührt" haben
// (das zählte ein Ticket in zwei Wochen und war nicht mit dem Kopf-KPI vergleichbar).
// Lagemaß ist der Median (Kosten je Ticket sind rechtsschief, p90 ≈ 2× Median), immer mit
// n; relative Sicht über einen Index gegen eine Baseline-Kohorte und ein gleitendes
// Fenster über die letzten 20 Tickets (bei 4 Wochen Daten mit n = 5..40 ist das
// Kalenderraster grob). Rechenhelfer in report-stats.ts.
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich löschbare TypeScript-Syntax.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalsByPhase, type PhaseTotal } from './cost-aggregate.ts';
import { classifyModel, usageBlocksUsd, valueRates, type BlockUsd } from './cost-from-transcript.ts';
import type { CostEntry } from './cost-record.ts';
import {
	avg,
	bar,
	berlinDay,
	berlinStamp,
	fmtIndex,
	frac,
	getOrInit,
	indexTo,
	isoWeek,
	median,
	MIN_N_COHORT,
	mio,
	num,
	pct,
	quantileOf,
	ratio,
	rollingMedian,
	sealWeek,
	share,
	shareWithInterval,
	trendArrow,
	usd,
	weekOf,
	xychart,
	ZERO,
} from './report-stats.ts';

export type TicketTotal = {
	issue: string;
	runs: number;
	turns: number;
	tokensIn: number;
	tokensOut: number;
	valueCost: number;
	cost: number;
	first: string;
	last: string;
	/** Phasen-Verteilung in Erstauftreten-Reihenfolge, z. B. „analyse:1 … fixup:4". */
	phases: string[];
};

/** Feld im Datensatz vorhanden (im Gegensatz zu ZERO: „—" vs. 0 unterscheidbar). */
const defined = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Roh-Einträge EINER Ticket-Datei — Zwischenschritt zwischen Datei und Summenzeile. */
export type TicketEntries = { issue: string; entries: CostEntry[] };

/**
 * Liest alle `<issueId>.json` unter `dir` roh ein — die gemeinsame Datenquelle aller
 * repo-weiten Berichte (Kosten hier, Turns in turns-report.ts). Kaputte Dateien werden
 * übersprungen und gemeldet, statt den Bericht scheitern zu lassen; ein nicht lesbares
 * Verzeichnis meldet sich als einzelner Skip.
 */
export function readTickets(dir: string): { tickets: TicketEntries[]; skipped: string[] } {
	const tickets: TicketEntries[] = [];
	const skipped: string[] = [];
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return { tickets, skipped: [dir] };
	}
	for (const name of names.sort()) {
		if (!name.endsWith('.json')) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
		} catch {
			skipped.push(name);
			continue;
		}
		if (!Array.isArray(parsed)) {
			skipped.push(name);
			continue;
		}
		const entries = parsed as CostEntry[];
		if (entries.length === 0) continue;
		tickets.push({ issue: name.replace(/\.json$/, ''), entries });
	}
	return { tickets, skipped };
}

/** Harness-Intervention: Datum (Berlin-Tag, ISO) und Beschriftung — aus docs/kosten-interventionen.json. */
export type Intervention = { date: string; label: string; issue?: number | null };

const HERE = dirname(fileURLToPath(import.meta.url));
export const INTERVENTIONS_PATH = join(HERE, '..', '..', 'docs', 'kosten-interventionen.json');

/** Liest die Interventions-Liste; fehlende oder kaputte Datei = keine Interventionen (kein Abbruch). */
export function loadInterventions(path: string = INTERVENTIONS_PATH): Intervention[] {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((x): x is Intervention => typeof x?.date === 'string' && typeof x?.label === 'string')
			.sort((a, b) => a.date.localeCompare(b.date));
	} catch {
		return [];
	}
}

/**
 * Zielwert eines KPI aus docs/kosten-ziele.json — die maschinenlesbare Fassung der
 * „Erfolgsmessung" im Kosten-Optimierungsplan. `okMax`/`okMin` sind die Ziel-Schwellen
 * (okMax = erfüllt bei ist <= Schwelle, okMin bei ist >= Schwelle), `goal` der Anzeigetext.
 * Richtungs-Ziele (sinkend/steigend) tragen nur `goal` — ihr Prädikat bleibt im Code.
 */
export type KpiGoal = { goal?: string; okMax?: number; okMin?: number };
export type CostGoals = { weeklyBudgetUsd?: number; kpis?: Record<string, KpiGoal> };

export const GOALS_PATH = join(HERE, '..', '..', 'docs', 'kosten-ziele.json');

/** Liest die Ziele; fehlende oder kaputte Datei = leere Ziele + Warnung, die Defaults im Code gelten. */
export function loadGoals(path: string = GOALS_PATH): CostGoals {
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
		return typeof parsed === 'object' && parsed !== null ? (parsed as CostGoals) : {};
	} catch {
		process.stderr.write(`kosten-ziele nicht lesbar (${path}) — hartkodierte Ziel-Defaults gelten.\n`);
		return {};
	}
}

/** Summiert die Einträge EINES Tickets zur Berichtszeile. */
const ticketTotal = ({ issue, entries }: TicketEntries): TicketTotal => {
	const byPhase = new Map<string, number>();
	const total: TicketTotal = {
		issue,
		runs: entries.length,
		turns: 0,
		tokensIn: 0,
		tokensOut: 0,
		valueCost: 0,
		cost: 0,
		first: entries[0]?.timestamp ?? '',
		last: entries[entries.length - 1]?.timestamp ?? '',
		phases: [],
	};
	for (const e of entries) {
		total.turns += ZERO(e.turns);
		total.tokensIn += ZERO(e.tokensIn);
		total.tokensOut += ZERO(e.tokensOut);
		total.valueCost += ZERO(e.valueCost);
		total.cost += ZERO(e.cost);
		const phase = e.phase ?? '(ohne)';
		byPhase.set(phase, (byPhase.get(phase) ?? 0) + 1);
	}
	total.phases = [...byPhase.entries()].map(([phase, n]) => `${phase}:${n}`);
	return total;
};

// Schleifen-Kandidaten zuerst: absteigend nach Wert, dann Issue-Nummer aufsteigend —
// der Bericht soll die Ausreisser oben zeigen, nicht sie in 50 Zeilen verstecken.
const byValue = (a: TicketTotal, b: TicketTotal): number =>
	b.valueCost - a.valueCost || Number(a.issue) - Number(b.issue);

/** Liest alle <issueId>.json unter `dir` und summiert je Ticket. Kaputte Dateien übersprungen+gemeldet. */
export function ticketTotals(dir: string): { tickets: TicketTotal[]; skipped: string[] } {
	const { tickets, skipped } = readTickets(dir);
	return { tickets: tickets.map(ticketTotal).sort(byValue), skipped };
}

/**
 * Vollständigkeit eines Ticket-Datensatzes — gemeinsame Definition für Kosten-Report,
 * Turn-Report und Audit-Basis (eine Definition, drei Renderer). Versiegelte Dateien
 * enthalten nicht nur komplette Durchläufe, und Kennzahlen dürfen darüber nicht mitteln.
 * Entschieden wird CHRONOLOGISCH am ersten Siegel (documenter), nicht an Phasen-Zählern:
 * - `vollstaendig`: implement + documenter — Pipeline-Durchlauf bis zum Siegel.
 * - `extern-vollstaendig`: kein implement, aber review/fixup VOR dem ersten Siegel — ein
 *   extern umgesetzter PR (Claude Web, Mensch), der durch Review, ggf. Fixup und Siegel
 *   lief. Das ist ein kompletter Erstdurchlauf mit eigener Herkunft, keine Nacharbeit:
 *   Bis 2026-09 zählten 61 solcher Tickets als „Fixup-Bein" und 36 als „sonstiges", und
 *   59 % aller Tickets fehlten in jeder Kennzahl.
 * - `fixup-bein`: kein implement, fixup erst NACH dem ersten Siegel — Nacharbeit eines
 *   bereits versiegelten Tickets. Würde Schleifen-Raten aufblähen, ohne Erstumsetzung zu sein.
 * - `abgebrochen`: kein documenter — endete vor dem Merge (needs-human, Abbruch, verfallen).
 * - `sonstiges`: alles andere (z. B. reine Analyse-Läufe mit Siegel, documenter-Re-Seals).
 * Beide vollständigen Klassen bilden die KPI-Basis, getrennt nach Herkunft ausweisbar;
 * ausgeschlossene Klassen erscheinen nur als Fußnote mit ihrer Summe.
 */
export type TicketClass = 'vollstaendig' | 'extern-vollstaendig' | 'fixup-bein' | 'abgebrochen' | 'sonstiges';

export const CLASS_LABEL: Record<TicketClass, string> = {
	vollstaendig: 'vollständig',
	'extern-vollstaendig': 'extern vollständig',
	'fixup-bein': 'Fixup-Bein',
	abgebrochen: 'abgebrochen',
	sonstiges: 'sonstiges',
};

/** Vollständige Klassen — die Basis aller Auswertungs-Kennzahlen. */
export const isComplete = (cls: TicketClass): boolean => cls === 'vollstaendig' || cls === 'extern-vollstaendig';

/** Herkunft eines vollständigen Tickets: Pipeline (implement) oder extern umgesetzt. */
export type Origin = 'pipeline' | 'extern';
export const originOf = (cls: TicketClass): Origin => (cls === 'vollstaendig' ? 'pipeline' : 'extern');

const byTime = (a: CostEntry, b: CostEntry): number =>
	a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0;

/** Klassifikation nach Pipeline-Vollständigkeit — Doku am Typ `TicketClass`. */
export function classifyTicket(entries: readonly CostEntry[]): TicketClass {
	const sorted = [...entries].sort(byTime);
	const firstSeal = sorted.findIndex((e) => e.phase === 'documenter');
	if (firstSeal < 0) return 'abgebrochen';
	if (sorted.some((e) => e.phase === 'implement')) return 'vollstaendig';
	const beforeSeal = sorted.slice(0, firstSeal);
	// `team` = lokaler Dev-Team-Lauf (.claude/skills/dev-team/SKILL.md): Umsetzung UND Review
	// passieren ausserhalb der Pipeline, es gibt also weder implement- noch review-Eintrag.
	// Ohne diese Phase hier fiele so ein Ticket trotz Siegel als „sonstiges" aus jeder Kennzahl.
	if (beforeSeal.some((e) => e.phase === 'review' || e.phase === 'fixup' || e.phase === 'team'))
		return 'extern-vollstaendig';
	if (sorted.slice(firstSeal + 1).some((e) => e.phase === 'fixup')) return 'fixup-bein';
	return 'sonstiges';
}

/** Ticket mit Klasse und Abschlusswoche — die Zwischenform beider Berichte. */
export type ClassifiedTicket = TicketEntries & {
	class: TicketClass;
	/** ISO-Woche des Siegels (letzter documenter-Lauf); undefined ohne Siegel. */
	sealWeek?: string;
	/** Zeitstempel des Siegels — Sortierschlüssel für Ticket-Fenster („letzte 20"). */
	sealTs?: string;
};

export const classifyAll = (tickets: readonly TicketEntries[]): ClassifiedTicket[] =>
	tickets.map((t) => {
		const seal = t.entries
			.filter((e) => e.phase === 'documenter')
			.map((e) => e.timestamp)
			.sort()
			.pop();
		return { ...t, class: classifyTicket(t.entries), sealWeek: sealWeek(t.entries), sealTs: seal };
	});

/** Mindest-n einer Kohorte, damit sie Baseline sein darf. */
export const BASELINE_MIN_N = 20;
/** Fensterbreite der Ticket-Fenster („letzte 20 vs. vorige 20"). */
export const WINDOW = 20;

/**
 * Baseline-Kohorte: per `--baseline` gesetzt, sonst die erste Abschlusswoche mit
 * n ≥ BASELINE_MIN_N, sonst die erste überhaupt. Eine zu kleine Baseline macht jeden
 * Index zum Zufall — deshalb der Schwellwert, deshalb steht n im Kopf.
 */
export const chooseBaseline = (cohorts: ReadonlyMap<string, unknown[]>, override?: string): string | undefined => {
	if (override && cohorts.has(override)) return override;
	const weeks = [...cohorts.keys()].sort();
	return weeks.find((w) => (cohorts.get(w)?.length ?? 0) >= BASELINE_MIN_N) ?? weeks[0];
};

/** Vollständige Tickets chronologisch nach Siegel — Basis der Ticket-Fenster. */
export const completeBySeal = (tickets: readonly ClassifiedTicket[]): ClassifiedTicket[] =>
	tickets
		.filter((t) => isComplete(t.class) && t.sealTs)
		.sort((a, b) => (a.sealTs as string).localeCompare(b.sealTs as string));

/** Kohorten je Abschlusswoche (nur vollständige Tickets). */
export const cohortsBySealWeek = (tickets: readonly ClassifiedTicket[]): Map<string, ClassifiedTicket[]> => {
	const out = new Map<string, ClassifiedTicket[]>();
	for (const t of tickets) {
		if (!isComplete(t.class) || !t.sealWeek) continue;
		getOrInit(out, t.sealWeek, () => []).push(t);
	}
	return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
};

/** Wert (valueCost) eines Tickets — die Größe hinter „Kosten je Ticket". */
const ticketValue = (t: TicketEntries): number => t.entries.reduce((a, e) => a + ZERO(e.valueCost), 0);
const isMeasuring = (t: TicketEntries): boolean => ticketValue(t) > 0;

/** Ticket-Fenster: letzte `n` und die `n` davor — undefined, wenn das ältere Fenster nicht voll ist. */
export const windows = <T>(sorted: readonly T[], n: number): { last: T[]; prev?: T[] } => ({
	last: sorted.slice(-n),
	prev: sorted.length >= 2 * n ? sorted.slice(-2 * n, -n) : undefined,
});

/** Laufende Woche = Woche des jüngsten Laufs überhaupt; ihre Kohorte ist noch offen. */
const currentWeekOf = (entries: readonly CostEntry[]): string | undefined => {
	const last = entries
		.map((e) => e.timestamp)
		.sort()
		.pop();
	return last === undefined ? undefined : weekOf(last);
};

export type ReportOptions = { baseline?: string; interventions?: Intervention[]; goals?: CostGoals };

/** Markdown-Bericht: KPIs mit Baseline/Index, Phasen, Block-Kosten, Trend, Kohorten, Ticket-Tabelle. */
export function renderReport(dir: string, opts: ReportOptions = {}): string {
	// EINMAL lesen, mehrfach auswerten. VOLLSTÄNDIGKEITS-FILTER: alle Kennzahlen laufen NUR
	// über vollständige Tickets (`classifyTicket`); Fixup-Beine, abgebrochene und sonstige
	// Durchläufe verzerrten Ø je Ticket und Review-Runden — als Fußnote bleiben sie sichtbar.
	const interventions = opts.interventions ?? loadInterventions();
	const goals = opts.goals ?? loadGoals();
	const ivDays = new Set(interventions.map((iv) => iv.date));
	const { tickets: rawAll, skipped } = readTickets(dir);
	const classified = classifyAll(rawAll);
	const raw = classified.filter((t) => isComplete(t.class));
	const excluded = classified.filter((t) => !isComplete(t.class));
	const exStats = excluded.reduce(
		(a, t) => {
			for (const e of t.entries) {
				a.runs += 1;
				a.turns += ZERO(e.turns);
				a.valueCost += ZERO(e.valueCost);
			}
			return a;
		},
		{ runs: 0, turns: 0, valueCost: 0 },
	);
	const tickets = raw.map(ticketTotal).sort(byValue);
	const lines: string[] = [];
	lines.push('## 📊 Token- & Kosten-Übersicht — vollständige Tickets', '');
	if (raw.length === 0) {
		lines.push(
			`Keine vollständigen Datensätze unter \`${dir}\` (${excluded.length} unvollständige ausgeschlossen).`,
			'',
		);
		return `${lines.join('\n')}\n`;
	}

	// Einträge in der Reihenfolge der Tabelle unten (Wert absteigend) — `totalsByPhase` ordnet
	// die Phasen nach ihrem ersten Auftreten in der Eingabe, und diese Reihenfolge ist die
	// bisherige des Berichts.
	const byIssue = new Map(raw.map((t) => [t.issue, t.entries]));
	const allEntries: CostEntry[] = tickets.flatMap((t) => byIssue.get(t.issue) ?? []);
	const phases = totalsByPhase(allEntries);
	const sum = tickets.reduce(
		(a, t) => ({
			runs: a.runs + t.runs,
			turns: a.turns + t.turns,
			tokensIn: a.tokensIn + t.tokensIn,
			tokensOut: a.tokensOut + t.tokensOut,
			valueCost: a.valueCost + t.valueCost,
			cost: a.cost + t.cost,
		}),
		{ runs: 0, turns: 0, tokensIn: 0, tokensOut: 0, valueCost: 0, cost: 0 },
	);
	const anyTurns = sum.turns > 0;
	// Zeitraum über ALLE Tickets (min/max), nicht über die Enden der wert-sortierten
	// Liste — der billigste Ticket-Datensatz stammt selten vom ersten Tag. Anzeige in
	// Berlin-Tagen, wie überall im Report.
	const first = tickets.reduce((min, t) => (t.first < min ? t.first : min), tickets[0].first);
	const last = tickets.reduce((max, t) => (t.last > max ? t.last : max), tickets[0].last);
	const pipelineCount = raw.filter((t) => t.class === 'vollstaendig').length;
	lines.push(
		`**${tickets.length} vollständige Tickets (${pipelineCount} Pipeline · ${raw.length - pipelineCount} extern) · ${sum.runs} Läufe · Zeitraum ${berlinDay(first)} bis ${berlinDay(last)}**`,
		'',
	);

	// ─── KPI-Kopf mit Baseline, Index und Ticket-Fenster ────────────────────────
	// Die Ziele aus docs/kosten-optimierungsplan.md („Erfolgsmessung") gegen die Ist-Werte —
	// und gegen die Baseline-Kohorte, denn „hat die letzte Harness-Änderung etwas gebracht"
	// ist eine relative Frage. Jede Kennzahl ist eine Funktion über eine Ticket-Menge, damit
	// Ist, Baseline und die beiden 20er-Fenster mit derselben Rechnung entstehen.
	const cohorts = cohortsBySealWeek(classified);
	const baselineWeek = chooseBaseline(cohorts, opts.baseline);
	const baseline = baselineWeek ? (cohorts.get(baselineWeek) ?? []) : [];
	const chrono = completeBySeal(classified);
	const win = windows(chrono, WINDOW);
	const currentWeek = currentWeekOf(rawAll.flatMap((t) => t.entries));
	// Messende Läufe (valueCost > 0) — Datenbasis für Trend, Richtung und den
	// Wochen-Änderungsbericht. 0-Wert-Läufe (:free) wären Rauschen, nicht Kosten.
	const messende = allEntries.filter((e) => ZERO(e.valueCost) > 0);
	// Richtungsfenster: letzte 7 Kalendertage gegen die 8–14 davor; Anker ist der jüngste
	// messende Datensatz (deterministisch aus den Daten statt von der Wanduhr). EINE
	// Rechnung, zwei Sichten — die Richtung-Sektion unten rendert die Tabelle, der
	// Änderungsbericht oben zieht die größten Bewegungen heraus.
	const anchorDay = Math.max(...messende.map((e) => Date.parse(`${berlinDay(e.timestamp)}T00:00:00Z`)));
	const dirNew = new Map<string, { runs: number; vc: number }>();
	const dirOld = new Map<string, { runs: number; vc: number }>();
	const addDir = (m: Map<string, { runs: number; vc: number }>, ph: string, vc: number): void => {
		const x = getOrInit(m, ph, () => ({ runs: 0, vc: 0 }));
		x.runs += 1;
		x.vc += vc;
	};
	for (const e of messende) {
		const age = (anchorDay - Date.parse(`${berlinDay(e.timestamp)}T00:00:00Z`)) / 86_400_000;
		if (age < 0 || age > 13) continue;
		const fenster = age <= 6 ? dirNew : dirOld;
		const ph = e.phase ?? '(ohne)';
		addDir(fenster, ph, ZERO(e.valueCost));
		addDir(fenster, '(gesamt)', ZERO(e.valueCost));
	}

	type Metric = (set: readonly ClassifiedTicket[]) => number;
	// Pipeline und extern sind zwei Populationen (extern = Review-only-Durchläufe, Median
	// deutlich billiger). Gemischt würde jede Verschiebung des Extern-Anteils wie eine
	// Kostenänderung aussehen — deshalb Ticket-Kennzahlen je Herkunft.
	const ofOrigin = (set: readonly ClassifiedTicket[], origin: Origin): ClassifiedTicket[] =>
		set.filter((t) => originOf(t.class) === origin);
	const medianCost: Metric = (set) => median(set.filter(isMeasuring).map(ticketValue));
	const p75Cost: Metric = (set) => quantileOf(set.filter(isMeasuring).map(ticketValue), 0.75);
	const medianCostOf =
		(origin: Origin): Metric =>
		(set) =>
			medianCost(ofOrigin(set, origin));
	const p75CostOf =
		(origin: Origin): Metric =>
		(set) =>
			p75Cost(ofOrigin(set, origin));
	const reviewRounds: Metric = (set) => {
		const withReview = set.filter((t) => t.entries.some((e) => e.phase === 'review'));
		return withReview.length > 0
			? withReview.reduce((a, t) => a + t.entries.filter((e) => e.phase === 'review').length, 0) / withReview.length
			: Number.NaN;
	};
	const reviewRoundsOf =
		(origin: Origin): Metric =>
		(set) =>
			reviewRounds(ofOrigin(set, origin));
	const reviewCoverage: Metric = (set) =>
		set.length > 0 ? set.filter((t) => t.entries.some((e) => e.phase === 'review')).length / set.length : Number.NaN;
	const cacheRatio =
		(provider: string): Metric =>
		(set) => {
			const es = set
				.flatMap((t) => t.entries)
				.filter((e) => e.provider === provider && typeof e.cacheReadTokens === 'number');
			const input = es.reduce((a, e) => a + ZERO(e.tokensIn), 0);
			return input > 0 ? es.reduce((a, e) => a + ZERO(e.cacheReadTokens), 0) / input : Number.NaN;
		};
	const claudeClassShare =
		(cls: 'flagship' | 'small'): Metric =>
		(set) => {
			const es = set.flatMap((t) => t.entries).filter((e) => e.provider === 'claude' && typeof e.model === 'string');
			return es.length > 0 ? es.filter((e) => classifyModel(e.model as string) === cls).length / es.length : Number.NaN;
		};
	const providerShare =
		(provider: string): Metric =>
		(set) => {
			const es = set.flatMap((t) => t.entries);
			return es.length > 0 ? es.filter((e) => e.provider === provider).length / es.length : Number.NaN;
		};
	// Turns je Pipeline-Ticket wie im Turn-Report (Issue #1197): Summe der erfassten turns
	// je Ticket, nur Tickets mit mindestens einem gemessenen Lauf — Lücken sind keine 0.
	const ticketTurns = (t: ClassifiedTicket): number | undefined => {
		const ms = t.entries.filter((e) => typeof e.turns === 'number');
		return ms.length > 0 ? ms.reduce((a, e) => a + (e.turns as number), 0) : undefined;
	};
	const medTurns: Metric = (set) =>
		median(
			ofOrigin(set, 'pipeline')
				.map(ticketTurns)
				.filter((n): n is number => n !== undefined),
		);
	const firstPassRate: Metric = (set) => {
		const pipe = ofOrigin(set, 'pipeline');
		return pipe.length > 0
			? pipe.filter((t) => !t.entries.some((e) => e.phase === 'fixup')).length / pipe.length
			: Number.NaN;
	};
	const firstPassText = (set: readonly ClassifiedTicket[]): string => {
		const pipe = ofOrigin(set, 'pipeline');
		return shareWithInterval(pipe.filter((t) => !t.entries.some((e) => e.phase === 'fixup')).length, pipe.length);
	};

	const fmtVal = (v: number, f: (n: number) => string): string => (Number.isFinite(v) ? f(v) : '—');
	type KpiVals = { ist: number; base: number; last20: number; prev20: number };
	type Kpi = {
		label: string;
		metric: Metric;
		f: (n: number) => string;
		/** Schlüssel in docs/kosten-ziele.json — goal-Text und ok-Schwelle dort pflegbar. */
		key?: string;
		goal: string;
		/** undefined = „nicht bewertbar" (z. B. Fenster noch nicht voll) → Status „—". */
		ok?: (c: KpiVals) => boolean | undefined;
		origin?: Origin;
		/** Ist-Zelle statt k.f (Erstgrün als k/n mit Wilson-Intervall). */
		istText?: (set: readonly ClassifiedTicket[]) => string;
	};
	const goalOf = (key: string, fallback: string): string => goals.kpis?.[key]?.goal ?? fallback;
	// okMax/okMin aus kosten-ziele.json überschreiben die Code-Schwelle; ohne Schwelle dort
	// gilt das Fallback-Prädikat (Richtungs-Ziele wie „sinkend" bleiben sowieso im Code).
	const okOf = (
		key: string,
		fallback: (c: KpiVals) => boolean | undefined,
	): ((c: KpiVals) => boolean | undefined) | undefined => {
		const g = goals.kpis?.[key];
		if (g && (typeof g.okMax === 'number' || typeof g.okMin === 'number')) {
			return (c) => (typeof g.okMax === 'number' ? c.ist <= g.okMax : c.ist >= (g.okMin as number));
		}
		return fallback;
	};
	// EINE Liste, zwei Sichten: die Zeilen mit Ziel speisen das Status-Dashboard oben, die
	// volle Liste die Detail-Tabelle unten — so laufen die Kennzahlen nicht auseinander.
	const kpis: Kpi[] = [
		{
			label: 'Kosten je Ticket Pipeline — Median (messende)',
			key: 'kostenJeTicketPipelineMedian',
			metric: medianCostOf('pipeline'),
			f: usd,
			goal: goalOf('kostenJeTicketPipelineMedian', '<= $3.00'),
			ok: okOf('kostenJeTicketPipelineMedian', (c) => c.ist <= 3),
			origin: 'pipeline',
		},
		{ label: 'Kosten je Ticket Pipeline — p75', metric: p75CostOf('pipeline'), f: usd, goal: '—', origin: 'pipeline' },
		{
			label: 'Turns je Ticket Pipeline — Median',
			key: 'turnsJeTicketPipeline',
			metric: medTurns,
			f: num,
			goal: goalOf('turnsJeTicketPipeline', 'Index sinkend (< 100)'),
			ok: okOf('turnsJeTicketPipeline', (c) => (c.base > 0 ? c.ist < c.base : undefined)),
			origin: 'pipeline',
		},
		{
			label: 'First-Pass-Grün Pipeline (kein Fixup)',
			key: 'firstPassGruenPipeline',
			metric: firstPassRate,
			f: pct,
			goal: goalOf('firstPassGruenPipeline', 'steigend'),
			ok: okOf('firstPassGruenPipeline', (c) => (Number.isFinite(c.prev20) ? c.last20 > c.prev20 : undefined)),
			origin: 'pipeline',
			istText: firstPassText,
		},
		{
			label: 'Kosten je Ticket extern — Median (messende)',
			metric: medianCostOf('extern'),
			f: usd,
			goal: '—',
			origin: 'extern',
		},
		{ label: 'Kosten je Ticket extern — p75', metric: p75CostOf('extern'), f: usd, goal: '—', origin: 'extern' },
		{
			label: 'Review-Runden je Ticket Pipeline (mit Review)',
			key: 'reviewRundenPipeline',
			metric: reviewRoundsOf('pipeline'),
			f: (v) => frac(v, 1),
			goal: goalOf('reviewRundenPipeline', '<= 1,2'),
			ok: okOf('reviewRundenPipeline', (c) => c.ist <= 1.2),
			origin: 'pipeline',
		},
		{
			label: 'Review-Runden je Ticket extern (mit Review)',
			key: 'reviewRundenExtern',
			metric: reviewRoundsOf('extern'),
			f: (v) => frac(v, 1),
			goal: goalOf('reviewRundenExtern', '<= 1,2'),
			ok: okOf('reviewRundenExtern', (c) => c.ist <= 1.2),
			origin: 'extern',
		},
		{ label: 'Review-Abdeckung (Tickets mit Review)', metric: reviewCoverage, f: pct, goal: '—' },
		{
			label: 'Cache-Effizienz claude (Read / Input)',
			key: 'cacheEffizienzClaude',
			metric: cacheRatio('claude'),
			f: pct,
			goal: goalOf('cacheEffizienzClaude', '> 95 %'),
			ok: okOf('cacheEffizienzClaude', (c) => c.ist > 0.95),
		},
		{ label: 'Cache-Effizienz zai', metric: cacheRatio('zai'), f: pct, goal: '—' },
		{ label: 'Cache-Effizienz openrouter', metric: cacheRatio('openrouter'), f: pct, goal: '—' },
		{
			label: 'Flagship-Anteil der Claude-Läufe',
			key: 'flagshipAnteilClaude',
			metric: claudeClassShare('flagship'),
			f: pct,
			goal: goalOf('flagshipAnteilClaude', '<= 10 %'),
			ok: okOf('flagshipAnteilClaude', (c) => c.ist <= 0.1),
		},
		{
			label: 'Small-Anteil der Claude-Läufe (haiku)',
			key: 'smallAnteilClaude',
			metric: claudeClassShare('small'),
			f: pct,
			goal: goalOf('smallAnteilClaude', '> 50 %'),
			ok: okOf('smallAnteilClaude', (c) => c.ist > 0.5),
		},
		{ label: 'Provider-Mix claude', metric: providerShare('claude'), f: pct, goal: '—' },
		{ label: 'Provider-Mix zai', metric: providerShare('zai'), f: pct, goal: '—' },
		{ label: 'Provider-Mix openrouter', metric: providerShare('openrouter'), f: pct, goal: '—' },
	];
	// Ticket-Fenster je Herkunft: „letzte 20 Pipeline-Tickets" statt „Pipeline-Anteil der
	// letzten 20 Tickets" — sonst vergleicht das Fenster bei wechselndem Mix 3 mit 17 Tickets.
	const kpiCompute = (k: Kpi): KpiVals => {
		const pool = k.origin ? ofOrigin(chrono, k.origin) : chrono;
		const w = k.origin ? windows(pool, WINDOW) : win;
		return {
			ist: k.metric(raw),
			base: k.metric(baseline),
			last20: k.metric(w.last),
			prev20: w.prev ? k.metric(w.prev) : Number.NaN,
		};
	};
	const kpiStatus = (k: Kpi, c: KpiVals): string => {
		if (!k.ok || !Number.isFinite(c.ist)) return '—';
		const verdict = k.ok(c);
		return verdict === undefined ? '—' : verdict ? '🟢' : '🔴';
	};
	const kpiRow = (k: Kpi): string => {
		const c = kpiCompute(k);
		return `| ${k.label} | ${k.istText ? k.istText(raw) : fmtVal(c.ist, k.f)} | ${fmtVal(c.base, k.f)} | ${fmtIndex(indexTo(c.base, c.ist))} | ${trendArrow(c.prev20, c.last20)} | ${k.goal} | ${kpiStatus(k, c)} |`;
	};
	const nOf = (set: readonly ClassifiedTicket[]): string =>
		`n=${ofOrigin(set, 'pipeline').length}/${ofOrigin(set, 'extern').length}`;
	const baselineNote = baselineWeek ? `${baselineWeek} (${nOf(baseline)})` : '—';

	// ─── Status: die Ziel-KPIs auf einen Blick ─────────────────────────────────
	// Erste Sektion des Reports: erfüllt/verfehlt, ohne durch die Detail-Tabelle zu lesen.
	const targets = kpis.filter((k) => k.ok);
	const fulfilled = targets.filter((k) => kpiStatus(k, kpiCompute(k)) === '🟢').length;
	lines.push('### Status — Ziele auf einen Blick', '');
	lines.push(`**${fulfilled} von ${targets.length} Zielen erfüllt**`, '');
	lines.push('| Ziel-KPI | Ist | Ziel | Index | Trend | Status |', '| --- | ---: | ---: | ---: | :---: | :---: |');
	for (const k of targets) {
		const c = kpiCompute(k);
		lines.push(
			`| ${k.label} | ${k.istText ? k.istText(raw) : fmtVal(c.ist, k.f)} | ${k.goal} | ${fmtIndex(indexTo(c.base, c.ist))} | ${trendArrow(c.prev20, c.last20)} | ${kpiStatus(k, c)} |`,
		);
	}
	lines.push(
		'',
		'> Index und Trend wie in der Kennzahlen-Tabelle unten erklärt; „—" = nicht messbar bzw. Fenster noch',
		'> nicht voll (Richtungs-Ziele). Erstgrün als k/n mit Wilson-Intervall ab n >= 8.',
		'',
	);

	// ─── Was hat sich verändert — letzte Siegelwoche ───────────────────────────
	// Die Änderungen stehen sonst verstreut (Kohorten-Tabelle, Ampel-Trend, Richtung) —
	// hier die Kurzfassung: was frisch versiegelt wurde und wo sich am meisten bewegt hat.
	const sealWeeks = [...cohorts.keys()].sort();
	const lastSealWeek = sealWeeks.at(-1);
	if (lastSealWeek) {
		const cohort = (cohorts.get(lastSealWeek) ?? []).sort((a, b) => ticketValue(b) - ticketValue(a));
		const weekValue = cohort.reduce((a, t) => a + ticketValue(t), 0);
		const pipeMedian = medianCostOf('pipeline')(raw);
		const ticketLink = (issue: string): string =>
			`[#${issue}](https://github.com/deleonio/priority-pilot/issues/${issue})`;
		const weekMark = (wk: string): string => (wk === currentWeek ? `${wk}*` : wk);
		lines.push('### Was hat sich verändert — letzte Woche', '');
		lines.push(
			`**${weekMark(lastSealWeek)}: ${cohort.length} Tickets versiegelt · ${usd(weekValue)} gesamt · ${usd(weekValue / cohort.length)} je Ticket**`,
			'',
		);
		lines.push('| Ticket | Herkunft | Wert (USD) | gegen Median Pipeline |', '| --- | --- | ---: | :--- |');
		for (const t of cohort) {
			const gegen = Number.isFinite(pipeMedian)
				? ticketValue(t) >= pipeMedian
					? `über Median (${usd(pipeMedian)})`
					: `unter Median (${usd(pipeMedian)})`
				: '—';
			lines.push(
				`| ${ticketLink(t.issue)} | ${originOf(t.class) === 'pipeline' ? 'Pipeline' : 'Extern'} | ${usd(ticketValue(t))} | ${gegen} |`,
			);
		}
		// Größte Bewegung aus den Richtungsfenstern (oben einmal gerechnet, „Richtung" unten)
		const movers = phases
			.map((p) => p.phase)
			.flatMap((ph) => {
				const alt = dirOld.get(ph);
				const neu = dirNew.get(ph);
				return alt && alt.runs >= 2 && neu && neu.runs >= 2
					? [{ ph, alt: alt.vc / alt.runs, neu: neu.vc / neu.runs }]
					: [];
			})
			.sort((a, b) => Math.abs(b.neu / b.alt - 1) - Math.abs(a.neu / a.alt - 1))
			.slice(0, 2);
		if (movers.length > 0)
			lines.push(
				'',
				`Größte Bewegung je Phase (letzte 7 vs. 8–14 Tage): ${movers
					.map((m) => `${m.ph} ${trendArrow(m.alt, m.neu)} (${usd(m.alt)} → ${usd(m.neu)})`)
					.join(' · ')}.`,
			);
		lines.push(
			'',
			'> Anker ist die Siegelwoche (Woche des letzten documenter-Laufs); „*" = laufende Woche, ihre Kohorte ist noch offen.',
			'> Median = messende Pipeline-Tickets über alle Wochen. Bewegung = Ø Wert je Run, 7 gegen 8–14 Tage (wie „Richtung" unten).',
			'',
		);
	}

	lines.push('### Kennzahlen — Ist, Baseline, Fenster', '');
	lines.push(
		`| Kennzahl | Ist (${nOf(raw)}) | Baseline ${baselineNote} | Index | Δ letzte ${WINDOW} vs. vorige ${WINDOW} Tickets | Ziel | Status |`,
		'| --- | ---: | ---: | ---: | :---: | ---: | :---: |',
		...kpis.map(kpiRow),
		'',
		'> Ziele aus `docs/kosten-ziele.json` (KPI-Definitionen: `docs/kosten-optimierungsplan.md`, „Erfolgsmessung"). n = Pipeline/extern. Index = Ist / Baseline × 100 (Baseline = erste',
		`> Abschlusswoche mit n ≥ ${BASELINE_MIN_N}, per \`--baseline\` änderbar). Δ vergleicht die letzten ${WINDOW}`,
		`> versiegelten Tickets (je Herkunft) mit den ${WINDOW} davor („→" = unter ±10 %, „—" = älteres Fenster nicht voll).`,
		'> Modell-Klassen (`classifyModel`) statt Namens-Regex; Cache je Provider, weil das Ziel dem',
		'> Claude-Fuhrpark gilt und openrouter-Läufe den Gesamtwert sonst rot färben. Kohorten-Anker',
		'> ist die Abschlusswoche (Siegel), nicht die Woche der einzelnen Läufe.',
		'',
	);

	// ─── Phasen-Tabelle ────────────────────────────────────────────────────────
	const blockTokens = (p: PhaseTotal): { input: number; write: number; read: number } => ({
		input: Math.max(0, p.tokensIn - p.cacheCreationTokens - p.cacheReadTokens),
		write: p.cacheCreationTokens,
		read: p.cacheReadTokens,
	});
	lines.push(
		'| Phase | Läufe | Turns | Input | Cache-W (1,25×) | Cache-R (0,1×) | Token out | Wert (USD) | Anteil |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |',
	);
	for (const p of phases) {
		const b = blockTokens(p);
		lines.push(
			`| ${p.phase} | ${p.runs} | ${anyTurns ? num(p.turns) : '—'} | ${mio(b.input)} | ${mio(b.write)} | ${mio(b.read)} | ${num(p.tokensOut)} | ${usd(p.valueCost)} | ${bar(p.valueCost, sum.valueCost)} |`,
		);
	}
	const sumBlocks = phases.reduce(
		(a, p) => {
			const b = blockTokens(p);
			return { input: a.input + b.input, write: a.write + b.write, read: a.read + b.read };
		},
		{ input: 0, write: 0, read: 0 },
	);
	lines.push(
		`| **Summe** | **${sum.runs}** | **${anyTurns ? num(sum.turns) : '—'}** | **${mio(sumBlocks.input)}** | **${mio(sumBlocks.write)}** | **${mio(sumBlocks.read)}** | **${num(sum.tokensOut)}** | **${usd(sum.valueCost)}** | ${bar(1, 1)} |`,
		'',
	);

	// ─── Block-Kosten EXAKT je Eintrag ─────────────────────────────────────────
	// Jeder messende Eintrag wird mit den Bewertungspreisen SEINES Modells in die vier
	// Blöcke zerlegt (dieselbe Wahl wie valueCost, s. `valueRates`). Die frühere Näherung
	// bewertete alle Token zu mid-Preisen (3/15) und skalierte auf die Summe — bei 75 %
	// GLM-Läufen war Output um ~20 % über-, Cache-Read um 8 Punkte unterzeichnet. Einträge
	// ohne Cache-Aufschlüsselung zählen komplett als echter Input. Messende Läufe: oben
	// definiert (eine Rechnung für Trend, Richtung und Änderungsbericht).
	const blocks: BlockUsd & { tokens: { input: number; write: number; read: number; output: number } } = {
		input: 0,
		write: 0,
		read: 0,
		output: 0,
		tokens: { input: 0, write: 0, read: 0, output: 0 },
	};
	for (const e of messende) {
		const write = ZERO(e.cacheCreationTokens);
		const read = ZERO(e.cacheReadTokens);
		const tokensOf = {
			inputTokens: Math.max(0, e.tokensIn - write - read),
			cacheCreationTokens: write,
			cacheReadTokens: read,
			outputTokens: e.tokensOut,
		};
		const [inRate, outRate] = valueRates(e.model ?? '');
		const b = usageBlocksUsd(tokensOf, inRate, outRate);
		blocks.input += b.input;
		blocks.write += b.write;
		blocks.read += b.read;
		blocks.output += b.output;
		blocks.tokens.input += tokensOf.inputTokens;
		blocks.tokens.write += write;
		blocks.tokens.read += read;
		blocks.tokens.output += e.tokensOut;
	}
	const blockSum = blocks.input + blocks.write + blocks.read + blocks.output;
	const blockRow = (label: string, tokens: number, value: number): string =>
		`| ${label} | ${mio(tokens)} | ${usd(value)} | ${bar(value, blockSum)} |`;
	lines.push(
		'### Kosten nach Block — messende Läufe',
		'',
		'| Block | Token | Wert (USD) | Anteil |',
		'| --- | ---: | ---: | :--- |',
		blockRow('Input (echt)', blocks.tokens.input, blocks.input),
		blockRow('Cache-Write (1,25×)', blocks.tokens.write, blocks.write),
		blockRow('Cache-Read (0,1×)', blocks.tokens.read, blocks.read),
		blockRow('Output', blocks.tokens.output, blocks.output),
		'',
		'> Je Eintrag zu den Bewertungspreisen seines Modells zerlegt (Summe = Wert der messenden',
		'> Läufe). Cache-Read ist rabattiert, aber bei hoher Turn-Zahl der größte Treiber; Output',
		'> ist pro Token am teuersten. Läufe ohne Messung (valueCost 0) fehlen hier.',
		'',
	);

	// ─── Zeitlicher Trend (Läufe, Berlin-Tage, letzte 60 Tage) ─────────────────
	// Tagesmittel glätten Ticket-Streuung, der 7-Tage-Median glättet die Tage. Begrenzt auf
	// 60 Tage: eine x-Achse mit jedem Tag seit Messbeginn wird nach einem Quartal unlesbar.
	const TREND_DAYS = 60;
	const byDay = new Map<string, { runs: number; vc: number }>();
	const byWeek = new Map<string, { runs: number; vc: number }>();
	const byWeekPhase = new Map<string, Map<string, { runs: number; vc: number }>>();
	const byWeekProvider = new Map<string, Map<string, { turns: number; vc: number }>>();
	for (const e of messende) {
		const vc = ZERO(e.valueCost);
		const day = berlinDay(e.timestamp);
		const d = getOrInit(byDay, day, () => ({ runs: 0, vc: 0 }));
		d.runs += 1;
		d.vc += vc;
		const wk = isoWeek(day);
		const w = getOrInit(byWeek, wk, () => ({ runs: 0, vc: 0 }));
		w.runs += 1;
		w.vc += vc;
		const pw = getOrInit(
			getOrInit(byWeekPhase, wk, () => new Map()),
			e.phase ?? '(ohne)',
			() => ({ runs: 0, vc: 0 }),
		);
		pw.runs += 1;
		pw.vc += vc;
		if (typeof e.turns === 'number' && e.turns > 0) {
			const pv = getOrInit(
				getOrInit(byWeekProvider, wk, () => new Map()),
				e.provider ?? '?',
				() => ({ turns: 0, vc: 0 }),
			);
			pv.turns += e.turns;
			pv.vc += vc;
		}
	}
	const allDays = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
	const days = allDays.slice(-TREND_DAYS);
	if (days.length > 0) {
		lines.push(`### Zeitlicher Trend — nur messende Läufe, letzte ${TREND_DAYS} Tage`, '');
		const perRun = days.map(([, v]) => v.vc / v.runs);
		// „*" hinter dem Tag = Harness-Intervention — Bewegungen im Chart lassen sich so direkt
		// einer Änderung zuordnen (ASCII wie beim Wochen-Stern der laufenden Woche).
		const markDay = (day: string): string => (ivDays.has(day) ? `${day.slice(5)}*` : day.slice(5));
		const dayLabels = days.map(([d]) => markDay(d));
		lines.push(
			...xychart({
				title: 'Ø Kosten je Run (USD)',
				labels: dayLabels,
				yLabel: 'Ø USD je Run',
				yMax: Math.max(2, Math.ceil(Math.max(...perRun) + 0.5)),
				series: [
					{ kind: 'bar', name: 'Ø je Run', values: perRun, digits: 3 },
					{ kind: 'line', name: '7-Tage-Median', values: rollingMedian(perRun, 7), digits: 3 },
				],
			}),
		);
		// Kumulierte Linie im EIGENEN Chart — andere Skala als der Ø-Balken, gemeinsame
		// Achse würde die Balken plätten.
		let cum = 0;
		const cumSeries = days.map(([, v]) => (cum += v.vc));
		lines.push(
			...xychart({
				title: `Kumulierter Wert (USD, ${TREND_DAYS} Tage)`,
				labels: dayLabels,
				yLabel: 'USD kumuliert',
				yMax: Math.ceil(cum + 1),
				series: [{ kind: 'line', name: 'Kumuliert', values: cumSeries, digits: 2 }],
			}),
		);
		lines.push(
			'',
			'> Nur Läufe mit Messung (valueCost > 0, seit #984). Wenige Runs pro Tag können den',
			'> Tageswert stark bewegen — der 7-Tage-Median zählt, nicht der Einzelpunkt. Tages-Grenzen gelten in Berliner Zeit.',
			...(ivDays.size > 0
				? ['> „*" hinter dem Tag = Harness-Intervention (docs/kosten-interventionen.json, s. „Interventionen“ unten).']
				: []),
			'',
		);

		// ─── Kohorten je Abschlusswoche: Median, p75, Index (je Herkunft) ────────
		const weeks = [...cohorts.keys()];
		const cohortOf = (wk: string, origin: Origin): ClassifiedTicket[] =>
			ofOrigin(cohorts.get(wk) ?? [], origin).filter(isMeasuring);
		const cohortMedian = (origin: Origin): number[] =>
			weeks.map((wk) => {
				const set = cohortOf(wk, origin);
				return set.length >= MIN_N_COHORT ? medianCost(set) : Number.NaN;
			});
		const medPipe = cohortMedian('pipeline');
		const medExt = cohortMedian('extern');
		const basePipe = medianCostOf('pipeline')(baseline);
		const baseExt = medianCostOf('extern')(baseline);
		// Gleitender Median über die letzten 20 Pipeline-Tickets, am Ende jeder Woche abgelesen.
		const chronoPipe = ofOrigin(chrono, 'pipeline').filter(isMeasuring);
		const rollingAtWeek = weeks.map((wk) => {
			const upTo = chronoPipe.filter((t) => (t.sealWeek as string) <= wk).slice(-WINDOW);
			return upTo.length >= MIN_N_COHORT ? median(upTo.map(ticketValue)) : Number.NaN;
		});
		const mark = (wk: string): string => (wk === currentWeek ? `${wk}*` : wk);
		lines.push('### Kosten je Ticket nach Abschlusswoche', '');
		lines.push(
			'| Abschlusswoche | n Pipeline / extern | Median Pipeline | p75 Pipeline | Index Pipeline | Δ Vorwoche | Rolling-Median Pipeline (letzte 20) | Median extern | Index extern |',
		);
		lines.push('| --- | ---: | ---: | ---: | ---: | :---: | ---: | ---: | ---: |');
		weeks.forEach((wk, i) => {
			const pipe = cohortOf(wk, 'pipeline');
			const ext = cohortOf(wk, 'extern');
			const mp = medPipe[i] as number;
			const prev = i > 0 ? (medPipe[i - 1] as number) : Number.NaN;
			const small = (n: number): string => (n > 0 && n < MIN_N_COHORT ? `${n}†` : String(n));
			lines.push(
				`| ${mark(wk)} | ${small(pipe.length)} / ${small(ext.length)} | ${fmtVal(mp, usd)} | ${pipe.length >= MIN_N_COHORT ? usd(p75Cost(pipe)) : '—'} | ${fmtIndex(indexTo(basePipe, mp))} | ${trendArrow(prev, mp)} | ${fmtVal(rollingAtWeek[i] as number, usd)} | ${fmtVal(medExt[i] as number, usd)} | ${fmtIndex(indexTo(baseExt, medExt[i] as number))} |`,
			);
		});
		lines.push('');
		lines.push(
			...xychart({
				title: `Index Kosten je Ticket, Pipeline (Median, Baseline ${baselineWeek ?? '—'} = 100)`,
				labels: weeks.map(mark),
				yLabel: 'Index',
				series: [
					{ kind: 'bar', name: 'Kohorte', values: medPipe.map((m) => indexTo(basePipe, m)), digits: 0 },
					{ kind: 'line', name: 'Rolling 20', values: rollingAtWeek.map((m) => indexTo(basePipe, m)), digits: 0 },
				],
			}),
		);
		lines.push(
			'',
			'> Kohorte = alle Tickets, die in der Woche versiegelt wurden (ganzer Ticket-Wert), je Herkunft. „†" =',
			`> n < ${MIN_N_COHORT} messende Tickets, Median nicht belastbar und nicht im Chart. „*" = laufende Woche,`,
			'> Kohorte noch offen. Rolling-Median = Median der letzten 20 versiegelten Pipeline-Tickets zum Wochenende.',
			'',
		);

		// ─── Läufe je Woche: Budget-Sicht und Preis je Turn je Provider ───────────
		// Kosten = Turns × Kosten je Turn. Fällt der Wochenwert, sagt diese Tabelle, ob weniger
		// gearbeitet wurde (Turns) oder nur das Preisschild gewechselt hat (Provider-Mix).
		const runWeeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
		const providers = ['claude', 'zai', 'openrouter'];
		// Wochenbudget (kosten-ziele.json): Δ je Woche macht Überschreitungen lesbar, die
		// Monatsprognose linear nach verstrichenen Tagen — Anker ist wie bei „Richtung" der
		// jüngste messende Tag, nicht die Wanduhr (der Report bleibt deterministisch).
		const budget = goals.weeklyBudgetUsd;
		const deltaCell =
			budget !== undefined
				? (vc: number): string => {
						const d = vc - budget;
						return `${d < 0 ? '-' : '+'}$${Math.abs(d).toFixed(2)}${vc > budget ? ' 🔴' : ''}`;
					}
				: undefined;
		lines.push('### Läufe je Woche — Budget und Preis je Turn', '');
		const head = [
			'Woche',
			'Läufe',
			'Wert (USD)',
			...(budget !== undefined ? [`Δ Soll ${usd(budget)}`] : []),
			...providers.map((p) => `$/Turn ${p}`),
		];
		lines.push(`| ${head.join(' | ')} |`);
		lines.push(`| --- |${' ---: |'.repeat(head.length - 1)}`);
		for (const [wk, w] of runWeeks) {
			const pv = byWeekProvider.get(wk);
			const cells = providers.map((p) => {
				const x = pv?.get(p);
				return x && x.turns > 0 ? `$${(x.vc / x.turns).toFixed(3)}` : '—';
			});
			const mid = deltaCell ? [usd(w.vc), deltaCell(w.vc)] : [usd(w.vc)];
			lines.push(`| ${mark(wk)} | ${w.runs} | ${mid.join(' | ')} | ${cells.join(' | ')} |`);
		}
		if (budget !== undefined) {
			const anchorDayStr = new Date(anchorDay).toISOString().slice(0, 10);
			const ym = anchorDayStr.slice(0, 7);
			const mtd = messende
				.filter((e) => berlinDay(e.timestamp).startsWith(ym))
				.reduce((a, e) => a + ZERO(e.valueCost), 0);
			const dayNo = Number(anchorDayStr.slice(8, 10));
			const daysTotal = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
			lines.push(
				'',
				`**Budget:** Soll ${usd(budget)}/Woche · ${ym} bis dato ${usd(mtd)} · Prognose bei gleichem Tempo ${usd((mtd / dayNo) * daysTotal)}/Monat.`,
			);
		}
		lines.push('');
		// Phasen-Trendtabelle: Ø je Phase je Woche PLUS Anteil am Wochenwert — Ø zeigt, ob
		// eine Phase teurer wird, der Anteil, ob sie den Wochenwert dominiert.
		const phaseNames = [...new Set(messende.map((e) => e.phase ?? '(ohne)'))];
		lines.push('Ø Wert je Lauf und Anteil am Wochenwert, je Phase:', '');
		lines.push('| Woche | ' + phaseNames.join(' | ') + ' |');
		lines.push('| --- |' + ' ---: |'.repeat(phaseNames.length));
		for (const [wk, w] of runWeeks) {
			const wm = byWeekPhase.get(wk) ?? new Map<string, { runs: number; vc: number }>();
			const cells = phaseNames.map((ph) => {
				const pw = wm.get(ph);
				return pw ? `$${(pw.vc / pw.runs).toFixed(2)} · ${pct(share(pw.vc, w.vc))}` : '—';
			});
			lines.push(`| ${mark(wk)} | ${cells.join(' | ')} |`);
		}
		lines.push('');

		// ─── Ampel-Trend: Wochen als SPALTEN, Ampel je Zelle gegen die Vorwoche ────
		// Der Blick läuft über die Zeile: jede Zelle zeigt Ø Wert je Run der Woche und die
		// Ampel gegen die Spalte links (🟢 ≥ 10 % billiger, 🟡 ±10 %, 🔴 ≥ 10 % teurer) —
		// so ist eine Verschlechterung einer Phase ohne Kopf-rechnen sichtbar.
		const AMPEL_WEEKS = 10;
		const ampelWeeks = runWeeks.slice(-AMPEL_WEEKS);
		const weekVal = (ph: string, wk: string): number | undefined => {
			if (ph === '(gesamt)') {
				const w = byWeek.get(wk);
				return w && w.runs > 0 ? w.vc / w.runs : undefined;
			}
			const pw = byWeekPhase.get(wk)?.get(ph);
			return pw && pw.runs > 0 ? pw.vc / pw.runs : undefined;
		};
		const ampelCell = (ph: string, wk: string, prevWk?: string): string => {
			const cur = weekVal(ph, wk);
			if (cur === undefined) return '—';
			const prev = prevWk ? weekVal(ph, prevWk) : undefined;
			if (prev === undefined || prev <= 0) return `· ${usd(cur)}`;
			const delta = (cur - prev) / prev;
			return `${delta < -0.1 ? '🟢' : delta <= 0.1 ? '🟡' : '🔴'} ${usd(cur)}`;
		};
		const firstYear = ampelWeeks[0]?.[0].slice(0, 4);
		const headCell = (wk: string): string => {
			const [y, w] = wk.split('-');
			return y === firstYear ? w : wk; // Jahreswechsel in der Spalten-Überschrift sichtbar
		};
		lines.push('### Ampel-Trend — Ø Wert je Run, gegen Vorwoche', '');
		lines.push(`| Phase | ${ampelWeeks.map(([wk]) => headCell(mark(wk))).join(' | ')} |`);
		lines.push(`| --- |${' ---: |'.repeat(ampelWeeks.length)}`);
		for (const ph of [...phaseNames, '(gesamt)']) {
			const label = ph === '(gesamt)' ? '**Alle Phasen**' : ph;
			lines.push(
				`| ${label} | ${ampelWeeks.map(([wk], i) => ampelCell(ph, wk, i > 0 ? ampelWeeks[i - 1][0] : undefined)).join(' | ')} |`,
			);
		}
		lines.push(
			'',
			'> 🟢 ≥ 10 % billiger als die Vorwoche · 🟡 ±10 % (Geld bleibt) · 🔴 ≥ 10 % teurer · „·" = erste Spalte ohne Vorwoche. Ø Wert je Run,',
			'> nur messende Läufe (0-Werte zählen als 0). Letzte 10 Wochen; „*" = laufende Woche, ihre Kohorte ist noch offen.',
			'',
		);

		// ─── Richtung: letzte 7 Kalendertage gegen die 8–14 davor ─────────────────
		// Die Fenster (dirOld/dirNew) rechnet der Report-Kopf einmal vor — hier steht nur
		// die Darstellung; Anker und Schwellen sind dort dokumentiert.
		const avgFenster = (x?: { runs: number; vc: number }): string => (x && x.runs > 0 ? usd(x.vc / x.runs) : '—');
		const richtung = (alt?: { runs: number; vc: number }, neu?: { runs: number; vc: number }): string =>
			!alt || alt.runs < 2 || !neu || neu.runs < 2 ? '—' : trendArrow(alt.vc / alt.runs, neu.vc / neu.runs);
		const richtRow = (label: string, ph: string): void =>
			lines.push(
				`| ${label} | ${avgFenster(dirOld.get(ph))} → ${avgFenster(dirNew.get(ph))} | ${richtung(dirOld.get(ph), dirNew.get(ph))} |`,
			);
		lines.push('### Richtung — letzte 7 vs. 8–14 Tage', '');
		lines.push('| Phase | Ø je Run | Trend |');
		lines.push('| --- | ---: | :---: |');
		for (const ph of phaseNames) {
			if (dirNew.has(ph) || dirOld.has(ph)) richtRow(ph, ph);
		}
		richtRow('**Alle Phasen**', '(gesamt)');
		lines.push(
			'',
			'> Anker ist der jüngste Datensatz (Kalendertage, Berliner Zeit). „—" = zu wenige Runs (< 2) im Fenster,',
			'> „→" = unter ±10 % Änderung. „Alle Phasen" verschiebt sich auch mit dem Phasen-Mix',
			'> (z. B. kaum implement-Läufe im alten Fenster) — je Phase lesen, nicht nur die Summe.',
			'',
		);

		// ─── Interventionen: Ø Wert je Run, 7 Tage davor/danach ────────────────────
		// Kalendertägliches Gegenstück zur Ticket-Kohorten-Sicht im Turn-Report (dort je 20
		// versiegelte Pipeline-Tickets mit Erstgrün/Lead-Time): hier steht der Lauf-Verbrauch
		// rund um die Harness-Änderung — messende Läufe, Davor = Interventionstag −7 … −1,
		// Danach = Interventionstag … +6 (Berliner Tage, ± wie „Richtung" gegen ±10 % Rauschen).
		if (interventions.length > 0) {
			lines.push('### Interventionen — Ø Wert je Run, 7 Tage davor/danach', '');
			lines.push(
				'| Datum | Intervention | Läufe vor/nach | Ø Wert je Run vor → nach | Trend |',
				'| --- | --- | ---: | ---: | :---: |',
			);
			const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);
			for (const iv of interventions) {
				let bRuns = 0;
				let bVc = 0;
				let aRuns = 0;
				let aVc = 0;
				for (const e of messende) {
					const diff = (dayMs(berlinDay(e.timestamp)) - dayMs(iv.date)) / 86_400_000;
					if (diff >= -7 && diff <= -1) {
						bRuns += 1;
						bVc += ZERO(e.valueCost);
					} else if (diff >= 0 && diff <= 6) {
						aRuns += 1;
						aVc += ZERO(e.valueCost);
					}
				}
				const label = iv.issue ? `${iv.label} (#${iv.issue})` : iv.label;
				const cell = (runs: number, vc: number): string => (runs >= 2 ? usd(vc / runs) : '—');
				lines.push(
					`| ${iv.date} | ${label} | ${bRuns}/${aRuns} | ${cell(bRuns, bVc)} → ${cell(aRuns, aVc)} | ${bRuns >= 2 && aRuns >= 2 ? trendArrow(bVc / bRuns, aVc / aRuns) : '—'} |`,
				);
			}
			lines.push(
				'',
				'> Quelle: `docs/kosten-interventionen.json`. Nur messende Läufe (valueCost > 0); „—" = unter 2 Runs',
				'> je Seite. Ticket-Kohorten-Sicht (Turns, Erstgrün, Lead-Time je 20 Tickets) steht im Turn-Report.',
				'',
			);
		}

		// ─── Messabdeckung je Woche ───────────────────────────────────────────────
		// Trends dürfen nicht an Messlücken hängen: Die Turn-Erfassung startete erst W35,
		// Effort-Felder ab 2026-09-06. Ein Sprung in einer Kennzahl, der mit einem Sprung
		// hier zusammenfällt, ist Messung, nicht Wirkung.
		const fields: Array<[string, (e: CostEntry) => boolean]> = [
			['turns', (e) => typeof e.turns === 'number'],
			['valueCost', (e) => ZERO(e.valueCost) > 0],
			['cache', (e) => typeof e.cacheReadTokens === 'number'],
			['model', (e) => typeof e.model === 'string' && e.model.length > 0],
			['effort', (e) => typeof e.effort === 'string'],
			['sidechain', (e) => typeof e.sidechainTokens === 'number'],
		];
		const coverageWeeks = new Map<string, CostEntry[]>();
		for (const e of rawAll.flatMap((t) => t.entries)) getOrInit(coverageWeeks, weekOf(e.timestamp), () => []).push(e);
		lines.push('### Messabdeckung je Woche — alle Läufe', '');
		lines.push(`| Woche | Läufe | ${fields.map(([f]) => f).join(' | ')} |`);
		lines.push(`| --- | ---: |${' ---: |'.repeat(fields.length)}`);
		for (const [wk, es] of [...coverageWeeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
			lines.push(
				`| ${mark(wk)} | ${es.length} | ${fields.map(([, has]) => pct(share(es.filter(has).length, es.length))).join(' | ')} |`,
			);
		}
		lines.push(
			'',
			'> Anteil der Läufe mit dem jeweiligen Feld. Ein Kennzahl-Sprung, der hier mit einem Sprung zusammenfällt, ist Messung, nicht Wirkung.',
			'',
		);
	}

	// ─── Ticket-Tabelle (Top 10 — Optimierungskandidaten) ──────────────────────
	// KEINE Voll-Liste mehr: Mit 440+ Datensätzen sprengt sie die GitHub-Summary (wird
	// still abgeschnitten) und dient der kontinuierlichen Optimierung nichts — die
	// Ausreisser stehen ohnehin oben. Einzelvergleiche über den Fokus-Modus (--issues).
	const TOP_N = 10;
	const classById = new Map(classified.map((t) => [t.issue, t.class]));
	lines.push(`### Ticket-Tabelle — Top ${TOP_N} (Optimierungskandidaten)`, '');
	lines.push(
		'| Ticket | Herkunft | Läufe | Turns | Token in | Wert (USD) | Echt (USD) | Anteil | Phasen |',
		'| --- | --- | ---: | ---: | ---: | ---: | ---: | :--- | --- |',
	);
	for (const t of tickets.slice(0, TOP_N)) {
		lines.push(
			`| [#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue}) | ${originOf(classById.get(t.issue) ?? 'vollstaendig')} | ${t.runs} | ${t.turns > 0 ? num(t.turns) : '—'} | ${mio(t.tokensIn)} | ${usd(t.valueCost)} | ${t.cost > 0 ? usd(t.cost) : '—'} | ${bar(t.valueCost, sum.valueCost)} | ${t.phases.join(' ')} |`,
		);
	}
	const topN = tickets.slice(0, TOP_N).reduce((a, t) => a + t.valueCost, 0);
	lines.push(
		'',
		`> Nur die Top ${TOP_N} von ${tickets.length} vollständigen Tickets — oben stehen die teuersten Durchläufe und damit die ersten Optimierungskandidaten (Review-/Fixup-Schleifen); sie stehen für ${pct(share(topN, sum.valueCost))} des Gesamtwerts.`,
	);

	if (!anyTurns) {
		lines.push(
			'> ℹ️ Keine Turns erfasst — alle Datensätze stammen von Läufen vor der Turns-Erfassung (Issue #984).',
			'',
		);
	}
	lines.push(
		'> Wert = Verbrauchsbewertung (echter Listenpreis, wo vorhanden — sonst Modellklasse), Echt = gemessene Kosten zu Listenpreisen von Anthropic und z.ai (ohne Preisliste, also openrouter: 0, s. `.costs/SCHEMA.md`). Sortiert nach Wert absteigend — oben stehen die teuersten Durchläufe und damit die ersten Optimierungskandidaten (Review-/Fixup-Schleifen).',
		'',
	);
	if (excluded.length > 0) {
		const CLASS_ORDER: TicketClass[] = ['fixup-bein', 'abgebrochen', 'sonstiges'];
		const excludedTotals = excluded
			.map((t) => ({ total: ticketTotal(t), class: t.class }))
			.sort(
				(a, b) =>
					CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class) || Number(a.total.issue) - Number(b.total.issue),
			);
		lines.push(
			`### Ausgeschlossene Tickets — nicht in Kennzahlen enthalten (${excluded.length})`,
			'',
			'| Ticket | Klasse | Läufe | Turns | Wert (USD) |',
			'| --- | --- | ---: | ---: | ---: |',
		);
		for (const { total, class: cls } of excludedTotals) {
			lines.push(
				`| [#${total.issue}](https://github.com/deleonio/priority-pilot/issues/${total.issue}) | ${CLASS_LABEL[cls]} | ${total.runs} | ${total.turns > 0 ? num(total.turns) : '—'} | ${usd(total.valueCost)} |`,
			);
		}
		lines.push(
			'',
			`> ${exStats.runs} Läufe · ${num(exStats.turns)} Turns · ${usd(exStats.valueCost)} Wert — Budget-Realität bleibt sichtbar, die Auswertung bleibt sauber.`,
			'',
		);
	}
	if (skipped.length > 0) {
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
	}
	return `${lines.join('\n')}\n`;
}

/**
 * Kompakter Fokus-Report für ausgewählte Tickets (Dispatch-Input „issues" bzw. --issues):
 * Statt der repo-weiten Kohorten-Tabellen nur die Läufe DER gewählten Tickets — je Lauf
 * Phase, Modell, Provider, Turns, Token, Cache — und ihr Ø je Phase gegenüber ALLEN anderen
 * Läufen derselben Phase. Basis ist hier bewusst die ganze Datei (auch unvollständige
 * Tickets): Verglichen wird der EINZELNE LAUF mit seinem Setup, nicht die Ticket-Kohorte.
 * Läufe ohne Wert-Bewertung (valueCost 0, z. B. openrouter-:free-Modelle) zählen mit —
 * genau deren Vergleich ist der Hauptanwendungsfall.
 */
export function renderFocusReport(dir: string, issues: readonly string[]): string {
	const { tickets, skipped } = readTickets(dir);
	const lines: string[] = [];
	const label = issues.map((i) => `#${i}`).join(', ');
	lines.push(`## 🔎 Fokus-Report — ${label}`, '');
	lines.push(
		'> Kompakt-Modus: nur die gewählten Tickets — ihre Läufe gegenüber allen anderen Läufen derselben Phase. Voller Report ohne `--issues`.',
		'',
	);
	if (skipped.length > 0)
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');

	const wanted = new Set(issues);
	const selected = tickets.filter((t) => wanted.has(t.issue));
	if (selected.length === 0) {
		lines.push(`Keine Datensätze für ${label} unter \`${dir}\`.`, '');
		return `${lines.join('\n')}\n`;
	}
	const missing = issues.filter((i) => !selected.some((t) => t.issue === i));
	if (missing.length > 0) lines.push(`> ℹ️ Keine Daten für: ${missing.map((i) => `#${i}`).join(', ')}.`, '');

	// ─── Direktvergleich (ab 2 Tickets): Kennzahlen und Phasen nebeneinander ───
	// Zellformat „Wert · Turns · Token · Cache · MCP · Dauer"; die Δ-Spalte vergleicht die
	// zweite mit der ersten Spalte und erscheint nur bei genau zwei Tickets (bei mehr wird
	// Δ mehrdeutig). Je Kennzahl folgt ein xychart-Block: je Phase eine Balkengruppe mit
	// einem Balken je Ticket NEBENEINANDER plus „Ø“ über alle gewählten Tickets (Mermaid
	// kennt kein Grouping und dedupliziert gleiche Labels — Slot-Trick unten). Werte
	// kumuliert je Phase, eine nicht gelaufene Phase zeichnet 0. Eine Serie
	// ohne EINZIGEN Wert zur Kennzahl (Alt-Daten ohne Feld) entfällt; der Chart entfällt
	// ganz, wenn weniger als zwei unterscheidbare Serien übrig bleiben.
	if (selected.length >= 2) {
		const tt = selected.map((t) => ({ issue: t.issue, ...ticketTotal(t) }));
		const link = (issue: string): string => `[#${issue}](https://github.com/deleonio/priority-pilot/issues/${issue})`;
		const delta = (a: number, b: number): string => (a > 0 ? (b >= a ? '+' : '-') + pct(Math.abs((b - a) / a)) : '—');
		const first = tt[0];
		const second = tt[1];
		const head = (
			label: string,
			get: (x: (typeof tt)[number]) => string,
			num?: (x: (typeof tt)[number]) => number,
		): string =>
			`| ${label} | ${tt.map(get).join(' | ')} |${num && tt.length === 2 ? ` ${delta(num(first), num(second))} |` : ''}`;
		lines.push('### Direktvergleich', '');
		lines.push(
			`| | ${tt.map((x) => link(x.issue)).join(' | ')} |${tt.length === 2 ? ' Δ |' : ''}`,
			`| --- |${' ---: |'.repeat(tt.length)}${tt.length === 2 ? ' ---: |' : ''}`,
			head(
				'Wert (USD)',
				(x) => usd(x.valueCost),
				(x) => x.valueCost,
			),
			head(
				'Läufe',
				(x) => num(x.runs),
				(x) => x.runs,
			),
			head(
				'Turns',
				(x) => (x.turns > 0 ? num(x.turns) : '—'),
				(x) => x.turns,
			),
			head(
				'Token in',
				(x) => mio(x.tokensIn),
				(x) => x.tokensIn,
			),
			head(
				'Wert je Turn',
				(x) => (x.turns > 0 ? `$${(x.valueCost / x.turns).toFixed(3)}` : '—'),
				(x) => (x.turns > 0 ? x.valueCost / x.turns : Number.NaN),
			),
			'',
		);
		const phases = [...new Set(selected.flatMap((t) => t.entries.map((e) => e.phase ?? '(ohne)')))];
		type PhaseStat = {
			vc: number;
			turns: number;
			tin: number;
			cache: number;
			mcp: number;
			dur: number;
			hasTurns: boolean;
			hasCache: boolean;
			hasMcp: boolean;
			hasDur: boolean;
		};
		const phaseStat = (t: (typeof selected)[number], ph: string): PhaseStat | undefined => {
			const es = t.entries.filter((e) => (e.phase ?? '(ohne)') === ph);
			if (es.length === 0) return undefined; // Phase lief in diesem Ticket gar nicht
			return {
				vc: es.reduce((a, e) => a + ZERO(e.valueCost), 0),
				turns: es.reduce((a, e) => a + (defined(e.turns) ? e.turns : 0), 0),
				tin: es.reduce((a, e) => a + ZERO(e.tokensIn), 0),
				cache: es.reduce(
					(a, e) =>
						a +
						(defined(e.cacheReadTokens) ? e.cacheReadTokens : 0) +
						(defined(e.cacheCreationTokens) ? e.cacheCreationTokens : 0),
					0,
				),
				mcp: es.reduce((a, e) => a + (defined(e.mcpCalls) ? e.mcpCalls : 0), 0),
				dur: es.reduce((a, e) => a + (defined(e.durationSeconds) ? e.durationSeconds : 0), 0),
				hasTurns: es.some((e) => defined(e.turns)),
				hasCache: es.some((e) => defined(e.cacheReadTokens) || defined(e.cacheCreationTokens)),
				hasMcp: es.some((e) => defined(e.mcpCalls)),
				hasDur: es.some((e) => defined(e.durationSeconds)),
			};
		};
		const statsByTicket = new Map(selected.map((t) => [t.issue, new Map(phases.map((ph) => [ph, phaseStat(t, ph)]))]));
		const statCell = (s: PhaseStat | undefined): string => {
			if (!s) return '—';
			const part = (show: boolean, text: string): string => (show ? text : '—');
			return [
				usd(s.vc),
				part(s.turns > 0, `${num(s.turns)} T`),
				mio(s.tin),
				part(s.hasCache, `${mio(s.cache)} C`),
				part(s.hasMcp, `${num(s.mcp)} MCP`),
				part(s.hasDur, `${(s.dur / 60).toFixed(1)} min`),
			].join(' · ');
		};
		const totalStat = (t: (typeof selected)[number]): PhaseStat => {
			const parts = [...(statsByTicket.get(t.issue)?.values() ?? [])].filter((s): s is PhaseStat => s !== undefined);
			return {
				vc: parts.reduce((a, s) => a + s.vc, 0),
				turns: parts.reduce((a, s) => a + s.turns, 0),
				tin: parts.reduce((a, s) => a + s.tin, 0),
				cache: parts.reduce((a, s) => a + s.cache, 0),
				mcp: parts.reduce((a, s) => a + s.mcp, 0),
				dur: parts.reduce((a, s) => a + s.dur, 0),
				hasTurns: t.entries.some((e) => defined(e.turns)),
				hasCache: t.entries.some((e) => defined(e.cacheReadTokens) || defined(e.cacheCreationTokens)),
				hasMcp: t.entries.some((e) => defined(e.mcpCalls)),
				hasDur: t.entries.some((e) => defined(e.durationSeconds)),
			};
		};
		lines.push(
			`| Phase | ${tt.map((x) => link(x.issue)).join(' | ')} |`,
			`| --- |${' ---: |'.repeat(tt.length)}`,
			...phases.map((ph) => `| ${ph} | ${tt.map((x) => statCell(statsByTicket.get(x.issue)?.get(ph))).join(' | ')} |`),
			`| **Summe** | ${selected.map((t) => statCell(totalStat(t))).join(' | ')} |`,
			'',
			'> Zelle: Wert · Turns (T) · Token in · Cache-Token (C, read+write) · MCP-Calls · Dauer (min). „—" = Phase lief nicht oder Lauf ohne Angabe (Alt-Daten). Die Δ-Spalte vergleicht die zweite mit der ersten Spalte (nur bei zwei Tickets).',
			'',
		);

		// ─── Phasen im Vergleich: je Kennzahl ein xychart, eine Serie je Ticket ───
		type Metric = {
			title: string;
			yLabel: string;
			digits: number;
			value: (s: PhaseStat) => number;
			/** Hat das Ticket die Kennzahl überhaupt (Alt-Daten ohne Feld → Serie entfällt)? */
			present: (s: PhaseStat) => boolean;
		};
		const metrics: Metric[] = [
			{ title: 'Wert je Phase (USD)', yLabel: 'USD', digits: 2, value: (s) => s.vc, present: () => true },
			{
				title: 'Token in je Phase (Mio.)',
				yLabel: 'Mio. Token',
				digits: 2,
				value: (s) => s.tin / 1e6,
				present: () => true,
			},
			{ title: 'Turns je Phase', yLabel: 'API-Calls', digits: 0, value: (s) => s.turns, present: (s) => s.hasTurns },
			{
				title: 'Cache-Token je Phase (Mio.)',
				yLabel: 'Mio. Token',
				digits: 2,
				value: (s) => s.cache / 1e6,
				present: (s) => s.hasCache,
			},
			{ title: 'MCP-Calls je Phase', yLabel: 'Aufrufe', digits: 0, value: (s) => s.mcp, present: (s) => s.hasMcp },
			{
				title: 'Dauer je Phase (Minuten)',
				yLabel: 'Minuten',
				digits: 1,
				value: (s) => s.dur / 60,
				present: (s) => s.hasDur,
			},
		];
		const charted = tt.slice(0, 6); // mehr Balken je Gruppe trägt xychart nicht mehr lesbar
		// Mermaid xychart zeichnet mehrere bar-Serien ÜBEREINANDER (kein Grouping) und dedupliziert
		// gleiche x-Labels. Daher: je Phase eine Gruppe aus charted.length+1 Slots (ein Slot je
		// Ticket + einer für Ø) — der Phasenname steht am Gruppenanfang, die übrigen Labels sind
		// unsichtbare Platzhalter aus Nullbreiten-Leerzeichen in global eindeutiger Anzahl, damit
		// Mermaid sie nicht zu einer Kategorie zusammenzieht.
		const zwsp = '\u200b';
		const slotCount = charted.length + 1;
		const labels: string[] = [];
		for (const ph of phases)
			for (let si = 0; si < slotCount; si++) labels.push(si === 0 ? ph : zwsp.repeat(labels.length + 1));
		const atSlot = (slot: number, value: number): number[] =>
			Array.from({ length: slotCount }, (_, i) => (i === slot ? value : 0));
		let chartCount = 0;
		for (const m of metrics) {
			const statOf = (issue: string, ph: string): PhaseStat | undefined => {
				const s = statsByTicket.get(issue)?.get(ph);
				return s !== undefined && m.present(s) ? s : undefined;
			};
			// Phasen-Vektor (Position = Phase); beim Zeichnen wird er auf die Slots gespreizt
			const vecOf = (issue: string): number[] =>
				phases.map((ph) => {
					const s = statOf(issue, ph);
					return s ? m.value(s) : 0; // Phase lief nicht / Kennzahl fehlt (Alt-Daten) → 0
				});
			const avgVec = phases.map((ph) => {
				const vals = tt
					.map((t) => statOf(t.issue, ph))
					.filter((s) => s !== undefined)
					.map((s) => m.value(s));
				// Ø über ALLE gewählten Tickets, je Phase nur über die mit Daten (nicht gelaufene
				// Phase zählt nicht als 0); ohne Daten zeichnet 0
				return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
			});
			const carry = charted.filter((t) => phases.some((ph) => statOf(t.issue, ph) !== undefined));
			const series = [
				...carry.map((t, ti) => ({
					kind: 'bar' as const,
					name: `#${t.issue}`,
					values: vecOf(t.issue).flatMap((v, pi) => atSlot(ti, v)),
					digits: m.digits,
				})),
				// Ø entfällt bei einem einzelnen Ticket (Dublette)
				...(tt.length >= 2
					? [
							{
								kind: 'bar' as const,
								name: `Ø (${tt.length})`,
								values: avgVec.flatMap((v, pi) => atSlot(charted.length, v)),
								digits: m.digits,
							},
						]
					: []),
			];
			if (series.length < 2) continue;
			// Einziges Ticket-Serie, deren Werte mit Ø übereinstimmen → Chart wäre eine Dublette
			if (carry.length === 1 && vecOf(carry[0].issue).every((v, i) => v === avgVec[i])) continue;
			const chart = xychart({ title: m.title, labels, series, yLabel: m.yLabel });
			if (chart.length > 0) {
				if (chartCount === 0) lines.push('### Phasen im Vergleich', '');
				lines.push(`#### ${m.title}`, '', ...chart, '');
				chartCount += 1;
			}
		}
		if (chartCount > 0) {
			const capped =
				tt.length > charted.length
					? ` Die ersten ${charted.length} Tickets zeichnen Balken; ${tt.length - charted.length} weitere fließen nur in Ø und die Tabellen ein.`
					: '';
			lines.push(
				`> Balken je Phase nebeneinander: einer je Ticket, zuletzt „Ø (${tt.length})“ = Mittelwert über alle gewählten Tickets, je Phase nur über die mit Daten („0“ = Phase lief ohne Wert oder gar nicht).${capped}`,
				'',
			);
		}
	}

	// ─── Läufe der Fokus-Tickets ───────────────────────────────────────────────
	lines.push('### Läufe der Fokus-Tickets', '');
	lines.push(
		'| Ticket | Phase | Zeitpunkt (Berlin) | Modell | Provider | Turns | Token in | Cache-R | Wert (USD) |',
		'| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |',
	);
	const runs = selected
		.flatMap((t) => t.entries.map((e) => ({ issue: t.issue, e })))
		.sort((a, b) => a.e.timestamp.localeCompare(b.e.timestamp));
	for (const { issue, e } of runs) {
		const cacheR =
			typeof e.cacheReadTokens === 'number' && ZERO(e.tokensIn) > 0
				? pct(ZERO(e.cacheReadTokens) / ZERO(e.tokensIn))
				: '—';
		lines.push(
			`| [#${issue}](https://github.com/deleonio/priority-pilot/issues/${issue}) | ${e.phase ?? '(ohne)'} | ${berlinStamp(e.timestamp)} | ${e.model ?? '—'} | ${e.provider ?? '—'} | ${typeof e.turns === 'number' ? num(e.turns) : '—'} | ${mio(e.tokensIn)} | ${cacheR} | ${ZERO(e.valueCost) > 0 ? usd(ZERO(e.valueCost)) : '—'} |`,
		);
	}
	lines.push(
		'',
		'> „—" beim Wert = Lauf ohne Bewertung (valueCost 0, z. B. :free-Modell). Cache-R = Anteil der gelesenen Cache-Token am Input.',
		'',
	);

	// ─── Fokus gegen den Rest, je Phase ────────────────────────────────────────
	// Ø je Run (Wert inkl. 0-Werten, Turns, $/Turn): zeigt, ob das Setup des Fokus-Laufs
	// gegenüber der eingespielten Phase spart — ohne dass der Kohorten-Filter eingreift.
	const agg = (es: readonly CostEntry[]): { n: number; vc: number; turns: number } => {
		const a = { n: es.length, vc: 0, turns: 0 };
		for (const e of es) {
			a.vc += ZERO(e.valueCost);
			a.turns += ZERO(e.turns);
		}
		return a;
	};
	const focusRuns = selected.flatMap((t) => t.entries);
	const restRuns = tickets.filter((t) => !wanted.has(t.issue)).flatMap((t) => t.entries);
	const phaseOf = (e: CostEntry): string => e.phase ?? '(ohne)';
	const phases = [...new Set(focusRuns.map(phaseOf))];
	lines.push('### Fokus gegen den Rest — je Phase', '');
	lines.push(
		'| Phase | Fokus Läufe | Ø Wert | Ø Turns | $/Turn | Rest Läufe | Ø Wert | Ø Turns | $/Turn |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
	);
	for (const ph of phases) {
		const f = agg(focusRuns.filter((e) => phaseOf(e) === ph));
		const r = agg(restRuns.filter((e) => phaseOf(e) === ph));
		lines.push(
			`| ${ph} | ${f.n} | ${usd(f.n > 0 ? f.vc / f.n : 0)} | ${avg(f.turns, f.n)} | ${ratio(f.vc, f.turns)} | ${r.n} | ${usd(r.n > 0 ? r.vc / r.n : 0)} | ${avg(r.turns, r.n)} | ${ratio(r.vc, r.turns)} |`,
		);
	}
	lines.push(
		'',
		'> „Rest" = alle Läufe anderer Tickets derselben Phase (auch unvollständige Tickets — hier zählt der Lauf, nicht die Ticket-Kohorte). Wert-Ø schließt 0-Werte ein: ein :free-Modell senkt den Ø, das ist die Aussage, nicht ein Fehler.',
		'',
	);
	return `${lines.join('\n')}\n`;
}

const flag = (argv: readonly string[], name: string): string | undefined => {
	const idx = argv.indexOf(`--${name}`);
	return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
};

/** `--issues 1752, 1754` → ['1752','1754'] — Trenner sind Komma und/oder Leerzeichen. */
export const parseIssueList = (raw: string | undefined): string[] =>
	(raw ?? '')
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter((s) => /^\d+$/.test(s));

const main = (argv: readonly string[]): number => {
	const dir = flag(argv, 'dir') ?? '.costs';
	const issues = parseIssueList(flag(argv, 'issues'));
	const ivPath = flag(argv, 'interventions');
	process.stdout.write(
		issues.length > 0
			? renderFocusReport(dir, issues)
			: renderReport(dir, {
					baseline: flag(argv, 'baseline'),
					interventions: ivPath ? loadInterventions(ivPath) : undefined,
				}),
	);
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
