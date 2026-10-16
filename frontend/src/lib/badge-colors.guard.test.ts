import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as badgeColors from './badgeColors';

const colors = badgeColors as unknown as Record<string, Record<string, string>>;

/**
 * Spec-Test #2560 AK1 (docs/spec/issue-2560.md): Badge-Farben kommen aus benannten Konstanten,
 * nie als Hex-Literal direkt am `_color`-Prop (Rückfallschutz fürs Nachbar-Muster `PRIORITY_COLOR`).
 * #2637 AK3 (docs/spec/issue-2637.md): der Guard deckt auch TaskTable.tsx und Dashboard.tsx ab und
 * erkennt Hex-Literale in Badge-Farb-Mapping-Definitionen (lokale Konstanten wären sonst erlaubt).
 * Issue-Referenzen wie "#2361" sind Hex-Zeichen, aber keine Farbliterale — geprüft wird deshalb
 * nur der in Anführungszeichen stehende Hex-String.
 */
describe('Badge-Farben ohne Hex-Literal (#2560 AK1, #2637 AK1/AK3)', () => {
	it.each(['TaskTable.tsx', 'TaskTree.tsx', 'Dashboard.tsx', 'SeriesTab.tsx', 'MilestoneBadges.tsx'])(
		'%s hat kein _color="#…"',
		(file) => {
			const src = readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8');
			expect(src).not.toMatch(/_color=(\{\s*)?["'`]#/);
			// #2618 AK2: auch Hex-Literale innerhalb eines Ausdrucks (Ternary)
			expect(src).not.toMatch(/_color=\{[^}]*["'`]#/);
			// #2637 AK3: auch Hex-Literale in Mapping-Definitionen (lokale Farb-Konstanten)
			expect(src).not.toMatch(/["'`]#[0-9a-fA-F]{3,8}["'`]/);
		},
	);
});

/** #2637 AK2: die zentrale Quelle liefert exakt die bisherigen Hex-Werte (Aussehen unverändert). */
describe('Badge-Farb-Mappings aus badgeColors.ts (#2637 AK2)', () => {
	it('exportiert PRIORITY_COLOR mit den bisherigen Hex-Werten', () => {
		expect(colors.PRIORITY_COLOR).toEqual({ info: '#005b99', warning: '#c66a00', danger: '#b42318' });
	});
	it('exportiert URGENCY_COLOR mit den bisherigen Hex-Werten', () => {
		expect(colors.URGENCY_COLOR).toEqual({ overdue: '#b42318', soon: '#b54708' });
	});
});
