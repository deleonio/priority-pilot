#!/usr/bin/env tsx
/**
 * Test-Suite-Analyse nach TDD-Strategie (Substance over Quantity).
 *
 * Findet: tautologische Tests, Redundanzen, fehlende Empty-Set-Probes,
 *         Behavior-Coverage-Lücken (Heuristik, KEIN echtes Mutation-Testing).
 *
 * WICHTIG (vormals kaputt, jetzt behoben):
 *  - Extraktion läuft über einen string-/kommentar-/regex-bewussten Scanner, der
 *    `it()` UND `test()` erkennt (früher: nur `test()` → Server/Frontend-Unit blind).
 *  - Assertion-Vokabular aus dem echten Codebase-Inventar (inkl. `.toBe`, `assert.*`),
 *    keine False-Positive-Tautologien mehr.
 *  - Redundanz-Signatur = Test-Name + Matcher (nicht „erste 300 Zeichen Body"),
 *    damit Setup-Boilerplate (z. B. 375px-Viewport) keine False Positives erzeugt.
 *  - Counts (früher via ✓/✖-Glyph-Parsing) sind weg: sie waren nie treibend und
 *    runner-abhängig kaputt. Stattdessen: Anzahl analysierter Blöcke (verlässlich).
 *
 * Nutzung: pnpm dlx tsx@4.22.4 .github/scripts/analyze-test-suite.ts \
 *   --unit-results unit-results.txt --e2e-results e2e-results.txt --repo-root . --report-dir .ai-knowledge
 *
 * Die Detektoren sind als reine, exportierte Funktionen gehalten — pure Functions ohne
 * Dateisystem-Status (leicht testbar).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

interface CliArgs {
	unitResults: string;
	e2eResults: string;
	repoRoot: string;
	reportDir: string;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	const result: Partial<CliArgs> = {};
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--unit-results':
				result.unitResults = args[++i];
				break;
			case '--e2e-results':
				result.e2eResults = args[++i];
				break;
			case '--repo-root':
				result.repoRoot = args[++i];
				break;
			case '--report-dir':
				result.reportDir = args[++i];
				break;
		}
	}
	// unit/e2e-results werden (noch) nicht ausgewertet — Counts sind entfernt. Die Args
	// bleiben aus Backwards-Kompatibilität zum Workflow-Aufruf erforderlich.
	if (!result.unitResults || !result.e2eResults || !result.repoRoot || !result.reportDir) {
		console.error('Missing required arguments');
		process.exit(1);
	}
	return result as CliArgs;
}

function findTestFiles(dir: string): string[] {
	const results: string[] = [];
	if (!existsSync(dir)) return results;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findTestFiles(full));
		} else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
			results.push(full);
		}
	}
	return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

interface TestBlock {
	file: string; // Repo-relativer Pfad
	name: string; // Test-Name (1. StringLiteral-Arg) oder 'unnamed'
	kind: 'test' | 'it';
	bodyText: string; // Quelltext des Callback-Body (für Vokabular-Scans)
	assertions: string[]; // Gefundene Matcher (z. B. 'toBe', 'toHaveBeenCalled', 'assert.match')
	hasMockAssertion: boolean;
	hasObservableOutcome: boolean;
	describeChain: string[]; // describe-Kette von außen nach innen (für Redundanz-Signatur)
}

type Category = 'tautological' | 'redundant' | 'emptySet' | 'mutation';
type Severity = 'critical' | 'warning' | 'info';

interface Finding {
	category: Category;
	file: string;
	testName: string;
	issue: string;
	fix: string;
	severity: Severity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion-Vokabular (aus echtem Codebase-Inventar, siehe Exploration)
// ─────────────────────────────────────────────────────────────────────────────

/** Matcher, die ausschließlich Mock-/Implementations-Details prüfen. */
export const MOCK_MATCHERS = new Set<string>([
	'toHaveBeenCalled',
	'toBeCalled',
	'toHaveBeenCalledWith',
	'toHaveBeenCalledTimes',
	'toHaveBeenCalledOnce',
	'toBeCalledWith',
]);

const ASSERT_METHODS =
	/\bassert\.(ok|equal|notEqual|deepEqual|notDeepEqual|strictEqual|notStrictEqual|deepStrictEqual|notDeepStrictEqual|throws|doesNotThrow|rejects|doesNotReject|match|doesNotMatch|fail|ifError|approxEqual)\b/g;

// ─────────────────────────────────────────────────────────────────────────────
// Scanner: string-/kommentar-/regex-bewusst. Liefert eine Code-Maske (true = Code,
// false = String/Kommentar/Regex), damit Block-Extraktion und Balanced-Matching
// nicht durch Strings/Kommentare getäuscht werden.
// ─────────────────────────────────────────────────────────────────────────────

const KW_BEFORE_REGEX = new Set([
	'return',
	'typeof',
	'instanceof',
	'in',
	'of',
	'do',
	'else',
	'void',
	'delete',
	'new',
	'await',
	'yield',
	'case',
	'throw',
]);

/** Ist ein `/` an dieser Stelle ein Regex-Literal (keine Division)? */
function isRegexStart(lastToken: string): boolean {
	if (lastToken === '') return true;
	if (KW_BEFORE_REGEX.has(lastToken)) return true;
	const last = lastToken[lastToken.length - 1];
	if (/[A-Za-z0-9_$]/.test(last)) return false; // Ident/Zahl → Division
	if (last === ')' || last === ']' || last === '"' || last === "'" || last === '`') return false;
	return true; // Operator/Interpunktion → Regex
}

/**
 * Berechnet mask[i] === true genau dann, wenn Position i „echter Code" ist
 * (nicht in String-/Template-/Kommentar-/Regex-Literalen). Eine fehlerhafte Maske
 * an einzelnen Stellen führt maximal zu übersprungenen Tests, nie zu Abstürzen.
 */
export function computeCodeMask(s: string): boolean[] {
	const n = s.length;
	const mask = new Array<boolean>(n).fill(true);
	type Mode = 'code' | 'sq' | 'dq' | 'tpl' | 'line' | 'block' | 'regex' | 'class';
	let mode: Mode = 'code';
	const braceStack: ('block' | 'interp')[] = []; // für Template-${}-Interpolation
	let lastToken = '';
	let i = 0;

	const ident = (start: number): string => {
		let j = start;
		while (j < n && /[A-Za-z0-9_$]/.test(s[j])) j++;
		return s.slice(start, j);
	};

	while (i < n) {
		const c = s[i];
		const c2 = i + 1 < n ? s[i + 1] : '';

		switch (mode) {
			case 'code': {
				if (c === '/' && c2 === '/') {
					mask[i] = mask[i + 1] = false;
					i += 2;
					mode = 'line';
					continue;
				}
				if (c === '/' && c2 === '*') {
					mask[i] = mask[i + 1] = false;
					i += 2;
					mode = 'block';
					continue;
				}
				if (c === '/' && isRegexStart(lastToken)) {
					mask[i] = false;
					i++;
					mode = 'regex';
					continue;
				}
				if (c === "'" || c === '"') {
					mask[i] = false;
					i++;
					mode = c === "'" ? 'sq' : 'dq';
					continue;
				}
				if (c === '`') {
					mask[i] = false;
					i++;
					mode = 'tpl';
					continue;
				}
				if (c === '{') {
					braceStack.push('block');
					mask[i] = true;
					lastToken = c;
					i++;
					continue;
				}
				if (c === '}') {
					const top = braceStack.pop();
					mask[i] = true;
					lastToken = c;
					if (top === 'interp') {
						mode = 'tpl';
					}
					i++;
					continue;
				}
				if (/[A-Za-z_$]/.test(c)) {
					const id = ident(i);
					lastToken = id;
					for (let k = 0; k < id.length; k++) mask[i + k] = true;
					i += id.length;
					continue;
				}
				if (!/\s/.test(c)) lastToken = c;
				mask[i] = true;
				i++;
				continue;
			}
			case 'sq':
			case 'dq': {
				mask[i] = false;
				if (c === '\\') {
					if (i + 1 < n) mask[i + 1] = false;
					i += 2;
					continue;
				}
				if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"')) {
					lastToken = c;
					mode = 'code';
					i++;
					continue;
				}
				i++;
				continue;
			}
			case 'tpl': {
				mask[i] = false;
				if (c === '\\') {
					if (i + 1 < n) mask[i + 1] = false;
					i += 2;
					continue;
				}
				if (c === '`') {
					lastToken = c;
					mode = 'code';
					i++;
					continue;
				}
				if (c === '$' && c2 === '{') {
					mask[i] = mask[i + 1] = false;
					braceStack.push('interp');
					lastToken = '{';
					mode = 'code';
					i += 2;
					continue;
				}
				i++;
				continue;
			}
			case 'line': {
				mask[i] = false;
				if (c === '\n') mode = 'code';
				i++;
				continue;
			}
			case 'block': {
				mask[i] = false;
				if (c === '*' && c2 === '/') {
					mask[i + 1] = false;
					mode = 'code';
					i += 2;
					continue;
				}
				i++;
				continue;
			}
			case 'regex': {
				mask[i] = false;
				if (c === '\\') {
					if (i + 1 < n) mask[i + 1] = false;
					i += 2;
					continue;
				}
				if (c === '[') {
					mode = 'class';
					i++;
					continue;
				}
				if (c === '/' || c === '\n') {
					if (c === '/') {
						i++;
						while (i < n && /[a-z]/.test(s[i])) {
							mask[i] = false;
							i++;
						}
					}
					lastToken = '/';
					mode = 'code';
					continue;
				}
				i++;
				continue;
			}
			case 'class': {
				mask[i] = false;
				if (c === '\\') {
					if (i + 1 < n) mask[i + 1] = false;
					i += 2;
					continue;
				}
				if (c === ']') mode = 'regex';
				i++;
				continue;
			}
		}
	}
	return mask;
}

/** Liest den Callee (ggf. mit Property) direkt vor einer öffnenden Klammer `(`. */
function calleeBeforeParen(s: string, parenIdx: number, mask: boolean[]): { base: string; prop?: string } | null {
	let j = parenIdx - 1;
	while (j >= 0 && (/\s/.test(s[j]) || !mask[j])) j--; // Whitespace + Nicht-Code überspringen
	if (j < 0 || !/[A-Za-z0-9_$]/.test(s[j])) return null;
	// trailing identifier (property oder base)
	let end = j + 1;
	let start = j;
	while (start > 0 && /[A-Za-z0-9_$]/.test(s[start - 1])) start--;
	const first = s.slice(start, end);
	// optionale `.prop`-Kette davor
	let k = start - 1;
	while (k >= 0 && (/\s/.test(s[k]) || !mask[k])) k--;
	if (k >= 0 && s[k] === '.') {
		let m = k - 1;
		while (m >= 0 && (/\s/.test(s[m]) || !mask[m])) m--;
		if (m >= 0 && /[A-Za-z0-9_$]/.test(s[m])) {
			let end2 = m + 1;
			let start2 = m;
			while (start2 > 0 && /[A-Za-z0-9_$]/.test(s[start2 - 1])) start2--;
			return { base: s.slice(start2, end2), prop: first };
		}
	}
	return { base: first };
}

const TEST_MODIFIERS = new Set(['only', 'skip', 'todo']);

/** Ist `(an parenIdx)` ein test/it-Aufruf (inkl. .only/.skip/.todo, exkl. .describe)? */
function isTestItCall(s: string, parenIdx: number, mask: boolean[]): boolean {
	const callee = calleeBeforeParen(s, parenIdx, mask);
	if (!callee) return false;
	if (callee.base !== 'test' && callee.base !== 'it') return false;
	if (callee.prop === undefined) return true;
	return TEST_MODIFIERS.has(callee.prop);
}

/** Ist `(an parenIdx)` ein describe-Aufruf (inkl. .only/.skip/.todo)? */
function isDescribeCall(s: string, parenIdx: number, mask: boolean[]): boolean {
	const callee = calleeBeforeParen(s, parenIdx, mask);
	if (!callee) return false;
	if (callee.base !== 'describe') return false;
	if (callee.prop === undefined) return true;
	return TEST_MODIFIERS.has(callee.prop);
}

/** Matching von `open` zu `close` ab openIdx, mask-bewusst (Strings/Kommentare zählen nicht). */
function matchBalanced(s: string, openIdx: number, open: string, close: string, mask: boolean[]): number {
	let depth = 0;
	for (let i = openIdx; i < s.length; i++) {
		if (!mask[i]) continue;
		if (s[i] === open) depth++;
		else if (s[i] === close) {
			depth--;
			if (depth === 0) return i;
		}
	}
	return -1; // unausgewogen → defensiv
}

/** Auftrennen der Argumentliste eines Aufrufs an Top-Level-Kommata. Liefert Arg-Spans. */
function splitArgs(s: string, openParen: number, closeParen: number, mask: boolean[]): Array<[number, number]> {
	const args: Array<[number, number]> = [];
	let depth = 0;
	let start = openParen + 1;
	for (let i = openParen + 1; i < closeParen; i++) {
		if (!mask[i]) continue;
		if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth++;
		else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth--;
		else if (s[i] === ',' && depth === 0) {
			args.push([start, i]);
			start = i + 1;
		}
	}
	if (start < closeParen) args.push([start, closeParen]);
	return args.filter(([a, b]) => s.slice(a, b).trim().length > 0);
}

/** Parse einen StringLiteral- oder Template-Arg (ohne Parser) grob zum Namen. */
function parseNameArg(arg: string): string {
	const trimmed = arg.trim();
	const m = trimmed.match(/^([`'"])([\s\S]*)\1$/);
	if (!m) return 'unnamed';
	return m[2].replace(/\$\{[^}]*\}/g, '').trim() || 'unnamed';
}

/** Callback-Arg (Arrow/Function) → Body-Text. Liefert '' bei Nicht-Erkennung. */
function extractCallbackBody(arg: string): string {
	const arrow = arg.indexOf('=>');
	const fn = /\bfunction\b/.test(arg);
	const bodyStartRel = arrow >= 0 ? arg.indexOf('{', arrow) : fn ? arg.indexOf('{') : -1;
	if (bodyStartRel >= 0) {
		const bodyEndRel = arg.lastIndexOf('}');
		if (bodyEndRel > bodyStartRel) return arg.slice(bodyStartRel + 1, bodyEndRel);
	}
	// Expression-Body eines Arrows: alles nach `=>`
	if (arrow >= 0) return arg.slice(arrow + 2).trim();
	return '';
}

/** Matcher im Body-Text erkennen (bounded, da Body-Grenzen vom Scanner stammen). */
function extractAssertions(bodyText: string): string[] {
	const matchers: string[] = [];
	// expect(...).<chain>.matcher(  — chain darf .not/.resolves/.rejects enthalten
	const expectRe = /expect\b[\s\S]*?\)\s*(?:\?\s*)?(?:\.\s*(?:not|resolves|rejects)\b)*\.\s*([A-Za-z0-9_]+)\s*\(/g;
	let m: RegExpExecArray | null;
	while ((m = expectRe.exec(bodyText)) !== null) {
		matchers.push(m[1]);
	}
	// assert.<method>(
	let am: RegExpExecArray | null;
	const assertRe = new RegExp(ASSERT_METHODS.source, 'g');
	while ((am = assertRe.exec(bodyText)) !== null) {
		matchers.push(`assert.${am[1]}`);
	}
	return matchers;
}

function hasObservableSideEffect(bodyText: string): boolean {
	return /page\.evaluate\s*\(/.test(bodyText) || /page\.request\.(get|post|put|patch|delete)\s*\(/.test(bodyText);
}

/**
 * Extrahiert alle test/it-Blöcke einer Datei. Herzstück der „AST-Neufassung":
 * erkennt it() UND test(), liefert präzise Body-Grenzen (mask-bewusst).
 * Trackt zudem die describe-Kette für jeden Test (für redundanzfreie Signatur).
 */
export function extractTestBlocks(content: string, filePath: string): TestBlock[] {
	const mask = computeCodeMask(content);
	const relPath = relative(REPO_ROOT, filePath);
	const blocks: TestBlock[] = [];

	// Phase 1: Alle describe-Blöcke sammeln (Name + Callback-Ende)
	interface DescribeBlock {
		name: string;
		callbackEnd: number; // Position der schließenden } des Callbacks
	}
	const describeBlocks: DescribeBlock[] = [];

	for (let i = 0; i < content.length; i++) {
		if (content[i] !== '(' || !mask[i]) continue;
		if (!isDescribeCall(content, i, mask)) continue;

		const closeParen = matchBalanced(content, i, '(', ')', mask);
		if (closeParen < 0) continue;
		const args = splitArgs(content, i, closeParen, mask);
		if (args.length < 2) continue;

		const name = parseNameArg(content.slice(args[0][0], args[0][1]));
		const callbackArg = content.slice(args[1][0], args[1][1]);
		// Callback-Ende ist die letzte } im Arg (schließt den Callback-Body)
		const callbackEnd = args[1][1] - 1;

		describeBlocks.push({ name, callbackEnd });
	}

	// Hilfsfunktion: Für eine Position die describe-Kette bestimmen (rückwärts)
	function getDescribeChainAt(testPos: number): string[] {
		const chain: string[] = [];
		for (const db of describeBlocks) {
			if (db.callbackEnd > testPos) {
				chain.push(db.name);
			}
		}
		return chain;
	}

	// Phase 2: test/it-Blöcke extrahieren mit describe-Kette
	for (let i = 0; i < content.length; i++) {
		if (content[i] !== '(' || !mask[i]) continue;
		if (!isTestItCall(content, i, mask)) continue;

		const closeParen = matchBalanced(content, i, '(', ')', mask);
		if (closeParen < 0) continue;
		const args = splitArgs(content, i, closeParen, mask);
		if (args.length < 2) continue; // mind. Name + Callback

		const name = parseNameArg(content.slice(args[0][0], args[0][1]));
		const callbackArg = content.slice(args[1][0], args[1][1]);
		const bodyText = extractCallbackBody(callbackArg);
		const assertions = extractAssertions(bodyText);

		const hasMockAssertion =
			assertions.some((a) => MOCK_MATCHERS.has(a)) || /\bmock\.(method|fn|getter|setter|restore)\s*\(/.test(bodyText);
		// Deny-List (robuster als jede Allow-List): jeder Matcher, der NICHT ein
		// Mock-Detail ist, gilt als beobachtbares Outcome — inkl. toBeInTheDocument,
		// assert.* etc. So kann kein vergessener Matcher eine False-Positive erzeugen.
		const hasObservableOutcome =
			assertions.some((a) => !MOCK_MATCHERS.has(a)) ||
			hasObservableSideEffect(bodyText) ||
			/\bexpect\b[\s\S]*?\)\.\s*(resolves|rejects)\b/.test(bodyText);

		const callee = calleeBeforeParen(content, i, mask);
		blocks.push({
			file: relPath,
			name,
			kind: callee?.base === 'it' ? 'it' : 'test',
			bodyText,
			assertions,
			hasMockAssertion,
			hasObservableOutcome,
			describeChain: getDescribeChainAt(i),
		});
	}
	return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detektoren (rein, testbar)
// ─────────────────────────────────────────────────────────────────────────────

/** 1. Tautologisch: Mock-Assertion ohne beobachtbares Outcome UND leerer Existenz-Check. */
export function detectTautological(blocks: TestBlock[]): Finding[] {
	const findings: Finding[] = [];
	for (const b of blocks) {
		if (b.hasMockAssertion && !b.hasObservableOutcome) {
			findings.push({
				category: 'tautological',
				file: b.file,
				testName: b.name,
				issue: 'Prüft nur Mock/Implementation-Detail (toHaveBeenCalled/mock.method), kein beobachtbares Verhalten',
				fix: 'Assertion auf Observable Outcome ergänzen (DOM, API-Response, State, .toBe/.toEqual/assert.*) oder Test entfernen',
				severity: 'critical',
			});
		}
	}
	return findings;
}

/**
 * 2. Empty-Set-Probe: matchAll-Extraktion, die einen for..of-Loop speist, ohne vorherigen
 * Längen-Guard (dateibezogen). Eine leere Menge → Loop läuft 0× → Test grün, prüft nichts.
 *
 * Scope-Bewusst NUR for..of: die .map-/Extraktionsform ([…x.matchAll(…)].map(…)) speist
 * i. d. R. eine nachgelagerte Assertion und ist daher niedrigriskant + false-positive-anfällig.
 * Der lautlose 0-Durchlauf eines nackten for..of ist das eigentliche Risiko — deshalb nur das.
 */
export function detectEmptySet(content: string, filePath: string): Finding[] {
	const findings: Finding[] = [];
	const relPath = relative(REPO_ROOT, filePath);
	const pattern =
		/(?:const\s+\w+\s*=\s*\[[\s\S]*?matchAll\([\s\S]*?\]\s*;|Array\.from\([^)]*matchAll\([\s\S]*?\)\s*\))[\s\S]*?for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*\{/g;
	let m: RegExpExecArray | null;
	while ((m = pattern.exec(content)) !== null) {
		// Guard kann VOR der Zuweisung ODER (realistischer) ZWISCHEN matchAll und dem
		// for-Loop stehen — also auch innerhalb des Match-Spans prüfen, nicht nur davor.
		const region = content.slice(Math.max(0, m.index - 500), m.index + m[0].length);
		const hasGuard = /length\s*>\s*0|length\s*===?\s*0|toHaveLength\s*\(\s*0|assert\.ok\s*\([^)]*length/.test(region);
		if (!hasGuard) {
			findings.push({
				category: 'emptySet',
				file: relPath,
				testName: 'All-Quantor ohne Empty-Set-Probe',
				issue: 'Extraktion via matchAll kann leer sein → Loop läuft nie → Test geht grün, prüft aber nichts',
				fix: 'assert.ok(items.length > 0, "Extraktion liefert leere Menge — Regex/Selektor kaputt?") vor Loop einfügen',
				severity: 'critical',
			});
		}
	}
	return findings;
}

/** Redundanz-Signatur: describe-Kette + Test-Name + sortierte Matcher-Menge. Setup-Boilerplate fliegt raus. */
export function redundancySignature(b: TestBlock): string {
	const describePart = b.describeChain.map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim()).join('::');
	const name = b.name.toLowerCase().replace(/\s+/g, ' ').trim();
	const matchers = [...new Set(b.assertions.filter((a) => !MOCK_MATCHERS.has(a) && !a.startsWith('assert.')))]
		.sort()
		.join(',');
	return describePart ? `${describePart}::${name}::${matchers}` : `${name}::${matchers}`;
}

/** 3. Redundanz: gleiche Signatur (>1 Vorkommen) → Duplikat-Verdacht (Warning). */
export function detectRedundancy(blocks: TestBlock[]): Finding[] {
	const findings: Finding[] = [];
	const groups = new Map<string, TestBlock[]>();
	for (const b of blocks) {
		// Ohne Assertion kann keine sinnvolle Signatur entstehen → überspringen.
		if (b.assertions.length === 0) continue;
		// Redundanz nur INNERHALB einer Datei: gleicher Name + gleiche Matcher in
		// derselben Datei = echter Copy-Paste-Fehler. Querdatei-Kollisionen bei
		// generischen Namen ("200 mit leerer Liste" pro Endpoint) sind keine Redundanz
		// — die sind der späteren semantischen Schicht (Reduktions-Engine) überlassen.
		const key = `${b.file}${redundancySignature(b)}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(b);
	}
	for (const [, occ] of groups) {
		if (occ.length <= 1) continue;
		const keep = occ[0];
		for (let i = 1; i < occ.length; i++) {
			const dup = occ[i];
			findings.push({
				category: 'redundant',
				file: dup.file,
				testName: dup.name,
				issue: `Identische Signatur (Name + Matcher) wie ${keep.file}::${keep.name}`,
				fix: `Prüfen ob wirklich doppelt; andernfalls stärkste Formulierung in ${keep.file} behalten`,
				severity: 'warning',
			});
		}
	}
	return findings;
}

/** 4. Behavior-Coverage-Heuristik (KEIN Mutation-Beweis): Fokus-ohne-Tab, Existenz-ohne-Verhalten. */
export function detectBehaviorGaps(blocks: TestBlock[]): Finding[] {
	const findings: Finding[] = [];
	for (const b of blocks) {
		// Fokus-Test ohne Tab-Freiheit. Heuristik-Grenze: reine Autofokus-Tests
		// (Name „…Autofokus…"/„…fokussiert…") NICHT als Fokus-Gefängnis flaggen — dort
		// ist toBeFocused die korrekte, vollständige Assertion. Früher matchte das bare
		// `fokus` auch auf „Autofokus"/„fokussiert" → critical False Positives (PR #505).
		const isAutofokus = /autofokus|fokussier/i.test(b.name);
		const isFocus = !isAutofokus && (/\b(?:initialfokus|fokus)\b/i.test(b.name) || /\btoBeFocused\b/.test(b.bodyText));
		const hasTab = /\bTab\b|keyboard\.press\(\s*['"]Tab['"]/.test(b.bodyText);
		if (isFocus && !hasTab) {
			findings.push({
				category: 'mutation',
				file: b.file,
				testName: b.name,
				issue: 'Fokus-Vertrag ohne Tab-Freiheit — Fokus-Gefängnis wird nicht gecatched (HEURISTIK, kein Beweis)',
				fix: 'AK ergänzen: Tab → expect(button).toBeFocused()',
				severity: 'critical',
			});
		}
		// Existenz-Test ohne Behavior (Info)
		const isExistence = /existiert|vorhanden|gefunden/i.test(b.name);
		if (isExistence && !b.hasObservableOutcome) {
			findings.push({
				category: 'tautological',
				file: b.file,
				testName: b.name,
				issue: 'Prüft nur Existenz/Vorhandensein, kein Verhalten',
				fix: 'Behavior-Assertion ergänzen oder entfernen, wenn durch andere Tests abgedeckt',
				severity: 'info',
			});
		}
	}
	return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

export function generateReport(
	findings: Finding[],
	blockCount: number,
	fileCount: number,
	reportDir: string,
	dateISO: string,
): string {
	const criticalCount = findings.filter((f) => f.severity === 'critical').length;
	const warningCount = findings.filter((f) => f.severity === 'warning').length;
	const infoCount = findings.filter((f) => f.severity === 'info').length;

	const byCategory = (cat: Category) => findings.filter((f) => f.category === cat);

	let md = `# Test-Optimierung Report — ${dateISO.slice(0, 10)}

> Generiert von \`.github/workflows/test-optimization.yml\` (Scanner-basierte Analyse, TDD-Strategie v3)

---

## 1. Zusammenfassung

| Metrik | Wert |
|--------|------|
| Analysierte Test-Dateien | ${fileCount} |
| Erkannte Test-Blöcke (test/it) | ${blockCount} |
| **Tautologische Tests** | **${byCategory('tautological').length}** |
| **Redundante Tests** | **${byCategory('redundant').length}** |
| **Fehlende Empty-Set-Probes** | **${byCategory('emptySet').length}** |
| **Behavior-Coverage-Lücken (Heuristik)** | **${byCategory('mutation').length}** |
| **Kritische Findings** | **${criticalCount}** |
| Warnungen | ${warningCount} |
| Infos | ${infoCount} |

> Hinweis: Pass/Fail-Counts werden nicht mehr erhoben (früher runner-abhängig kaputt).
> Wert des Reports sind die Findings, nicht Lauf-Statistiken.

---

`;

	const section = (title: string, cat: Category, intro: string, header: string) => {
		md += `## ${title}\n\n${intro}\n\n`;
		const items = byCategory(cat);
		if (items.length === 0) {
			md += `(keine gefunden)\n\n`;
			return;
		}
		md += `| Test-Datei | Test-Name | Problem | Empfehlung | Severity |\n`;
		md += `|------------|-----------|---------|------------|----------|\n`;
		for (const f of items) {
			md += `| ${f.file} | ${f.testName} | ${f.issue} | ${f.fix} | ${f.severity} |\n`;
		}
		md += `\n`;
	};

	section(
		'2. Tautologische Tests (Implementation Detail vs. Behavior)',
		'tautological',
		'*Tests, die prüfen **wie** etwas implementiert ist, nicht **dass** es funktioniert.*',
	);
	section(
		'3. Redundanzen (gleiche Signatur: Name + Matcher)',
		'redundant',
		'*Gleiche Anforderung mehrfach — nur die stärkste (AK) behalten.*',
	);
	section(
		'4. Fehlende Empty-Set-Probes (All-Quantoren)',
		'emptySet',
		'*All-Quantor ohne Prüfung, dass die Menge nicht leer ist — Test geht grün, prüft aber nichts.*',
	);
	section(
		'5. Behavior-Coverage-Lücken (HEURISTIK — kein Mutation-Beweis)',
		'mutation',
		'*Statische Heuristik. Ein echtes Mutation-Testing (Code mutieren → Suite neu → rot?) lebt im Reduktions-Engine-Plan, nicht hier.*',
	);

	// PR-Empfehlungen
	md += `## 6. Konkrete PR-Empfehlungen\n\n`;
	const topCritical = findings.filter((f) => f.severity === 'critical').slice(0, 5);
	if (topCritical.length === 0) {
		md += `(keine kritischen Findings — Test-Suite gesund)\n\n`;
	} else {
		md += `| Priorität | Datei | Test | Änderung |\n`;
		md += `|-----------|-------|------|----------|\n`;
		for (const f of topCritical) {
			md += `| 🔴 Critical | ${f.file} | ${f.testName} | ${f.fix} |\n`;
		}
		md += `\n`;
	}

	md += `---\n*Report generiert am ${dateISO}*\n`;

	const reportPath = join(reportDir, `test-optimization-report-${dateISO.slice(0, 10)}.md`);
	// reportDir ggf. anlegen (z. B. lokaler Aufruf mit neuem --report-dir) — sonst ENOENT.
	mkdirSync(reportDir, { recursive: true });
	writeFileSync(reportPath, md);
	return reportPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main (nur bei direktem Aufruf)
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const args = parseArgs();

	console.log('🔍 Analysiere Test-Suite...');
	console.log(`  Repo-Root: ${args.repoRoot}`);
	console.log(`  Report-Dir: ${args.reportDir}`);

	const testDirs = [
		join(args.repoRoot, 'frontend', 'e2e'),
		join(args.repoRoot, 'server', 'src'),
		join(args.repoRoot, 'frontend', 'src'),
		join(args.repoRoot, '.github', 'workflows'),
		join(args.repoRoot, 'tests'),
	];

	let allBlocks: TestBlock[] = [];
	let allFindings: Finding[] = [];
	let fileCount = 0;

	for (const dir of testDirs) {
		for (const file of findTestFiles(dir)) {
			fileCount++;
			const content = readFileSync(file, 'utf8');
			const blocks = extractTestBlocks(content, file);
			allBlocks.push(...blocks);
			allFindings.push(...detectTautological(blocks));
			allFindings.push(...detectEmptySet(content, file));
		}
	}

	allFindings.push(...detectRedundancy(allBlocks));
	allFindings.push(...detectBehaviorGaps(allBlocks));

	console.log(`  Gefunden: ${fileCount} Test-Dateien, ${allBlocks.length} Test-Blöcke`);

	const reportPath = generateReport(allFindings, allBlocks.length, fileCount, args.reportDir, new Date().toISOString());

	console.log(`✅ Report geschrieben: ${reportPath}`);
	console.log(
		`   Findings: ${allFindings.length} (Critical: ${allFindings.filter((f) => f.severity === 'critical').length})`,
	);

	const criticalFindings = allFindings.some((f) => f.severity === 'critical');
	const githubOutput = process.env.GITHUB_OUTPUT;
	if (githubOutput) {
		appendFileSync(githubOutput, `report_path=${reportPath}\n`);
		appendFileSync(githubOutput, `critical_findings=${criticalFindings}\n`);
	} else {
		console.log(`::set-output name=report_path::${reportPath}`);
		console.log(`::set-output name=critical_findings::${criticalFindings}`);
	}
}

// Direkt-Aufruf-Guard (ESM): main() nur laufen lassen, wenn dieses Modul das Entry ist.
// Pfad-Vergleich (nicht URL-Vergleich) ist unter tsx am robustesten.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	main().catch((err) => {
		console.error('❌ Analyse fehlgeschlagen:', err);
		process.exit(1);
	});
}
