import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#193): Die Multi-User-Allowlist-Logik existiert noch nicht. Der Import schlägt
// fehl, bis `server/src/logics/allowedEmails.ts` `isEmailAllowed` und `getConfiguredEmails`
// gemäß diesem Vertrag (AK 1–7, AK-9) bereitstellt.
import { isEmailAllowed, getConfiguredEmails } from './allowedEmails.js';

const ENV_KEYS = ['GOOGLE_ALLOWED_EMAIL', 'GOOGLE_ALLOWED_EMAILS'] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
	originalEnv[key] = process.env[key];
}

const clearEnv = (): void => {
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
};

const restoreEnv = (): void => {
	for (const key of ENV_KEYS) {
		if (originalEnv[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = originalEnv[key];
		}
	}
};

describe('allowedEmails — Multi-User-Allowlist (Issue #193)', () => {
	afterEach(() => {
		restoreEnv();
	});

	it('AK-1: Backward-Compat — einzelne GOOGLE_ALLOWED_EMAIL ist erlaubt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAIL = 'a@b.com';
		assert.equal(isEmailAllowed('a@b.com'), true);
	});

	it('AK-2: CSV — erste E-Mail aus GOOGLE_ALLOWED_EMAILS ist erlaubt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = 'a@b.com,c@d.com';
		assert.equal(isEmailAllowed('a@b.com'), true);
	});

	it('AK-3: CSV — zweite E-Mail aus GOOGLE_ALLOWED_EMAILS ist erlaubt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = 'a@b.com,c@d.com';
		assert.equal(isEmailAllowed('c@d.com'), true);
	});

	it('AK-4: JSON-Array — E-Mail aus dem Array ist erlaubt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = '["a@b.com","c@d.com"]';
		assert.equal(isEmailAllowed('c@d.com'), true);
	});

	it('AK-5: kein Env-Var gesetzt — getConfiguredEmails() wirft', () => {
		clearEnv();
		assert.throws(() => getConfiguredEmails());
	});

	it('AK-6: case-insensitiv — A@B.COM ist bei a@b.com erlaubt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAIL = 'a@b.com';
		assert.equal(isEmailAllowed('A@B.COM'), true);
	});

	it('AK-7: Whitespace — Leerzeichen um die E-Mails werden getrimmt', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = ' a@b.com , c@d.com ';
		assert.equal(isEmailAllowed(' a@b.com '), true);
	});

	// Hilfsfunktion: fängt console.log während eines Aufrufs ab.
	const captureLog = (run: () => void): string[] => {
		const logged: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]): void => {
			logged.push(args.map((a) => String(a)).join(' '));
		};
		try {
			run();
		} finally {
			console.log = originalLog;
		}
		return logged;
	};

	// AK-9 (angepasst #1471/F-5): Die Startmeldung bleibt, die Adressen erscheinen aber nur noch
	// maskiert — die Allowlist ist Zugangskonfiguration und gehört nicht im Klartext in die Logs.
	it('AK-9: getConfiguredEmails() loggt die erlaubten E-Mails maskiert mit Präfix [auth] Allowed emails:', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.org';

		const logged = captureLog(() => getConfiguredEmails());
		const line = logged.find((entry) => entry.includes('[auth] Allowed emails:'));

		assert.ok(line, 'getConfiguredEmails() sollte mit dem Präfix "[auth] Allowed emails:" loggen');
		assert.ok(line.includes('a***@example.com'), 'Die erste Adresse sollte maskiert erscheinen');
		assert.ok(line.includes('b***@example.org'), 'Die zweite Adresse sollte maskiert erscheinen');
		assert.ok(!line.includes('alice@example.com'), 'Die vollständige Adresse darf nicht im Log stehen');
		assert.ok(!line.includes('bob@example.org'), 'Die vollständige Adresse darf nicht im Log stehen');
	});

	// Randfall der Maskierung: ohne `@` oder mit leerem Local-Part bleibt nichts Erkennbares übrig.
	it('AK-9b: Adressen ohne Local-Part werden vollständig maskiert', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAILS = '@example.com,kaputt';

		const logged = captureLog(() => getConfiguredEmails());
		const line = logged.find((entry) => entry.includes('[auth] Allowed emails:'));

		assert.equal(line, '[auth] Allowed emails: ***, ***');
	});
});
