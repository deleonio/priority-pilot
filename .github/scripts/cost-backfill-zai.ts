// Einmaliges Backfill: z.ai-Läufe in `.costs/*.json` nachträglich bepreisen.
//
// WARUM: Bis zur Aufnahme der z.ai-Listenpreise in cost-from-transcript.ts galt für GLM-
// Modelle der Fremdtarif-Weg — `cost` blieb 0 und `valueCost` bewertete den Verbrauch zur
// Anthropic-Klassenstufe. Damit standen 236 der 371 Datensätze mit 0 in der Kosten-
// Übersicht; der Trend über die Zeit war praktisch wertlos. Beides ist aus den bereits
// gespeicherten Token-Feldern deterministisch nachrechenbar, also wird es nachgerechnet.
//
// ABGRENZUNG: openrouter-Läufe bleiben unberührt (weiter Fremdtarif, cost=0) — für sie gibt
// es keine Preisliste im Repo. Anthropic-Läufe ebenfalls: deren cost war nie 0.
//
// IDEMPOTENZ: Das Skript rechnet immer aus den Token-Feldern, nie aus dem Vorwert. Ein
// zweiter Lauf schreibt dieselben Zahlen; ein geänderter EUR_TO_USD-Kurs wird sauber
// durchgezogen, statt sich mit dem alten Kurs zu vermischen.
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM.

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeCost, computeValueCost, lookupZaiPrice, type Usage } from './cost-from-transcript.ts';
import { COSTS_DIR, readCostRecords, writeCostRecords, type CostEntry } from './cost-record.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

/** Rundung wie die Erfassung: 6 Nachkommastellen, damit die Datei nicht mit Float-Rauschen wächst. */
const round6 = (n: number): number => Number(n.toFixed(6));

/**
 * Verbrauch eines Eintrags rekonstruieren.
 *
 * `tokensIn` ist laut SCHEMA.md die SUMME aus ungecachtem Input, Cache-Write und Cache-Read —
 * die drei Anteile werden mit verschiedenen Faktoren bepreist, also muss der ungecachte Rest
 * herausgerechnet werden. Fehlt die Aufschlüsselung (Alt-Einträge vor der Transkript-
 * Erfassung), ist der Eintrag nicht rekonstruierbar und wird übersprungen statt geraten.
 */
function toUsage(entry: CostEntry): Usage | undefined {
	const { cacheCreationTokens, cacheReadTokens } = entry;
	if (typeof cacheCreationTokens !== 'number' || typeof cacheReadTokens !== 'number') return undefined;
	if (typeof entry.model !== 'string') return undefined;
	const inputTokens = entry.tokensIn - cacheCreationTokens - cacheReadTokens;
	if (inputTokens < 0) return undefined;
	return {
		inputTokens,
		outputTokens: entry.tokensOut,
		cacheCreationTokens,
		cacheReadTokens,
		sidechainTokens: entry.sidechainTokens ?? 0,
		turns: entry.turns ?? 0,
		model: entry.model,
	};
}

export type BackfillStats = { files: number; touched: number; skipped: number; costSum: number };

/**
 * Rechnet `cost` und `valueCost` aller z.ai-Einträge neu. Gibt die geänderten Einträge
 * zurück, ohne zu schreiben — der Aufrufer entscheidet über die Mutation (Dry-Run).
 */
export function backfillEntries(entries: readonly CostEntry[]): {
	entries: CostEntry[];
	touched: number;
	skipped: number;
} {
	let touched = 0;
	let skipped = 0;
	const next = entries.map((entry) => {
		if (!entry.model || !lookupZaiPrice(entry.model)) return entry;
		const usage = toUsage(entry);
		if (!usage) {
			skipped += 1;
			return entry;
		}
		const cost = round6(computeCost(usage) ?? 0);
		const valueCost = round6(computeValueCost(usage));
		if (entry.cost === cost && entry.valueCost === valueCost) return entry;
		touched += 1;
		return { ...entry, cost, valueCost };
	});
	return { entries: next, touched, skipped };
}

function main(argv: readonly string[]): number {
	const write = argv.includes('--write');
	const dir = join(REPO_ROOT, COSTS_DIR);
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.json'))
		.sort();

	const stats: BackfillStats = { files: 0, touched: 0, skipped: 0, costSum: 0 };
	for (const file of files) {
		const issueId = file.replace(/\.json$/, '');
		const before = readCostRecords(issueId, { rootDir: REPO_ROOT });
		if (before.length === 0) continue;
		const { entries, touched, skipped } = backfillEntries(before);
		stats.skipped += skipped;
		if (touched === 0) continue;
		stats.files += 1;
		stats.touched += touched;
		stats.costSum += entries.reduce((sum, e) => sum + (lookupZaiPrice(e.model ?? '') ? e.cost : 0), 0);
		if (write) writeCostRecords(issueId, entries, { rootDir: REPO_ROOT });
	}

	const mode = write ? 'geschrieben' : 'DRY-RUN (nichts geschrieben, --write zum Anwenden)';
	process.stdout.write(
		`cost-backfill-zai: ${stats.touched} z.ai-Einträge in ${stats.files} Dateien — ${mode}\n` +
			`  Summe cost der bepreisten z.ai-Läufe: $${stats.costSum.toFixed(2)}\n` +
			(stats.skipped > 0 ? `  ${stats.skipped} übersprungen (Cache-Aufschlüsselung fehlt)\n` : ''),
	);
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
