/**
 * Rote Spec-Tests für Issue #1435 — Feedback direkt in Obsidian (AK1–AK7).
 *
 * Vertrag (docs/spec/issue-1435.md): `POST /feedback` legt über einen injizierbaren
 * `ObsidianGithubClient` (AppDeps.obsidianGithubClient) eine Markdown-Datei auf dem
 * konfigurierten Feedback-Branch an. Kein echtes Netzwerk — der Client wird pro Test gestubt.
 *
 * AK8–AK10 (Frontend-UI) stehen in `frontend/e2e/issue-1435-feedback.spec.ts`.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { MailSender } from '../logics/mail.js';

applyTestAuthEnv('test-secret-issue-1435');

const ENV_KEYS = [
	'FEEDBACK_GITHUB_TOKEN',
	'FEEDBACK_GITHUB_REPO',
	'FEEDBACK_GITHUB_BRANCH',
	'FEEDBACK_GITHUB_DIR',
] as const;
const envBackup: Record<string, string | undefined> = {};

interface RecordedCommit {
	repo: string;
	branch: string;
	path: string;
	content: string;
}

let server: TestServer;
let branchShaAnswer: string | null = 'existing-sha';
let branchShaError: Error | null = null;
let commitError: Error | null = null;
let getBranchShaCalls: { repo: string; branch: string }[] = [];
let createBranchCalls: { repo: string; branch: string; fromBranch: string }[] = [];
let commitFileCalls: RecordedCommit[] = [];

const resetStubState = (): void => {
	branchShaAnswer = 'existing-sha';
	branchShaError = null;
	commitError = null;
	getBranchShaCalls = [];
	createBranchCalls = [];
	commitFileCalls = [];
};

describe('POST /feedback (#1435)', () => {
	before(async () => {
		for (const key of ENV_KEYS) envBackup[key] = process.env[key];
		server = await startTestServer({
			obsidianGithubClient: {
				getBranchSha: async (repo: string, branch: string) => {
					getBranchShaCalls.push({ repo, branch });
					if (branchShaError) throw branchShaError;
					return branchShaAnswer;
				},
				createBranch: async (repo: string, branch: string, fromBranch: string) => {
					createBranchCalls.push({ repo, branch, fromBranch });
				},
				commitFile: async (repo: string, branch: string, path: string, content: string) => {
					if (commitError) throw commitError;
					commitFileCalls.push({ repo, branch, path, content });
				},
			},
		});
	});

	beforeEach(async () => {
		for (const key of ENV_KEYS) delete process.env[key];
		process.env.FEEDBACK_GITHUB_TOKEN = 'test-pat';
		resetStubState();
		await resetDb();
	});

	after(async () => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		if (server) await server.close();
		await closeDb();
	});

	const validBody = { category: 'bug', title: 'Login hängt', description: 'Nach dem Login lädt nichts mehr.' };

	const submit = (cookie: string | null, body: unknown = validBody) =>
		fetch(`${server.baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});

	it('AK1/AK3: gültiger Body → 201, genau ein Commit auf FEEDBACK_GITHUB_BRANCH (nie main), Frontmatter im Inhalt', async () => {
		process.env.FEEDBACK_GITHUB_BRANCH = 'app-feedback';
		const cookie = await server.register('feedback-ak1@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(commitFileCalls.length, 1, 'Genau ein Commit-Aufruf');
		const commit = commitFileCalls[0];
		assert.equal(commit.branch, 'app-feedback', 'Zielbranch kommt aus FEEDBACK_GITHUB_BRANCH');
		assert.notEqual(commit.branch, 'main', 'Niemals main als Zielbranch');
		assert.match(commit.content, /^---\n/, 'Inhalt beginnt mit YAML-Frontmatter');
		assert.match(commit.content, /kategorie:\s*bug/, 'Frontmatter enthält die Kategorie');
		assert.match(commit.content, /quelle:\s*app-feedback/, 'Frontmatter markiert die Quelle');
		assert.match(commit.content, /# Login hängt/, 'Titel erscheint als Überschrift');
	});

	it('AK2: zwei Einreichungen mit identischem Titel am selben Tag erzeugen zwei verschiedene Pfade', async () => {
		const cookie = await server.register('feedback-ak2@example.com');

		const first = await submit(cookie);
		const second = await submit(cookie);
		assert.equal(first.status, 201);
		assert.equal(second.status, 201);
		assert.equal(commitFileCalls.length, 2);
		assert.notEqual(commitFileCalls[0].path, commitFileCalls[1].path, 'Pfade müssen sich unterscheiden');
		assert.match(commitFileCalls[0].path, /^Feedback\/\d{4}-\d{2}-\d{2}-bug-.+\.md$/);
	});

	it('AK4: unbekannte Kategorie, leerer Titel oder leere Beschreibung → 400, kein Commit', async () => {
		const cookie = await server.register('feedback-ak4@example.com');

		const cases = [
			{ ...validBody, category: 'sonstiges' },
			{ ...validBody, title: '' },
			{ ...validBody, description: '' },
		];
		for (const body of cases) {
			const res = await submit(cookie, body);
			assert.equal(res.status, 400, `Body ${JSON.stringify(body)} muss 400 liefern`);
		}
		assert.equal(commitFileCalls.length, 0, 'Kein Upstream-Aufruf bei Validierungsfehlern');
	});

	it('AK5: fehlendes FEEDBACK_GITHUB_TOKEN → 503, kein Tokenwert im Body', async () => {
		delete process.env.FEEDBACK_GITHUB_TOKEN;
		const cookie = await server.register('feedback-ak5-token@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 503);
		const text = await res.text();
		assert.doesNotMatch(text, /test-pat/, 'Tokenwert darf nicht in der Response stehen');
	});

	it('AK5: Upstream-Fehler (401/409 des Clients) → 502, Upstream-Body nicht durchgereicht', async () => {
		const cookie = await server.register('feedback-ak5-upstream@example.com');
		commitError = new Error('raw upstream 401: token invalid, secret-upstream-detail');

		const res = await submit(cookie);
		assert.equal(res.status, 502);
		const text = await res.text();
		assert.doesNotMatch(text, /secret-upstream-detail/, 'Roher Upstream-Fehlertext darf nicht durchgereicht werden');
	});

	it('AK6: Branch existiert nicht → Branch wird vor dem Commit angelegt, Commit nennt den neuen Branch', async () => {
		process.env.FEEDBACK_GITHUB_BRANCH = 'app-feedback';
		branchShaAnswer = null;
		const cookie = await server.register('feedback-ak6@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(createBranchCalls.length, 1, 'Branch-Anlage muss genau einmal aufgerufen werden');
		assert.equal(createBranchCalls[0].branch, 'app-feedback');
		assert.equal(commitFileCalls.length, 1);
		assert.equal(commitFileCalls[0].branch, 'app-feedback', 'Commit nennt den neu angelegten Branch');
	});

	it('AK7: ohne Session → 401, kein Upstream-Aufruf', async () => {
		const res = await submit(null);
		assert.equal(res.status, 401);
		assert.equal(commitFileCalls.length, 0);
		assert.equal(getBranchShaCalls.length, 0);
	});
});

/**
 * Rote Spec-Tests für Issue #1502 — Feedback auch an Admins per E-Mail (AK1–AK5).
 * Vertrag: docs/spec/issue-1502.md. AK6 (main nie beschrieben) ist bereits durch die
 * #1435-Tests oben abgedeckt und wird hier nicht dupliziert.
 * `createFeedbackRouter` kennt `mailSender` noch nicht (Impl-Phase) — die injizierten
 * Mail-Aufrufe bleiben deshalb aus, die Assertions unten sind der rote Zustand.
 */
describe('POST /feedback (#1502) — Admin-Mail', () => {
	const MAIL_ENV_KEYS = [
		'FEEDBACK_GITHUB_TOKEN',
		'FEEDBACK_GITHUB_REPO',
		'FEEDBACK_GITHUB_BRANCH',
		'FEEDBACK_GITHUB_DIR',
		'SMTP_HOST',
		'SMTP_PORT',
		'SMTP_SECURE',
		'SMTP_USER',
		'SMTP_PASSWORD',
		'MAIL_FROM',
	] as const;
	const mailEnvBackup: Record<string, string | undefined> = {};

	let mailServer: TestServer;
	let mailCalls: { to: string; subject: string; text: string }[] = [];
	let mailError: Error | null = null;
	let commitError2: Error | null = null;
	let commitFileCalls2: { repo: string; branch: string; path: string; content: string }[] = [];

	const mailSender: MailSender = async (payload) => {
		if (mailError) throw mailError;
		mailCalls.push({ to: payload.to, subject: payload.subject, text: payload.text });
	};

	before(async () => {
		for (const key of MAIL_ENV_KEYS) mailEnvBackup[key] = process.env[key];
		mailServer = await startTestServer({
			obsidianGithubClient: {
				getBranchSha: async () => 'existing-sha',
				createBranch: async () => {},
				commitFile: async (repo: string, branch: string, path: string, content: string) => {
					if (commitError2) throw commitError2;
					commitFileCalls2.push({ repo, branch, path, content });
				},
			},
			mailSender,
		} as unknown as Parameters<typeof startTestServer>[0]);
	});

	beforeEach(async () => {
		for (const key of MAIL_ENV_KEYS) delete process.env[key];
		process.env.FEEDBACK_GITHUB_TOKEN = 'test-pat-1502';
		process.env.SMTP_HOST = 'smtp.example.com';
		process.env.SMTP_PORT = '587';
		process.env.SMTP_SECURE = 'false';
		process.env.SMTP_USER = 'smtp-user-1502';
		process.env.SMTP_PASSWORD = 'super-secret-password-1502';
		process.env.MAIL_FROM = 'noreply@example.com';
		mailCalls = [];
		mailError = null;
		commitError2 = null;
		commitFileCalls2 = [];
		await resetDb();
	});

	after(async () => {
		for (const [key, value] of Object.entries(mailEnvBackup)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		if (mailServer) await mailServer.close();
		await closeDb();
	});

	const body1502 = { category: 'bug', title: 'Sync hängt', description: 'Nach dem Sync bleibt der Ladebalken stehen.' };

	const submitMail = (cookie: string | null) =>
		fetch(`${mailServer.baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body1502),
		});

	it('AK1: zwei Admins mit E-Mail + ein Member → genau zwei Mails an die Admins, Commit unverändert, 201', async () => {
		await User.create({
			email: 'admin1-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin 1',
			role: 'admin',
		});
		await User.create({
			email: 'admin2-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin 2',
			role: 'admin',
		});
		const cookie = await mailServer.register('member-1502@example.com');

		const res = await submitMail(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(commitFileCalls2.length, 1, 'Der Obsidian-Commit bleibt unverändert bei genau einem Aufruf');
		assert.equal(mailCalls.length, 2, 'Genau zwei Admins erhalten eine Mail');
		const recipients = mailCalls.map((call) => call.to).sort();
		assert.deepEqual(recipients, ['admin1-1502@example.com', 'admin2-1502@example.com']);
		assert.ok(!recipients.includes('member-1502@example.com'), 'Der Member erhält keine Mail');
	});

	it('AK1: Admin ohne E-Mail (leerer String) erhält keine Mail, übrige Admins schon', async () => {
		await User.create({
			email: 'admin-mit-mail-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin mit Mail',
			role: 'admin',
		});
		await User.create({ email: '', passwordHash: '__test__', displayName: 'Admin ohne Mail', role: 'admin' });
		const cookie = await mailServer.register('member2-1502@example.com');

		const res = await submitMail(cookie);
		assert.equal(res.status, 201);
		assert.equal(mailCalls.length, 1, 'Nur der Admin mit gesetzter E-Mail erhält eine Mail');
		assert.equal(mailCalls[0]?.to, 'admin-mit-mail-1502@example.com');
	});

	it('AK2: Mailtext enthält Kategorie/Titel/Beschreibung/Nutzer/App-Version, kein Tokenwert', async () => {
		await User.create({
			email: 'admin-ak2-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin AK2',
			role: 'admin',
		});
		const cookie = await mailServer.register('sender-ak2-1502@example.com');

		const res = await submitMail(cookie);
		assert.equal(res.status, 201);
		assert.equal(mailCalls.length, 1);
		const call = mailCalls[0];
		assert.ok(call, 'Es muss eine Mail aufgezeichnet worden sein');
		assert.match(call!.subject, /bug/i, 'Betreff nennt die Kategorie');
		assert.match(call!.subject, /Sync hängt/, 'Betreff nennt den Titel');
		assert.match(call!.text, /bug/, 'Text enthält die Kategorie');
		assert.match(call!.text, /Sync hängt/, 'Text enthält den Titel');
		assert.match(call!.text, /Nach dem Sync bleibt der Ladebalken stehen\./, 'Text enthält die Beschreibung');
		assert.match(call!.text, /sender-ak2-1502@example\.com/, 'Text enthält den absendenden Nutzer');
		assert.doesNotMatch(call!.text, /test-pat-1502/, 'Kein FEEDBACK_GITHUB_TOKEN-Wert im Mailtext');
		assert.doesNotMatch(call!.subject, /test-pat-1502/, 'Kein FEEDBACK_GITHUB_TOKEN-Wert im Betreff');
	});

	it('AK3: SMTP nicht konfiguriert (kein MAIL_FROM) → kein Mailversand, 201 und Commit bleiben', async () => {
		delete process.env.MAIL_FROM;
		await User.create({
			email: 'admin-ak3-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin AK3',
			role: 'admin',
		});
		const cookie = await mailServer.register('sender-ak3-1502@example.com');

		const res = await submitMail(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(mailCalls.length, 0, 'Ohne SMTP-Konfiguration wird kein Versandversuch gemacht');
		assert.equal(commitFileCalls2.length, 1, 'Der Obsidian-Commit bleibt unverändert');
	});

	it('AK4: Mailversand wirft für alle Admins → 201 bleibt, Log ohne SMTP-Zugangsdaten', async () => {
		mailError = new Error('SMTP-Transport fehlgeschlagen');
		await User.create({
			email: 'admin-ak4-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin AK4',
			role: 'admin',
		});
		const cookie = await mailServer.register('sender-ak4-1502@example.com');
		const originalWarn = console.warn;
		const originalError = console.error;
		const logged: string[] = [];
		console.warn = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
		try {
			const res = await submitMail(cookie);
			assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
			assert.equal(commitFileCalls2.length, 1, 'Der Obsidian-Commit bleibt trotz Mailfehler bestehen');
			const combinedLog = logged.join('\n');
			assert.ok(!combinedLog.includes('smtp-user-1502'), 'SMTP_USER darf nicht geloggt werden');
			assert.ok(!combinedLog.includes('super-secret-password-1502'), 'SMTP_PASSWORD darf nicht geloggt werden');
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
		}
	});

	it('AK5: Obsidian-Commit schlägt fehl (502) → Mailversand läuft trotzdem für alle Admins', async () => {
		commitError2 = new Error('raw upstream 401: token invalid, secret-upstream-detail-1502');
		await User.create({
			email: 'admin-ak5-a-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin AK5 A',
			role: 'admin',
		});
		await User.create({
			email: 'admin-ak5-b-1502@example.com',
			passwordHash: '__test__',
			displayName: 'Admin AK5 B',
			role: 'admin',
		});
		const cookie = await mailServer.register('sender-ak5-1502@example.com');

		const res = await submitMail(cookie);
		assert.equal(res.status, 502, 'Der Obsidian-Fehler bleibt bei 502');
		assert.equal(mailCalls.length, 2, 'Der Mailversand scheitert nicht am Obsidian-Weg (Ticket-Formulierung, AK5)');
	});
});
