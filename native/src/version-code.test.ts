import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { rootVersion, versionCodeFrom } from './version-code';

describe('versionCodeFrom', () => {
	test('kodiert major*10000 + minor*100 + patch', () => {
		expect(versionCodeFrom('0.5.18')).toBe(518);
		expect(versionCodeFrom('1.2.3')).toBe(10203);
	});

	test('steigt monoton ueber Patch-, Minor- und Major-Bumps', () => {
		const codes = ['0.5.18', '0.5.19', '0.6.0', '0.99.99', '1.0.0'].map(versionCodeFrom);
		expect([...codes].sort((a, b) => a - b)).toEqual(codes);
	});

	test('wirft bei ungültigem Schema', () => {
		expect(() => versionCodeFrom('0.5')).toThrow();
		expect(() => versionCodeFrom('a.b.c')).toThrow();
		expect(() => versionCodeFrom('0.5.-1')).toThrow();
	});
});

test('build.gradle leitet den versionCode aus der Root-package.json ab', () => {
	const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
	expect(gradle).toContain('../../../package.json');
	expect(gradle).toMatch(/major \* 10000 \+ minor \* 100 \+ patch/);
	expect(versionCodeFrom(rootVersion())).toBeGreaterThan(0);
});
