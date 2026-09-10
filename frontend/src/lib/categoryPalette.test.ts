import { describe, expect, it } from 'vitest';
import { CATEGORY_PALETTE, categoryColorLabel, categoryColorOptions, DEFAULT_CATEGORY_COLOR } from './categoryPalette';

/**
 * Die Palette ist an drei Stellen gespiegelt (hier, `openapi.yml`, `server/src/models/categoryColors.ts`).
 * Diese Tests sichern, was beim Nachziehen still schiefgehen kann: doppelte oder unbenannte Farben
 * und ein Default, der nicht zur Palette gehört. Der Server lehnt einen unbekannten Wert mit 400 ab —
 * ein hier eingeschleppter Tippfehler wäre also ein Fehler erst beim Speichern.
 */
describe('Kategorie-Palette', () => {
	it('enthält nur eindeutige Hex-Farben mit Namen', () => {
		const colors = CATEGORY_PALETTE.map((entry) => entry.color);
		expect(new Set(colors).size).toBe(colors.length);
		for (const entry of CATEGORY_PALETTE) {
			expect(entry.color).toMatch(/^#[0-9a-f]{6}$/);
			expect(entry.label.trim()).not.toBe('');
		}
	});

	it('hat einen Default aus der Palette', () => {
		expect(CATEGORY_PALETTE.map((entry) => entry.color)).toContain(DEFAULT_CATEGORY_COLOR);
	});

	it('liefert je Palettenfarbe eine Option mit Farbnamen', () => {
		const options = categoryColorOptions();
		expect(options).toHaveLength(CATEGORY_PALETTE.length);
		expect(options[0]).toEqual({ label: CATEGORY_PALETTE[0].label, value: CATEGORY_PALETTE[0].color });
	});

	it('fällt bei einer unbekannten Farbe auf den Hex-Wert zurück statt leer zu bleiben', () => {
		expect(categoryColorLabel(CATEGORY_PALETTE[0].color)).toBe(CATEGORY_PALETTE[0].label);
		expect(categoryColorLabel('#123456')).toBe('#123456');
	});
});
