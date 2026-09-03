// Token-/Kostenerfassung aus pi-Sitzungen (Issue #1184) — das Gegenstück zu
// cost-from-transcript.ts für die zweite Laufzeit.
//
// WARUM EIN EIGENES MODUL UND KEIN ZWEITER PARSER-ZWEIG: Die beiden Sitzungsformate haben
// nichts gemeinsam ausser „JSONL". Claude Code schreibt je Content-Block eine Zeile mit
// IDENTISCHEM `message.usage` (daher dort die Dedup-Pflicht über `message.id`); pi schreibt
// je Nachricht GENAU EINE Zeile mit ihrer eigenen `usage`. Ein gemeinsamer Parser müsste in
// jeder Zeile beide Formate unterscheiden — zwei kleine Parser sind lesbarer als einer mit
// zwei Modi.
//
// WAS BEWUSST GETEILT WIRD: Preistabelle, Cache-Faktoren, `computeCost`/`computeValueCost`
// und `classifyModel` kommen aus cost-from-transcript.ts, der Schreibpfad aus cost-record.ts.
// Nur so sind die `.costs`-Zahlen beider Laufzeiten vergleichbar.
//
// WARUM NICHT pis EIGENER `usage.cost`: pi rechnet selbst mit seinem Modellkatalog. Nähme man
// den Wert, verglichen Claude-Lauf und pi-Lauf zwei verschiedene Preislisten statt zweier
// Laufzeiten — dieselbe Begründung, die im Bestand schon den festen `EUR_TO_USD`-Kurs trägt.
//
// WARUM --session-dir STATT HOME-SCAN: setup-pi legt je Lauf ein eigenes Sitzungsverzeichnis
// an (RUNNER_TEMP/pi-session) und lenkt auch die Subagent-Sitzungen dorthin. Damit ist die
// Abgrenzung „nur dieser Lauf" exakt, statt über eine Zeituntergrenze geschätzt zu werden.
//
// Stil-Spiegel von cost-from-transcript.ts: Node-Eintritt, keine externen Deps, ESM.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
	CACHE_READ_FACTOR,
	CACHE_WRITE_FACTOR,
	classifyModel,
	computeCost,
	computeValueCost,
	DEFAULT_MODEL_CLASS,
	lookupPrice,
	type Usage,
} from './cost-from-transcript.ts';
import { appendCostRecord, type CostInput } from './cost-record.ts';

/** Standard-Ablage der pi-Sitzungen, wenn kein --session-dir übergeben wird. */
export const PI_SESSION_ROOT = join(homedir(), '.pi', 'agent', 'sessions');

/**
 * Unterordner, in den setup-pi die Kind-Sitzungen von pi-subagents lenkt
 * (`defaultSessionDir` der Erweiterung). Sitzungen darunter zählen als Sidechain.
 * Wird der Name dort geändert, muss er hier mitwandern — sonst fällt der Fan-out-Anteil
 * still auf 0 zurück und der Verbrauch sähe aus, als käme er komplett aus dem Elternlauf.
 */
export const SUBAGENT_DIR = 'subagents';

/**
 * Eine pi-Sitzungszeile. Relevant sind ausschliesslich Einträge vom Typ `message`, deren
 * `message.role` `assistant` ist — nur sie tragen Verbrauch. `compaction`- und
 * `branch_summary`-Einträge können laut pi-Doku ebenfalls eine `usage` tragen (die Kosten der
 * Zusammenfassung selbst); die zählen mit, weil sie echter Verbrauch des Laufes sind.
 */
type PiEntry = {
	type?: string;
	timestamp?: string;
	usage?: Record<string, unknown>;
	message?: {
		role?: string;
		model?: string;
		provider?: string;
		usage?: Record<string, unknown>;
	};
};

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** Leerer Verbrauch — Startwert der Summierung und Rückgabe für „nichts gefunden". */
const emptyUsage = (): Usage => ({
	inputTokens: 0,
	outputTokens: 0,
	cacheCreationTokens: 0,
	cacheReadTokens: 0,
	sidechainTokens: 0,
	turns: 0,
	model: '',
});

/**
 * Summiert die Nutzung aus pi-JSONL-Zeilen.
 *
 * - KEINE Deduplizierung nötig: pi schreibt je Nachricht genau eine Zeile (anders als Claude
 *   Code, wo jeder Content-Block dieselbe usage wiederholt).
 * - `turns` = Anzahl der Assistant-Nachrichten mit Verbrauch = Anzahl der API-Calls.
 * - `sidechain` markiert Verbrauch aus Subagent-Sitzungen. pi kennt kein `isSidechain`-Feld:
 *   Kind-Sitzungen sind eigene Dateien. Der Aufrufer markiert sie deshalb beim Einlesen
 *   (s. `collectUsage`), damit der Fan-out-Anteil wie bei Claude Code sichtbar bleibt.
 * - `model` = das Modell mit dem grössten Output-Anteil (gleiche Regel wie im Claude-Pendant).
 */
export function sumUsage(lines: readonly { line: string; sidechain: boolean }[]): Usage {
	const outputByModel = new Map<string, number>();
	const usage = emptyUsage();

	for (const { line, sidechain } of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let parsed: PiEntry;
		try {
			parsed = JSON.parse(trimmed) as PiEntry;
		} catch {
			continue; // abgeschnittene letzte Zeile bei laufendem Schreiben — überspringen
		}

		// Verbrauch steht an der Nachricht (assistant) oder direkt am Eintrag
		// (compaction/branch_summary tragen die usage ihrer Zusammenfassung dort).
		const raw = parsed.message?.role === 'assistant' ? parsed.message?.usage : parsed.usage;
		if (!raw) continue;

		const input = num(raw.input);
		const output = num(raw.output);
		const cacheRead = num(raw.cacheRead);
		const cacheWrite = num(raw.cacheWrite);
		if (input === 0 && output === 0 && cacheRead === 0 && cacheWrite === 0) continue;

		usage.inputTokens += input;
		usage.outputTokens += output;
		usage.cacheReadTokens += cacheRead;
		usage.cacheCreationTokens += cacheWrite;
		usage.turns += 1;
		if (sidechain) usage.sidechainTokens += input + output + cacheRead + cacheWrite;

		const model = parsed.message?.model;
		if (model) outputByModel.set(model, (outputByModel.get(model) ?? 0) + output);
	}

	usage.model = [...outputByModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
	return usage;
}

/** Alle Sitzungsdateien unter `root` (rekursiv, nur *.jsonl), mit ihrem Pfad. */
export function findSessions(root: string = PI_SESSION_ROOT): string[] {
	const found: string[] = [];
	const walk = (dir: string): void => {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return; // kein Sitzungsordner (z. B. Lauf ohne pi) — nicht fatal
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
	return found.sort();
}

export type CollectOptions = { sessionDir?: string };

/**
 * Liest alle Sitzungen des Laufes und summiert sie zu EINEM Verbrauch.
 *
 * Subagent-Sitzungen liegen unterhalb von `<session-dir>/subagents` (setup-pi setzt
 * `defaultSessionDir` von pi-subagents genau dorthin). Ihr Verbrauch zählt VOLL mit — es ist
 * echter Verbrauch — wird aber zusätzlich als `sidechainTokens` ausgewiesen, damit der
 * Fan-out-Anteil sichtbar bleibt, genau wie im Claude-Pendant.
 */
export function collectUsage(opts: CollectOptions = {}): Usage {
	const root = opts.sessionDir ?? PI_SESSION_ROOT;
	const lines: { line: string; sidechain: boolean }[] = [];
	for (const file of findSessions(root)) {
		const sidechain = file.slice(root.length).split(/[\\/]/).includes(SUBAGENT_DIR);
		let content: string;
		try {
			content = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			lines.push({ line, sidechain });
		}
	}
	return sumUsage(lines);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — von der record-cost-Action nach dem pi-Step aufgerufen.
//   node .github/scripts/cost-from-pi-session.ts --issue 42 --phase analyse \
//        --provider claude --session-dir /tmp/pi-session
//
// Die Ausgabe ist ZEICHENGLEICH zu cost-from-transcript.ts (dieselben key=value-Zeilen):
// die record-cost-Action wertet beide Skripte mit demselben sed-Block aus.
// ─────────────────────────────────────────────────────────────────────────────

const flag = (argv: readonly string[], name: string): string | undefined => {
	const idx = argv.indexOf(`--${name}`);
	return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
};

export function main(argv: readonly string[] = process.argv.slice(2)): number {
	const issue = flag(argv, 'issue');
	if (!issue) {
		process.stderr.write('cost-from-pi-session: --issue fehlt\n');
		return 2;
	}
	const usage = collectUsage({ sessionDir: flag(argv, 'session-dir') });

	const tokensIn = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
	if (tokensIn === 0 && usage.outputTokens === 0) {
		// Kein Fehler: bei einem übersprungenen oder sofort abgebrochenen Lauf gibt es schlicht
		// keine Sitzung. Ein harter Exit würde eine grüne Phase rot färben.
		process.stderr.write('cost-from-pi-session: kein Verbrauch gefunden — kein Datensatz geschrieben\n');
		return 0;
	}

	const computed = computeCost(usage);
	if (computed === undefined) {
		process.stderr.write(
			`cost-from-pi-session: unbekanntes Modell '${usage.model}' — cost=0 (Fremdtarif, s. PRICES_USD_PER_MTOK)\n`,
		);
	}
	if (usage.model && classifyModel(usage.model) === undefined) {
		process.stderr.write(
			`cost-from-pi-session: unbekanntes Modell '${usage.model}' — valueCost zur Default-Klasse '${DEFAULT_MODEL_CLASS}' bewertet (s. MODEL_CLASSES)\n`,
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

	// Kostenaufschluesselung nach Block, identisch zum Claude-Pendant: Die Summe
	// "Token in (inkl. Cache)" verdeckt, WO das Geld fliesst.
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
