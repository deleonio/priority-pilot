/**
 * Issue #679: Zeichenzähler für KolInput basierend auf KolInputText/KolTextarea
 * Rote Tests für KolInput Counter-Funktionalität.
 * Diese Tests FAILED, solange die KolInput Counter-Implementierung nicht existiert.
 *
 * Spec-Referenz: docs/spec/issue-679.md
 */

import { describe, it, expect } from 'vitest';
import { getKolInputCounter } from './kolInputCounter';

describe('Frontend — KolInput Counter (Issue #679)', () => {
	describe('Counter-Funktionalität für KolInput', () => {
		it('Eingabe von 5 Zeichen → Counter zeigt "5" (Spec-Referenz: docs/spec/issue-679.md)', () => {
			const input5 = 'hello';
			const counter = getKolInputCounter(input5);
			expect(counter).toContain('5');
		});

		it('Eingabe von 100 Zeichen → Counter zeigt "100" (Spec-Referenz: docs/spec/issue-679.md)', () => {
			const input100 = 'a'.repeat(100);
			const counter = getKolInputCounter(input100);
			expect(counter).toContain('100');
		});

		it('Leeres Feld → Counter zeigt "0" (Spec-Referenz: docs/spec/issue-679.md)', () => {
			const counter = getKolInputCounter('');
			expect(counter).toContain('0');
		});

		it('Counter basiert auf KolInputText/KolTextarea Implementierung (Wiederverwendung)', () => {
			// Testet, dass die Counter-Logik wiederverwendbar ist und konsistent mit existierenden Countern
			const testInput = 'Test';
			const counter = getKolInputCounter(testInput);

			// Counter soll eine lesbare Zeichenanzahl enthalten
			expect(typeof counter).toBe('string');
			expect(counter.length).toBeGreaterThan(0);
		});

		it('Counter wird bei Eingabe aktualisiert (reaktiv)', () => {
			// Testet verschiedene Eingaben und garantiert unterschiedliche Counter-Werte
			const counter1 = getKolInputCounter('a');
			const counter2 = getKolInputCounter('ab');
			const counter3 = getKolInputCounter('abc');

			// Jede Eingabe muss zu einem unterschiedlichen Counter-Wert führen
			expect(counter1).not.toBe(counter2);
			expect(counter2).not.toBe(counter3);
		});
	});

	describe('Counter-Format-Konsistenz', () => {
		it('Counter verwendet das gleiche Format wie KolInputText/KolTextarea (Wiederverwendung)', () => {
			// Basierend auf getCharacterCounter() aus titleLengthValidation.ts
			const input = 'test';
			const counter = getKolInputCounter(input);

			// Counter soll Format "X" oder "X/Y" haben (konsistent mit existierenden Countern)
			expect(counter).toMatch(/\d+/);
		});
	});
});
