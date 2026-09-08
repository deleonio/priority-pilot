/**
 * Titel-Längenbeschränkung (65 Zeichen)
 * Tests für Frontend-Input-Validierung.
 */

import { describe, it, expect } from 'vitest';
import { validateTitleLength, getTitleMaxLength, getCharacterCounter } from './titleLengthValidation';

describe('Frontend — Titel-Längen-Validation', () => {
	describe('Input-Validierungsfunktion', () => {
		it('Titel mit 65 Zeichen ist gültig, remaining=0', () => {
			const title65 = 'a'.repeat(65);
			const result = validateTitleLength(title65);

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(0);
			expect(result.error).toBeUndefined();
		});

		it('Titel mit 64 Zeichen ist gültig, remaining=1', () => {
			const title64 = 'b'.repeat(64);
			const result = validateTitleLength(title64);

			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(1);
			expect(result.error).toBeUndefined();
		});

		it('Titel mit 66 Zeichen ist ungültig, remaining=-1', () => {
			const title66 = 'c'.repeat(66);
			const result = validateTitleLength(title66);

			expect(result.isValid).toBe(false);
			expect(result.remaining).toBe(-1);
			expect(result.error).toContain('65');
		});

		it('Leerer Titel ist ungültig, remaining=65', () => {
			const result = validateTitleLength('');

			expect(result.isValid).toBe(false);
			expect(result.remaining).toBe(65);
			expect(result.error).toContain('mindestens');
		});

		it('Emoji-Zählung korrekt (UTF-16 code units)', () => {
			const titleEmoji = '😀'.repeat(10); // 10 Emojis = 20 UTF-16 code units
			const result = validateTitleLength(titleEmoji);

			// Frontend zählt UTF-16 code units (String.length)
			expect(result.isValid).toBe(true);
			expect(result.remaining).toBe(45);
		});
	});

	describe('maxLength-Attribute für Input-Felder', () => {
		it('Task-Input-Feld hat maxlength=65', () => {
			const maxlength = getTitleMaxLength();
			expect(maxlength).toBe(65);
		});

		it('Series-Input-Feld hat maxlength=65', () => {
			const maxlength = getTitleMaxLength();
			expect(maxlength).toBe(65);
		});
	});

	describe('Zeichen-Counter für UX', () => {
		it('Zeichen-Counter zeigt "65/65" bei vollem Titel', () => {
			const title65 = 'd'.repeat(65);
			const counter = getCharacterCounter(title65);
			expect(counter).toBe('65/65');
		});

		it('Zeichen-Counter zeigt "15/65" bei halbem Titel', () => {
			const title15 = 'e'.repeat(15);
			const counter = getCharacterCounter(title15);
			expect(counter).toBe('15/65');
		});

		it('Zeichen-Counter zeigt "66/65" bei überlangem Titel (rot markiert)', () => {
			const title66 = 'f'.repeat(66);
			const counter = getCharacterCounter(title66);
			expect(counter).toBe('66/65');
		});
	});
});
