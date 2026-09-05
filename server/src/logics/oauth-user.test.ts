import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { upsertOAuthUser } from './oauthUser.js';

/**
 * Rote Spec-Tests für #1238 (Spec docs/spec/issue-1238.md) — OAuth-Profil-Sync.
 *
 * Der GoogleStrategy-Verify-Callback (express/index.ts:164-184) zieht bei Bestandsnutzern
 * nur avatarUrl nach, nie displayName, und füttert die Session mit der Google-Profil-Variable
 * statt mit der DB-Zeile. Die Logik wird nach server/src/logics/oauthUser.ts extrahiert
 * (Aufrufort bleibt die Strategie-Registrierung, auch für /auth/google/silent).
 *
 * AK1: Bestandsnutzer + geänderter Profilname → users.displayName wird aktualisiert.
 * AK2: Rückgabewert (Basis für done()/Session) == DB-Zeile.
 * AK4: Unbekannte E-Mail → Nutzer wird mit Google-Profilnamen angelegt (Guard).
 *
 * Rot, bis das Modul existiert. KEIN Produktivcode.
 */

describe('#1238 upsertOAuthUser — OAuth-Profil-Sync', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		await closeDb();
	});

	// ── AK1 + AK2 — Bestandsnutzer: Name UND Avatar werden nachgezogen, Rückgabe = DB-Zeile ──

	it('AK1/AK2: Bestandsnutzer mit altem Namen + Login-Profil mit neuem Namen → DB-Zeile UND Rueckgabe tragen den neuen Namen', async () => {
		await User.create({
			email: 'alt@example.com',
			passwordHash: '__oauth__',
			displayName: 'Alter Name',
			avatarUrl: 'https://lh3.googleusercontent.com/alt.jpg',
		});

		const result = await upsertOAuthUser({
			email: 'alt@example.com',
			displayName: 'Neuer Name',
			avatarUrl: 'https://lh3.googleusercontent.com/neu.jpg',
		});

		const row = await User.findOne({ where: { email: 'alt@example.com' } });
		assert.ok(row, 'Nutzerzeile muss existieren');
		assert.equal(
			row.displayName,
			'Neuer Name',
			'AK1: users.displayName muss wie beim avatarUrl-Sync nachgezogen werden',
		);
		assert.equal(
			result.displayName,
			row.displayName,
			'AK2: Session-Name muss aus der DB-Zeile kommen, nicht aus der Google-Variablen',
		);
		assert.equal(result.id, row.id, 'AK2: Session-ID muss die DB-ID sein');
		assert.equal(row.avatarUrl, 'https://lh3.googleusercontent.com/neu.jpg', 'Avatar-Sync läuft unverändert weiter');
	});

	it('AK2: Rueckgabewert entspricht der DB-Zeile auch ohne Profilname-Fallback (displayName == email)', async () => {
		// Muster index.ts:170: displayName ?? email — der Fallback muss in Zeile und Rueckgabe identisch sein.
		await User.create({
			email: 'fallback@example.com',
			passwordHash: '__oauth__',
			displayName: 'fallback@example.com',
			avatarUrl: null,
		});

		const result = await upsertOAuthUser({ email: 'fallback@example.com', displayName: null, avatarUrl: null });

		const row = await User.findOne({ where: { email: 'fallback@example.com' } });
		assert.ok(row);
		assert.equal(row.displayName, 'fallback@example.com', 'E-Mail-Fallback darf den Namen nicht verlieren');
		assert.equal(result.displayName, row.displayName, 'AK2: Rueckgabe == DB-Zeile');
		assert.equal(result.avatarUrl, row.avatarUrl, 'AK2: avatarUrl in Rueckgabe == DB-Zeile');
	});

	// ── AK4 — Guard: Neuanlage behält den Google-Profilnamen ─────────────────────────────

	it('AK4: unbekannte E-Mail → Nutzer wird mit Google-Profilname und Avatar angelegt', async () => {
		const result = await upsertOAuthUser({
			email: 'neu@example.com',
			displayName: 'Neuer Nutzer',
			avatarUrl: 'https://lh3.googleusercontent.com/neu.jpg',
		});

		const row = await User.findOne({ where: { email: 'neu@example.com' } });
		assert.ok(row, 'Nutzer muss angelegt worden sein');
		assert.equal(row.displayName, 'Neuer Nutzer', 'AK4: Google-Profilname ist der displayName');
		assert.equal(row.avatarUrl, 'https://lh3.googleusercontent.com/neu.jpg', 'AK4: Avatar wird uebernommen');
		assert.equal(result.displayName, row.displayName, 'Rueckgabe == DB-Zeile');
	});
});
