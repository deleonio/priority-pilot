import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail } from './adminEmails.js';

/**
 * Tests für den Admin-Bootstrap (#1471/F-6): `logics/adminEmails.ts` steuert über `ADMIN_EMAILS`,
 * wer beim Login automatisch zur Rolle `admin` befördert wird — eine Fehlinterpretation des
 * Env-Formats vergibt oder verweigert stillschweigend Adminrechte, und beides fällt im Betrieb
 * nicht von selbst auf. Geprüft wird die Auswertung (CSV/JSON/Normalisierung), nicht der Wortlaut
 * der Datei.
 *
 * Das Parse-Format ist dasselbe wie bei der Allowlist (`allowedEmails.test.ts`); die Rollenlogik
 * darüber (nur Beförderung, keine Rückstufung) sitzt in `auth.ts` und ist dort getestet.
 */

const originalAdminEmails = process.env.ADMIN_EMAILS;

const restoreEnv = (): void => {
	if (originalAdminEmails === undefined) {
		delete process.env.ADMIN_EMAILS;
	} else {
		process.env.ADMIN_EMAILS = originalAdminEmails;
	}
};

describe('adminEmails — Admin-Bootstrap über ADMIN_EMAILS', () => {
	afterEach(restoreEnv);

	it('nicht gesetzt → niemand ist Admin', () => {
		delete process.env.ADMIN_EMAILS;
		assert.equal(isAdminEmail('a@b.com'), false);
	});

	it('leerer Wert → niemand ist Admin', () => {
		process.env.ADMIN_EMAILS = '   ';
		assert.equal(isAdminEmail('a@b.com'), false);
	});

	it('CSV: jede gelistete Adresse ist Admin, eine ungelistete nicht', () => {
		process.env.ADMIN_EMAILS = 'a@b.com,c@d.com';
		assert.equal(isAdminEmail('a@b.com'), true);
		assert.equal(isAdminEmail('c@d.com'), true);
		assert.equal(isAdminEmail('e@f.com'), false);
	});

	it('JSON-Array wird als solches gelesen (keine CSV-Interpretation der Klammern)', () => {
		process.env.ADMIN_EMAILS = '["a@b.com", "c@d.com"]';
		assert.equal(isAdminEmail('a@b.com'), true);
		assert.equal(isAdminEmail('c@d.com'), true);
	});

	it('kaputtes JSON fällt auf CSV zurück, statt die Konfiguration zu verwerfen', () => {
		process.env.ADMIN_EMAILS = '[a@b.com,c@d.com';
		// Der führende `[` bleibt am ersten Eintrag kleben — die zweite Adresse bleibt nutzbar.
		assert.equal(isAdminEmail('c@d.com'), true);
	});

	it('JSON-Objekt (kein Array) fällt auf CSV zurück', () => {
		process.env.ADMIN_EMAILS = '{"mail":"a@b.com"}';
		assert.equal(isAdminEmail('a@b.com'), false);
	});

	it('Vergleich ist case-insensitiv — in der Konfiguration wie in der Anfrage', () => {
		process.env.ADMIN_EMAILS = 'A@B.COM';
		assert.equal(isAdminEmail('a@b.com'), true);
		assert.equal(isAdminEmail('A@B.com'), true);
	});

	it('Whitespace um die Einträge wird getrimmt', () => {
		process.env.ADMIN_EMAILS = ' a@b.com , c@d.com ';
		assert.equal(isAdminEmail(' a@b.com '), true);
		assert.equal(isAdminEmail('c@d.com'), true);
	});

	it('leere Einträge werden verworfen — eine leere Anfrage wird dadurch nicht Admin', () => {
		process.env.ADMIN_EMAILS = 'a@b.com,,';
		assert.equal(isAdminEmail(''), false);
		assert.equal(isAdminEmail('a@b.com'), true);
	});
});
