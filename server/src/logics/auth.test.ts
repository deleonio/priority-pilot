import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './auth.js';

// AK 6 — Passwort-Hashing: Passwörter werden niemals im Klartext gespeichert.
// Diese Tests werden grün, sobald server/src/logics/auth.ts existiert.

describe('AK 6 — Passwort-Hashing (bcrypt, cost ≥ 12)', () => {
	it('hashPassword liefert einen bcrypt-Hash (beginnt mit $2b$)', async () => {
		const hash = await hashPassword('geheim123');
		assert.match(hash, /^\$2b\$/, 'Muss ein bcrypt-Hash sein');
	});

	it('hashPassword verwendet mindestens cost 12', async () => {
		const hash = await hashPassword('geheim123');
		const cost = parseInt(hash.split('$')[2], 10);
		assert.ok(cost >= 12, `bcrypt-Cost muss ≥ 12 sein, war ${cost}`);
	});

	it('hashPassword enthält das Klartext-Passwort nicht im Hash', async () => {
		const password = 'meinGeheimesPasswort';
		const hash = await hashPassword(password);
		assert.ok(!hash.includes(password), 'Klartext-Passwort darf nicht im Hash vorkommen');
	});

	it('verifyPassword gibt true für korrektes Passwort zurück', async () => {
		const password = 'korrekt';
		const hash = await hashPassword(password);
		const result = await verifyPassword(password, hash);
		assert.ok(result, 'Korrektes Passwort soll akzeptiert werden');
	});

	it('verifyPassword gibt false für falsches Passwort zurück', async () => {
		const hash = await hashPassword('richtig');
		const result = await verifyPassword('falsch', hash);
		assert.ok(!result, 'Falsches Passwort soll abgelehnt werden');
	});
});
