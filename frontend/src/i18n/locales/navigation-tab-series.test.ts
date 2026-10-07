import { describe, expect, it } from 'vitest';
import de from './de/navigation.json';
import en from './en/navigation.json';
import es from './es/navigation.json';
import fr from './fr/navigation.json';
import itLocale from './it/navigation.json';
import nl from './nl/navigation.json';
import pl from './pl/navigation.json';
import pt from './pt/navigation.json';
import ru from './ru/navigation.json';
import sv from './sv/navigation.json';

/**
 * Rote Spec-Tests für #2358 AK7 (Vertrag: `docs/spec/issue-2358.md`).
 *
 * Das Tab-Label `tabs.series` heißt auf Deutsch „Serien & Vorlagen"; die übrigen neun Sprachen
 * führen eine eigene Übersetzung (nicht der deutsche Text, nicht leer). Der Schlüsselname bleibt.
 */
describe('#2358 AK7 — navigation:tabs.series', () => {
	const others: Record<string, { tabs: { series?: string } }> = {
		en,
		es,
		fr,
		it: itLocale,
		nl,
		pl,
		pt,
		ru,
		sv,
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
