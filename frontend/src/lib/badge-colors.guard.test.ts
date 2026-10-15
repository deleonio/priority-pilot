import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Spec-Test #2560 AK1 (docs/spec/issue-2560.md): Badge-Farben kommen aus benannten Konstanten,
 * nie als Hex-Literal direkt am `_color`-Prop (Rückfallschutz fürs Nachbar-Muster `PRIORITY_COLOR`).
 */
describe('Badge-Farben ohne Hex-Literal (#2560 AK1)', () => {
	it.each(['TaskTree.tsx', 'SeriesTab.tsx'])('%s hat kein _color="#…"', (file) => {
		const src = readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8');
		expect(src).not.toMatch(/_color=(\{\s*)?["'`]#/);
	});
});
