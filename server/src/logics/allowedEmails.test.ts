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

	it('AK-9: getConfiguredEmails() loggt die erlaubten E-Mails mit Präfix [auth] Allowed emails:', () => {
		clearEnv();
		process.env.GOOGLE_ALLOWED_EMAIL = 'a@b.com';

		const logged: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]): void => {
			logged.push(args.map((a) => String(a)).join(' '));
		};
		try {
			getConfiguredEmails();
		} finally {
			console.log = originalLog;
		}

		assert.ok(
			logged.some((line) => line.includes('[auth] Allowed emails:')),
			'getConfiguredEmails() sollte mit dem Präfix "[auth] Allowed emails:" loggen',
		);
	});
});
