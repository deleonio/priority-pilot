import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY } from './privacy.ts';
import { TERMS } from './terms.ts';
import { WITHDRAWAL } from './withdrawal.ts';

// #1967 AK2: Spiegel der Liste „zu meiden“ aus docs/fuersorge-tonalitaet.md (Zweckbestimmung und Begriffsliste).
const VERBOTEN =
	/burnout[- ]?(präventi|prevent|prévent|prevenci|prevenz|prevenç|profilakt|профилакт)|therap|terap|терап|heilung|diagnos|диагноз|behandlung|stressabbau/iu;

describe('website — Zweckbestimmung ohne Heilversprechen (#1967)', () => {
	const dir = new URL('./i18n/', import.meta.url);
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	for (const file of files) {
		it(`${file}: enthält keinen Begriff der Zu-meiden-Liste`, () => {
			expect(readFileSync(new URL(file, dir), 'utf8')).not.toMatch(VERBOTEN);
		});
	}

	it('terms.ts, privacy.ts und withdrawal.ts enthalten keinen Begriff der Zu-meiden-Liste', () => {
		expect(JSON.stringify(TERMS)).not.toMatch(VERBOTEN);
		expect(JSON.stringify(PRIVACY)).not.toMatch(VERBOTEN);
		expect(JSON.stringify(WITHDRAWAL)).not.toMatch(VERBOTEN);
	});
});
