import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_VARIANTS, readBalanceVariant, storeBalanceVariant } from './balanceVariant';

/**
 * Persistenz der Bildwahl. Geprüft wird vor allem der Weg, der schiefgehen kann: Was passiert bei
 * einem Wert, den diese Version nicht kennt? Der Schlüssel überlebt Updates und Hand-Edits im
 * Browser — ein unbekannter Wert darf nicht in ein leeres Dashboard münden, sondern muss auf den
 * Default zurückfallen. Muster wie `animations.test.ts`.
 */
describe('balanceVariant', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('zeigt ohne gespeicherte Wahl das Herz', () => {
		expect(readBalanceVariant()).toBe('herz');
	});

	it('liest jede der vier Varianten zurück, die sie geschrieben hat', () => {
		for (const { value } of BALANCE_VARIANTS) {
			storeBalanceVariant(value);
			expect(readBalanceVariant()).toBe(value);
		}
	});

	it('fällt bei einem unbekannten gespeicherten Wert auf das Herz zurück', () => {
		localStorage.setItem('pp-balance-variant', 'seifenblasen-3000');

		expect(readBalanceVariant()).toBe('herz');
	});

	it('übersteht einen gesperrten localStorage in beide Richtungen', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('SecurityError');
		});
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('QuotaExceededError');
		});

		expect(readBalanceVariant()).toBe('herz');
		expect(() => storeBalanceVariant('ringe')).not.toThrow();
	});

	it('führt genau vier Varianten in fester Reihenfolge', () => {
		expect(BALANCE_VARIANTS.map((variant) => variant.value)).toEqual(['herz', 'blasen', 'ringe', 'strahlen']);
	});
});
