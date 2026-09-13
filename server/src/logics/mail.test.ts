import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb } from '../test/helpers.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';

/**
 * ROTE Spec-Tests für #1426 (SMTP-Feature) — TF8, Vertrag: docs/spec/issue-1426.md.
 * `logics/mail.ts` existiert noch nicht → rot durch fehlendes Modul (legitimer Erst-Rot-Zustand
 * für neue Funktionalität). KEIN Produktivcode.
 */

const SMTP_ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] as const;

/** Setzt alle SMTP-Env-Variablen und liefert eine Restore-Funktion (Muster: push.test.ts VAPID-Save/Restore). */
const withFullSmtpEnv = (): (() => void) => {
	const saved = Object.fromEntries(SMTP_ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.SMTP_HOST = 'smtp.example.com';
	process.env.SMTP_PORT = '587';
	process.env.SMTP_SECURE = 'false';
	process.env.SMTP_USER = 'smtp-user';
	process.env.SMTP_PASSWORD = 'super-secret-password';
	process.env.MAIL_FROM = 'noreply@example.com';
	return () => {
		for (const key of SMTP_ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
};

describe('logics/mail — Versand-Helfer (#1426, TF8)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(closeDb);

	it('AK2/AK3: isMailConfigured() spiegelt die Env-Konfiguration', () => {
		const restore = withFullSmtpEnv();
		try {
			assert.equal(isMailConfigured(), true);
			delete process.env.SMTP_HOST;
			assert.equal(isMailConfigured(), false);
		} finally {
			restore();
		}
	});

	it('AK1: sendMailToUser ruft den injizierten Sender genau einmal mit der Nutzer-Mail auf', async () => {
		const restore = withFullSmtpEnv();
		try {
			const calls: { to: string; subject: string; text: string }[] = [];
			const send: MailSender = (payload) => {
				calls.push(payload);
				return Promise.resolve();
			};
			await sendMailToUser({ email: 'user@example.com' }, { subject: 'Test', text: 'Hallo' }, send);

			assert.equal(calls.length, 1, 'der Sender wird genau einmal aufgerufen');
			assert.equal(calls[0].to, 'user@example.com');
		} finally {
			restore();
		}
	});

	it('Nutzer ohne E-Mail wird übersprungen — kein Aufruf, kein Fehler', async () => {
		const restore = withFullSmtpEnv();
		try {
			const calls: unknown[] = [];
			const send: MailSender = (payload) => {
				calls.push(payload);
				return Promise.resolve();
			};
			await sendMailToUser({ email: null }, { subject: 'Test', text: 'Hallo' }, send);

			assert.equal(calls.length, 0, 'ohne E-Mail wird kein Versand versucht');
		} finally {
			restore();
		}
	});

	it('AK3: ein werfender Sender wird protokolliert, ohne SMTP_USER/SMTP_PASSWORD im Log-Text', async () => {
		const restore = withFullSmtpEnv();
		const originalWarn = console.warn;
		const originalError = console.error;
		const logged: string[] = [];
		console.warn = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		try {
			const send: MailSender = () => Promise.reject(new Error('SMTP-Transport fehlgeschlagen'));

			await assert.doesNotReject(
				sendMailToUser({ email: 'user@example.com' }, { subject: 'Test', text: 'Hallo' }, send),
				'ein Transportfehler darf den Aufrufer nicht abbrechen',
			);

			assert.ok(logged.length > 0, 'der Fehler wird protokolliert');
			const combined = logged.join('\n');
			assert.ok(!combined.includes('smtp-user'), 'SMTP_USER darf nicht im Log auftauchen');
			assert.ok(!combined.includes('super-secret-password'), 'SMTP_PASSWORD darf nicht im Log auftauchen');
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
			restore();
		}
	});
});
