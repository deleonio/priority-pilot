import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/index.js';
import {
	resetDb,
	closeDb,
	ensureDisplayNameCustomColumn,
	setDisplayNameCustom,
	displayNameCustomOf,
} from '../test/helpers.js';
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
 * #1256 (Spec docs/spec/issue-1256.md) stellt den #1238-AK1-Vertrag auf Flag-Logik um:
 * `users.displayNameCustom` (BOOLEAN NOT NULL DEFAULT 0) schützt den per PUT /profile selbst
 * gesetzten Namen vor dem OAuth-Sync; ohne Flag (0) wird der Name weiter nachgezogen,
 * der avatarUrl-Sync bleibt von der Flag unberührt. Die Flag-Spalte wird testseitig
 * nachgezogen (helpers.setDisplayNameCustom), solange das Modell sie noch nicht kennt.
 *
 * Rot, bis die Impl die Flag-Logik ergänzt. KEIN Produktivcode.
 */

describe('#1238 upsertOAuthUser — OAuth-Profil-Sync', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		await closeDb();
	});

	// ── AK1 + AK2 (#1238) / AK3 (#1256) — Bestandsnutzer ohne eigenen Namen: Name UND Avatar
	//    werden nachgezogen, Rückgabe = DB-Zeile. Seit #1256 gilt das nur bei Flag 0.

	it('AK3 (#1256): Bestandsnutzer OHNE eigenen Namen (Flag 0) + Login-Profil mit neuem Namen → DB-Zeile UND Rueckgabe tragen den neuen Namen', async () => {
		await User.create({
			email: 'alt@example.com',
			passwordHash: '__oauth__',
			displayName: 'Alter Name',
			avatarUrl: 'https://lh3.googleusercontent.com/alt.jpg',
		});
		// #1256: explizit Flag 0 — Nutzer hat (noch) keinen eigenen Namen gespeichert.
		await setDisplayNameCustom('alt@example.com', 0);

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
		// #1256: Flag-Spalte testseitig nachziehen, damit der Flag-0-Assert unten lesbar bleibt.
		await ensureDisplayNameCustomColumn();
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
		// #1256 AK3: Neuanlage startet mit Flag 0 (Guard — der Name folgt weiter dem Google-Profil).
		assert.equal(await displayNameCustomOf('neu@example.com'), 0, 'AK3: Neuanlage startet mit displayNameCustom = 0');
	});

	// ── #1256 — Eigenspeicherung über PUT /profile schützt displayName vor dem OAuth-Sync ──

	it('#1256 AK1: eigener Name (Flag 1) uebersteht OAuth-Login mit abweichendem Google-Namen', async () => {
		await User.create({
			email: 'own@example.com',
			passwordHash: '__oauth__',
			displayName: 'Eigener Name',
			avatarUrl: null,
		});
		await setDisplayNameCustom('own@example.com', 1);

		const result = await upsertOAuthUser({
			email: 'own@example.com',
			displayName: 'Google Name',
			avatarUrl: null,
		});

		const row = await User.findOne({ where: { email: 'own@example.com' } });
		assert.ok(row, 'Nutzerzeile muss existieren');
		assert.equal(
			row.displayName,
			'Eigener Name',
			'AK1: selbst gespeicherter Name darf vom Google-Profil nicht ueberschrieben werden',
		);
		assert.equal(result.displayName, 'Eigener Name', 'AK1: Rueckgabe == DB-Zeile (Session-Basis unveraendert)');
		assert.equal(result.id, row.id, 'AK1: Rueckgabe-ID == DB-ID');
	});

	it('#1256 AK4: geaenderter Google-Avatar wird auch bei Flag 1 uebernommen', async () => {
		await User.create({
			email: 'avatar@example.com',
			passwordHash: '__oauth__',
			displayName: 'Eigener Name',
			avatarUrl: 'https://lh3.googleusercontent.com/alt.jpg',
		});
		await setDisplayNameCustom('avatar@example.com', 1);

		const result = await upsertOAuthUser({
			email: 'avatar@example.com',
			displayName: 'Eigener Name',
			avatarUrl: 'https://lh3.googleusercontent.com/neu.jpg',
		});

		const row = await User.findOne({ where: { email: 'avatar@example.com' } });
		assert.ok(row);
		assert.equal(
			row.avatarUrl,
			'https://lh3.googleusercontent.com/neu.jpg',
			'AK4: Avatar-Sync bleibt von der Flag unberuehrt',
		);
		assert.equal(row.displayName, 'Eigener Name', 'AK4: Name bleibt trotzdem geschützt');
		assert.equal(result.avatarUrl, row.avatarUrl, 'Rueckgabe == DB-Zeile');
	});
});
