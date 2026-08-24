// Issue #515 — Pro-Ticket Token-/Kostenerfassung.
// Reine Funktionen, um je Issue einen Datensatz unter der Issue-ID in `.costs/<id>.json`
// fortlaufend zu ergänzen (Append, kein Überschreiben) und später chronologisch auszulesen.
// Datenquelle = Output eines GitHub-Workflow-Runs; Zahlen als int/float. Damit lassen sich
// Token-Verbrauch und Kosten pro Ticket chronologisch auswerten, ohne Secrets ins Repo zu
// schreiben (scanForSecrets hält die Pipeline beim Committen grün).
//
// Stil-Spiegel von analyze-test-suite.ts: Node-Eintritt, keine externen Deps, ESM.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ablageort der Datensätze (relativ zum rootDir). Eine Datei pro Issue-ID. */
export const COSTS_DIR = '.costs';

/**
 * Vollständiger Eintrag —Issue-ID + Verbrauch/Kosten eines Workflow-Runs.
 *
 * Die fünf Pflichtfelder sind unverändert (Bestandsschutz für vorhandene Datensätze).
 * Die optionalen Felder kamen mit der Transkript-Erfassung dazu (cost-from-transcript.ts)
 * und sind für den Vorher/Nachher-Vergleich der Pipeline nötig:
 *   - ohne `phase` lässt sich der Verbrauch nicht je Pipeline-Schritt aufschlüsseln,
 *   - ohne `model`/`provider` ist ein Kostenwert nicht zuordenbar (GLM ≠ Anthropic-Preise),
 *   - ohne die Cache-Aufteilung ist `cost` aus den Token nicht rekonstruierbar (Cache-Write
 *     und Cache-Read werden mit abweichenden Faktoren berechnet, s. cost-from-transcript.ts),
 *   - ohne `turns` fehlt die Granularität zwischen Läufen und Token (wie viele API-Calls
 *     brauchte der Lauf — die Kennzahl zur Bearbeitungseffizienz, Issue #984),
 *   - ohne `valueCost` sind Läufe über zai/openrouter in USD nicht vergleichbar (cost ist
 *     dort 0, bewertet wird der Verbrauch zu Modellklassen-Preisen, Issue #984).
 * Alt-Einträge ohne diese Felder bleiben gültig — Leser müssen sie als optional behandeln.
 */
export type CostEntry = {
	issueId: string;
	timestamp: string;
	tokensIn: number;
	tokensOut: number;
	cost: number;
	phase?: string;
	model?: string;
	provider?: string;
	cacheCreationTokens?: number;
	cacheReadTokens?: number;
	sidechainTokens?: number;
	turns?: number;
	valueCost?: number;
};

/** Eingabe eines Runs (Issue-ID wird beim Anhängen zugewiesen). */
export type CostInput = Omit<CostEntry, 'issueId'>;

export type CostOptions = { rootDir?: string };

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo-Root, falls kein rootDir übergeben wird (zwei Ebenen über .github/scripts). */
const REPO_ROOT = join(HERE, '..', '..');

const resolveDir = (opts: CostOptions | undefined): string => opts?.rootDir ?? REPO_ROOT;
const recordPath = (rootDir: string, issueId: string | number): string => join(rootDir, COSTS_DIR, `${issueId}.json`);

/**
 * Issue-ID normalisiert als Dateinamen-tauglichen String: Pfad-Trenner (`/`, `\`) werden
 * ersetzt, führende Punkte entfernt — so kann eine ID nicht aus `.costs/` ausbrechen.
 */
const normalizeIssueId = (issueId: string | number): string => {
	const safe = String(issueId)
		.replace(/[/\\]+/g, '-')
		.replace(/^\.+/, '');
	return safe.length > 0 ? safe : '_';
};

/**
 * Gibt einen Eintrag mit den dokumentierten Pflichtfeldern zurück; optionale Felder
 * werden nur übernommen, wenn sie gesetzt sind. Bewusst kein Spread von `input`:
 * so kann ein Aufrufer keine undokumentierten Schlüssel in die Datei schmuggeln,
 * und ein Datensatz ohne Zusatzangaben sieht exakt aus wie vor der Erweiterung.
 */
const toEntry = (issueId: string, input: CostInput): CostEntry => {
	const entry: CostEntry = {
		timestamp: input.timestamp,
		tokensIn: input.tokensIn,
		tokensOut: input.tokensOut,
		cost: input.cost,
		issueId,
	};
	if (input.phase !== undefined) entry.phase = input.phase;
	if (input.model !== undefined) entry.model = input.model;
	if (input.provider !== undefined) entry.provider = input.provider;
	if (input.cacheCreationTokens !== undefined) entry.cacheCreationTokens = input.cacheCreationTokens;
	if (input.cacheReadTokens !== undefined) entry.cacheReadTokens = input.cacheReadTokens;
	if (input.sidechainTokens !== undefined) entry.sidechainTokens = input.sidechainTokens;
	if (input.turns !== undefined) entry.turns = input.turns;
	if (input.valueCost !== undefined) entry.valueCost = input.valueCost;
	return entry;
};

/**
 * Hängt einen Datensatz für `<rootDir>/.costs/<issueId>.json` an — vorhandene Einträge
 * bleiben unverändert (Append, kein Überschreiben). Gibt alle Einträge des Issues zurück.
 */
export function appendCostRecord(issueId: string | number, input: CostInput, opts: CostOptions = {}): CostEntry[] {
	const rootDir = resolveDir(opts);
	const id = normalizeIssueId(issueId);
	const file = recordPath(rootDir, id);
	const entries = readCostRecords(id, { rootDir });
	entries.push(toEntry(id, input));
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
	return entries;
}

/** Liefert alle Einträge eines Issues, aufsteigend nach Timestamp sortiert (chronologisch). */
export function readCostRecords(issueId: string | number, opts: CostOptions = {}): CostEntry[] {
	const rootDir = resolveDir(opts);
	const file = recordPath(rootDir, normalizeIssueId(issueId));
	if (!existsSync(file)) return [];
	const parsed = JSON.parse(readFileSync(file, 'utf8')) as CostEntry[];
	const entries = Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
	return [...entries].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

/**
 * Schreibt die GESAMTE Eintragsliste eines Issues — Gegenstück zu readCostRecords für den
 * terminalen Siegel-Lauf (cost-seal.ts): der Documenter ersetzt die Datei durch die
 * vollständig gemergte, deduplizierte Menge statt appendschrittweise zu erweitern.
 * Tab-Einrückung wie Prettier (useTabs) — der Siegel-Commit landet auf main und darf
 * dort keinen Format-Churn mit `pnpm format` erzeugen.
 */
export function writeCostRecords(issueId: string | number, entries: CostEntry[], opts: CostOptions = {}): void {
	const rootDir = resolveDir(opts);
	const file = recordPath(rootDir, normalizeIssueId(issueId));
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(entries, null, '\t')}\n`, 'utf8');
}

/**
 * Bekannte Secret-Muster der Pipeline (Anthropic-/GitHub-Token u. a.). Liefert die Treffer,
 * damit `.costs/`-Inhalt vor dem Commit geprüft werden kann — saubere Datensätze bleiben grün.
 */
const SECRET_PATTERNS: RegExp[] = [
	/sk-ant-[A-Za-z0-9_-]{10,}/, // Anthropic API-Key
	/gh[pousr]_[A-Za-z0-9]{20,}/, // GitHub PAT / token (Klasse [pousr] deckt ghp_/gho_/ghu_/ghs_/ghr_)
	/AKIA[0-9A-Z]{16}/, // AWS access key
	/xox[baprs]-[A-Za-z0-9-]{10,}/, // Slack token
	/api[_-]?key['"\s:=]+[A-Za-z0-9_-]{16,}/i, // generischer API-Key
];

export type SecretFinding = { pattern: string; match: string };

export function scanForSecrets(content: string): SecretFinding[] {
	const findings: SecretFinding[] = [];
	for (const pattern of SECRET_PATTERNS) {
		for (const match of content.matchAll(
			new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`),
		)) {
			const value = match[0];
			if (value && !findings.some((f) => f.match === value)) {
				findings.push({ pattern: pattern.source, match: value });
			}
		}
	}
	return findings;
}
