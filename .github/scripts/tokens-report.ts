// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) — das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// „Kosten-Uebersicht" (woechentlich, read-only) in die Job-Summary:
//   node .github/scripts/tokens-report.ts --dir .costs [--baseline 2026-W35]
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
import { join } from 'node:path';
import { totalsByPhase, type PhaseTotal } from './cost-aggregate.ts';
import { classifyModel, usageBlocksUsd, valueRates, type BlockUsd } from './cost-from-transcript.ts';
import type { CostEntry } from './cost-record.ts';
import {
	bar,
	berlinDay,
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
	rollingMedian,
	sealWeek,
	share,
	trendArrow,
	usd,
	weekOf,
	xychart,
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

const ZERO = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

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
	if (beforeSeal.some((e) => e.phase === 'review' || e.phase === 'fixup')) return 'extern-vollstaendig';
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

export type ReportOptions = { baseline?: string };

/** Markdown-Bericht: KPIs mit Baseline/Index, Phasen, Block-Kosten, Trend, Kohorten, Ticket-Tabelle. */
export function renderReport(dir: string, opts: ReportOptions = {}): string {
	// EINMAL lesen, mehrfach auswerten. VOLLSTÄNDIGKEITS-FILTER: alle Kennzahlen laufen NUR
	// über vollständige Tickets (`classifyTicket`); Fixup-Beine, abgebrochene und sonstige
	// Durchläufe verzerrten Ø je Ticket und Review-Runden — als Fußnote bleiben sie sichtbar.
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

	const fmtVal = (v: number, f: (n: number) => string): string => (Number.isFinite(v) ? f(v) : '—');
	// Ticket-Fenster je Herkunft: „letzte 20 Pipeline-Tickets" statt „Pipeline-Anteil der
	// letzten 20 Tickets" — sonst vergleicht das Fenster bei wechselndem Mix 3 mit 17 Tickets.
	const kpiRow = (
		label: string,
		metric: Metric,
		f: (n: number) => string,
		goal: string,
		ok?: (v: number) => boolean,
		origin?: Origin,
	): string => {
		const pool = origin ? ofOrigin(chrono, origin) : chrono;
		const w = origin ? windows(pool, WINDOW) : win;
		const ist = metric(raw);
		const base = metric(baseline);
		const last20 = metric(w.last);
		const prev20 = w.prev ? metric(w.prev) : Number.NaN;
		const status = ok && Number.isFinite(ist) ? (ok(ist) ? '🟢' : '🔴') : '—';
		return `| ${label} | ${fmtVal(ist, f)} | ${fmtVal(base, f)} | ${fmtIndex(indexTo(base, ist))} | ${trendArrow(prev20, last20)} | ${goal} | ${status} |`;
	};
	const nOf = (set: readonly ClassifiedTicket[]): string =>
		`n=${ofOrigin(set, 'pipeline').length}/${ofOrigin(set, 'extern').length}`;
	const baselineNote = baselineWeek ? `${baselineWeek} (${nOf(baseline)})` : '—';
	lines.push(
		`| Kennzahl | Ist (${nOf(raw)}) | Baseline ${baselineNote} | Index | Δ letzte ${WINDOW} vs. vorige ${WINDOW} Tickets | Ziel | Status |`,
		'| --- | ---: | ---: | ---: | :---: | ---: | :---: |',
		kpiRow(
			'Kosten je Ticket Pipeline — Median (messende)',
			medianCostOf('pipeline'),
			usd,
			'< $3.00',
			(v) => v < 3,
			'pipeline',
		),
		kpiRow('Kosten je Ticket Pipeline — p75', p75CostOf('pipeline'), usd, '—', undefined, 'pipeline'),
		kpiRow('Kosten je Ticket extern — Median (messende)', medianCostOf('extern'), usd, '—', undefined, 'extern'),
		kpiRow('Kosten je Ticket extern — p75', p75CostOf('extern'), usd, '—', undefined, 'extern'),
		kpiRow(
			'Review-Runden je Ticket Pipeline (mit Review)',
			reviewRoundsOf('pipeline'),
			(v) => frac(v, 1),
			'≤ 1,2',
			(v) => v <= 1.2,
			'pipeline',
		),
		kpiRow(
			'Review-Runden je Ticket extern (mit Review)',
			reviewRoundsOf('extern'),
			(v) => frac(v, 1),
			'≤ 1,2',
			(v) => v <= 1.2,
			'extern',
		),
		kpiRow('Review-Abdeckung (Tickets mit Review)', reviewCoverage, pct, '—'),
		kpiRow('Cache-Effizienz claude (Read / Input)', cacheRatio('claude'), pct, '> 95 %', (v) => v > 0.95),
		kpiRow('Cache-Effizienz zai', cacheRatio('zai'), pct, '—'),
		kpiRow('Cache-Effizienz openrouter', cacheRatio('openrouter'), pct, '—'),
		kpiRow('Flagship-Anteil der Claude-Läufe', claudeClassShare('flagship'), pct, '< 10 %', (v) => v < 0.1),
		kpiRow('Small-Anteil der Claude-Läufe (haiku)', claudeClassShare('small'), pct, '> 50 %', (v) => v > 0.5),
		kpiRow('Provider-Mix claude', providerShare('claude'), pct, '—'),
		kpiRow('Provider-Mix zai', providerShare('zai'), pct, '—'),
		kpiRow('Provider-Mix openrouter', providerShare('openrouter'), pct, '—'),
		'',
		'> Ziele aus `docs/kosten-optimierungsplan.md`. n = Pipeline/extern. Index = Ist / Baseline × 100 (Baseline = erste',
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
	// ohne Cache-Aufschlüsselung zählen komplett als echter Input.
	const messende = allEntries.filter((e) => ZERO(e.valueCost) > 0);
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
		lines.push(
			...xychart({
				title: 'Ø Kosten je Run (USD)',
				labels: days.map(([d]) => d.slice(5)),
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
				labels: days.map(([d]) => d.slice(5)),
				yLabel: 'USD kumuliert',
				yMax: Math.ceil(cum + 1),
				series: [{ kind: 'line', name: 'Kumuliert', values: cumSeries, digits: 2 }],
			}),
		);
		lines.push(
			'',
			'> Nur Läufe mit Messung (valueCost > 0, seit #984). Wenige Runs pro Tag können den',
			'> Tageswert stark bewegen — der 7-Tage-Median zählt, nicht der Einzelpunkt. Tages-Grenzen gelten in Berliner Zeit.',
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
		lines.push('### Läufe je Woche — Budget und Preis je Turn', '');
		lines.push(`| Woche | Läufe | Wert (USD) | ${providers.map((p) => `$/Turn ${p}`).join(' | ')} |`);
		lines.push(`| --- | ---: | ---: |${' ---: |'.repeat(providers.length)}`);
		for (const [wk, w] of runWeeks) {
			const pv = byWeekProvider.get(wk);
			const cells = providers.map((p) => {
				const x = pv?.get(p);
				return x && x.turns > 0 ? `$${(x.vc / x.turns).toFixed(3)}` : '—';
			});
			lines.push(`| ${mark(wk)} | ${w.runs} | ${usd(w.vc)} | ${cells.join(' | ')} |`);
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

		// ─── Richtung: letzte 7 Kalendertage gegen die 8–14 davor ─────────────────
		// Anker ist der jüngste messende Datensatz, deterministisch aus den Daten statt von
		// der Wanduhr; gezählt in Berlin-Tagen, konsistent zum Trend oben.
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

	// ─── Ticket-Tabelle ────────────────────────────────────────────────────────
	const classById = new Map(classified.map((t) => [t.issue, t.class]));
	lines.push(
		'| Ticket | Herkunft | Läufe | Turns | Token in | Wert (USD) | Echt (USD) | Anteil | Phasen |',
		'| --- | --- | ---: | ---: | ---: | ---: | ---: | :--- | --- |',
	);
	for (const t of tickets) {
		lines.push(
			`| [#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue}) | ${originOf(classById.get(t.issue) ?? 'vollstaendig')} | ${t.runs} | ${t.turns > 0 ? num(t.turns) : '—'} | ${mio(t.tokensIn)} | ${usd(t.valueCost)} | ${t.cost > 0 ? usd(t.cost) : '—'} | ${bar(t.valueCost, sum.valueCost)} | ${t.phases.join(' ')} |`,
		);
	}
	const top5 = tickets.slice(0, 5).reduce((a, t) => a + t.valueCost, 0);
	lines.push('', `> **Top 5 Tickets** stehen für ${pct(share(top5, sum.valueCost))} des Gesamtwerts.`);

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
		const byClass = (cls: TicketClass): number => excluded.filter((t) => t.class === cls).length;
		lines.push(
			`> ℹ️ Ausgeschlossen (unvollständig, in KEINER Kennzahl enthalten): ${excluded.length} Tickets — ` +
				`${byClass('fixup-bein')} Fixup-Beine, ${byClass('abgebrochen')} abgebrochen, ${byClass('sonstiges')} sonstige; ` +
				`${exStats.runs} Läufe · ${num(exStats.turns)} Turns · ${usd(exStats.valueCost)} Wert. ` +
				'Budget-Realität bleibt über diese Summe sichtbar, die Auswertung bleibt sauber.',
			'',
		);
	}
	if (skipped.length > 0) {
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
	}
	return `${lines.join('\n')}\n`;
}

const flag = (argv: readonly string[], name: string): string | undefined => {
	const idx = argv.indexOf(`--${name}`);
	return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
};

const main = (argv: readonly string[]): number => {
	process.stdout.write(renderReport(flag(argv, 'dir') ?? '.costs', { baseline: flag(argv, 'baseline') }));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
