// Token-/Kostenerfassung aus dem Claude-Code-Sitzungstranskript (Schritt 0 der
// Harness-Optimierung: Kosten-Baseline VOR dem Umbau, sonst ist der Vorher-Wert verloren).
//
// WARUM AUS DEM TRANSKRIPT und nicht aus dem claude-Aufruf: Der Aufruf in den Phasen-
// Workflows (`claude -p … | tee /tmp/claude-output.log`) liefert reinen Text. Token-Zahlen
// gäbe es nur über `--output-format json` — das würde aber die Live-Ausgabe im Actions-Log,
// den VERDICT-Grep und `needs-human-explain.sh logtail` brechen. Genau das darf die
// Baseline-Messung nicht: Wer den Aufruf ändert, misst nicht mehr die alte Pipeline.
// Claude Code schreibt ohnehin ein vollständiges JSONL-Transkript nach
// ~/.claude/projects/<slug>/<sessionId>.jsonl — dort steht die Nutzung exakt.
//
// FALLSTRICK (der eigentliche Grund für dieses Modul): Eine Assistant-Antwort erscheint
// als MEHRERE JSONL-Zeilen (eine je Content-Block), die ALLE dasselbe `message.usage`
// tragen. Naives Aufsummieren zählt dieselben Token mehrfach — im Referenztranskript
// 80 Zeilen bei nur 23 echten Antworten, also ~3,5-fach überhöht. Deduplizierung über
// `message.id` (fallback `requestId`) ist deshalb Pflicht, nicht Kür.
//
// Stil-Spiegel von cost-record.ts: Node-Eintritt, keine externen Deps, ESM.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { appendCostRecord, type CostInput } from './cost-record.ts';

/** Standard-Ablage der Claude-Code-Transkripte. */
export const TRANSCRIPT_ROOT = join(homedir(), '.claude', 'projects');

/**
 * Anthropic-Listenpreise in USD je 1 Mio. Token (Stand 2026-08).
 *
 * Schlüssel sind PRÄFIXE: die Pipeline löst `haiku` auf `claude-haiku-4-5-20251001` auf
 * (setup-claude/action.yml), das Transkript meldet je nach Modell mit oder ohne
 * Datums-Suffix. Längster passender Präfix gewinnt.
 *
 * Bewusst OHNE das Sonnet-5-Einführungspreisfenster ($2/$10 bis 2026-08-31): Baseline und
 * Nachher-Messung müssen mit derselben Tabelle gerechnet werden, sonst vergleicht der
 * A/B-Test Preisänderungen statt Pipeline-Änderungen. Wer absolute Rechnungsbeträge
 * braucht, nimmt die Abrechnung — hier zählt die Relation.
 */
export const PRICES_USD_PER_MTOK: ReadonlyArray<readonly [string, number, number]> = [
	// [Modell-Präfix, Input, Output]
	['claude-fable-5', 10.0, 50.0],
	['claude-mythos-5', 10.0, 50.0],
	['claude-opus-5', 5.0, 25.0],
	['claude-opus-4', 5.0, 25.0],
	['claude-sonnet-5', 3.0, 15.0],
	['claude-sonnet-4', 3.0, 15.0],
	['claude-haiku-4', 1.0, 5.0],
];

/** Cache-Write kostet ~1,25x, Cache-Read ~0,1x des Input-Preises. */
export const CACHE_WRITE_FACTOR = 1.25;
export const CACHE_READ_FACTOR = 0.1;

export type Usage = {
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	sidechainTokens: number;
	/** Modell mit dem größten Output-Anteil — das die Kosten dominierende. */
	model: string;
};

type RawLine = {
	type?: string;
	timestamp?: string;
	cwd?: string;
	isSidechain?: boolean;
	requestId?: string;
	uuid?: string;
	message?: {
		id?: string;
		model?: string;
		usage?: Record<string, unknown>;
	};
};

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Preiszeile mit dem längsten passenden Präfix, oder undefined bei unbekanntem Modell. */
export function lookupPrice(model: string): readonly [string, number, number] | undefined {
	return PRICES_USD_PER_MTOK.filter(([prefix]) => model.startsWith(prefix)).sort(
		(a, b) => b[0].length - a[0].length,
	)[0];
}

/**
 * Kosten eines Verbrauchs in USD. Unbekannte Modelle (GLM über zai/openrouter) liefern
 * `undefined` — dort gelten fremde Tarife, ein mit Anthropic-Preisen gerechneter Wert
 * wäre schlicht falsch. Der Aufrufer schreibt dann cost=0 und protokolliert das Modell.
 */
export function computeCost(usage: Usage): number | undefined {
	const price = lookupPrice(usage.model);
	if (!price) return undefined;
	const [, inRate, outRate] = price;
	const perToken = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
	return (
		perToken(usage.inputTokens, inRate) +
		perToken(usage.cacheCreationTokens, inRate * CACHE_WRITE_FACTOR) +
		perToken(usage.cacheReadTokens, inRate * CACHE_READ_FACTOR) +
		perToken(usage.outputTokens, outRate)
	);
}

/**
 * Summiert die Nutzung aus JSONL-Transkriptzeilen.
 *
 * - dedupliziert über `message.id` (fallback `requestId`, dann `uuid`) — s. Kopf-Kommentar;
 * - `since` grenzt auf DIESEN Lauf ein (ISO-8601, exklusiv früher): ein Runner kann mehrere
 *   Sitzungen im selben Projektordner haben, und ohne Untergrenze zählte ein Folgelauf die
 *   Token des Vorlaufs erneut mit;
 * - Subagent-Zeilen (`isSidechain`) zählen VOLL mit — das ist echter Verbrauch — werden
 *   zusätzlich separat ausgewiesen, damit der Subagent-Anteil sichtbar bleibt.
 */
export function sumUsage(lines: readonly string[], since?: string): Usage {
	const seen = new Set<string>();
	const outputByModel = new Map<string, number>();
	const usage: Usage = {
		inputTokens: 0,
		outputTokens: 0,
		cacheCreationTokens: 0,
		cacheReadTokens: 0,
		sidechainTokens: 0,
		model: '',
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let parsed: RawLine;
		try {
			parsed = JSON.parse(trimmed) as RawLine;
		} catch {
			continue; // abgeschnittene letzte Zeile bei laufendem Schreiben — überspringen
		}
		const raw = parsed.message?.usage;
		if (!raw) continue;
		if (since && typeof parsed.timestamp === 'string' && parsed.timestamp < since) continue;

		const key = parsed.message?.id ?? parsed.requestId ?? parsed.uuid;
		if (!key || seen.has(key)) continue;
		seen.add(key);

		const input = num(raw.input_tokens);
		const output = num(raw.output_tokens);
		const cacheCreation = num(raw.cache_creation_input_tokens);
		const cacheRead = num(raw.cache_read_input_tokens);

		usage.inputTokens += input;
		usage.outputTokens += output;
		usage.cacheCreationTokens += cacheCreation;
		usage.cacheReadTokens += cacheRead;
		if (parsed.isSidechain === true) {
			usage.sidechainTokens += input + output + cacheCreation + cacheRead;
		}

		const model = parsed.message?.model;
		if (model) outputByModel.set(model, (outputByModel.get(model) ?? 0) + output);
	}

	usage.model = [...outputByModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
	return usage;
}

/** Alle Transkriptdateien unter `root` (rekursiv, nur *.jsonl). */
export function findTranscripts(root: string = TRANSCRIPT_ROOT): string[] {
	const found: string[] = [];
	const walk = (dir: string): void => {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return; // kein Transkriptordner (z. B. Provider ohne Claude-Code-Lauf) — nicht fatal
		}
		for (const name of entries) {
			const full = join(dir, name);
			let isDir = false;
			try {
				isDir = statSync(full).isDirectory();
			} catch {
				continue;
			}
			if (isDir) walk(full);
			else if (name.endsWith('.jsonl')) found.push(full);
		}
	};
	walk(root);
	return found;
}

export type CollectOptions = {
	root?: string;
	since?: string;
	/** Nur Transkripte dieses Arbeitsverzeichnisses (schützt vor fremden Sitzungen). */
	cwd?: string;
};

/** Liest alle passenden Transkripte und summiert sie zu EINEM Verbrauch des Laufes. */
export function collectUsage(opts: CollectOptions = {}): Usage {
	const lines: string[] = [];
	for (const file of findTranscripts(opts.root)) {
		let content: string;
		try {
			content = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			if (opts.cwd && !line.includes(JSON.stringify(opts.cwd))) continue;
			lines.push(line);
		}
	}
	return sumUsage(lines, opts.since);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — von der record-cost-Action nach dem claude-Step aufgerufen.
//   tsx .github/scripts/cost-from-transcript.ts --issue 42 --phase implement \
//       --since 2026-08-19T10:00:00Z --provider claude
// ─────────────────────────────────────────────────────────────────────────────

const flag = (argv: readonly string[], name: string): string | undefined => {
	const idx = argv.indexOf(`--${name}`);
	return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
};

export function main(argv: readonly string[] = process.argv.slice(2)): number {
	const issue = flag(argv, 'issue');
	if (!issue) {
		process.stderr.write('cost-from-transcript: --issue fehlt\n');
		return 2;
	}
	const usage = collectUsage({
		root: flag(argv, 'root'),
		since: flag(argv, 'since'),
		cwd: flag(argv, 'cwd'),
	});

	const tokensIn = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
	if (tokensIn === 0 && usage.outputTokens === 0) {
		// Kein Fehler: bei Nicht-Claude-Providern oder einem übersprungenen Lauf gibt es
		// schlicht kein Transkript. Ein harter Exit würde eine grüne Phase rot färben.
		process.stderr.write('cost-from-transcript: kein Verbrauch gefunden — kein Datensatz geschrieben\n');
		return 0;
	}

	const computed = computeCost(usage);
	if (computed === undefined) {
		process.stderr.write(
			`cost-from-transcript: unbekanntes Modell '${usage.model}' — cost=0 (Fremdtarif, s. PRICES_USD_PER_MTOK)\n`,
		);
	}

	const input: CostInput = {
		timestamp: new Date().toISOString(),
		tokensIn,
		tokensOut: usage.outputTokens,
		cost: computed ?? 0,
		cacheCreationTokens: usage.cacheCreationTokens,
		cacheReadTokens: usage.cacheReadTokens,
	};
	const phase = flag(argv, 'phase');
	const provider = flag(argv, 'provider');
	if (phase) input.phase = phase;
	if (provider) input.provider = provider;
	if (usage.model) input.model = usage.model;
	if (usage.sidechainTokens > 0) input.sidechainTokens = usage.sidechainTokens;

	appendCostRecord(issue, input, { rootDir: flag(argv, 'root-dir') });
	process.stdout.write(
		`tokensIn=${tokensIn}\ntokensOut=${usage.outputTokens}\ncost=${(computed ?? 0).toFixed(4)}\nmodel=${usage.model}\n`,
	);
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
