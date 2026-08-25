// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) — das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// „Kosten-Übersicht" (manuell oder nightly, read-only) in die Job-Summary:
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

export type ProviderTotal = {
	provider: string;
	runs: number;
	turns: number;
	tokensIn: number;
	tokensOut: number;
	valueCost: number;
	cost: number;
};

const ZERO = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Liest alle <issueId>.json unter `dir` einmalig ein. Kaputte Dateien übersprungen+gemeldet. */
const readEntries = (dir: string): { byIssue: Map<string, CostEntry[]>; skipped: string[] } => {
	const byIssue = new Map<string, CostEntry[]>();
	const skipped: string[] = [];
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return { byIssue, skipped: [dir] };
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
		byIssue.set(name.replace(/\.json$/, ''), parsed as CostEntry[]);
	}
	return { byIssue, skipped };
};

/** Summiert die je Ticket-Datei eingelesenen Einträge je Ticket. */
const aggregateTickets = (byIssue: Map<string, CostEntry[]>): TicketTotal[] => {
	const tickets: TicketTotal[] = [];
	for (const [issue, entries] of byIssue) {
		if (entries.length === 0) continue;
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
	return tickets;
};

/** Summiert Einträge je Provider, absteigend nach Wert (teuerster Provider zuerst). */
const aggregateProviders = (entries: CostEntry[]): ProviderTotal[] => {
	const byProvider = new Map<string, ProviderTotal>();
	for (const e of entries) {
		const provider = e.provider ?? 'unbekannt';
		let total = byProvider.get(provider);
		if (!total) {
			total = { provider, runs: 0, turns: 0, tokensIn: 0, tokensOut: 0, valueCost: 0, cost: 0 };
			byProvider.set(provider, total);
		}
		total.runs += 1;
		total.turns += ZERO(e.turns);
		total.tokensIn += ZERO(e.tokensIn);
		total.tokensOut += ZERO(e.tokensOut);
		total.valueCost += ZERO(e.valueCost);
		total.cost += ZERO(e.cost);
	}
	return [...byProvider.values()].sort((a, b) => b.valueCost - a.valueCost);
};

/** Liest alle <issueId>.json unter `dir` und summiert je Ticket. Kaputte Dateien übersprungen+gemeldet. */
export function ticketTotals(dir: string): { tickets: TicketTotal[]; skipped: string[] } {
	const { byIssue, skipped } = readEntries(dir);
	return { tickets: aggregateTickets(byIssue), skipped };
}

/** Liest alle Einträge aus allen Ticket-Dateien unter `dir` und summiert je Provider. */
export function providerTotals(dir: string): { providers: ProviderTotal[]; skipped: string[] } {
	const { byIssue, skipped } = readEntries(dir);
	return { providers: aggregateProviders([...byIssue.values()].flat()), skipped };
}

const num = (n: number): string => n.toLocaleString('de-DE');
const usd = (n: number): string => `$${n.toFixed(2)}`;
const mio = (n: number): string => `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio`;

/** Markdown-Bericht: Summen, Phasen-Verteilung, Provider-Verteilung, Tabelle je Ticket (Wert absteigend). */
export function renderReport(dir: string): string {
	const { byIssue, skipped } = readEntries(dir);
	const tickets = aggregateTickets(byIssue);
	const lines: string[] = [];
	lines.push('## 💰 Kosten-Übersicht — alle versiegelten Tickets', '');
	if (tickets.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		return `${lines.join('\n')}\n`;
	}

	const allEntries = [...byIssue.values()].flat();
	const providers = aggregateProviders(allEntries);
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

	lines.push(
		`**${tickets.length} Tickets · ${sum.runs} Läufe · Zeitraum ${first.slice(0, 10)} bis ${last.slice(0, 10)}**`,
		'',
	);

	// Phasen-Tabelle
	lines.push('### Nach Phasen', '');
	lines.push('| Phase | Läufe | Turns | Token in | Token out | Wert (USD) |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
	for (const p of phases) {
		lines.push(
			`| ${p.phase} | ${p.runs} | ${anyTurns ? num(p.turns) : '—'} | ${mio(p.tokensIn)} | ${num(p.tokensOut)} | ${usd(p.valueCost)} |`,
		);
	}
	lines.push(
		`| **Summe** | **${sum.runs}** | **${anyTurns ? num(sum.turns) : '—'}** | **${mio(sum.tokensIn)}** | **${num(sum.tokensOut)}** | **${usd(sum.valueCost)}** |`,
		'',
	);

	// Provider-Tabelle
	lines.push('### Nach Providern', '');
	lines.push('| Provider | Läufe | Turns | Token in | Token out | Wert (USD) | Echt (USD) |');
	lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
	for (const p of providers) {
		lines.push(
			`| ${p.provider} | ${p.runs} | ${p.turns > 0 ? num(p.turns) : '—'} | ${mio(p.tokensIn)} | ${num(p.tokensOut)} | ${usd(p.valueCost)} | ${p.cost > 0 ? usd(p.cost) : '—'} |`,
		);
	}
	const providerSum = providers.reduce(
		(a, p) => ({
			runs: a.runs + p.runs,
			turns: a.turns + p.turns,
			tokensIn: a.tokensIn + p.tokensIn,
			tokensOut: a.tokensOut + p.tokensOut,
			valueCost: a.valueCost + p.valueCost,
			cost: a.cost + p.cost,
		}),
		{ runs: 0, turns: 0, tokensIn: 0, tokensOut: 0, valueCost: 0, cost: 0 },
	);
	lines.push(
		`| **Summe** | **${providerSum.runs}** | **${providerSum.turns > 0 ? num(providerSum.turns) : '—'}** | **${mio(providerSum.tokensIn)}** | **${num(providerSum.tokensOut)}** | **${usd(providerSum.valueCost)}** | **${providerSum.cost > 0 ? usd(providerSum.cost) : '—'}** |`,
		'',
	);

	// Ticket-Tabelle
	lines.push('### Nach Tickets (Wert absteigend)', '');
	lines.push(
		'| Ticket | Läufe | Turns | Token in | Wert (USD) | Echt (USD) | Phasen |',
		'| --- | ---: | ---: | ---: | ---: | ---: | --- |',
	);
	for (const t of tickets) {
		lines.push(
			`| #${t.issue} | ${t.runs} | ${t.turns > 0 ? num(t.turns) : '—'} | ${mio(t.tokensIn)} | ${usd(t.valueCost)} | ${t.cost > 0 ? usd(t.cost) : '—'} | ${t.phases.join(' ')} |`,
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

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderReport(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
