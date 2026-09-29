import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CARE_SPRACHEN, CARE_VORLAGEN } from './careSuggestionData.js';
import { SEED_PILLARS } from '../models/pillarData.js';

/**
 * Rote Spec-Tests für #1791 (Spec docs/spec/issue-1791.md) — AK5: kuratierte Vorlagen-
 * Stammdaten vollständig über Säulen und die zehn App-Sprachen.
 *
 * Rot, bis `logics/careSuggestionData.ts` existiert. KEIN Produktivcode.
 */

/** Spiegel zu `frontend/src/i18n/locales/` — die zehn App-Sprachen; neue App-Sprache → Pflicht pflegen. */
const APP_SPRACHEN = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'];

describe('CARE_VORLAGEN Stammdaten (#1791 AK5)', () => {
	it('CARE_SPRACHEN entspricht exakt den zehn App-Sprachen', () => {
		assert.deepEqual([...CARE_SPRACHEN], APP_SPRACHEN);
	});

	it('je Säule mindestens fünf Vorlagen', () => {
		for (const saeuleId of SEED_PILLARS.map((_, index) => index + 1)) {
			const anzahl = CARE_VORLAGEN.filter((vorlage) => vorlage.saeuleId === saeuleId).length;
			assert.ok(anzahl >= 5, `Säule ${saeuleId} braucht mindestens fünf Vorlagen, hat ${anzahl}`);
		}
	});

	it('jede Vorlage in allen zehn Sprachen mit nicht-leerem Titel und Beschreibung; Keys einzigartig', () => {
		const keys = new Set<string>();
		for (const vorlage of CARE_VORLAGEN) {
			assert.ok(!keys.has(vorlage.key), `Key "${vorlage.key}" doppelt — Dismissal-Bezug bricht`);
			keys.add(vorlage.key);
			for (const sprache of CARE_SPRACHEN) {
				const text = vorlage.texte[sprache];
				assert.ok(text, `Vorlage "${vorlage.key}" fehlt in Sprache "${sprache}"`);
				assert.ok(text.titel.trim().length > 0, `Titel von "${vorlage.key}" leer in "${sprache}"`);
				assert.ok(text.beschreibung.trim().length > 0, `Beschreibung von "${vorlage.key}" leer in "${sprache}"`);
			}
		}
	});
});
