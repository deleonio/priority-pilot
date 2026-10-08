import { describe, expect, it } from 'vitest';
import de from './de/navigation.json';
import en from './en/navigation.json';

/**
 * Rote Spec-Tests für #2358 AK7 (Vertrag: `docs/spec/issue-2358.md`).
 *
 * Das Tab-Label `tabs.series` heißt auf Deutsch „Serien & Vorlagen"; Englisch
 * führt eine eigene Übersetzung (nicht der deutsche Text, nicht leer). Der Schlüsselname bleibt.
 */
describe('#2358 AK7 — navigation:tabs.series', () => {
	const others: Record<string, { tabs: { series?: string } }> = {
		en,
	};

	it('de lautet „Serien & Vorlagen"', () => {
		expect(de.tabs.series).toBe('Serien & Vorlagen');
	});

	it.each(Object.keys(others))('%s: eigene Übersetzung (nicht de, nicht leer)', (code) => {
		const value = others[code]?.tabs.series;
		expect(value, `${code}: tabs.series fehlt`).toBeTruthy();
		expect(value).not.toBe(de.tabs.series);
		expect(value).not.toMatch(/Serien|Vorlagen/);
	});
});
