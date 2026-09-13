import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import type { MailSender } from '../logics/mail.js';

/**
 * ROTE Spec-Tests für #1426 (SMTP-Feature) — TF1-TF4, Vertrag: docs/spec/issue-1426.md.
 * `POST /mail/test` existiert noch nicht (weder `logics/mail.ts` noch `express/routes/mail.ts`,
 * noch die Verdrahtung über `AppDeps.mailSender` in `express/index.ts`) → rot durch fehlendes
 * Modul bzw. 404 (Vorbild: push-test-endpoint.test.ts, „die Tests sind rot (404 statt 200/503/401)").
 * KEIN Produktivcode — die `mailSender`-Injektion wird erst in der Impl-Phase Teil von `AppDeps`.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com';
applyTestAuthEnv('mail-test-endpoint');
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'smtp-user';
process.env.SMTP_PASSWORD = 'super-secret-password';
process.env.MAIL_FROM = 'noreply@example.com';

const ADMIN_EMAIL = 'admin@example.com';
const MEMBER_EMAIL = 'member@example.com';

let server: TestServer;
let sentTo: string[] = [];

const recordingSender: MailSender = (payload) => {
	sentTo.push(payload.to);
	return Promise.resolve();
};

const failingSender: MailSender = () => Promise.reject(new Error('SMTP-Transport fehlgeschlagen'));

/** `AppDeps` kennt `mailSender` noch nicht (Impl-Phase) — Cast analog dem Intersection-Muster aus MEMORY.md. */
const startMailTestServer = (mailSender: MailSender) =>
	startTestServer({ mailSender } as unknown as Parameters<typeof startTestServer>[0]);

const postMailTest = (cookie?: string) =>
	fetch(`${server.baseUrl}/mail/test`, {
		method: 'POST',
		headers: cookie ? { cookie } : {},
	});

describe('POST /mail/test — SMTP-Testmail für Admins (#1426, TF1-TF4)', () => {
	beforeEach(async () => {
		await resetDb();
		sentTo = [];
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('AK1: 200 für einen Admin, Sender genau einmal mit to=Admin-Mail aufgerufen', async () => {
		server = await startMailTestServer(recordingSender);
		try {
			const cookie = await server.login(ADMIN_EMAIL, { role: 'admin' });

			const res = await postMailTest(cookie);
			assert.equal(res.status, 200, 'Admin mit vollständiger SMTP-Umgebung erhält 200');
			assert.equal(sentTo.length, 1, 'der Mail-Sender wird genau einmal aufgerufen');
			assert.equal(sentTo[0], ADMIN_EMAIL, 'Empfänger ist die E-Mail des angemeldeten Admins');
		} finally {
			await server.close();
		}
	});

	it('AK4: 403 für eine Rolle member', async () => {
		server = await startMailTestServer(recordingSender);
		try {
			const cookie = await server.login(MEMBER_EMAIL, { role: 'member' });

			const res = await postMailTest(cookie);
			assert.equal(res.status, 403, 'member darf keine Testmail auslösen');
			assert.equal(sentTo.length, 0, 'ohne Berechtigung wird nichts verschickt');
		} finally {
			await server.close();
		}
	});

	it('AK4: 401 ohne Session', async () => {
		server = await startMailTestServer(recordingSender);
		try {
			const res = await postMailTest();
			assert.equal(res.status, 401, 'ohne Session gibt es 401');
		} finally {
			await server.close();
		}
	});

	it('AK2: 503, wenn SMTP unvollständig ist — kein Versandversuch', async () => {
		server = await startMailTestServer(recordingSender);
		const cookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const saved = process.env.SMTP_HOST;
		delete process.env.SMTP_HOST;
		try {
			const res = await postMailTest(cookie);
			assert.equal(res.status, 503, 'unvollständige SMTP-Umgebung liefert 503');
			assert.equal(sentTo.length, 0, 'ohne vollständige Konfiguration wird nichts versendet');
			const body = (await res.json()) as { message?: string };
			assert.ok(body.message && body.message.trim().length > 0, '503 hat eine verständliche Meldung');
		} finally {
			process.env.SMTP_HOST = saved;
			await server.close();
		}
	});

	it('AK3: 502, wenn der Transport wirft — Meldung und Logs ohne SMTP_USER/SMTP_PASSWORD', async () => {
		server = await startMailTestServer(failingSender);
		const cookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const originalWarn = console.warn;
		const originalError = console.error;
		const logged: string[] = [];
		console.warn = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		try {
			const res = await postMailTest(cookie);
			assert.equal(res.status, 502, 'ein werfender Transport liefert 502');
			const body = (await res.json()) as { message?: string };
			assert.ok(body.message && body.message.trim().length > 0, '502 hat eine verständliche Meldung');
			assert.ok(!body.message?.includes('smtp-user'), 'SMTP_USER darf nicht in der Antwort auftauchen');
			assert.ok(!body.message?.includes('super-secret-password'), 'SMTP_PASSWORD darf nicht in der Antwort auftauchen');
			const combinedLog = logged.join('\n');
			assert.ok(!combinedLog.includes('smtp-user'), 'SMTP_USER darf nicht geloggt werden');
			assert.ok(!combinedLog.includes('super-secret-password'), 'SMTP_PASSWORD darf nicht geloggt werden');
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
			await server.close();
		}
	});
});
