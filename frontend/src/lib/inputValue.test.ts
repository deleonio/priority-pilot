import { describe, expect, it } from 'vitest';
import { readNumber, readString } from './inputValue';

describe('readString', () => {
	it('gibt Strings unverändert zurück', () => {
		expect(readString('hallo')).toBe('hallo');
	});

	it('liefert leeren String für null/undefined', () => {
		expect(readString(null)).toBe('');
		expect(readString(undefined)).toBe('');
	});

	it('wandelt andere Werte in ihren String', () => {
		expect(readString(42)).toBe('42');
	});
});

describe('readNumber', () => {
	it('liefert endliche Zahlen aus Number und numerischem String', () => {
		expect(readNumber(3)).toBe(3);
		expect(readNumber('2.5')).toBe(2.5);
	});

	it('liefert null bei leer, nicht-numerisch oder nicht-endlich', () => {
		expect(readNumber('')).toBeNull();
		expect(readNumber('   ')).toBeNull();
		expect(readNumber('abc')).toBeNull();
		expect(readNumber(null)).toBeNull();
		expect(readNumber(undefined)).toBeNull();
		expect(readNumber(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
