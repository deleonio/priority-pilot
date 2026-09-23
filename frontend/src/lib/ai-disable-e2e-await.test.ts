import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Rote Spec-Tests für #1408 AK1 — `initAiEnabled` in `frontend/e2e/ai-disable.spec.ts` muss ein
 * abwartbares Promise zurückgeben, und alle drei Aufrufer (#1335-AK5, #1525-AK3,
 * #1527-`beforeEach`) müssen es mit `await` abwarten. Heute (docs/spec/issue-1408.md) ist der
 * Helfer synchron (`: void`) und gibt das Promise von `page.addInitScript(...)` nicht zurück —
 * ein `page.evaluate`-Assertion-Test dieser Race ist im lokalen Testlauf nicht zuverlässig rot
 * (Timing-abhängig), deshalb prüft dieser Test die Quelle direkt (statischer Vertrag, TF1).
 */

const SPEC_PATH = 'e2e/ai-disable.spec.ts';

const readSpecSource = (): string => readFileSync(new URL(`../../${SPEC_PATH}`, import.meta.url), 'utf-8');

describe('#1408 AK1: initAiEnabled ist async und wird überall abgewartet', () => {
	it('deklariert initAiEnabled als Promise<void> und gibt page.addInitScript(...) zurück', () => {
		const source = readSpecSource();
		const helperMatch = source.match(/const initAiEnabled = ([\s\S]*?)\n};/);
		expect(helperMatch, `Helfer initAiEnabled nicht gefunden in ${SPEC_PATH}`).not.toBeNull();

		const helperBody = helperMatch![1];
		expect(helperBody, 'initAiEnabled muss async sein und Promise<void> deklarieren').toMatch(
			/async \(page: Page, aiEnabled: boolean\): Promise<void>/,
		);
		expect(helperBody, 'initAiEnabled muss auf page.addInitScript(...) warten').toMatch(/await page\.addInitScript\(/);
	});

	it('jeder Aufruf von initAiEnabled(...) in der Datei wird mit await abgewartet', () => {
		const source = readSpecSource();
		const calls = [...source.matchAll(/^(.*\binitAiEnabled\([^)]*\)[^\n]*)$/gm)].map((match) => match[1]);

		expect(calls.length, `Erwarte Aufrufe von initAiEnabled(...) in ${SPEC_PATH}`).toBeGreaterThan(0);

		const unawaited = calls.filter((line) => !/\bawait\s+initAiEnabled\(/.test(line));
		expect(unawaited, 'Jeder Aufruf von initAiEnabled(...) muss mit await stehen').toEqual([]);
	});
});
