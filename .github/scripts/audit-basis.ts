// Kombinierte KOSTEN-BASIS für den Prompt-Audit (.github/prompts/prompt-audit.md, ORDER
// Schritt 1): Turns FIRST — sie sind der Abrechnungsmaßstab der Abos (Claude, z.ai rechnen
// je Prompt/Turn ab) und das Minimierungsziel der Pipeline —, Tokens und $ daneben in
// derselben Tabelle. Vorher lieferten costs-summary.sh ($) und der Turn-Report die Achsen
// getrennt; der Audit musste Ersparnisse zwischen zwei Blickwinkeln umrechnen (#1198).
//
// VOLLSTÄNDIGKEITS-FILTER: Versiegelte Dateien enthalten neben kompletten Durchläufen auch
// Fixup-Beine (Nacharbeit ohne implement, eigene Datei) und abgebrochene Tickets (ohne
// documenter). Schleifen-Raten und Turns/Ticket mitteln deshalb NUR über vollständige
// Tickets (implement + documenter) — Klassifikation aus turns-report.ts, dieselbe Logik
// wie im Turn-Report (eine Definition, zwei Renderer).
//
// Läufe ohne `turns`-Feld (vor #984) zählen in Runs/$/Token mit, bleiben aber aus allen
// Turn-Mittelwerten heraus — als 0 gemittelt hätten sie den Turn-Aufwand untertrieben.
//
// Aufruf: node .github/scripts/audit-basis.ts [verzeichnis]   (Default: .costs)

import { classifyTicket, pct, readTickets } from './tokens-report.ts';
import type { CostEntry } from './cost-record.ts';

const M = 1_000_000;
const isMeasured = (e: CostEntry): boolean => typeof e.turns === 'number' && Number.isFinite(e.turns);

const num = (n: number): string => Math.round(n).toLocaleString('de-DE');
const avg = (part: number, count: number): string =>
	count > 0 ? (part / count).toLocaleString('de-DE', { maximumFractionDigits: 1 }) : '—';
const ratio = (part: number, base: number): string =>
	base > 0 ? (part / base).toLocaleString('de-DE', { maximumFractionDigits: 2, maximumSignificantDigits: 3 }) : '—';

/** Kompakte Markdown-Basis für den Audit-Kontext — bewusst schmal, der Audit liest sie ganz. */
export function renderAuditBasis(dir: string): string {
	const { tickets: raw, skipped } = readTickets(dir);
	const lines: string[] = ['## KOSTEN-BASIS (Turns zuerst)', ''];
	if (raw.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		return `${lines.join('\n')}\n`;
	}

	const entries = raw.flatMap((t) => t.entries);
	const measured = entries.filter(isMeasured);
	const classes = { vollstaendig: 0, 'fixup-bein': 0, abgebrochen: 0, sonstiges: 0 };
	const completeIds = new Set<string>();
	const fixupIds = new Set<string>();
	for (const { issue, entries: es } of raw) {
		const phaseRuns: Record<string, number> = {};
		for (const e of es) phaseRuns[e.phase ?? '(ohne)'] = (phaseRuns[e.phase ?? '(ohne)'] ?? 0) + 1;
		const cls = classifyTicket(phaseRuns);
		classes[cls] += 1;
		if (cls === 'vollstaendig') {
			completeIds.add(issue);
			if ((phaseRuns.fixup ?? 0) > 0) fixupIds.add(issue);
		}
	}

	const sum = (list: CostEntry[], pick: (e: CostEntry) => number): number => list.reduce((a, e) => a + pick(e), 0);
	const phases = new Map<
		string,
		{
			runs: number;
			tickets: Set<string>;
			turns: number;
			measured: number;
			tokensIn: number;
			tokensOut: number;
			cost: number;
		}
	>();
	for (const e of entries) {
		const phase = e.phase ?? '(ohne)';
		let p = phases.get(phase);
		if (!p) {
			p = { runs: 0, tickets: new Set<string>(), turns: 0, measured: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
			phases.set(phase, p);
		}
		p.runs += 1;
		p.tickets.add(e.issueId);
		p.tokensIn += e.tokensIn;
		p.tokensOut += e.tokensOut;
		p.cost += e.cost;
		if (isMeasured(e)) {
			p.measured += 1;
			p.turns += e.turns as number;
		}
	}
	const order = ['analyse', 'ux', 'spec', 'implement', 'review', 'fixup', 'documenter'];
	const sorted = [...phases.entries()].sort(([a], [b]) => {
		const ra = order.indexOf(a);
		const rb = order.indexOf(b);
		return (ra < 0 ? order.length : ra) - (rb < 0 ? order.length : rb) || a.localeCompare(b);
	});

	lines.push(
		`| Phase | Runs | Tickets | Turns | Ø T/Run | Tok in (M) | Tok out (k) | $ |`,
		`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
	);
	for (const [phase, p] of sorted) {
		lines.push(
			`| ${phase} | ${p.runs} | ${p.tickets.size} | ${num(p.turns)} | ${avg(p.turns, p.measured)} | ` +
				`${(p.tokensIn / M).toLocaleString('de-DE', { maximumFractionDigits: 1 })} | ${num(p.tokensOut / 1000)} | ${p.cost.toFixed(2)} |`,
		);
	}
	const totalCost = sum(entries, (e) => e.cost);
	const totalTurns = sum(measured, (e) => e.turns as number);
	lines.push(
		`| **Gesamt** | **${entries.length}** | **${raw.length}** | **${num(totalTurns)}** | **${avg(totalTurns, measured.length)}** | ` +
			`**${(sum(entries, (e) => e.tokensIn) / M).toLocaleString('de-DE', { maximumFractionDigits: 1 })}** | ` +
			`**${num(sum(entries, (e) => e.tokensOut) / 1000)}** | **${totalCost.toFixed(2)}** |`,
		'',
	);

	const completeEntries = measured.filter((e) => completeIds.has(e.issueId));
	const runsOf = (phase: string, list: CostEntry[]): number => list.filter((e) => e.phase === phase).length;
	const implRuns = runsOf('implement', completeEntries);
	const fixRuns = runsOf('fixup', completeEntries);
	const revRuns = runsOf('review', completeEntries);
	const firstPass = completeIds.size - fixupIds.size;
	const ticketTurns = raw
		.filter((t) => completeIds.has(t.issue))
		.map((t) => t.entries.filter(isMeasured).reduce((a, e) => a + (e.turns as number), 0))
		.filter((n) => n > 0)
		.sort((a, b) => a - b);
	const median = ticketTurns.length > 0 ? ticketTurns[Math.floor(ticketTurns.length / 2)] : Number.NaN;
	const cacheShare =
		sum(entries, (e) => e.cacheReadTokens ?? 0) /
		Math.max(
			1,
			sum(entries, (e) => e.tokensIn),
		);

	lines.push(
		`Vollständigkeit: ${classes.vollstaendig} vollständig · ${classes['fixup-bein']} Fixup-Beine · ${classes.abgebrochen} abgebrochen · ${classes.sonstiges} sonstige — Raten darunter nur über vollständige.`,
		'',
		`Schleifen (Läufe): Fixup÷Implement = ${fixRuns}÷${implRuns} = ${ratio(fixRuns, implRuns)} · Review÷Implement = ${revRuns}÷${implRuns} = ${ratio(revRuns, implRuns)}`,
		`First-Pass-Grün (kein Fixup) = ${firstPass}/${completeIds.size} (${pct(completeIds.size > 0 ? firstPass / completeIds.size : 0)}) · Ø Fixup-Läufe je nachbearbeitetem = ${avg(fixRuns, fixupIds.size)} · Median Turns/Ticket (vollständig) = ${Number.isNaN(median) ? '—' : num(median)}`,
		'',
		`Cache-Read-Anteil am Input: ${pct(cacheShare)} — der Prompt-Cache arbeitet; Ersparnispotenzial liegt in TURN-Anzahl, nicht Token-Menge.`,
	);
	if (entries.length > measured.length) {
		lines.push(
			'',
			`Hinweis: ${entries.length - measured.length} von ${entries.length} Läufen ohne turns-Feld (vor #984) — aus Turn-Mittelwerten ausgeschlossen, nicht als 0 gezählt.`,
		);
	}
	if (skipped.length > 0) lines.push('', `> ⚠️ Nicht lesbar und übersprungen: ${skipped.join(', ')}`);
	lines.push('');
	return `${lines.join('\n')}\n`;
}

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderAuditBasis(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
