// Turn-primäre Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json).
//
// WARUM EIGENER BERICHT: Die Abos rechnen praktisch nach Prompts/Turns ab (Claude,
// z.ai/GLM Coding Plan), nicht nach Tokens. tokens-report.ts stellt Tokens und USD als
// Primärmetrik dar und führt `turns` nur als Nebenspalte ohne eigene Aggregation — die
// Effizienz-Betrachtung greift damit am tatsächlichen Abrechnungsmaßstab vorbei (Issue #1197).
// Dieser Bericht dreht die Perspektive um: Turns je Ticket und Phase, Ø je Lauf und je Ticket,
// Schleifen-Raten (Fixup/Review gegen Implement) und der Wochen-Trend. Turns sind zudem die
// modellneutrale Effizienzgröße: Kosten bewegen sich mit dem Provider-Mix, Turns nicht.
//
// BEZUGSEINHEIT UND STATISTIK wie im Kosten-Report: Ticket-Kohorte je Abschlusswoche,
// Median/p75 mit n, Index gegen eine Baseline-Kohorte, Fenster über die letzten 20 Tickets,
// Anteile (Erstgrün) mit Wilson-Intervall, Vorher/Nachher je Harness-Intervention
// (docs/kosten-interventionen.json). Rechenhelfer in report-stats.ts, Klassifikation und
// Kohorten aus tokens-report.ts — eine Definition, zwei Renderer.
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte. Läuft lokal und im
// Workflow „Kosten-Uebersicht" (wöchentlich, read-only) in die Job-Summary:
//   node .github/scripts/turns-report.ts --dir .costs [--baseline 2026-W35] [--interventions docs/kosten-interventionen.json]
//
// Stil-Spiegel von tokens-report.ts: Node-Eintritt, keine externen Deps, ESM, ausschliesslich
// löschbare TypeScript-Syntax.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';
import {
	BASELINE_MIN_N,
	CLASS_LABEL,
	chooseBaseline,
	classifyTicket,
	isComplete,
	originOf,
	readTickets,
	WINDOW,
	windows,
	type Origin,
	type TicketClass,
} from './tokens-report.ts';
import {
	avg,
	bar,
	berlinDay,
	fmtIndex,
	frac,
	getOrInit,
	indexTo,
	median,
	MIN_N_COHORT,
	num,
	pct,
	quantileOf,
	ratio,
	sealWeek,
	shareWithInterval,
	trendArrow,
	weekOf,
	wilson,
	xychart,
} from './report-stats.ts';

export type TicketTurns = {
	issue: string;
	/** Läufe gesamt — inklusive Alt-Läufe ohne `turns`-Feld. */
	runs: number;
	/** Läufe MIT `turns`-Feld; nur sie tragen Turns bei und gehen in Durchschnitte ein. */
	measured: number;
	turns: number;
	/** Wert (valueCost) des Tickets — für den Vorher/Nachher-Vergleich je Intervention. */
	valueCost: number;
	/** Turns je Phase in Erstauftreten-Reihenfolge, z. B. „implement:42 review:30". */
	phases: string[];
	/** Laufzahl je Phase (über ALLE Läufe, auch ungemessene). */
	phaseRuns: Record<string, number>;
	/** Pipeline-Vollständigkeit (`classifyTicket` aus tokens-report.ts — gemeinsame Definition). */
	class: TicketClass;
	/** Abschlusswoche (Siegel) und Siegel-Zeitstempel; undefined ohne documenter. */
	sealWeek?: string;
	sealTs?: string;
	/** Wandzeit erster → letzter Lauf in Stunden (ALLE Läufe); NaN bei < 2 Läufen. */
	leadHours: number;
};

export type TurnTotals = {
	tickets: TicketTurns[];
	/** Alle Läufe, Ticket-Nummer aufsteigend und je Ticket chronologisch. */
	entries: CostEntry[];
	/** Nur Läufe mit erfassten Turns (seit Issue #984) — die Datenbasis aller Kennzahlen. */
	measured: CostEntry[];
	skipped: string[];
};

/**
 * Ablauf der Pipeline (ADR 0005, Mentor aus ADR 0008) als Anzeigereihenfolge der Phasen-
 * Tabelle. `totalsByPhase` ordnet nach erstem Auftreten in der Eingabe — repo-weit ist das
 * die Reihenfolge irgendeines Tickets, nicht die der Kette. Unbekannte Phasen hängen hinten
 * an, es geht also keine Zeile verloren, wenn die Pipeline wächst.
 */
const PHASE_ORDER = ['analyse', 'ux', 'spec', 'implement', 'mentor', 'review', 'fixup', 'documenter'];
const phaseRank = (phase: string): number => {
	const i = PHASE_ORDER.indexOf(phase);
	return i < 0 ? PHASE_ORDER.length : i;
};

/** Ein Lauf zählt nur mit, wenn er das Feld wirklich trägt — `0` wäre eine Aussage, `undefined` ist keine. */
const isMeasured = (e: CostEntry): boolean => typeof e.turns === 'number' && Number.isFinite(e.turns);
const ZERO = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Liest `dir` und summiert Turns je Ticket. Sortierung: Turns absteigend (die Schleifen-Tickets
 * gehören nach oben), Tickets ganz ohne Turn-Erfassung ans Ende — sie sind kein „0-Turn-Ticket",
 * sondern eine Messlücke und würden sonst zwischen echten Nullen verschwinden.
 */
export function turnTotals(dir: string): TurnTotals {
	const { tickets: raw, skipped } = readTickets(dir);
	const tickets: TicketTurns[] = [];
	const entries: CostEntry[] = [];
	for (const { issue, entries: ticketEntries } of raw) {
		entries.push(...ticketEntries);
		const byPhase = new Map<string, number>();
		const phaseRuns: Record<string, number> = {};
		const ts = ticketEntries.map((e) => Date.parse(e.timestamp)).sort((a, b) => a - b);
		const total: TicketTurns = {
			issue,
			runs: ticketEntries.length,
			measured: 0,
			turns: 0,
			valueCost: 0,
			phases: [],
			phaseRuns,
			class: classifyTicket(ticketEntries),
			sealWeek: sealWeek(ticketEntries),
			sealTs: ticketEntries
				.filter((e) => e.phase === 'documenter')
				.map((e) => e.timestamp)
				.sort()
				.pop(),
			leadHours: ts.length >= 2 ? ((ts[ts.length - 1] as number) - (ts[0] as number)) / 3_600_000 : Number.NaN,
		};
		for (const e of ticketEntries) {
			const phase = e.phase ?? '(ohne)';
			phaseRuns[phase] = (phaseRuns[phase] ?? 0) + 1;
			total.valueCost += ZERO(e.valueCost);
			if (!isMeasured(e)) continue;
			const turns = e.turns as number;
			total.measured += 1;
			total.turns += turns;
			byPhase.set(phase, (byPhase.get(phase) ?? 0) + turns);
		}
		total.phases = [...byPhase.entries()].map(([phase, n]) => `${phase}:${n}`);
		tickets.push(total);
	}
	tickets.sort(
		(a, b) => Number(b.measured > 0) - Number(a.measured > 0) || b.turns - a.turns || Number(a.issue) - Number(b.issue),
	);
	return { tickets, entries, measured: entries.filter(isMeasured), skipped };
}

const has = (phaseRuns: Record<string, number>, phase: string): boolean => (phaseRuns[phase] ?? 0) > 0;

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

export type TurnReportOptions = { baseline?: string; interventions?: Intervention[] };

/** Markdown-Bericht: Kennzahlen mit Baseline/Index, Schleifen-Raten, Turns je Phase, Kohorten, Interventionen, Turns je Ticket. */
export function renderTurnReport(dir: string, opts: TurnReportOptions = {}): string {
	const all = turnTotals(dir);
	const lines: string[] = [];
	// VOLLSTÄNDIGKEITS-FILTER: alle Kennzahlen laufen NUR über vollständige Tickets
	// (`classifyTicket` aus tokens-report.ts — dieselbe Definition wie im Kosten-Report und
	// in der Audit-Basis), getrennt nach Herkunft (Pipeline mit implement, extern umgesetzt).
	// Fixup-Beine blähen Schleifen-Raten auf, abgebrochene Durchläufe haben ihr Ende noch
	// nicht gezeigt; beide bleiben nur als Fußnote mit ihrer Summe sichtbar.
	const tickets = all.tickets.filter((t) => isComplete(t.class));
	const excluded = all.tickets.filter((t) => !isComplete(t.class));
	const completeIds = new Set(tickets.map((t) => t.issue));
	const entries = all.entries.filter((e) => completeIds.has(e.issueId));
	const measured = all.measured.filter((e) => completeIds.has(e.issueId));
	const skipped = all.skipped;
	lines.push('## 🔁 Turn-Übersicht — vollständige Tickets', '');
	if (all.tickets.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		if (skipped.length > 0) lines.push(`> ⚠️ Nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
		return `${lines.join('\n')}\n`;
	}
	if (tickets.length === 0) {
		lines.push(
			`Keine vollständigen Datensätze unter \`${dir}\` (${excluded.length} unvollständige ausgeschlossen).`,
			'',
		);
		if (skipped.length > 0) lines.push(`> ⚠️ Nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
		return `${lines.join('\n')}\n`;
	}

	const turnsTotal = tickets.reduce((a, t) => a + t.turns, 0);
	const runsTotal = tickets.reduce((a, t) => a + t.runs, 0);
	const measuredTickets = tickets.filter((t) => t.measured > 0);
	const days = entries.map((e) => berlinDay(e.timestamp)).sort();
	const exRuns = excluded.reduce((a, t) => a + t.runs, 0);
	const exTurns = excluded.reduce((a, t) => a + t.turns, 0);
	const ofOrigin = (set: readonly TicketTurns[], origin: Origin): TicketTurns[] =>
		set.filter((t) => originOf(t.class) === origin);
	const pipeline = ofOrigin(tickets, 'pipeline');

	lines.push(
		`**${tickets.length} vollständige Tickets (${pipeline.length} Pipeline · ${tickets.length - pipeline.length} extern) · ${runsTotal} Läufe · ${num(turnsTotal)} Turns · ` +
			`Zeitraum ${days[0]} bis ${days[days.length - 1]}**`,
		'',
		`${measured.length} von ${runsTotal} Läufen (${pct(runsTotal > 0 ? measured.length / runsTotal : 0)}) haben Turns ` +
			`erfasst — nur sie tragen zu Summen und Durchschnitten bei.`,
		'',
	);
	if (excluded.length > 0) {
		const byClass = (cls: TicketClass): number => excluded.filter((t) => t.class === cls).length;
		lines.push(
			`> ℹ️ Ausgeschlossen (unvollständig, in KEINER Kennzahl enthalten): ${excluded.length} Tickets — ` +
				`${byClass('fixup-bein')} Fixup-Beine, ${byClass('abgebrochen')} abgebrochen, ${byClass('sonstiges')} sonstige; ` +
				`${exRuns} Läufe · ${num(exTurns)} Turns. Budget-Realität bleibt über diese Summe sichtbar.`,
			'',
		);
	}

	if (measured.length === 0) {
		lines.push(
			'> ℹ️ Kein einziger Lauf hat Turns erfasst — alle Datensätze stammen von Läufen vor der',
			'> Turns-Erfassung (Issue #984). Ohne Messwerte gibt es nichts zu mitteln.',
			'',
		);
		return `${lines.join('\n')}\n`;
	}

	// ─── Kohorten, Baseline, Fenster ────────────────────────────────────────────
	const cohorts = new Map<string, TicketTurns[]>();
	for (const t of tickets) if (t.sealWeek) getOrInit(cohorts, t.sealWeek, () => []).push(t);
	const sortedCohorts = new Map([...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b)));
	const baselineWeek = chooseBaseline(sortedCohorts, opts.baseline);
	const baseline = baselineWeek ? (sortedCohorts.get(baselineWeek) ?? []) : [];
	const chrono = tickets.filter((t) => t.sealTs).sort((a, b) => (a.sealTs as string).localeCompare(b.sealTs as string));
	const lastRun = all.entries
		.map((e) => e.timestamp)
		.sort()
		.pop();
	const currentWeek = lastRun === undefined ? undefined : weekOf(lastRun);
	const mark = (wk: string): string => (wk === currentWeek ? `${wk}*` : wk);

	// Kennzahlen als Funktionen über eine Ticket-Menge — Ist, Baseline und die 20er-Fenster
	// entstehen mit derselben Rechnung. Ticket-Kennzahlen nur über Tickets MIT Turn-Erfassung.
	type Metric = (set: readonly TicketTurns[]) => number;
	const withTurns = (set: readonly TicketTurns[]): TicketTurns[] => set.filter((t) => t.measured > 0);
	const medTurns: Metric = (set) => median(withTurns(set).map((t) => t.turns));
	const p75Turns: Metric = (set) =>
		quantileOf(
			withTurns(set).map((t) => t.turns),
			0.75,
		);
	const firstPassRate: Metric = (set) =>
		set.length > 0 ? set.filter((t) => !has(t.phaseRuns, 'fixup')).length / set.length : Number.NaN;
	const fixupPerReworked: Metric = (set) => {
		const reworked = set.filter((t) => has(t.phaseRuns, 'fixup'));
		return reworked.length > 0
			? reworked.reduce((a, t) => a + (t.phaseRuns.fixup ?? 0), 0) / reworked.length
			: Number.NaN;
	};
	const reviewPerTicket: Metric = (set) =>
		set.length > 0 ? set.reduce((a, t) => a + (t.phaseRuns.review ?? 0), 0) / set.length : Number.NaN;
	const medLead: Metric = (set) => median(set.map((t) => t.leadHours).filter((h) => Number.isFinite(h)));
	const p75Lead: Metric = (set) =>
		quantileOf(
			set.map((t) => t.leadHours).filter((h) => Number.isFinite(h)),
			0.75,
		);
	const skipped_ =
		(phase: string): Metric =>
		(set) =>
			set.length > 0 ? set.filter((t) => !has(t.phaseRuns, phase)).length / set.length : Number.NaN;
	const loopShare: Metric = (set) => {
		const ids = new Set(set.map((t) => t.issue));
		const es = measured.filter((e) => ids.has(e.issueId));
		const total = es.reduce((a, e) => a + (e.turns as number), 0);
		return total > 0
			? es.filter((e) => e.phase === 'review' || e.phase === 'fixup').reduce((a, e) => a + (e.turns as number), 0) /
					total
			: Number.NaN;
	};
	const turnsPerRun: Metric = (set) => {
		const ids = new Set(set.map((t) => t.issue));
		const es = measured.filter((e) => ids.has(e.issueId));
		return es.length > 0 ? es.reduce((a, e) => a + (e.turns as number), 0) / es.length : Number.NaN;
	};
	const fmtVal = (v: number, f: (n: number) => string): string => (Number.isFinite(v) ? f(v) : '—');
	const hours = (h: number): string => `${h.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`;
	const win = windows(chrono, WINDOW);
	const kpiRow = (
		label: string,
		metric: Metric,
		f: (n: number) => string,
		origin?: Origin,
		istText?: (set: readonly TicketTurns[]) => string,
	): string => {
		const pool = origin ? ofOrigin(chrono, origin) : chrono;
		const set = origin ? ofOrigin(tickets, origin) : tickets;
		const base = origin ? ofOrigin(baseline, origin) : baseline;
		const w = origin ? windows(pool, WINDOW) : win;
		const ist = metric(set);
		const b = metric(base);
		const last20 = metric(w.last);
		const prev20 = w.prev ? metric(w.prev) : Number.NaN;
		return `| ${label} | ${istText ? istText(set) : fmtVal(ist, f)} | ${fmtVal(b, f)} | ${fmtIndex(indexTo(b, ist))} | ${trendArrow(prev20, last20)} |`;
	};
	const firstPassText = (set: readonly TicketTurns[]): string =>
		shareWithInterval(set.filter((t) => !has(t.phaseRuns, 'fixup')).length, set.length);
	const nOf = (set: readonly TicketTurns[]): string =>
		`n=${ofOrigin(set, 'pipeline').length}/${ofOrigin(set, 'extern').length}`;
	const baselineNote = baselineWeek ? `${baselineWeek} (${nOf(baseline)})` : '—';

	lines.push(
		'### Kennzahlen — Ist, Baseline, Index',
		'',
		`| Kennzahl | Ist (${nOf(tickets)}) | Baseline ${baselineNote} | Index | Δ letzte ${WINDOW} vs. vorige ${WINDOW} Tickets |`,
		'| --- | ---: | ---: | ---: | :---: |',
		kpiRow('Ø Turns je Lauf (alle Läufe)', turnsPerRun, (v) => frac(v, 1)),
		kpiRow('Turns je Ticket Pipeline — Median', medTurns, num, 'pipeline'),
		kpiRow('Turns je Ticket Pipeline — p75', p75Turns, num, 'pipeline'),
		kpiRow('Turns je Ticket extern — Median', medTurns, num, 'extern'),
		kpiRow('First-Pass-Grün Pipeline (kein Fixup)', firstPassRate, pct, 'pipeline', firstPassText),
		kpiRow('First-Pass-Grün extern (kein Fixup)', firstPassRate, pct, 'extern', firstPassText),
		kpiRow('Ø Fixup-Läufe je nachbearbeitetem Ticket (Pipeline)', fixupPerReworked, (v) => frac(v, 1), 'pipeline'),
		kpiRow('Ø Review-Läufe je Ticket Pipeline (Re-Review-Faktor)', reviewPerTicket, (v) => frac(v, 1), 'pipeline'),
		kpiRow('Ø Review-Läufe je Ticket extern', reviewPerTicket, (v) => frac(v, 1), 'extern'),
		kpiRow('Fixup+Review-Anteil an Turns (alle)', loopShare, pct),
		kpiRow('Lead-Time Pipeline — Median (Wandzeit)', medLead, hours, 'pipeline'),
		kpiRow('Lead-Time Pipeline — p75', p75Lead, hours, 'pipeline'),
		kpiRow('Lead-Time extern — Median', medLead, hours, 'extern'),
		kpiRow('Spec übersprungen (Routing-Ersparnis, Pipeline)', skipped_('spec'), pct, 'pipeline'),
		kpiRow('UX übersprungen (Routing-Ersparnis, Pipeline)', skipped_('ux'), pct, 'pipeline'),
		'',
		`> n = Pipeline/extern. Index = Ist / Baseline × 100 (Baseline = erste Abschlusswoche mit n ≥ ${BASELINE_MIN_N},`,
		`> per \`--baseline\` änderbar). Δ vergleicht die letzten ${WINDOW} versiegelten Tickets (je Herkunft) mit den ${WINDOW}`,
		'> davor („→" = unter ±10 %, „—" = älteres Fenster nicht voll). Erstgrün mit 95-%-Wilson-Intervall ab n ≥ 8:',
		'> Die First-Pass-Grün-Rate ist die Steuergröße der Pipeline — jede Nacharbeit kostet eine Fixup- und',
		'> eine Re-Review-Runde. Median/p75 statt Ø, weil Turns je Ticket rechtsschief sind.',
		'',
	);

	// ─── Schleifen-Raten ────────────────────────────────────────────────────────
	// Die Nacharbeit (fixup) und die Prüfung (review) gegen die Erstumsetzung (implement).
	// ZWEI Blickwinkel, weil sie verschiedene Fragen beantworten: das Turns-Verhältnis sagt,
	// wie viele Prompts die Schleife im Abo KOSTET, das Läufe-Verhältnis, wie oft sie
	// überhaupt AUFTRITT. Nur Pipeline-Tickets — extern hat kein implement als Bezug.
	const pipelineIds = new Set(pipeline.map((t) => t.issue));
	const phaseSums = new Map<string, { runs: number; turns: number }>();
	for (const e of measured) {
		if (!pipelineIds.has(e.issueId)) continue;
		const p = getOrInit(phaseSums, e.phase ?? '(ohne)', () => ({ runs: 0, turns: 0 }));
		p.runs += 1;
		p.turns += e.turns as number;
	}
	const phaseSum = (phase: string): { runs: number; turns: number } => phaseSums.get(phase) ?? { runs: 0, turns: 0 };
	const implement = phaseSum('implement');
	const loopRow = (label: string, phase: string): string => {
		const p = phaseSum(phase);
		return `| ${label} ÷ Implement | ${ratio(p.turns, implement.turns)} | ${ratio(p.runs, implement.runs)} |`;
	};
	lines.push(
		'### Schleifen-Raten — Pipeline-Tickets',
		'',
		'| Schleife | Turns-Verhältnis | Läufe-Verhältnis |',
		'| --- | ---: | ---: |',
		loopRow('Fixup', 'fixup'),
		loopRow('Review', 'review'),
		'',
		'> Turns-Verhältnis = was die Schleife gegenüber der Erstumsetzung an Prompts kostet,',
		'> Läufe-Verhältnis = wie oft sie überhaupt auftritt. „—" heißt: keine messenden',
		'> `implement`-Läufe als Bezugsgröße vorhanden.',
		'',
	);

	// ─── Review-Runden-Verteilung ──────────────────────────────────────────────
	// Der Ø versteckt den Schwanz — wenige Tickets mit 4+ Runden tragen die Schleifenkosten
	// (Kreuzverhör-Loops, #932). Das Histogramm macht sie sichtbar; sie sind die
	// Eskalations-/Mentor-Kandidaten.
	const buckets = new Map<number, number>();
	for (const t of tickets) {
		const r = t.phaseRuns.review ?? 0;
		if (r <= 0) continue;
		const b = Math.min(r, 5);
		buckets.set(b, (buckets.get(b) ?? 0) + 1);
	}
	if (buckets.size > 0) {
		lines.push(
			'Review-Runden je Ticket (Histogramm, alle vollständigen):',
			'',
			'| Review-Runden | Tickets |',
			'| --- | ---: |',
		);
		for (let b = 1; b <= 5; b++) lines.push(`| ${b === 5 ? '5+' : b} | ${buckets.get(b) ?? 0} |`);
		lines.push(
			'',
			'> Wenige Tickets mit 4+ Runden tragen die Schleifenkosten — sie sind die Eskalations-/Mentor-Kandidaten.',
			'',
		);
	}

	// ─── Turns je Phase ────────────────────────────────────────────────────────
	// Über totalsByPhase auf die MESSENDEN Läufe angewandt ist dessen `runs` automatisch
	// „Läufe mit Turn-Erfassung", und Ø je Lauf mittelt nicht über Messlücken.
	const phaseTickets = new Map<string, Set<string>>();
	for (const e of measured) getOrInit(phaseTickets, e.phase ?? '(ohne)', () => new Set<string>()).add(e.issueId);
	lines.push(
		'### Turns je Phase',
		'',
		'| Phase | Läufe | Tickets | Turns | Ø je Lauf | Ø je Ticket | Anteil |',
		'| --- | ---: | ---: | ---: | ---: | ---: | :--- |',
	);
	const phases = totalsByPhase(measured).sort(
		(a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.phase.localeCompare(b.phase),
	);
	for (const p of phases) {
		const ticketCount = phaseTickets.get(p.phase)?.size ?? 0;
		lines.push(
			`| ${p.phase} | ${p.runs} | ${ticketCount} | ${num(p.turns)} | ${avg(p.turns, p.runs)} | ` +
				`${avg(p.turns, ticketCount)} | ${bar(p.turns, turnsTotal)} |`,
		);
	}
	lines.push(
		`| **Summe** | **${measured.length}** | **${measuredTickets.length}** | **${num(turnsTotal)}** | ` +
			`**${avg(turnsTotal, measured.length)}** | **${avg(turnsTotal, measuredTickets.length)}** | ${bar(1, 1)} |`,
		'',
	);

	// ─── Wochen-Trend (Läufe je Lauf-Woche) ───────────────────────────────────
	// Wochen statt Tage: Turns schwanken je Ticket stark, ein Tagesraster zeigt vor allem,
	// welches Ticket zufällig an dem Tag lief. Wochen-Grenzen folgen den Berliner
	// Kalendertagen — konsistent zum Kosten-Report.
	const byWeek = new Map<string, { runs: number; turns: number; loop: number; input: number; sidechain: number }>();
	for (const e of measured) {
		const w = getOrInit(byWeek, weekOf(e.timestamp), () => ({ runs: 0, turns: 0, loop: 0, input: 0, sidechain: 0 }));
		w.runs += 1;
		w.turns += e.turns as number;
		if (e.phase === 'review' || e.phase === 'fixup') w.loop += e.turns as number;
		w.input += e.tokensIn;
		w.sidechain += e.sidechainTokens ?? 0;
	}
	const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
	lines.push('### Wochen-Trend — Läufe', '');
	lines.push(
		...xychart({
			title: 'Ø Turns je Lauf',
			labels: weeks.map(([wk]) => mark(wk)),
			yLabel: 'Ø Turns je Lauf',
			yMax: Math.max(5, Math.ceil(Math.max(...weeks.map(([, w]) => w.turns / w.runs)))),
			series: [{ kind: 'bar', name: 'Ø je Lauf', values: weeks.map(([, w]) => w.turns / w.runs) }],
		}),
		'',
	);
	// Loop-Anteil je Woche: Anteil der Schleifen-Phasen (review+fixup) an den Turns der Woche.
	lines.push(
		...xychart({
			title: 'Loop-Anteil (Review+Fixup) an Turns je Woche (%)',
			labels: weeks.map(([wk]) => mark(wk)),
			yLabel: '%',
			yMax: 100,
			series: [
				{
					kind: 'bar',
					name: 'Loop-Anteil %',
					values: weeks.map(([, w]) => (w.turns > 0 ? (w.loop / w.turns) * 100 : Number.NaN)),
				},
			],
		}),
		'',
	);
	// Budget-Burn: Turns je Woche über ALLE messenden Läufe, AUCH die ausgeschlossenen
	// Tickets — das Abo rechnet die Realität, nicht die gefilterte Auswertung (das Budget
	// riss 2026-09 unbemerkt, s. Kopf des Kosten-Übersicht-Workflows). Die 8000er-Linie ist
	// das Richtbudget aus docs/kosten-optimierungsplan.md; laufende Woche unvollständig.
	const TURN_BUDGET_PER_WEEK = 8000;
	const burnWeeks = new Map<string, number>();
	for (const e of all.measured) {
		const wk = weekOf(e.timestamp);
		burnWeeks.set(wk, (burnWeeks.get(wk) ?? 0) + (e.turns as number));
	}
	const burnKeys = [...burnWeeks.keys()].sort();
	lines.push(
		...xychart({
			title: 'Turn-Budget-Burn — Turns je Woche vs. Budget',
			labels: burnKeys.map(mark),
			yLabel: 'Turns',
			series: [
				{ kind: 'bar', name: 'Turns', values: burnKeys.map((k) => burnWeeks.get(k) ?? 0), digits: 0 },
				{
					kind: 'line',
					name: `Budget ${TURN_BUDGET_PER_WEEK}`,
					values: burnKeys.map(() => TURN_BUDGET_PER_WEEK),
					digits: 0,
				},
			],
		}),
		'',
		`> Budget-Linie = ${num(TURN_BUDGET_PER_WEEK)} Turns/Woche (Richtwert). Basis: ALLE messenden Läufe inkl. der ausgeschlossenen Tickets — Abo-Realität statt gefilterte Auswertung. „*" = laufende Woche.`,
		'',
	);
	// Delegationsquote je Woche: sidechainTokens-Anteil am Input. Misst, ob der ADR-0008-
	// Fan-out (Haiku-Subagents) real ankommt — 0 % heißt, alle Reads laufen im teuren Parent.
	lines.push('| Woche | Läufe | Turns | Ø je Lauf | Loop-Anteil | Delegation |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
	for (const [wk, w] of weeks) {
		lines.push(
			`| ${mark(wk)} | ${w.runs} | ${num(w.turns)} | ${avg(w.turns, w.runs)} | ${w.turns > 0 ? pct(w.loop / w.turns) : '—'} | ${w.input > 0 ? pct(w.sidechain / w.input) : '—'} |`,
		);
	}
	lines.push('');

	// ─── Kohorten je Abschlusswoche ───────────────────────────────────────────
	// Ob ein Ticket first-pass-grün ist und was es an Turns gekostet hat, weiß man erst am
	// Ende — deshalb zählt die Woche des Siegels. Wochen ohne Kohorte fehlen im Chart, statt
	// als 0 % („alles nachgearbeitet") zu erscheinen; die laufende Woche ist markiert.
	const cohortWeeks = [...sortedCohorts.keys()];
	const cohortOf = (wk: string, origin: Origin): TicketTurns[] => ofOrigin(sortedCohorts.get(wk) ?? [], origin);
	const guarded = (set: readonly TicketTurns[], metric: Metric, minN = MIN_N_COHORT): number =>
		withTurns(set).length >= minN ? metric(set) : Number.NaN;
	const medPipe = cohortWeeks.map((wk) => guarded(cohortOf(wk, 'pipeline'), medTurns));
	const leadPipe = cohortWeeks.map((wk) => guarded(cohortOf(wk, 'pipeline'), medLead));
	const medExt = cohortWeeks.map((wk) => guarded(cohortOf(wk, 'extern'), medTurns));
	const basePipe = ofOrigin(baseline, 'pipeline');
	const baseMedTurns = medTurns(basePipe);
	const baseMedLead = medLead(basePipe);
	const chronoPipe = withTurns(ofOrigin(chrono, 'pipeline'));
	const rollingAtWeek = cohortWeeks.map((wk) => {
		const upTo = chronoPipe.filter((t) => (t.sealWeek as string) <= wk).slice(-WINDOW);
		return upTo.length >= MIN_N_COHORT ? median(upTo.map((t) => t.turns)) : Number.NaN;
	});
	const fpOf = (set: readonly TicketTurns[]): { k: number; n: number } => ({
		k: set.filter((t) => !has(t.phaseRuns, 'fixup')).length,
		n: set.length,
	});
	lines.push('### Kohorten je Abschlusswoche', '');
	lines.push(
		'| Abschlusswoche | n Pipeline / extern | Median Turns Pipeline | p75 | Index | Rolling-Median (letzte 20) | Erstgrün Pipeline | Lead-Time Pipeline (Median) | Median Turns extern | Erstgrün extern |',
	);
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
	cohortWeeks.forEach((wk, i) => {
		const pipe = cohortOf(wk, 'pipeline');
		const ext = cohortOf(wk, 'extern');
		const small = (n: number): string => (n > 0 && n < MIN_N_COHORT ? `${n}†` : String(n));
		const fpP = fpOf(pipe);
		const fpE = fpOf(ext);
		lines.push(
			`| ${mark(wk)} | ${small(pipe.length)} / ${small(ext.length)} | ${fmtVal(medPipe[i] as number, num)} | ${fmtVal(guarded(pipe, p75Turns), num)} | ${fmtIndex(indexTo(baseMedTurns, medPipe[i] as number))} | ${fmtVal(rollingAtWeek[i] as number, num)} | ${shareWithInterval(fpP.k, fpP.n)} | ${fmtVal(leadPipe[i] as number, hours)} | ${fmtVal(medExt[i] as number, num)} | ${shareWithInterval(fpE.k, fpE.n)} |`,
		);
	});
	lines.push('');
	// Erstgrün-Rate je Woche als Kurve mit Wilson-Band: „bewegt sich was" sieht man im Chart in
	// einer Sekunde — und ob die Bewegung größer als das Band ist, gleich mit.
	const fpSeries = cohortWeeks.map((wk) => fpOf(cohortOf(wk, 'pipeline')));
	const fpRate = fpSeries.map(({ k, n }) => (n >= MIN_N_COHORT ? (k / n) * 100 : Number.NaN));
	lines.push(
		...xychart({
			title: 'First-Pass-Grün je Abschlusswoche, Pipeline (%) mit 95-%-Band',
			labels: cohortWeeks.map(mark),
			yLabel: '%',
			yMax: 100,
			series: [
				{ kind: 'bar', name: 'Erstgrün %', values: fpRate },
				{
					kind: 'line',
					name: 'Band unten',
					values: fpSeries.map(({ k, n }) => (n >= MIN_N_COHORT ? wilson(k, n).low * 100 : Number.NaN)),
				},
				{
					kind: 'line',
					name: 'Band oben',
					values: fpSeries.map(({ k, n }) => (n >= MIN_N_COHORT ? wilson(k, n).high * 100 : Number.NaN)),
				},
			],
		}),
		'',
	);
	lines.push(
		...xychart({
			title: `Index Pipeline (Median, Baseline ${baselineWeek ?? '—'} = 100)`,
			labels: cohortWeeks.map(mark),
			yLabel: 'Index',
			series: [
				{ kind: 'line', name: 'Turns je Ticket', values: medPipe.map((m) => indexTo(baseMedTurns, m)), digits: 0 },
				{ kind: 'line', name: 'Lead-Time', values: leadPipe.map((m) => indexTo(baseMedLead, m)), digits: 0 },
				{
					kind: 'line',
					name: 'Rolling 20 Turns',
					values: rollingAtWeek.map((m) => indexTo(baseMedTurns, m)),
					digits: 0,
				},
			],
		}),
		'',
		`> Kohorte = in der Woche versiegelte Tickets, je Herkunft. „†" = n < ${MIN_N_COHORT}, Median nicht belastbar und`,
		'> nicht im Chart. „*" = laufende Woche, Kohorte noch offen. Erstgrün als k/n mit Wilson-Intervall ab n ≥ 8;',
		'> im Chart ist das Band als zwei Linien gezeichnet (Mermaid kennt keine Fehlerbalken). Rolling-Median =',
		'> Median der letzten 20 versiegelten Pipeline-Tickets zum Wochenende.',
		'',
	);

	// ─── Interventionen: Vorher/Nachher ───────────────────────────────────────
	// Je Harness-Änderung die letzten 20 davor versiegelten Pipeline-Tickets gegen die ersten
	// 20 danach. Kein Signifikanztest: n und Intervall reichen für die Entscheidung, ein
	// U-Test würde bei n = 20 und Mehrfachvergleichen mehr suggerieren als er trägt.
	const interventions = opts.interventions ?? loadInterventions();
	if (interventions.length > 0) {
		lines.push('### Interventionen — Vorher/Nachher (Pipeline, je 20 Tickets)', '');
		lines.push(
			'| Datum | Intervention | n vor/nach | Turns/Ticket Median | Kosten/Ticket Median | Erstgrün | Lead-Time Median |',
		);
		lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: |');
		const pipeChrono = ofOrigin(chrono, 'pipeline');
		const medCost: Metric = (set) => median(set.filter((t) => t.valueCost > 0).map((t) => t.valueCost));
		const pair = (before: TicketTurns[], after: TicketTurns[], metric: Metric, f: (n: number) => string): string => {
			const b = metric(before);
			const a = metric(after);
			return `${fmtVal(b, f)} → ${fmtVal(a, f)} ${trendArrow(b, a)}`;
		};
		for (const iv of interventions) {
			const before = pipeChrono.filter((t) => berlinDay(t.sealTs as string) < iv.date).slice(-WINDOW);
			const after = pipeChrono.filter((t) => berlinDay(t.sealTs as string) >= iv.date).slice(0, WINDOW);
			const label = iv.issue ? `${iv.label} (#${iv.issue})` : iv.label;
			if (before.length < MIN_N_COHORT || after.length < MIN_N_COHORT) {
				lines.push(`| ${iv.date} | ${label} | ${before.length}/${after.length} | — | — | — | — |`);
				continue;
			}
			const fpB = fpOf(before);
			const fpA = fpOf(after);
			lines.push(
				`| ${iv.date} | ${label} | ${before.length}/${after.length} | ${pair(before, after, medTurns, num)} | ${pair(before, after, medCost, (v) => `$${v.toFixed(2)}`)} | ${shareWithInterval(fpB.k, fpB.n)} → ${shareWithInterval(fpA.k, fpA.n)} | ${pair(before, after, medLead, hours)} |`,
			);
		}
		lines.push(
			'',
			`> Quelle: \`docs/kosten-interventionen.json\` (bei jeder Harness-Änderung ergänzen). Vorher = die letzten ${WINDOW}`,
			`> davor versiegelten Pipeline-Tickets, Nachher = die ersten ${WINDOW} danach; unter ${MIN_N_COHORT} auf einer Seite „—".`,
			'> Überlappende Interventionen teilen sich Tickets — die Zuordnung ist zeitlich, nicht kausal.',
			'',
		);
	}

	// ─── Herkunft: Pipeline vs. extern ────────────────────────────────────────
	// Beantwortet, ob externe Tickets öfter nachgebessert werden UND ob das an Turns teurer ist.
	// Die Trennung „schlechterer Code vs. strengerer Review" liefern die findings/nits-Felder.
	const origins: Origin[] = ['pipeline', 'extern'];
	lines.push(
		'### Herkunft: Pipeline vs. extern umgesetzt — vollständige Tickets',
		'',
		'| Herkunft | Tickets | mit Fixup | Fixup-Rate | Turns gesamt | Median Turns je Ticket | Ø Läufe je Ticket |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
	);
	for (const o of origins) {
		const group = ofOrigin(tickets, o);
		const fp = fpOf(group);
		const turnsGroup = group.reduce((a, t) => a + t.turns, 0);
		const runsGroup = group.reduce((a, t) => a + t.runs, 0);
		lines.push(
			`| ${o === 'pipeline' ? 'Pipeline (implement)' : 'extern umgesetzt (Review-only)'} | ${group.length} | ${fp.n - fp.k} | ${shareWithInterval(fp.n - fp.k, fp.n)} | ${num(turnsGroup)} | ${fmtVal(medTurns(group), num)} | ${avg(runsGroup, group.length)} |`,
		);
	}
	lines.push(
		'',
		'> Median Turns nur über Tickets mit Turn-Erfassung; Fixup-Rate über alle, mit Wilson-Intervall. Extern = vollständige Tickets ohne implement-Eintrag (Klasse `extern-vollstaendig`).',
		'',
	);

	// ─── Review-Fakten und Effort-Matrix (Felder ab 2026-09-06) ───────────────
	const originById = new Map(all.tickets.map((t) => [t.issue, originOf(t.class)]));
	const withFindings = entries.filter(
		(e) => e.phase === 'review' && typeof e.findings === 'number' && typeof e.nits === 'number',
	);
	const effortRuns = entries.filter((e) => typeof e.effort === 'string');
	if (withFindings.length === 0 && effortRuns.length === 0) {
		lines.push(
			'> ℹ️ Review-Fakten (verdict/findings/nits) und Effort sind ab Versiegelungen ab 2026-09-06',
			'> erfasst — die Herkunfts-Tabelle oben schärft sich dann um „Ø Findings/Nits je Review“',
			'> und eine Effort-Matrix (Ø Turns je Phase × Effort-Stufe) ergänzt diese Notiz.',
			'',
		);
	}
	if (withFindings.length > 0) {
		lines.push(
			'### Review-Fakten je Herkunft (Läufe ab 2026-09-06)',
			'',
			'| Herkunft | Review-Läufe | Ø Findings | Ø Nits | needs-fixup-Anteil |',
			'| --- | ---: | ---: | ---: | ---: |',
		);
		for (const o of origins) {
			const g = withFindings.filter((e) => originById.get(e.issueId) === o);
			if (g.length === 0) continue;
			const fAvg = g.reduce((a, e) => a + (e.findings as number), 0) / g.length;
			const nAvg = g.reduce((a, e) => a + (e.nits as number), 0) / g.length;
			const fix = g.filter((e) => e.verdict === 'needs-fixup').length;
			lines.push(
				`| ${o === 'pipeline' ? 'Pipeline' : 'extern'} | ${g.length} | ${frac(fAvg, 1)} | ${frac(nAvg, 1)} | ${shareWithInterval(fix, g.length)} |`,
			);
		}
		lines.push(
			'',
			'> Findings = Inline-Review-Kommentare des Laufes (je einer nach SKILL Step 4).',
			'> Hohe Ø Findings bei extern UND Pipeline → strengerer Review; hohe Findings + hoher',
			'> needs-fixup-Anteil nur bei extern → schwächerer Code (s. SCHEMA.md-Auswertung).',
			'',
		);
	}
	if (effortRuns.length > 0) {
		const byPhaseEffort = new Map<string, { runs: number; turns: number }>();
		for (const e of effortRuns) {
			if (!isMeasured(e)) continue;
			const rec = getOrInit(byPhaseEffort, `${e.phase ?? '(ohne)'}\u{0009}${e.effort}`, () => ({ runs: 0, turns: 0 }));
			rec.runs += 1;
			rec.turns += e.turns as number;
		}
		lines.push(
			'### Effort-Matrix (Läufe ab 2026-09-06)',
			'',
			'| Phase | Effort | Läufe | Ø Turns |',
			'| --- | --- | ---: | ---: |',
		);
		for (const [key, rec] of [...byPhaseEffort.entries()].sort(([a], [b]) => a.localeCompare(b))) {
			const [phase, effort] = key.split('\u{0009}') as [string, string];
			lines.push(`| ${phase} | ${effort} | ${rec.runs} | ${avg(rec.turns, rec.runs)} |`);
		}
		lines.push(
			'',
			'> Antwortet „lohnt high Effort?“: senkt ein höherer Aufwand die Turns je Lauf (und',
			'> mittelbar die Fixup-Rate), oder zahlt er sich nur in Token?',
			'',
		);
	}

	// ─── Turns je Ticket ───────────────────────────────────────────────────────
	lines.push(
		'### Turns je Ticket',
		'',
		'| Ticket | Klasse | Läufe | Turns | Ø je Lauf | Anteil | Turns je Phase |',
		'| --- | --- | ---: | ---: | ---: | :--- | --- |',
	);
	for (const t of tickets) {
		const link = `[#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue})`;
		if (t.measured === 0) {
			lines.push(`| ${link} | ${CLASS_LABEL[t.class]} | ${t.runs} | — | — | — | — |`);
			continue;
		}
		lines.push(
			`| ${link} | ${CLASS_LABEL[t.class]} | ${t.runs} | ${num(t.turns)} | ${avg(t.turns, t.measured)} | ${bar(t.turns, turnsTotal)} | ` +
				`${t.phases.join(' ')} |`,
		);
	}
	const top5 = tickets.slice(0, 5).reduce((a, t) => a + t.turns, 0);
	lines.push('', `> **Top 5 Tickets** stehen für ${pct(turnsTotal > 0 ? top5 / turnsTotal : 0)} aller Turns.`, '');

	const legacyRuns = runsTotal - measured.length;
	if (legacyRuns > 0) {
		lines.push(
			`> ℹ️ ${legacyRuns === 1 ? '1 Lauf' : `${legacyRuns} Läufe`} ohne \`turns\`-Feld stammen von vor der Turns-Erfassung (Issue #984).`,
			'> Sie erscheinen als „—" statt „0" und zählen in keiner Summe und keinem Durchschnitt mit —',
			'> ein Ticket mit „—" ist nicht turn-frei, sondern ungemessen.',
			'',
		);
	}
	lines.push(
		'> Turns = deduplizierte Assistant-Antworten (= API-Calls) eines Laufes inkl. Subagenten,',
		'> siehe `.costs/SCHEMA.md`. Sie sind der Abrechnungsmaßstab der Abos (Claude, z.ai);',
		'> Tokens und USD stehen im Bericht des Workflows „Kosten-Übersicht".',
		'',
	);
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
	const ivPath = flag(argv, 'interventions');
	process.stdout.write(
		renderTurnReport(flag(argv, 'dir') ?? '.costs', {
			baseline: flag(argv, 'baseline'),
			interventions: ivPath ? loadInterventions(ivPath) : undefined,
		}),
	);
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
