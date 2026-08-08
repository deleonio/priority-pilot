import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
	extractTestBlocks,
	detectTautological,
	detectRedundancy,
	detectEmptySet,
	type TestBlock,
} from './analyze-test-suite.ts';

// Contract-Tests für die Test-Suite-Analyse. Die Detektoren sind reine, exportierte
// Funktionen — jede Assertion fixiert einen konkreten Anti-Pattern-Fall und dessen
// korrekte Klassifikation, damit Regressionen (die früher den Job vertrauensunwürdig
// machten) sofort rot laufen. Stil-Spiegel von workflow-consistency.test.ts:
// node:test + assert/strict, deutsche describe/it.

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '__fixtures__');
const readFixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');
// gleicher Pfad-Präfix für alle Fixtures → Redundanz-Gruppierung verhält sich wie im Echtlauf.
const blocksOf = (name: string): TestBlock[] => extractTestBlocks(readFixture(name), join(FIXTURES, name));

describe('Tautologie-Detektor (Mock-Detail ohne beobachtbares Outcome)', () => {
	it('flaggt Mock-only-Tests (kein beobachtbares Outcome)', () => {
		const findings = detectTautological(blocksOf('vitest-mock-only.ts'));
		assert.equal(findings.length, 1);
		assert.equal(findings[0].category, 'tautological');
	});

	it('markiert .toBe-Tests NICHT als tautologisch (Regression: .toBe fehlte im Vokabular)', () => {
		const findings = detectTautological(blocksOf('vitest-tobee.ts'));
		assert.equal(findings.length, 0);
	});

	it('erkennt node:assert als beobachtbares Outcome (Regression: Server-Domain war blind)', () => {
		const findings = detectTautological(blocksOf('server-assert.ts'));
		assert.equal(findings.length, 0);
	});
});

describe('Redundanz-Detektor (gleiche Signatur: Name + Matcher)', () => {
	it('flaggt echte Copy-Paste-Duplikate (gleicher Name + Assertion, eine Datei)', () => {
		const findings = detectRedundancy(blocksOf('redundant-pair.ts'));
		assert.equal(findings.length, 1);
		assert.equal(findings[0].category, 'redundant');
	});

	it('markiert Tests mit geteiltem 375px-Setup, aber verschiedenen Targets NICHT als redundant', () => {
		// Regression der 13 False Positives: früher kollidierte die Body-Präfix-Signatur.
		const findings = detectRedundancy(blocksOf('playwright-375px.ts'));
		assert.equal(findings.length, 0);
	});

	it('kollidiert NICHT querdatei bei gleichem generischen Namen (Within-File-Scoping)', () => {
		// Zwei verschiedene Dateien, je ein Test mit identischem Namen '200 mit leerer Liste'.
		// Querdatei-Rundumblick darf sie NICHT als Duplikate zusammenziehen.
		const combined = [...blocksOf('cross-a.ts'), ...blocksOf('cross-b.ts')];
		const findings = detectRedundancy(combined);
		assert.equal(findings.length, 0);
	});
});

describe('Empty-Set-Detektor (All-Quantor ohne Leer-Mengen-Probe)', () => {
	it('flaggt matchAll-Loop ohne Längen-Guard', () => {
		const findings = detectEmptySet(readFixture('emptyset-no-guard.ts'), join(FIXTURES, 'emptyset-no-guard.ts'));
		assert.equal(findings.length, 1);
		assert.equal(findings[0].category, 'emptySet');
	});

	it('flaggt NICHT bei Guard zwischen Zuweisung und Loop', () => {
		const findings = detectEmptySet(readFixture('emptyset-with-guard.ts'), join(FIXTURES, 'emptyset-with-guard.ts'));
		assert.equal(findings.length, 0);
	});
});

describe('Block-Extraktion (string-/kommentar-/regex-bewusster Scanner)', () => {
	it('erkennt test() UND it() über alle drei Domains', () => {
		// Playwright (test), Vitest (it), node:test (it) — alle drei müssen extrahiert werden.
		assert.equal(blocksOf('playwright-375px.ts').length, 2);
		assert.equal(blocksOf('redundant-pair.ts').length, 2);
		assert.equal(blocksOf('server-assert.ts').length, 1);
	});

	it('extrahiert assert.* als Assertion-Name', () => {
		const [block] = blocksOf('server-assert.ts');
		assert.ok(
			block.assertions.includes('assert.match'),
			`assert.match nicht erkannt: ${JSON.stringify(block.assertions)}`,
		);
	});
});
