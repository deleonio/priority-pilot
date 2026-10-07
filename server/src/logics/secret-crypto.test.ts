import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret, isSecretKeyConfigured } from './secret-crypto.js';

/** Rote Spec-Tests für #2211 AK2/AK5 (docs/spec/issue-2211.md): Verschlüsselungshilfe. Rot, bis das Modul existiert. */

const original = process.env.CALDAV_ENCRYPTION_KEY;
afterEach(() => {
	if (original === undefined) delete process.env.CALDAV_ENCRYPTION_KEY;
	else process.env.CALDAV_ENCRYPTION_KEY = original;
});

describe('secret-crypto (#2211)', () => {
	it('Roundtrip; Chiffrat enthält den Klartext nicht und ist je Aufruf verschieden', () => {
		process.env.CALDAV_ENCRYPTION_KEY = 'schluessel-a';
		const first = encryptSecret('app-passwort-123');
		assert.ok(!first.includes('app-passwort-123'));
		assert.notEqual(first, encryptSecret('app-passwort-123'));
		assert.equal(decryptSecret(first), 'app-passwort-123');
	});

	it('falscher Schlüssel scheitert beim Entschlüsseln', () => {
		process.env.CALDAV_ENCRYPTION_KEY = 'schluessel-a';
		const cipher = encryptSecret('geheim');
		process.env.CALDAV_ENCRYPTION_KEY = 'schluessel-b';
		assert.throws(() => decryptSecret(cipher));
	});

	it('ohne Schlüssel: nicht konfiguriert, Verschlüsseln wirft', () => {
		delete process.env.CALDAV_ENCRYPTION_KEY;
		assert.equal(isSecretKeyConfigured(), false);
		assert.throws(() => encryptSecret('geheim'));
		process.env.CALDAV_ENCRYPTION_KEY = 'x';
		assert.equal(isSecretKeyConfigured(), true);
	});
});
