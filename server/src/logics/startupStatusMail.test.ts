import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/index.js';
import type { UserRole } from '../models/user.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { sendStartupStatusMail } from './startupStatusMail.js';
import type { MailSender } from './mail.js';

// #1566: `UserRole` kennt 'tester' noch nicht (rote Spec-Phase) — Doppel-Cast für den tsc-Gate
// (MEMORY-Muster 2026-08-23); der Laufzeitwert ist schlicht 'tester'.
const TESTER_ROLE = 'tester' as unknown as UserRole;

/**
 * Status-Mail beim Serverstart — Vertrag: nur in Produktion mit konfiguriertem SMTP wird je
 * Admin-Nutzer (Rolle `admin`) eine Mail verschickt (Commit-SHA, Zeitpunkt, Node-Version);
 * Member und Nutzer ohne E-Mail gehen leer aus. Der Versand ist injizierbar (#1426-Muster,
 * siehe `logics/mail.test.ts`), das Env-Handling folgt dem Save/Restore-Muster derselben Datei.
 */

const SAVED_KEYS = ['SMTP_HOST', 'MAIL_FROM', 'NODE_ENV', 'STATUS_MAIL_CC'] as const;

/** Setzt die gegebenen Env-Variablen und liefert eine Restore-Funktion (Muster: mail.test.ts). */
const withEnv = (values: Partial<Record<(typeof SAVED_KEYS)[number], string>>): (() => void) => {
	const saved = Object.fromEntries(SAVED_KEYS.map((key) => [key, process.env[key]]));
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	return () => {
		for (const key of SAVED_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
};

/** Erfolgs-Sender: sammelt die versendeten Payloads (Muster: mail.test.ts). */
const recordingSender =
	(calls: { to: string; subject: string; text: string; cc?: string }[]): MailSender =>
	(payload) => {
		calls.push(payload);
		return Promise.resolve();
	};

const createAdmin = (email: string) =>
	User.create({ email, displayName: `Admin ${email || 'ohne Mail'}`, passwordHash: '__test__', role: 'admin' });

describe('logics/startupStatusMail — Status-Mail beim Serverstart', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(closeDb);

	it('sendet in Produktion genau an Admins mit E-Mail — Betreff mit Commit, Text mit Node-Version', async () => {
		const restore = withEnv({
			NODE_ENV: 'production',
			SMTP_HOST: 'smtp.example.com',
			MAIL_FROM: 'noreply@example.com',
		});
		try {
			await createAdmin('admin1@example.com');
			await createAdmin('admin2@example.com');
			await User.create({ email: 'member@example.com', displayName: 'Member', passwordHash: '__test__' });
			await createAdmin('');

			const calls: { to: string; subject: string; text: string }[] = [];
			const sent = await sendStartupStatusMail(recordingSender(calls));

			assert.equal(sent, 2, 'genau die zwei Admins mit E-Mail erhalten eine Mail');
			assert.deepEqual(
				calls.map((call) => call.to).sort(),
				['admin1@example.com', 'admin2@example.com'],
				'Member und Admin ohne E-Mail bleiben ausgeschlossen',
			);
			for (const call of calls) {
				assert.match(call.subject, /^Priority Pilot neu gestartet \(/);
				assert.ok(call.text.includes('Node:'), 'der Text nennt die Node-Version');
			}
		} finally {
			restore();
		}
	});

	it('setzt STATUS_MAIL_CC als cc auf jeder Mail — ohne die Env bleibt cc leer', async () => {
		await createAdmin('admin@example.com');
		const calls: { to: string; subject: string; text: string; cc?: string }[] = [];

		const restoreCc = withEnv({
			NODE_ENV: 'production',
			SMTP_HOST: 'smtp.example.com',
			MAIL_FROM: 'noreply@example.com',
			STATUS_MAIL_CC: 'betrieb@example.com',
		});
		try {
			await sendStartupStatusMail(recordingSender(calls));
			assert.equal(calls[0].cc, 'betrieb@example.com');
		} finally {
			restoreCc();
		}

		calls.length = 0;
		const restoreNoCc = withEnv({
			NODE_ENV: 'production',
			SMTP_HOST: 'smtp.example.com',
			MAIL_FROM: 'noreply@example.com',
			STATUS_MAIL_CC: undefined,
		});
		try {
			await sendStartupStatusMail(recordingSender(calls));
			assert.equal(calls[0].cc, undefined);
		} finally {
			restoreNoCc();
		}
	});

	it('kein Versand außerhalb von Produktion (Dev/Tests)', async () => {
		const restore = withEnv({ NODE_ENV: 'test', SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'noreply@example.com' });
		try {
			await createAdmin('admin@example.com');

			const calls: { to: string; subject: string; text: string }[] = [];
			const sent = await sendStartupStatusMail(recordingSender(calls));

			assert.equal(sent, 0);
			assert.equal(calls.length, 0, 'außerhalb von Produktion wird kein Versand versucht');
		} finally {
			restore();
		}
	});

	it('kein Versand ohne SMTP-Konfiguration (SMTP_HOST/MAIL_FROM fehlen)', async () => {
		const restore = withEnv({ NODE_ENV: 'production', SMTP_HOST: undefined, MAIL_FROM: undefined });
		try {
			await createAdmin('admin@example.com');

			const calls: { to: string; subject: string; text: string }[] = [];
			const sent = await sendStartupStatusMail(recordingSender(calls));

			assert.equal(sent, 0);
			assert.equal(calls.length, 0, 'ohne SMTP-Konfiguration wird kein Versand versucht');
		} finally {
			restore();
		}
	});

	// #1566 (Spec docs/spec/issue-1566.md, AK5): Guard — der Empfangsfilter bleibt exakt
	// `role: 'admin'`; ein Tester-Konto erhält die Status-Mail nie. Bewusst als grüner
	// Vertragstest angelegt (#1556-AK4-Prezedenz).
	it('#1566 AK5: ein Tester-Konto erhält keine Status-Mail — nur der Admin', async () => {
		const restore = withEnv({
			NODE_ENV: 'production',
			SMTP_HOST: 'smtp.example.com',
			MAIL_FROM: 'noreply@example.com',
		});
		try {
			await createAdmin('admin@example.com');
			await User.create({
				email: 'tester@example.com',
				displayName: 'Tester',
				passwordHash: '__test__',
				role: TESTER_ROLE,
			});

			const calls: { to: string; subject: string; text: string }[] = [];
			const sent = await sendStartupStatusMail(recordingSender(calls));

			assert.equal(sent, 1, 'nur der Admin erhält die Status-Mail');
			assert.deepEqual(
				calls.map((call) => call.to),
				['admin@example.com'],
				'der Tester geht als Empfänger leer aus',
			);
		} finally {
			restore();
		}
	});
});
