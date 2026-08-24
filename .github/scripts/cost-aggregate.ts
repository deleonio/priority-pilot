// Fasst die Kosten-Datensätze EINES Tickets aus mehreren Artefakten zu einem Bericht zusammen.
//
// WARUM ÜBERHAUPT: `.github/actions/record-cost` schreibt bewusst NICHT nach `.costs/` im
// Repo (sechs Phasen × parallele Tickets, die alle auf denselben Ordner committen, erzeugen
// Konflikte auf main). Jeder Phasen-Lauf lädt seinen Datensatz stattdessen als Artefakt
// `claude-costs-<phase>-issue-<n>-<run_id>` hoch. Damit liegen die Zahlen zwar vollständig
// vor, aber verstreut über N Artefakte — und für die Baseline aus ADR 0004 („erst messen,
// dann umbauen") braucht es EINE Tabelle. Genau die baut dieses Skript.
//
// Ausgelagert statt inline im Workflow, damit die Rechnung lokal gegen echte Artefakte
// ausführbar und damit belegbar bleibt:
//   node .github/scripts/cost-aggregate.ts --issue 912 --dir /tmp/costs
//
// Stil-Spiegel von cost-from-transcript.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich löschbare TypeScript-Syntax (läuft mit `node` ohne tsx, s. record-cost).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CostEntry } from './cost-record.ts';

/**
 * Alle `*.json` unterhalb von `dir` (rekursiv). `actions/download-artifact` legt bei
 * einem `pattern`-Download jedes Artefakt in einen EIGENEN Unterordner ab — alle Dateien
 * heissen `<issue>.json`, unterscheiden sich also nur im Pfad. Ein flaches Listing würde
 * genau eine davon finden und die übrigen Phasen still verlieren.
 */
export function findRecordFiles(dir: string): string[] {
	const out: string[] = [];
	const walk = (current: string): void => {
		let names: string[] = [];
		try {
			names = readdirSync(current);
		} catch {
			return; // nicht lesbar => überspringen, kein Abbruch des Gesamtberichts
		}
		for (const name of names.sort()) {
			const full = join(current, name);
			let isDir = false;
			try {
				isDir = statSync(full).isDirectory();
			} catch {
				continue;
			}
			if (isDir) walk(full);
			else if (name.endsWith('.json')) out.push(full);
		}
	};
	walk(dir);
	return out;
}

/**
 * Liest die Dateien ein und führt ihre Einträge zusammen — chronologisch sortiert.
 *
 * DEDUPE über timestamp+phase+tokensIn+tokensOut: Ein Artefakt enthält normalerweise
 * genau einen Eintrag (jeder Job startet auf einem frischen Runner mit leerem `.costs/`).
 * Wird ein Job aber RE-RUN, lädt er ein zweites Artefakt mit identischem Inhalt hoch —
 * ohne Dedupe zählte dieser Lauf doppelt und die Baseline wäre zu teuer. Zwei ECHTE Läufe
 * kollidieren nicht: ihre Timestamps unterscheiden sich.
 *
 * Kaputte Dateien werden übersprungen und gemeldet, statt den Bericht scheitern zu lassen —
 * ein unlesbares Artefakt darf nicht die Zahlen der anderen fünf Phasen verschlucken.
 */
export function mergeRecords(files: string[]): { entries: CostEntry[]; skipped: string[] } {
	const seen = new Set<string>();
	const entries: CostEntry[] = [];
	const skipped: string[] = [];

	for (const file of files) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(file, 'utf8'));
		} catch {
			skipped.push(file);
			continue;
		}
		if (!Array.isArray(parsed)) {
			skipped.push(file);
			continue;
		}
		for (const raw of parsed) {
			const entry = raw as CostEntry;
			if (typeof entry?.timestamp !== 'string') {
				skipped.push(file);
				continue;
			}
			const key = `${entry.timestamp}|${entry.phase ?? ''}|${entry.tokensIn}|${entry.tokensOut}`;
			if (seen.has(key)) continue;
			seen.add(key);
			entries.push(entry);
		}
	}

	entries.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
	return { entries, skipped };
}

export type PhaseTotal = {
	phase: string;
	runs: number;
	turns: number;
	tokensIn: number;
	tokensOut: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	cost: number;
	valueCost: number;
	models: string[];
	providers: string[];
	/** true = mindestens ein Lauf lief bei einem Nicht-Anthropic-Provider (cost dort 0). */
	foreignTariff: boolean;
};

const ZERO = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Summiert je Phase. Reihenfolge = erstes Auftreten in der Zeit, nicht alphabetisch:
 * Die Pipeline ist eine Kette, und eine nach `analyse, documenter, implement, …`
 * sortierte Tabelle würde ihren Ablauf verschleiern.
 */
export function totalsByPhase(entries: CostEntry[]): PhaseTotal[] {
	const order: string[] = [];
	const byPhase = new Map<string, PhaseTotal>();

	for (const entry of entries) {
		const phase = entry.phase ?? '(ohne Phase)';
		let total = byPhase.get(phase);
		if (!total) {
			total = {
				phase,
				runs: 0,
				turns: 0,
				tokensIn: 0,
				tokensOut: 0,
				cacheCreationTokens: 0,
				cacheReadTokens: 0,
				cost: 0,
				valueCost: 0,
				models: [],
				providers: [],
				foreignTariff: false,
			};
			byPhase.set(phase, total);
			order.push(phase);
		}
		total.runs += 1;
		total.turns += ZERO(entry.turns);
		total.tokensIn += ZERO(entry.tokensIn);
		total.tokensOut += ZERO(entry.tokensOut);
		total.cacheCreationTokens += ZERO(entry.cacheCreationTokens);
		total.cacheReadTokens += ZERO(entry.cacheReadTokens);
		total.cost += ZERO(entry.cost);
		total.valueCost += ZERO(entry.valueCost);
		if (entry.model && !total.models.includes(entry.model)) total.models.push(entry.model);
		if (entry.provider && !total.providers.includes(entry.provider)) total.providers.push(entry.provider);
		// `cost` ist bei zai/openrouter per Konstruktion 0 (Fremdtarif, s. .costs/SCHEMA.md).
		// Das muss im Bericht stehen — sonst liest sich „$0.00" wie „war kostenlos".
		if (entry.provider && entry.provider !== 'claude') total.foreignTariff = true;
	}

	return order.map((phase) => byPhase.get(phase) as PhaseTotal);
}

const num = (n: number): string => n.toLocaleString('de-DE');
const usd = (n: number): string => `$${n.toFixed(4)}`;

/** Markdown-Bericht für die Job-Summary bzw. für `docs/`. */
export function renderReport(issueId: string, entries: CostEntry[], skipped: string[] = []): string {
	const lines: string[] = [];
	lines.push(`## 💰 Kosten-Baseline — Ticket #${issueId}`);
	lines.push('');

	if (entries.length === 0) {
		lines.push('Keine Kosten-Datensätze gefunden.');
		lines.push('');
		lines.push(
			'Mögliche Gründe: das Ticket lief vor der Einführung der Erfassung, die Artefakte sind ' +
				'älter als 90 Tage (Aufbewahrungsfrist), oder die Ticket-Nummer stimmt nicht.',
		);
		return `${lines.join('\n')}\n`;
	}

	const totals = totalsByPhase(entries);
	const sum = totals.reduce(
		(acc, t) => ({
			runs: acc.runs + t.runs,
			turns: acc.turns + t.turns,
			tokensIn: acc.tokensIn + t.tokensIn,
			tokensOut: acc.tokensOut + t.tokensOut,
			cacheCreationTokens: acc.cacheCreationTokens + t.cacheCreationTokens,
			cacheReadTokens: acc.cacheReadTokens + t.cacheReadTokens,
			cost: acc.cost + t.cost,
			valueCost: acc.valueCost + t.valueCost,
		}),
		{
			runs: 0,
			turns: 0,
			tokensIn: 0,
			tokensOut: 0,
			cacheCreationTokens: 0,
			cacheReadTokens: 0,
			cost: 0,
			valueCost: 0,
		},
	);
	const anyForeign = totals.some((t) => t.foreignTariff);
	// Reine Altdaten (vor Issue #984) haben weder turns noch valueCost. Für sie wären
	// „0" und „$0.0000" Falschaussagen („brauchte keine Prompts" / „war wertlos") —
	// dieselbe Falle, vor der der Fremdtarif-Hinweis die Kostenspalte bewahrt.
	const legacyOnly =
		sum.tokensIn > 0 && !entries.some((e) => typeof e.valueCost === 'number' || typeof e.turns === 'number');
	const turnsCell = legacyOnly ? '—' : undefined;
	const valueCell = legacyOnly ? '—' : undefined;

	lines.push(
		'| Phase | Läufe | Turns | Modell | Token in (inkl. Cache) | davon Cache-Write | davon Cache-Read | Token out | Wert (USD) | Kosten (USD) |',
	);
	lines.push('| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |');
	for (const t of totals) {
		const model = t.models.length > 0 ? t.models.map((m) => `\`${m}\``).join(', ') : '—';
		const cost = t.foreignTariff ? '_Fremdtarif_' : usd(t.cost);
		lines.push(
			`| ${t.phase} | ${t.runs} | ${turnsCell ?? num(t.turns)} | ${model} | ${num(t.tokensIn)} | ${num(t.cacheCreationTokens)} | ` +
				`${num(t.cacheReadTokens)} | ${num(t.tokensOut)} | ${valueCell ?? usd(t.valueCost)} | ${cost} |`,
		);
	}
	lines.push(
		`| **Summe** | **${sum.runs}** | **${turnsCell ?? num(sum.turns)}** | | **${num(sum.tokensIn)}** | **${num(sum.cacheCreationTokens)}** | ` +
			`**${num(sum.cacheReadTokens)}** | **${num(sum.tokensOut)}** | **${valueCell ?? usd(sum.valueCost)}** | ` +
			`${anyForeign ? '**unvollständig**' : `**${usd(sum.cost)}**`} |`,
	);
	lines.push('');

	const providers = [...new Set(entries.map((e) => e.provider).filter(Boolean))];
	lines.push(
		`Zeitraum: ${entries[0].timestamp} bis ${entries[entries.length - 1].timestamp} · ` +
			`Provider: ${providers.length > 0 ? providers.map((p) => `\`${p}\``).join(', ') : 'unbekannt'}`,
	);

	if (anyForeign) {
		lines.push('');
		lines.push(
			'> ⚠️ **Die Kostenspalte ist unvollständig.** Mindestens ein Lauf lief über einen ' +
				'Nicht-Anthropic-Provider (`zai`/`openrouter`). Dort gelten Fremdtarife, und `cost` ist ' +
				'per Konstruktion `0` — ein mit Anthropic-Listenpreisen gerechneter Wert wäre schlicht ' +
				'falsch (siehe `.costs/SCHEMA.md`). Für den provider-unabhängigen Vergleich dient die ' +
				'Spalte **Wert (USD)**: Verbrauchsbewertung zu Modellklassen-Preisen (Issue #984).',
		);
	}

	if (legacyOnly) {
		lines.push('');
		lines.push(
			'> ℹ️ Weder Turns noch Wert erfasst — die Datensätze stammen von Läufen vor der ' +
				'Erfassung dieser Felder (Issue #984). Beide Spalten zeigen für sie „—".',
		);
	}

	if (skipped.length > 0) {
		lines.push('');
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen — die Summen sind untererfasst:`);
		for (const file of skipped) lines.push(`> - \`${file}\``);
	}

	return `${lines.join('\n')}\n`;
}

/** CLI: --issue <n> --dir <verzeichnis>. Schreibt den Bericht nach stdout. */
const main = (argv: string[]): number => {
	let issue = '';
	let dir = '';
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--issue') issue = argv[i + 1] ?? '';
		if (argv[i] === '--dir') dir = argv[i + 1] ?? '';
	}
	if (!issue || !dir) {
		process.stderr.write('cost-aggregate: --issue <n> --dir <verzeichnis> erforderlich\n');
		return 2;
	}
	const { entries, skipped } = mergeRecords(findRecordFiles(dir));
	process.stdout.write(renderReport(issue, entries, skipped));
	return 0;
};

// Nur ausführen, wenn direkt aufgerufen — als Import (Tests) bleibt das Modul nebenwirkungsfrei.
// Gleiche Form wie in cost-from-transcript.ts.
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
