// Turn-primäre Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json).
//
// WARUM EIGENER BERICHT: Die Abos rechnen praktisch nach Prompts/Turns ab (Claude,
// z.ai/GLM Coding Plan), nicht nach Tokens. costs-report.ts stellt Tokens und USD als
// Primärmetrik dar und führt `turns` nur als Nebenspalte ohne eigene Aggregation — die
// Effizienz-Betrachtung greift damit am tatsächlichen Abrechnungsmaßstab vorbei (Issue #1197).
// Dieser Bericht dreht die Perspektive um: Turns je Ticket und Phase, Ø je Lauf und je Ticket,
// Schleifen-Raten (Fixup/Review gegen Implement) und der Wochen-Trend. Tokens und USD bleiben
// Sekundärgrößen im Kosten-Report — der bleibt unverändert.
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte. Läuft lokal und im
// Workflow „Turn-Übersicht" (manuell, read-only) in die Job-Summary:
//   node .github/scripts/turns-report.ts --dir .costs
//
// Stil-Spiegel von costs-report.ts: Node-Eintritt, keine externen Deps, ESM, ausschliesslich
// löschbare TypeScript-Syntax. Lesen, Balken und Zeitraster kommen aus costs-report.ts —
// zwei Kopien derselben Berlin-/ISO-Woche-Rechnung wären ein zweites Muster.

import { totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';
import { bar, berlinDay, isoWeek, pct, readTickets } from './costs-report.ts';

export type TicketTurns = {
	issue: string;
	/** Läufe gesamt — inklusive Alt-Läufe ohne `turns`-Feld. */
	runs: number;
	/** Läufe MIT `turns`-Feld; nur sie tragen Turns bei und gehen in Durchschnitte ein. */
	measured: number;
	turns: number;
	/** Turns je Phase in Erstauftreten-Reihenfolge, z. B. „implement:42 review:30". */
	phases: string[];
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
 * Ablauf der Pipeline (ADR 0005) als Anzeigereihenfolge der Phasen-Tabelle. `totalsByPhase`
 * ordnet nach erstem Auftreten in der Eingabe — repo-weit ist das die Reihenfolge irgendeines
 * Tickets, nicht die der Kette. Unbekannte Phasen (neue oder `(ohne)`) hängen hinten an, es
 * geht also keine Zeile verloren, wenn die Pipeline wächst.
 */
const PHASE_ORDER = ['analyse', 'ux', 'spec', 'implement', 'review', 'fixup', 'documenter'];
const phaseRank = (phase: string): number => {
	const i = PHASE_ORDER.indexOf(phase);
	return i < 0 ? PHASE_ORDER.length : i;
};

/** Ein Lauf zählt nur mit, wenn er das Feld wirklich trägt — `0` wäre eine Aussage, `undefined` ist keine. */
const isMeasured = (e: CostEntry): boolean => typeof e.turns === 'number' && Number.isFinite(e.turns);

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
		const total: TicketTurns = { issue, runs: ticketEntries.length, measured: 0, turns: 0, phases: [] };
		for (const e of ticketEntries) {
			if (!isMeasured(e)) continue;
			const turns = e.turns as number;
			total.measured += 1;
			total.turns += turns;
			const phase = e.phase ?? '(ohne)';
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

const num = (n: number): string => n.toLocaleString('de-DE');
/** Ø-Werte mit einer Nachkommastelle; ohne messende Läufe „—" statt einer Division durch 0. */
const avg = (part: number, count: number): string =>
	count > 0 ? (part / count).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
/** Verhältniszahl (Schleifen-Rate) mit zwei Nachkommastellen; ohne Bezugsgröße „—". */
const ratio = (part: number, base: number): string =>
	base > 0 ? (part / base).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

/** Markdown-Bericht: Kennzahlen, Schleifen-Raten, Turns je Phase, Wochen-Trend, Turns je Ticket. */
export function renderTurnReport(dir: string): string {
	const { tickets, entries, measured, skipped } = turnTotals(dir);
	const lines: string[] = [];
	lines.push('## 🔁 Turn-Übersicht — alle versiegelten Tickets', '');
	if (tickets.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		if (skipped.length > 0) lines.push(`> ⚠️ Nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
		return `${lines.join('\n')}\n`;
	}

	const turnsTotal = tickets.reduce((a, t) => a + t.turns, 0);
	const runsTotal = tickets.reduce((a, t) => a + t.runs, 0);
	const measuredTickets = tickets.filter((t) => t.measured > 0);
	const days = entries.map((e) => berlinDay(e.timestamp)).sort();

	lines.push(
		`**${tickets.length} Tickets · ${runsTotal} Läufe · ${num(turnsTotal)} Turns · ` +
			`Zeitraum ${days[0]} bis ${days[days.length - 1]}**`,
		'',
		`${measured.length} von ${runsTotal} Läufen (${pct(runsTotal > 0 ? measured.length / runsTotal : 0)}) haben Turns ` +
			`erfasst — nur sie tragen zu Summen und Durchschnitten bei.`,
		'',
	);

	if (measured.length === 0) {
		lines.push(
			'> ℹ️ Kein einziger Lauf hat Turns erfasst — alle Datensätze stammen von Läufen vor der',
			'> Turns-Erfassung (Issue #984). Ohne Messwerte gibt es nichts zu mitteln.',
			'',
		);
		return `${lines.join('\n')}\n`;
	}

	lines.push(
		'| Kennzahl | Wert |',
		'| --- | ---: |',
		`| Ø Turns je Lauf | ${avg(turnsTotal, measured.length)} |`,
		`| Ø Turns je Ticket | ${avg(turnsTotal, measuredTickets.length)} |`,
		'',
	);

	// Schleifen-Raten: Die Nacharbeit (fixup) und die Prüfung (review) gegen die Erstumsetzung
	// (implement). ZWEI Blickwinkel, weil sie verschiedene Fragen beantworten: das
	// Turns-Verhältnis sagt, wie viele Prompts die Schleife im Abo KOSTET, das Läufe-Verhältnis,
	// wie oft sie überhaupt AUFTRITT. Ein Wert allein verwechselt „selten, aber teuer" mit
	// „häufig, aber billig".
	const phaseSum = (phase: string): { runs: number; turns: number } =>
		measured
			.filter((e) => e.phase === phase)
			.reduce((a, e) => ({ runs: a.runs + 1, turns: a.turns + (e.turns as number) }), { runs: 0, turns: 0 });
	const implement = phaseSum('implement');
	const loopRow = (label: string, phase: string): string => {
		const p = phaseSum(phase);
		return `| ${label} ÷ Implement | ${ratio(p.turns, implement.turns)} | ${ratio(p.runs, implement.runs)} |`;
	};
	lines.push(
		'### Schleifen-Raten',
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

	// Turns je Phase über totalsByPhase — auf die MESSENDEN Läufe angewandt ist dessen `runs`
	// automatisch „Läufe mit Turn-Erfassung", und Ø je Lauf mittelt nicht über Messlücken.
	const phaseTickets = new Map<string, Set<string>>();
	for (const e of measured) {
		const phase = e.phase ?? '(ohne)';
		let set = phaseTickets.get(phase);
		if (!set) {
			set = new Set<string>();
			phaseTickets.set(phase, set);
		}
		set.add(e.issueId);
	}
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

	// Wochen-Trend statt Tages-Trend: Turns schwanken je Ticket stark, ein Tagesraster zeigt
	// vor allem, welches Ticket zufällig an dem Tag lief. Wochen-Grenzen folgen den Berliner
	// Kalendertagen (isoWeek über berlinDay) — konsistent zum Kosten-Report.
	const byWeek = new Map<string, { runs: number; turns: number; issues: Set<string> }>();
	for (const e of measured) {
		const wk = isoWeek(berlinDay(e.timestamp));
		let w = byWeek.get(wk);
		if (!w) {
			w = { runs: 0, turns: 0, issues: new Set<string>() };
			byWeek.set(wk, w);
		}
		w.runs += 1;
		w.turns += e.turns as number;
		w.issues.add(e.issueId);
	}
	const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
	lines.push('### Wochen-Trend', '');
	lines.push('```mermaid');
	lines.push('xychart-beta');
	lines.push('\ttitle "Ø Turns je Lauf"');
	lines.push('\tx-axis ["' + weeks.map(([wk]) => wk).join('", "') + '"]');
	lines.push(
		'\ty-axis "Ø Turns je Lauf" 0 --> ' + Math.max(5, Math.ceil(Math.max(...weeks.map(([, w]) => w.turns / w.runs)))),
	);
	lines.push('\tbar "Ø je Lauf" [' + weeks.map(([, w]) => (w.turns / w.runs).toFixed(1)).join(', ') + ']');
	lines.push('```');
	lines.push('');
	lines.push('| Woche | Läufe | Tickets | Turns | Ø je Lauf | Ø je Ticket |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
	for (const [wk, w] of weeks) {
		lines.push(
			`| ${wk} | ${w.runs} | ${w.issues.size} | ${num(w.turns)} | ${avg(w.turns, w.runs)} | ${avg(w.turns, w.issues.size)} |`,
		);
	}
	lines.push('');

	lines.push(
		'### Turns je Ticket',
		'',
		'| Ticket | Läufe | Turns | Ø je Lauf | Anteil | Turns je Phase |',
		'| --- | ---: | ---: | ---: | :--- | --- |',
	);
	for (const t of tickets) {
		const link = `[#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue})`;
		if (t.measured === 0) {
			lines.push(`| ${link} | ${t.runs} | — | — | — | — |`);
			continue;
		}
		lines.push(
			`| ${link} | ${t.runs} | ${num(t.turns)} | ${avg(t.turns, t.measured)} | ${bar(t.turns, turnsTotal)} | ` +
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

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderTurnReport(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
