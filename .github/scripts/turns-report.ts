// Turn-primäre Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json).
//
// WARUM EIGENER BERICHT: Die Abos rechnen praktisch nach Prompts/Turns ab (Claude,
// z.ai/GLM Coding Plan), nicht nach Tokens. tokens-report.ts stellt Tokens und USD als
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
// Stil-Spiegel von tokens-report.ts: Node-Eintritt, keine externen Deps, ESM, ausschliesslich
// löschbare TypeScript-Syntax. Lesen, Balken und Zeitraster kommen aus tokens-report.ts —
// zwei Kopien derselben Berlin-/ISO-Woche-Rechnung wären ein zweites Muster.

import { totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';
import { bar, berlinDay, classifyTicket, isoWeek, pct, readTickets, type TicketClass } from './tokens-report.ts';

export type TicketTurns = {
	issue: string;
	/** Läufe gesamt — inklusive Alt-Läufe ohne `turns`-Feld. */
	runs: number;
	/** Läufe MIT `turns`-Feld; nur sie tragen Turns bei und gehen in Durchschnitte ein. */
	measured: number;
	turns: number;
	/** Turns je Phase in Erstauftreten-Reihenfolge, z. B. „implement:42 review:30". */
	phases: string[];
	/** Laufzahl je Phase (über ALLE Läufe, auch ungemessene) — Basis der Klassifikation. */
	phaseRuns: Record<string, number>;
	/** Pipeline-Vollständigkeit (`classifyTicket` aus tokens-report.ts — gemeinsame Definition). */
	class: TicketClass;
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
		const phaseRuns: Record<string, number> = {};
		const total: TicketTurns = {
			issue,
			runs: ticketEntries.length,
			measured: 0,
			turns: 0,
			phases: [],
			phaseRuns,
			class: 'sonstiges',
		};
		for (const e of ticketEntries) {
			const phase = e.phase ?? '(ohne)';
			phaseRuns[phase] = (phaseRuns[phase] ?? 0) + 1;
			if (!isMeasured(e)) continue;
			const turns = e.turns as number;
			total.measured += 1;
			total.turns += turns;
			byPhase.set(phase, (byPhase.get(phase) ?? 0) + turns);
		}
		total.phases = [...byPhase.entries()].map(([phase, n]) => `${phase}:${n}`);
		total.class = classifyTicket(phaseRuns);
		tickets.push(total);
	}
	tickets.sort(
		(a, b) => Number(b.measured > 0) - Number(a.measured > 0) || b.turns - a.turns || Number(a.issue) - Number(b.issue),
	);
	return { tickets, entries, measured: entries.filter(isMeasured), skipped };
}

const has = (phaseRuns: Record<string, number>, phase: string): boolean => (phaseRuns[phase] ?? 0) > 0;

const num = (n: number): string => n.toLocaleString('de-DE');
/** Ø-Werte mit einer Nachkommastelle; ohne messende Läufe „—" statt einer Division durch 0. */
const avg = (part: number, count: number): string =>
	count > 0 ? (part / count).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
/** Verhältniszahl (Schleifen-Rate) mit zwei Nachkommastellen; ohne Bezugsgröße „—". */
const ratio = (part: number, base: number): string =>
	base > 0 ? (part / base).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

/** Quantil (0..1) über aufsteigend sortierte Werte; unteres Element, ohne Interpolation. */
const quantile = (sorted: number[], q: number): number => {
	if (sorted.length === 0) return Number.NaN;
	const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
	return sorted[idx] as number;
};

const CLASS_LABEL: Record<TicketClass, string> = {
	vollstaendig: 'vollständig',
	'fixup-bein': 'Fixup-Bein',
	abgebrochen: 'abgebrochen',
	sonstiges: 'sonstiges',
};

/** Markdown-Bericht: Kennzahlen, Schleifen-Raten, Turns je Phase, Wochen-Trend, Turns je Ticket. */
export function renderTurnReport(dir: string): string {
	const all = turnTotals(dir);
	const lines: string[] = [];
	// VOLLSTÄNDIGKEITS-FILTER: alle Kennzahlen laufen NUR über vollständige Tickets
	// (implement + documenter, `classifyTicket` aus tokens-report.ts — dieselbe Definition
	// wie im Kosten-Report und in der Audit-Basis). Fixup-Beine blähen Schleifen-Raten auf,
	// abgebrochene Durchläufe haben ihr Ende noch nicht gezeigt; beide bleiben nur als
	// Fußnote mit ihrer Summe sichtbar (Budget-Realität erhalten, Auswertung sauber).
	const tickets = all.tickets.filter((t) => t.class === 'vollstaendig');
	const excluded = all.tickets.filter((t) => t.class !== 'vollstaendig');
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

	lines.push(
		`**${tickets.length} vollständige Tickets · ${runsTotal} Läufe · ${num(turnsTotal)} Turns · ` +
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

	// Selbstoptimierungs-Kennzahlen — `tickets` ist seit dem Vollständigkeits-Filter oben
	// bereits die Basis vollständiger Tickets; hier nur noch die Aufteilung nach Fixup.
	const complete = tickets;
	const firstPass = complete.filter((t) => !has(t.phaseRuns, 'fixup'));
	const reworked = complete.filter((t) => has(t.phaseRuns, 'fixup'));
	const fixupRunsReworked = reworked.reduce((a, t) => a + (t.phaseRuns.fixup ?? 0), 0);
	const reviewRunsComplete = complete.reduce((a, t) => a + (t.phaseRuns.review ?? 0), 0);
	const completeTurns = complete.reduce((a, t) => a + t.turns, 0);
	const loopTurns = measured
		.filter((e) => (e.phase === 'fixup' || e.phase === 'review') && complete.some((t) => t.issue === e.issueId))
		.reduce((a, e) => a + (e.turns as number), 0);
	const sortedTicketTurns = complete
		.filter((t) => t.turns > 0)
		.map((t) => t.turns)
		.sort((a, b) => a - b);
	// I — Lead-Time (Wandzeit erster → letzter Lauf je Ticket, ALLE Läufe auch ungemessene):
	// der Gegenpart zu Turns — „schnell fertig" vs. „wenige Prompts". Median/p75 wie bei Turns.
	const leadHours = tickets
		.map((t) => {
			const ts = entries
				.filter((e) => e.issueId === t.issue)
				.map((e) => Date.parse(e.timestamp))
				.sort((a, b) => a - b);
			return ts.length >= 2 ? (ts[ts.length - 1] - ts[0]) / 3_600_000 : Number.NaN;
		})
		.filter((h) => Number.isFinite(h))
		.sort((a, b) => a - b);
	const leadFmt = (q: number): string =>
		leadHours.length > 0 ? `${quantile(leadHours, q).toLocaleString('de-DE', { maximumFractionDigits: 1 })} h` : '—';
	// J — Routing-Ersparnis realisiert: Anteil vollständiger Tickets, die spec/ux laut
	// Analyse-Entscheidung übersprungen haben (Run-Spalte der ai-phase-routing-Tabelle).
	const noSpec = complete.filter((t) => !has(t.phaseRuns, 'spec')).length;
	const noUx = complete.filter((t) => !has(t.phaseRuns, 'ux')).length;
	lines.push(
		'### Selbstoptimierung — vollständige Tickets',
		'',
		`Basis: **${complete.length} vollständige Tickets** — davon ${reworked.length} mit Fixup-Schleife.`,
		'',
		'| Kennzahl | Wert |',
		'| --- | ---: |',
		`| First-Pass-Grün-Rate (kein Fixup) | ${pct(complete.length > 0 ? firstPass.length / complete.length : 0)} |`,
		`| Ø Fixup-Läufe je nachbearbeitetem Ticket | ${avg(fixupRunsReworked, reworked.length)} |`,
		`| Ø Review-Läufe je Ticket (Re-Review-Faktor) | ${avg(reviewRunsComplete, complete.length)} |`,
		`| Turns je Ticket — Median | ${sortedTicketTurns.length > 0 ? num(quantile(sortedTicketTurns, 0.5)) : '—'} |`,
		`| Turns je Ticket — p75 | ${sortedTicketTurns.length > 0 ? num(quantile(sortedTicketTurns, 0.75)) : '—'} |`,
		`| Fixup+Review-Anteil an Turns | ${pct(completeTurns > 0 ? loopTurns / completeTurns : 0)} |`,
		`| Lead-Time je Ticket — Median (Wandzeit) | ${leadFmt(0.5)} |`,
		`| Lead-Time je Ticket — p75 | ${leadFmt(0.75)} |`,
		`| Spec übersprungen (Routing-Ersparnis) | ${pct(complete.length > 0 ? noSpec / complete.length : 0)} |`,
		`| UX übersprungen (Routing-Ersparnis) | ${pct(complete.length > 0 ? noUx / complete.length : 0)} |`,
		'',
		'> Die First-Pass-Grün-Rate ist die Steuergröße der Pipeline: Jede Nacharbeit kostet',
		'> eine Fixup- und eine Re-Review-Runde. Der Wochen-Trend zeigt, ob Interventionen',
		'> (z. B. Severity-Gating im Review) die Rate bewegen — Median/p75 robuster als Ø.',
		'',
	);

	// E — Review-Runden-Verteilung: der Ø 2,2 versteckt den Schwanz — wenige Tickets mit 4+
	// Runden tragen die Schleifenkosten (Kreuzverhör-Loops, #932). Das Histogramm macht sie
	// sichtbar; sie sind die Eskalations-/Mentor-Kandidaten.
	const buckets = new Map<number, number>();
	for (const t of complete) {
		const r = t.phaseRuns.review ?? 0;
		if (r <= 0) continue;
		const b = Math.min(r, 5);
		buckets.set(b, (buckets.get(b) ?? 0) + 1);
	}
	if (buckets.size > 0) {
		lines.push('Review-Runden je Ticket (Histogramm):', '', '| Review-Runden | Tickets |', '| --- | ---: |');
		for (let b = 1; b <= 5; b++) lines.push(`| ${b === 5 ? '5+' : b} | ${buckets.get(b) ?? 0} |`);
		lines.push(
			'',
			'> Wenige Tickets mit 4+ Runden tragen die Schleifenkosten — sie sind die Eskalations-/Mentor-Kandidaten.',
			'',
		);
	}

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
	// Erstgrün je Woche — Attribute: Woche des LETZTEN gemessenen Laufs (Abschlusswoche), denn
	// ob ein Ticket first-pass-grün ist, weiß man erst am Ende. Nur vollständige Tickets.
	const weekFirstPass = new Map<string, { complete: number; firstPass: number }>();
	for (const t of tickets.filter((c) => c.class === 'vollstaendig')) {
		const last = entries
			.filter((e) => e.issueId === t.issue && isMeasured(e))
			.map((e) => e.timestamp)
			.sort()
			.pop();
		if (!last) continue;
		const wk = isoWeek(berlinDay(last));
		const rec = weekFirstPass.get(wk) ?? { complete: 0, firstPass: 0 };
		rec.complete += 1;
		if (!has(t.phaseRuns, 'fixup')) rec.firstPass += 1;
		weekFirstPass.set(wk, rec);
	}
	const firstPassCol = (wk: string): string => {
		const rec = weekFirstPass.get(wk);
		if (!rec || rec.complete === 0) return '—';
		return `${rec.firstPass}/${rec.complete} (${pct(rec.firstPass / rec.complete)})`;
	};
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

	// WIRKUNGSGRAD-CHARTS (A/B/C) — die Schleifen-Kennzahlen oben sind Snapshots; Entwicklung
	// braucht die Zeitachse. Alles Wochen-Raster (Tages-Werte verschieben sich mit dem
	// Versiegelungs-Lag nachträglich, s. Kosten-Report-Fußnote).
	//
	// A — Erstgrün-Rate je Woche: die Steuergröße als Kurve. Die Tabelle führt sie als Spalte,
	// der Trend braucht aber das Bild — „bewegt sich was" sieht man im Chart in einer Sekunde.
	const fpRates = weeks.map(([wk]) => {
		const rec = weekFirstPass.get(wk);
		return rec && rec.complete > 0 ? (rec.firstPass / rec.complete) * 100 : 0;
	});
	lines.push('```mermaid');
	lines.push('xychart-beta');
	lines.push('\ttitle "First-Pass-Grün je Woche (%)"');
	lines.push('\tx-axis ["' + weeks.map(([wk]) => wk).join('", "') + '"]');
	lines.push('\ty-axis "%" 0 --> 100');
	lines.push('\tbar "Erstgrün %" [' + fpRates.map((r) => r.toFixed(1)).join(', ') + ']');
	lines.push('```');
	lines.push('');

	// B — Loop-Anteil je Woche: Anteil der Schleifen-Phasen (review+fixup) an den Turns der
	// Woche. Der Snapshot oben (28,6 %) zeigt den Stand — ob der Block schrumpft, ist die Frage.
	const weekLoopTurns = new Map<string, number>();
	for (const e of measured) {
		if (e.phase !== 'review' && e.phase !== 'fixup') continue;
		const wk = isoWeek(berlinDay(e.timestamp));
		weekLoopTurns.set(wk, (weekLoopTurns.get(wk) ?? 0) + (e.turns as number));
	}
	const loopShares = weeks.map(([wk, w]) => (w.turns > 0 ? ((weekLoopTurns.get(wk) ?? 0) / w.turns) * 100 : 0));
	lines.push('```mermaid');
	lines.push('xychart-beta');
	lines.push('\ttitle "Loop-Anteil (Review+Fixup) an Turns je Woche (%)"');
	lines.push('\tx-axis ["' + weeks.map(([wk]) => wk).join('", "') + '"]');
	lines.push('\ty-axis "%" 0 --> 100');
	lines.push('\tbar "Loop-Anteil %" [' + loopShares.map((s) => s.toFixed(1)).join(', ') + ']');
	lines.push('```');
	lines.push('');

	// C — Budget-Burn: Turns je Woche über ALLE messenden Läufe, AUCH die ausgeschlossenen
	// Tickets — das Abo rechnet die Realität, nicht die gefilterte Auswertung (das Budget
	// riss 2026-09 unbemerkt, s. Kopf des Kosten-Übersicht-Workflows). Die 8000er-Linie ist
	// das Richtbudget aus docs/kosten-optimierungsplan.md; laufende Woche unvollständig.
	const TURN_BUDGET_PER_WEEK = 8000;
	const burnWeeks = new Map<string, number>();
	for (const e of all.measured) {
		const wk = isoWeek(berlinDay(e.timestamp));
		burnWeeks.set(wk, (burnWeeks.get(wk) ?? 0) + (e.turns as number));
	}
	const burnKeys = [...burnWeeks.keys()].sort();
	const burnMax = Math.max(TURN_BUDGET_PER_WEEK, ...burnKeys.map((k) => burnWeeks.get(k) ?? 0));
	lines.push('```mermaid');
	lines.push('xychart-beta');
	lines.push('\ttitle "Turn-Budget-Burn — Turns je Woche vs. Budget"');
	lines.push('\tx-axis ["' + burnKeys.join('", "') + '"]');
	lines.push(`\ty-axis "Turns" 0 --> ${Math.ceil(burnMax * 1.1)}`);
	lines.push('\tbar "Turns" [' + burnKeys.map((k) => burnWeeks.get(k) ?? 0).join(', ') + ']');
	lines.push(`\tline "Budget ${TURN_BUDGET_PER_WEEK}" [` + burnKeys.map(() => TURN_BUDGET_PER_WEEK).join(', ') + ']');
	lines.push('```');
	lines.push(
		'',
		`> Budget-Linie = ${num(TURN_BUDGET_PER_WEEK)} Turns/Woche (Richtwert). Basis: ALLE messenden Läufe inkl. der ausgeschlossenen Tickets — Abo-Realität statt gefilterte Auswertung.`,
		'',
	);

	// H — Delegationsquote je Woche: sidechainTokens-Anteil am Input. Misst, ob der ADR-0008-
	// Fan-out (Haiku-Subagents) real ankommt — 0 % heißt, alle Reads laufen im teuren Parent.
	const weekSidechain = new Map<string, number>();
	const weekInput = new Map<string, number>();
	for (const e of measured) {
		const wk = isoWeek(berlinDay(e.timestamp));
		weekInput.set(wk, (weekInput.get(wk) ?? 0) + e.tokensIn);
		weekSidechain.set(wk, (weekSidechain.get(wk) ?? 0) + (e.sidechainTokens ?? 0));
	}
	const delegationCol = (wk: string): string => {
		const inp = weekInput.get(wk) ?? 0;
		return inp > 0 ? `${(((weekSidechain.get(wk) ?? 0) / inp) * 100).toFixed(1)} %` : '—';
	};
	lines.push('| Woche | Läufe | Tickets | Turns | Ø je Lauf | Ø je Ticket | Erstgrün | Loop-Anteil | Delegation |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
	for (const [wk, w] of weeks) {
		lines.push(
			`| ${wk} | ${w.runs} | ${w.issues.size} | ${num(w.turns)} | ${avg(w.turns, w.runs)} | ${avg(w.turns, w.issues.size)} | ${firstPassCol(wk)} | ${(((weekLoopTurns.get(wk) ?? 0) / Math.max(1, w.turns)) * 100).toFixed(1)} % | ${delegationCol(wk)} |`,
		);
	}
	lines.push('');

	// D — HERKUNFTS-SPLIT: Pipeline-Tickets (Analyse+Implement vorhanden) gegen extern
	// umgesetzte (Review-only-Durchläufe, z. B. in Claude Web vorbereitet). Basis sind ALLE
	// Tickets, nicht nur vollständige — vollständige sind per Definition Pipeline-Tickets
	// (implement+documenter), der Extern-Anteil läge sonst gar nicht in der Auswertung.
	// Beantwortet die offene Frage, ob externe Tickets öfter nachgebessert werden UND ob
	// das an Turns teurer ist — die Trennung „schlechterer Code vs. strengerer Review"
	// liefern die findings/nits-Felder, sobald sie gefüllt sind (s. u.).
	const originOf = (t: TicketTurns): 'pipeline' | 'extern' =>
		has(t.phaseRuns, 'analyse') && has(t.phaseRuns, 'implement') ? 'pipeline' : 'extern';
	const origins: Array<'pipeline' | 'extern'> = ['pipeline', 'extern'];
	lines.push(
		'### Herkunft: Pipeline vs. extern umgesetzt — alle Tickets',
		'',
		'| Herkunft | Tickets | mit Fixup | Fixup-Rate | Turns gesamt | Ø Turns je Ticket | Ø Läufe je Ticket |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
	);
	for (const o of origins) {
		const group = all.tickets.filter((t) => originOf(t) === o);
		const reworkedGroup = group.filter((t) => has(t.phaseRuns, 'fixup'));
		const measuredGroup = group.filter((t) => t.measured > 0);
		const turnsGroup = group.reduce((a, t) => a + t.turns, 0);
		const runsGroup = group.reduce((a, t) => a + t.runs, 0);
		lines.push(
			`| ${o === 'pipeline' ? 'Pipeline (Analyse+Implement)' : 'extern umgesetzt (Review-only)'} | ${group.length} | ${reworkedGroup.length} | ${pct(group.length > 0 ? reworkedGroup.length / group.length : 0)} | ${num(turnsGroup)} | ${avg(turnsGroup, measuredGroup.length)} | ${avg(runsGroup, group.length)} |`,
		);
	}
	lines.push(
		'',
		'> Ø Turns/Läufe nur über Tickets mit Turn-Erfassung; Fixup-Rate über alle. Extern = Tickets ohne Analyse+Implement-Einträge — auch vor der Verkabelung versiegelte Durchläufe zählen hierzu.',
		'',
	);

	// F+G — Neue Messfelder (ab 2026-09-06 erfasst): verdict/findings/nits je Review-Lauf und
	// effort je Lauf füllen sich erst mit künftigen Versiegelungen. Ohne Daten bleibt es eine
	// Notiz statt einer leeren Tabelle — über fehlende Messung wird keine Aussage gemacht.
	const originById = new Map(all.tickets.map((t) => [t.issue, originOf(t)]));
	const withFindings = all.entries.filter(
		(e) => e.phase === 'review' && typeof e.findings === 'number' && typeof e.nits === 'number',
	);
	const effortRuns = all.entries.filter((e) => typeof e.effort === 'string');
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
			const fixShare = g.filter((e) => e.verdict === 'needs-fixup').length / g.length;
			lines.push(
				`| ${o === 'pipeline' ? 'Pipeline' : 'extern'} | ${g.length} | ${fAvg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} | ${nAvg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} | ${pct(fixShare)} |`,
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
			const key = `${e.phase ?? '(ohne)'}\u{0009}${e.effort}`;
			const rec = byPhaseEffort.get(key) ?? { runs: 0, turns: 0 };
			rec.runs += 1;
			rec.turns += e.turns as number;
			byPhaseEffort.set(key, rec);
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
			'> Antwortet „lohnt high Effort?“:senkt ein höherer Aufwand die Turns je Lauf (und',
			'> mittelbar die Fixup-Rate), oder zahlt er sich nur in Token?',
			'',
		);
	}

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

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderTurnReport(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
