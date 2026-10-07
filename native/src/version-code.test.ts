import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { rootVersion, versionCodeFrom } from './version-code';

describe('versionCodeFrom', () => {
	test('kodiert major*10000000 + minor*10000 + patch (AK1)', () => {
		expect(versionCodeFrom('0.5.18')).toBe(50018);
		expect(versionCodeFrom('1.2.3')).toBe(10020003);
	});

	test('steigt streng ueber Stellenueberlaeufe (AK1)', () => {
		for (const seq of [
			['0.18.99', '0.18.100', '0.19.0'],
			['0.99.5', '0.100.0', '1.0.0'],
		]) {
			const codes = seq.map(versionCodeFrom);
			expect(codes[0]).toBeLessThan(codes[1]);
			expect(codes[1]).toBeLessThan(codes[2]);
		}
	});

	test('0.18.0 liegt ueber allen bisherigen Codes (AK2)', () => {
		expect(versionCodeFrom('0.18.0')).toBeGreaterThan(1800);
	});

	test('haelt die Play-Obergrenze ein und wirft ausserhalb der Grenzen (AK3)', () => {
		expect(versionCodeFrom('209.999.9999')).toBeLessThan(2100000000);
		expect(() => versionCodeFrom('0.1000.0')).toThrow();
		expect(() => versionCodeFrom('0.0.10000')).toThrow();
		expect(() => versionCodeFrom('210.0.0')).toThrow();
	});

	test('wirft bei ungültigem Schema', () => {
		expect(() => versionCodeFrom('0.5')).toThrow();
		expect(() => versionCodeFrom('a.b.c')).toThrow();
		expect(() => versionCodeFrom('0.5.-1')).toThrow();
	});
});

test('build.gradle spiegelt Formel und Grenzen aus version-code.ts (AK4)', () => {
	const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
	expect(gradle).toContain('../../../package.json');
	expect(gradle).toMatch(/major \* 10000000 \+ minor \* 10000 \+ patch/);
	for (const limit of ['999', '9999', '209']) expect(gradle).toContain(limit);
	expect(versionCodeFrom(rootVersion())).toBeGreaterThan(0);
});
