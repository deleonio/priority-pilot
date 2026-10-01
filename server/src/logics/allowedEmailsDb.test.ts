import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
// Roter Spec-Test (#1983, AK1): Das Modell `AllowedEmail` und der DB-Export
// `isDbEmailAllowed` existieren noch nicht. Der Import schlägt fehl, bis
// `server/src/models/allowedEmail.ts` bzw. `server/src/logics/allowedEmails.ts`
// den Vertrag aus docs/spec/issue-1983.md bereitstellen.
import { AllowedEmail } from '../models/allowedEmail.js';
import { isDbEmailAllowed } from './allowedEmails.js';
import { resetDb, closeDb } from '../test/helpers.js';

// AK7-Regression: Die Env-Allowlist bleibt unberührt sync — dieser File testet NUR den
// DB-Zweig; bestehende allowedEmails.test.ts müssen grün bleiben.

describe('allowedEmails — DB-Zulassung mit Herkunft (#1983 AK1)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: gespeicherte Adresse (origin einladung) wird zugelassen — neben leerer Env-Allowlist', async () => {
		await AllowedEmail.create({ email: 'invitee@example.com', origin: 'einladung' });
		assert.equal(await isDbEmailAllowed('invitee@example.com'), true);
	});

	it('AK1: Prüfung ist normalisierend (trim + lowercase)', async () => {
		await AllowedEmail.create({ email: 'invitee@example.com', origin: 'admin' });
		assert.equal(await isDbEmailAllowed('  Invitee@Example.COM '), true);
	});

	it('AK1: unbekannte Adresse bleibt draußen', async () => {
		await AllowedEmail.create({ email: 'invitee@example.com', origin: 'delegation' });
		assert.equal(await isDbEmailAllowed('fremd@example.com'), false);
	});

	it('AK1: alle drei Herkünfte werden gespeichert und ausgelesen', async () => {
		for (const origin of ['einladung', 'delegation', 'admin'] as const) {
			const entry = await AllowedEmail.create({ email: `${origin}@example.com`, origin });
			assert.equal(entry.origin, origin);
		}
	});
});
