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
 * z.ai-Listenpreise in EUR je 1 Mio. Token (in/out), Stand 2026-08.
 *
 * Bewusst in EUR notiert — so bleiben die Zeilen direkt gegen die z.ai-Preisliste prüfbar,
 * statt als schon umgerechnete Zahlen ohne Herkunft dazustehen. Umgerechnet wird an genau
 * EINER Stelle (`EUR_TO_USD`), weil `cost`, `valueCost` und der gesamte Report in USD
 * rechnen: In einer Report-Summe stehen claude-, zai- und openrouter-Läufe nebeneinander,
 * eine gemischte Währungssumme wäre still falsch.
 */
export const PRICES_EUR_PER_MTOK_ZAI: ReadonlyArray<readonly [string, number, number]> = [
	// [Modell-Präfix, Input, Output]
	['glm-5.3', 3.0, 10.0],
	['glm-5-turbo', 1.2, 4.0],
	['glm-4.7', 0.6, 1.2],
];

/**
 * Umrechnungskurs EUR→USD (Stand 2026-08).
 *
 * BEWUSST FEST, nicht tagesaktuell: Baseline und Nachher-Messung müssen mit demselben Kurs
 * gerechnet werden, sonst vergleicht der A/B-Test Wechselkurse statt Pipeline-Änderungen —
 * dieselbe Begründung wie beim ausgelassenen Sonnet-Einführungspreis unten. Wer den Kurs
 * ändert, rechnet die Altdaten mit `cost-backfill-zai.ts` neu, sonst mischt der Trend zwei
 * Kurse. Wer absolute Rechnungsbeträge braucht, nimmt die Abrechnung — hier zählt die Relation.
 */
export const EUR_TO_USD = 1.08;

/** EUR-Preiszeile → USD-Preiszeile (einzige Umrechnungsstelle). */
const eurRowToUsd = ([prefix, inEur, outEur]: readonly [string, number, number]) =>
	[prefix, inEur * EUR_TO_USD, outEur * EUR_TO_USD] as const;

/**
 * Listenpreise in USD je 1 Mio. Token (Stand 2026-08) — Anthropic nativ, z.ai umgerechnet.
 *
 * Schlüssel sind PRÄFIXE: die Pipeline löst `haiku` auf `claude-haiku-4-5-20251001` auf
 * (setup-claude/action.yml), das Transkript meldet je nach Modell mit oder ohne
 * Datums-Suffix; z.ai meldet `glm-5.3[1m]` für den Präfix `glm-5.3`. Längster passender
 * Präfix gewinnt.
 *
 * Bewusst OHNE das Sonnet-5-Einführungspreisfenster ($2/$10 bis 2026-08-31): Baseline und
 * Nachher-Messung müssen mit derselben Tabelle gerechnet werden, sonst vergleicht der
 * A/B-Test Preisänderungen statt Pipeline-Änderungen. Wer absolute Rechnungsbeträge
 * braucht, nimmt die Abrechnung — hier zählt die Relation.
 *
 * Nicht gelistet bleiben openrouter-Modelle: dort gilt weiter der Fremdtarif-Weg (cost=0),
 * bewertet wird ihr Verbrauch über `MODEL_CLASSES`/`valueCost`.
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
	...PRICES_EUR_PER_MTOK_ZAI.map(eurRowToUsd),
];

/** Cache-Write kostet ~1,25x, Cache-Read ~0,1x des Input-Preises. */
export const CACHE_WRITE_FACTOR = 1.25;
export const CACHE_READ_FACTOR = 0.1;

/**
 * Modellklassen mit BEWERTUNGSPREISEN in USD je 1 Mio. Token (in/out) — Issue #984.
 *
 * WARUM BEWERTUNGSPREISE STATT PROVIDERPREISE: `cost` bleibt die echte Abrechnungsbasis
 * (nur Modelle mit Listenpreis — Anthropic und z.ai —, sonst 0 „Fremdtarif"). Für den
 * Effizienzvergleich braucht es aber EINEN Maßstab über alle Provider — sonst wären über
 * `:free`-Modelle geroutete Tickets in USD „unendlich effizient" bei vollem Tokenverbrauch.
 * Die Klassenpreise greifen, wo kein echter Listenpreis vorliegt (openrouter); sie
 * orientieren sich an den Anthropic-Referenzstufen. Bewertet wird der VERBRAUCH, nicht
 * die Rechnung. Basis: Anthropic-Listenpreise (opus/sonnet/haiku-Stufe).
 */
export type ModelClass = 'flagship' | 'mid' | 'small';

export const CLASS_PRICES_USD_PER_MTOK: Readonly<Record<ModelClass, readonly [number, number]>> = {
	flagship: [5.0, 25.0],
	mid: [3.0, 15.0],
	small: [1.0, 5.0],
};

/** Fallback-Klasse für unbekannte Modelle — der Aufrufer warnt (gleiche Stelle wie cost). */
export const DEFAULT_MODEL_CLASS: ModelClass = 'mid';

/**
 * Modell-Präfixe → Klasse. Schlüssel sind PRÄFIXE (längster passender gewinnt, wie
 * PRICES_USD_PER_MTOK). Beobachtete Schreibweisen (Kosten-Artefakte 19.–24.08.2026):
 * `glm-5.3`, `glm-5-turbo`, `glm-4.7` (zai), `claude-*`,
 * `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3-nano-30b-a3b:free`,
 * `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6`, `deepseek/deepseek-v3.2`,
 * `poolside/laguna-s-2.1:free` (openrouter). Vendor- und Bare-Formen, weil das
 * Transkript je nach Provider beides meldet.
 */
export const MODEL_CLASSES: ReadonlyArray<readonly [string, ModelClass]> = [
	// flagship
	['claude-opus', 'flagship'],
	['glm-5.3', 'flagship'],
	['nvidia/nemotron-3-ultra', 'flagship'],
	['nemotron-3-ultra', 'flagship'],
	['moonshotai/kimi-k2.6', 'flagship'],
	['kimi-k2.6', 'flagship'],
	// mid
	['claude-sonnet', 'mid'],
	['glm-5-turbo', 'mid'],
	['deepseek/deepseek-v3.2', 'mid'],
	['deepseek-v3.2', 'mid'],
	['moonshotai/kimi-k2.5', 'mid'],
	['kimi-k2.5', 'mid'],
	['poolside/laguna-s', 'mid'],
	['laguna-s', 'mid'],
	// small
	['claude-haiku', 'small'],
	['glm-4.7', 'small'],
	['nvidia/nemotron-3-nano', 'small'],
	['nemotron-3-nano', 'small'],
];

export type Usage = {
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	sidechainTokens: number;
	/** Deduplizierte Assistant-Antworten (= API-Calls) des Laufes, inkl. Subagenten. */
	turns: number;
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

/** z.ai-Listenpreis in USD (längster passender Präfix), oder undefined bei fremdem Modell. */
export function lookupZaiPrice(model: string): readonly [string, number, number] | undefined {
	const row = PRICES_EUR_PER_MTOK_ZAI.filter(([prefix]) => model.startsWith(prefix)).sort(
		(a, b) => b[0].length - a[0].length,
	)[0];
	return row && eurRowToUsd(row);
}

/** Modellklasse mit dem längsten passenden Präfix, oder undefined bei unbekanntem Modell. */
export function classifyModel(model: string): ModelClass | undefined {
	return MODEL_CLASSES.filter(([prefix]) => model.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]?.[1];
}

/** Verbrauch → USD zu gegebenen Token-Preisen (Cache-Faktoren eingerechnet). */
const usageToUsd = (usage: Usage, inRate: number, outRate: number): number => {
	const perToken = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
	return (
		perToken(usage.inputTokens, inRate) +
		perToken(usage.cacheCreationTokens, inRate * CACHE_WRITE_FACTOR) +
		perToken(usage.cacheReadTokens, inRate * CACHE_READ_FACTOR) +
		perToken(usage.outputTokens, outRate)
	);
};

/**
 * Kosten eines Verbrauchs in USD — für Modelle mit eigenem Listenpreis (Anthropic, z.ai).
 * Alles andere (openrouter) liefert `undefined`: dort gelten fremde Tarife, ein mit
 * Anthropic-Preisen gerechneter Wert wäre schlicht falsch. Der Aufrufer schreibt dann
 * cost=0 und protokolliert das Modell.
 */
export function computeCost(usage: Usage): number | undefined {
	const price = lookupPrice(usage.model);
	if (!price) return undefined;
	const [, inRate, outRate] = price;
	return usageToUsd(usage, inRate, outRate);
}

/**
 * Bewertungskosten in USD (Issue #984) — im Gegensatz zu `computeCost` für JEDES Modell
 * definiert, auch `:free`: Bewertet wird der Verbrauch, nicht die Rechnung.
 *
 * Reihenfolge: Ein bekannter z.ai-Listenpreis schlägt den Klassenpreis, weil er den
 * Verbrauch genauer bewertet als die Anthropic-Referenzstufe — `glm-5.3` galt als
 * flagship ($5/$25), kostet real aber 3/10 EUR, was den GLM-Verbrauch beim Output um
 * mehr als das Doppelte überbewertete. Alles ohne echten Preis (openrouter, `:free`)
 * bleibt beim Klassenmaßstab; unbekannte Modelle zählen als `DEFAULT_MODEL_CLASS` und
 * der Aufrufer warnt.
 *
 * Für Anthropic-Modelle ändert das nichts: deren Listenpreise sind identisch mit den
 * Klassenpreisen, aus denen die Stufen abgeleitet wurden.
 */
export function computeValueCost(usage: Usage): number {
	const zai = lookupZaiPrice(usage.model);
	if (zai) return usageToUsd(usage, zai[1], zai[2]);
	const cls = classifyModel(usage.model) ?? DEFAULT_MODEL_CLASS;
	const [inRate, outRate] = CLASS_PRICES_USD_PER_MTOK[cls];
	return usageToUsd(usage, inRate, outRate);
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
		turns: 0,
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
		// Jede deduplizierte Antwortzeile ist genau ein API-Call — dasselbe Dedupe, das
		// die Token vor Mehrfachzählung schützt (s. Kopf-Kommentar), liefert die Turnzahl.
		usage.turns += 1;

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
	if (usage.model && classifyModel(usage.model) === undefined) {
		process.stderr.write(
			`cost-from-transcript: unbekanntes Modell '${usage.model}' — valueCost zur Default-Klasse '${DEFAULT_MODEL_CLASS}' bewertet (s. MODEL_CLASSES)\n`,
		);
	}
	const valueCost = computeValueCost(usage);

	const input: CostInput = {
		timestamp: new Date().toISOString(),
		tokensIn,
		tokensOut: usage.outputTokens,
		cost: computed ?? 0,
		valueCost,
		cacheCreationTokens: usage.cacheCreationTokens,
		cacheReadTokens: usage.cacheReadTokens,
	};
	const phase = flag(argv, 'phase');
	const provider = flag(argv, 'provider');
	if (phase) input.phase = phase;
	if (provider) input.provider = provider;
	if (usage.model) input.model = usage.model;
	if (usage.sidechainTokens > 0) input.sidechainTokens = usage.sidechainTokens;
	if (usage.turns > 0) input.turns = usage.turns;

	appendCostRecord(issue, input, { rootDir: flag(argv, 'root-dir') });
	// Kostenaufschluesselung nach Block: Input-/Cache-Write-/Cache-Read-/Output-Anteil in USD.
	// Grund: die Summe "Token in (inkl. Cache)" verdeckt, WO das Geld fliesst — Output
	// dominiert (>75%), Cache-Reads sind bei 10% fast gratis. Ohne Aufschluesselung
	// optimiert man den falschen Block (Beobachtung aus den Laeufen #1031-#1033).
	const price = lookupPrice(usage.model);
	const blockUsd = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
	const inRate = price?.[1] ?? 0;
	const outRate = price?.[2] ?? 0;
	const costInputUsd = blockUsd(usage.inputTokens, inRate);
	const costCacheWriteUsd = blockUsd(usage.cacheCreationTokens, inRate * CACHE_WRITE_FACTOR);
	const costCacheReadUsd = blockUsd(usage.cacheReadTokens, inRate * CACHE_READ_FACTOR);
	const costOutputUsd = blockUsd(usage.outputTokens, outRate);
	process.stdout.write(
		`tokensIn=${tokensIn}\ntokensOut=${usage.outputTokens}\nturns=${usage.turns}\ncost=${(computed ?? 0).toFixed(4)}\nvalueCost=${valueCost.toFixed(4)}\nmodel=${usage.model}\ninputTokens=${usage.inputTokens}\ncacheCreationTokens=${usage.cacheCreationTokens}\ncacheReadTokens=${usage.cacheReadTokens}\ncostInputUsd=${costInputUsd.toFixed(4)}\ncostCacheWriteUsd=${costCacheWriteUsd.toFixed(4)}\ncostCacheReadUsd=${costCacheReadUsd.toFixed(4)}\ncostOutputUsd=${costOutputUsd.toFixed(4)}\n`,
	);
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
