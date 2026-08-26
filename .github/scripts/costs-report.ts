// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) — das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// „Kosten-Übersicht" (manuell, read-only) in die Job-Summary:
//   node .github/scripts/costs-report.ts --dir .costs
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich löschbare TypeScript-Syntax.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';

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

/** Liest alle <issueId>.json unter `dir` und summiert je Ticket. Kaputte Dateien übersprungen+gemeldet. */
export function ticketTotals(dir: string): { tickets: TicketTotal[]; skipped: string[] } {
	const tickets: TicketTotal[] = [];
	const skipped: string[] = [];
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return { tickets, skipped: [dir] };
	}
	for (const name of names.sort()) {
		if (!name.endsWith('.json') || name === 'SCHEMA.md') continue;
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
		const issue = name.replace(/\.json$/, '');
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
		tickets.push(total);
	}
	// Schleifen-Kandidaten zuerst: absteigend nach Wert, dann Issue-Nummer aufsteigend —
	// der Bericht soll die Ausreisser oben zeigen, nicht sie in 50 Zeilen verstecken.
	tickets.sort((a, b) => b.valueCost - a.valueCost || Number(a.issue) - Number(b.issue));
	return { tickets, skipped };
}

const num = (n: number): string => n.toLocaleString('de-DE');
const usd = (n: number): string => `$${n.toFixed(2)}`;
const mio = (n: number): string => `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio`;

/** Markdown-Bericht: Summen, Phasen-Verteilung, Tabelle je Ticket (Wert absteigend). */
export function renderReport(dir: string): string {
	const { tickets, skipped } = ticketTotals(dir);
	const lines: string[] = [];
	lines.push('## 💰 Kosten-Übersicht — alle versiegelten Tickets', '');
	if (tickets.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		return `${lines.join('\n')}\n`;
	}

	const allEntries: CostEntry[] = [];
	for (const t of tickets) allEntries.push(...readCostEntries(dir, t.issue));
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
	// Liste — der billigste Ticket-Datensatz stammt selten vom ersten Tag.
	const first = tickets.reduce((min, t) => (t.first < min ? t.first : min), tickets[0].first);
	const last = tickets.reduce((max, t) => (t.last > max ? t.last : max), tickets[0].last);

	// Block-Aufschlüsselung: echter Input / Cache-Write / Cache-Read aus tokensIn ableiten.
	// Grund: die Summe verdeckt, wo das Geld fliesst — Cache-Read ist rabattiert (0,1x)
	// und trotzdem oft der groesste Block; Output-Disziplin optimiert nur einen Anteil.
	const blockTokens = (p: PhaseTotal): { input: number; write: number; read: number } => ({
		input: Math.max(0, p.tokensIn - p.cacheCreationTokens - p.cacheReadTokens),
		write: p.cacheCreationTokens,
		read: p.cacheReadTokens,
	});

	lines.push(
		`**${tickets.length} Tickets · ${sum.runs} Läufe · Zeitraum ${first.slice(0, 10)} bis ${last.slice(0, 10)}**`,
		'',
		'| Phase | Läufe | Turns | Input | Cache-W (1,25×) | Cache-R (0,1×) | Token out | Wert (USD) |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
	);
	for (const p of phases) {
		const b = blockTokens(p);
		lines.push(
			`| ${p.phase} | ${p.runs} | ${anyTurns ? num(p.turns) : '—'} | ${mio(b.input)} | ${mio(b.write)} | ${mio(b.read)} | ${num(p.tokensOut)} | ${usd(p.valueCost)} |`,
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
		`| **Summe** | **${sum.runs}** | **${anyTurns ? num(sum.turns) : '—'}** | **${mio(sumBlocks.input)}** | **${mio(sumBlocks.write)}** | **${mio(sumBlocks.read)}** | **${num(sum.tokensOut)}** | **${usd(sum.valueCost)}** |`,
		'',
	);

	// Block-Kosten-Verteilung: USD je Block über alle Phasen. Roh-Bewertung zu
	// mid-Klassenpreisen (3/15 je M), dann auf die valueCost-Summe skaliert — je
	// Eintrag gerechnete Klassen-Preise sind fuer den Ueberblick zu fein; Anteile
	// stimmen, der Gesamtwert bleibt konsistent zur Tabelle oben.
	const rawIn = (sumBlocks.input / 1e6) * 3;
	const rawWrite = (sumBlocks.write / 1e6) * 3 * 1.25;
	const rawRead = (sumBlocks.read / 1e6) * 3 * 0.1;
	const rawOut = (sum.tokensOut / 1e6) * 15;
	const rawSum = rawIn + rawWrite + rawRead + rawOut || 1;
	const scale = sum.valueCost / rawSum;
	const blockRow = (label: string, tokens: number, usd: number): string =>
		`| ${label} | ${mio(tokens)} | $${usd.toFixed(2)} |`;
	lines.push(
		'### Kosten nach Block',
		'',
		'| Block | Token | Wert (USD) |',
		'| --- | ---: | ---: |',
		blockRow('Input (echt)', sumBlocks.input, rawIn * scale),
		blockRow('Cache-Write (1,25×)', sumBlocks.write, rawWrite * scale),
		blockRow('Cache-Read (0,1×)', sumBlocks.read, rawRead * scale),
		blockRow('Output', sum.tokensOut, rawOut * scale),
		'',
		'> Cache-Read ist rabattiert, aber bei hoher Turn-Zahl der größte Treiber;',
		'> Output ist pro Token am teuersten. Achtung: Datensätze vor der',
		'> Cache-Erfassung zählen komplett als „echter Input“ und überzeichnen ihn.',
		'',
	);

	// Zeitlicher Trend der Durchschnittskosten je Run (nur messende Läufe, valueCost > 0).
	// Grund: ein Trend ist der Kompass für Optimierungen — Tagesmittel glätten Ticket-Streuung,
	// Phasen-Mittel zeigen, WELCHE Phase den Trend treibt. Läufe ohne Messung (valueCost=0,
	// vor #984) würden den Trend gegen 0 ziehen und sind ausgeschlossen.
	const byDay = new Map<string, { runs: number; vc: number }>();
	const byDayPhase = new Map<string, Map<string, { runs: number; vc: number }>>();
	for (const e of allEntries) {
		const vc = ZERO(e.valueCost);
		if (vc <= 0) continue;
		const day = e.timestamp.slice(0, 10);
		let d = byDay.get(day);
		if (!d) {
			d = { runs: 0, vc: 0 };
			byDay.set(day, d);
		}
		d.runs += 1;
		d.vc += vc;
		const ph = e.phase ?? '(ohne)';
		let dm = byDayPhase.get(day);
		if (!dm) {
			dm = new Map();
			byDayPhase.set(day, dm);
		}
		let pd = dm.get(ph);
		if (!pd) {
			pd = { runs: 0, vc: 0 };
			dm.set(ph, pd);
		}
		pd.runs += 1;
		pd.vc += vc;
	}
	const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
	if (days.length > 0) {
		lines.push('### Zeitlicher Trend — Durchschnitt je Run', '');
		lines.push('```mermaid');
		lines.push('xychart-beta');
		lines.push('\ttitle "Ø Kosten je Run (USD, nur messende Läufe)"');
		lines.push('\tx-axis ["' + days.map(([d]) => d.slice(5)).join('", "') + '"]');
		lines.push(
			'\ty-axis "Ø USD je Run" 0 --> ' + Math.max(2, Math.ceil(Math.max(...days.map(([, v]) => v.vc / v.runs)) + 0.5)),
		);
		lines.push('\tbar "Ø je Run" [' + days.map(([, v]) => (v.vc / v.runs).toFixed(3)).join(', ') + ']');
		lines.push('```');
		lines.push(
			'',
			'> Nur Läufe mit Messung (valueCost > 0, seit #984). Wenige Runs pro Tag können den',
			'> Tageswert stark bewegen — der Trend zählt, nicht der Einzelpunkt.',
			'',
		);
		// Phasen-Trendtabelle:Ø je Phase je Tag — zeigt, welche Phase den Trend treibt.
		const phaseNames = [...new Set(allEntries.filter((e) => ZERO(e.valueCost) > 0).map((e) => e.phase ?? '(ohne)'))];
		lines.push('| Tag | ' + phaseNames.join(' | ') + ' |');
		lines.push('| --- |' + ' ---: |'.repeat(phaseNames.length));
		for (const [day] of days) {
			const dm = byDayPhase.get(day) ?? new Map();
			const cells = phaseNames.map((ph) => {
				const pd = dm.get(ph);
				return pd ? `$${(pd.vc / pd.runs).toFixed(2)}` : '—';
			});
			lines.push(`| ${day.slice(5)} | ${cells.join(' | ')} |`);
		}
		lines.push('');
	}

	lines.push(
		'| Ticket | Läufe | Turns | Token in | Wert (USD) | Echt (USD) | Phasen |',
		'| --- | ---: | ---: | ---: | ---: | ---: | --- |',
	);
	for (const t of tickets) {
		lines.push(
			`| [#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue}) | ${t.runs} | ${t.turns > 0 ? num(t.turns) : '—'} | ${mio(t.tokensIn)} | ${usd(t.valueCost)} | ${t.cost > 0 ? usd(t.cost) : '—'} | ${t.phases.join(' ')} |`,
		);
	}
	lines.push('');

	if (!anyTurns) {
		lines.push(
			'> ℹ️ Keine Turns erfasst — alle Datensätze stammen von Läufen vor der Turns-Erfassung (Issue #984).',
			'',
		);
	}
	lines.push(
		'> Wert = Verbrauchsbewertung zu Modellklassen-Preisen (provider-unabhängig), Echt = gemessene Anthropic-Kosten (Fremdtarife: 0, s. `.costs/SCHEMA.md`). Sortiert nach Wert absteigend — oben stehen die teuersten Durchläufe und damit die ersten Optimierungskandidaten (Review-/Fixup-Schleifen).',
		'',
	);
	if (skipped.length > 0) {
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
	}
	return `${lines.join('\n')}\n`;
}

/** Einträge einer Ticket-Datei erneut roh lesen (die Tabelle braucht sie für die Phasen-Summen). */
const readCostEntries = (dir: string, issue: string): CostEntry[] => {
	try {
		const parsed = JSON.parse(readFileSync(join(dir, `${issue}.json`), 'utf8')) as CostEntry[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderReport(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
