// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) – das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// "Kosten-Übersicht" (manuell oder nightly, read-only) in die Job-Summary:
//   node .github/scripts/costs-report.ts --dir .costs
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich lösbare TypeScript-Syntax.

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
	/** Phasen-Verteilung in Erstauftreten-Reihenfolge, z. B. "analyse:1 · fixup:4". */
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
	// Schleifen-Kandidaten zuerst: absteigend nach Wert, dann Issue-Nummer aufsteigend –
	// der Bericht soll die Ausreisser oben zeigen, nicht sie in 50 Zeilen verstecken.
	tickets.sort((a, b) => b.valueCost - a.valueCost || Number(a.issue) - Number(b.issue));
	return { tickets, skipped };
}

/** Liest alle Einträge aus allen Ticket-Dateien unter `dir` und summiert je Provider. */
export function providerTotals(dir: string): { providers: ProviderTotal[]; skipped: string[] } {
	const byProvider = new Map<string, ProviderTotal>();
	const order: string[] = [];
	const skipped: string[] = [];

	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return { providers: [], skipped: [dir] };
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
		for (const e of entries) {
			const provider = e.provider ?? 'unbekannt';
			let total = byProvider.get(provider);
			if (!total) {
				total = {
					provider,
					runs: 0,
					turns: 0,
					tokensIn: 0,
					tokensOut: 0,
					valueCost: 0,
					cost: 0,
				};
				byProvider.set(provider, total);
				order.push(provider);
			}
			total.runs += 1;
			total.turns += ZERO(e.turns);
			total.tokensIn += ZERO(e.tokensIn);
			total.tokensOut += ZERO(e.tokensOut);
			total.valueCost += ZERO(e.valueCost);
			total.cost += ZERO(e.cost);
		}
	}

	return { providers: order.map((p) => byProvider.get(p) as ProviderTotal), skipped };
}

const num = (n: number): string => n.toLocaleString('de-DE');
const usd = (n: number): string => `$${n.toFixed(2)}`;
const mio = (n: number): string => `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio`;

/** Markdown-Bericht: Summen, Phasen-Verteilung, Provider-Verteilung, Tabelle je Ticket (Wert absteigend). */
export function renderReport(dir: string): string {
	const { tickets, skipped: skippedTickets } = ticketTotals(dir);
	const { providers, skipped: skippedProviders } = providerTotals(dir);
	const lines: string[] = [];
	lines.push('## 📊 Kosten-Übersicht – alle versiegelten Tickets', '');
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
	// Liste – der billigste Ticket-Datensatz stammt selten vom ersten Tag.
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
			'> ℹ️ Keine Turns erfasst – alle Datensätze stammen von Läufen vor der Turns-Erfassung (Issue #984).',
			'',
		);
	}
	lines.push(
		'> Wert = Verbrauchsbewertung zu Modellklassen-Preisen (provider-unabhängig), Echt = gemessene Anthropic-Kosten (Fremdtarife: 0, s. `.costs/SCHEMA.md`). Sortiert nach Wert absteigend – oben stehen die teuersten Durchläufe und damit die ersten Optimierungskandidaten (Review-/Fixup-Schleifen).',
		'',
	);
	const allSkipped = [...new Set([...skippedTickets, ...skippedProviders])];
	if (allSkipped.length > 0) {
		lines.push(`> ⚠️ ${allSkipped.length} Datei(en) nicht lesbar und übersprungen: ${allSkipped.join(', ')}`, '');
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
