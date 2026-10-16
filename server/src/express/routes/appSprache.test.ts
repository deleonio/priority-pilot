import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import type { User } from '../../models/index.js';
import { appSprache } from './geoConfig.js';

/**
 * Rote Spec-Tests für #2624 (docs/spec/issue-2624.md): Die Sprachauflösungskette
 * (`User.sprache`, sonst `Accept-Language`, #2523) existiert als geteilter, purer Helper
 * `appSprache` in `routes/geoConfig.ts` — von `loeseSprache` (Care-Endpunkt) und `GET /next`
 * gemeinsam genutzt. Rot, bis der Export existiert (fehlender Export als legitimer erster
 * Rot für neue Funktionalität).
 */

/** Minimaler Request-Fake, der nur `get('accept-language')` bedient. */
const reqMitHeader = (acceptLanguage?: string): Request =>
	({
		get: (name: string) => (name.toLowerCase() === 'accept-language' ? acceptLanguage : undefined),
	}) as unknown as Request;

const nutzer = (sprache: string | null): Pick<User, 'sprache'> => ({ sprache });

describe('appSprache — geteilte Sprachauflösung (#2624 AK1)', () => {
	it('Nutzer gewinnt gegen den Header (spracheVon)', () => {
		assert.equal(appSprache(nutzer('en'), reqMitHeader('de-DE')), 'en');
		assert.equal(appSprache(nutzer('de'), reqMitHeader('en')), 'de');
	});

	it('Nutzer ohne gespeicherte Sprache bleibt bei der Nutzerkette (de), kein Header-Fallback', () => {
		assert.equal(appSprache(nutzer(null), reqMitHeader('en')), 'de');
	});

	it('ohne Nutzer folgt die Sprache dem Accept-Language-Header (spracheAusHeader)', () => {
		assert.equal(appSprache(null, reqMitHeader('en-GB')), 'en');
		assert.equal(appSprache(null, reqMitHeader()), 'de');
	});
});
