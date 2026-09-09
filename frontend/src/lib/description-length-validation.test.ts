/**
 * Beschreibung-Längenbeschränkung (3000 Zeichen)
 * Tests für Frontend-Input-Validierung.
 */

import { describe, it, expect } from 'vitest';
import { validateDescriptionLength, getDescriptionMaxLength, getCharacterCounter } from './descriptionLengthValidation';

describe('Frontend — Beschreibung-Längen-Validation', () => {
	describe('Input-Validierungsfunktion', () => {
		it('Beschreibung mit 3000 Zeichen ist gültig, remaining=0', () => {
			const description3000 = 'a'.repeat(3000);
			const result = validateDescriptionLength(description3000);

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(0);
			expect(result.error).toBeUndefined();
		});

		it('Beschreibung mit 2999 Zeichen ist gültig, remaining=1', () => {
			const description2999 = 'b'.repeat(2999);
			const result = validateDescriptionLength(description2999);

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(1);
			expect(result.error).toBeUndefined();
		});

		it('Beschreibung mit 3001 Zeichen ist ungültig, remaining=-1', () => {
			const description3001 = 'c'.repeat(3001);
			const result = validateDescriptionLength(description3001);

			expect(result.isValid).toBe(false);
			expect(result.remaining).toBe(-1);
			expect(result.error).toContain('3000');
		});

		it('Leerer String ist gültig (Beschreibung ist optional)', () => {
			const result = validateDescriptionLength('');

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(3000);
			expect(result.error).toBeUndefined();
		});

		it('Emoji-Zählung korrekt (UTF-16 code units)', () => {
			const descriptionEmoji = '😀'.repeat(10); // 10 Emojis = 20 UTF-16 code units
			const result = validateDescriptionLength(descriptionEmoji);

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(2980);
		});
	});

	describe('maxLength-Attribute für Textarea-Felder', () => {
		it('Task-/Series-Beschreibung-Feld hat maxlength=3000', () => {
			const maxlength = getDescriptionMaxLength();
			expect(maxlength).toBe(3000);
		});
	});

	describe('Zeichen-Counter für UX', () => {
		it('Zeichen-Counter zeigt "3000/3000" bei voller Beschreibung', () => {
			const description3000 = 'd'.repeat(3000);
			const counter = getCharacterCounter(description3000);
			expect(counter).toBe('3000/3000');
		});

		it('Zeichen-Counter zeigt "15/3000" bei kurzer Beschreibung', () => {
			const description15 = 'e'.repeat(15);
			const counter = getCharacterCounter(description15);
			expect(counter).toBe('15/3000');
		});

		it('Zeichen-Counter zeigt "3001/3000" bei überlanger Beschreibung (rot markiert)', () => {
			const description3001 = 'f'.repeat(3001);
			const counter = getCharacterCounter(description3001);
			expect(counter).toBe('3001/3000');
		});
	});
});
