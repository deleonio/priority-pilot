/**
 * Rote Spec-Tests für #1890 — MCP-Werkzeug `feedback_send` (Vertrag: docs/spec/issue-1890.md).
 *
 * AK1: tools/list führt `feedback_send` (Pflichtfelder category/title/description, nicht `write`).
 * AK2/AK3: gültiger Aufruf legt denselben Eintrag wie das Formular an (`quelle: mcp`), Admin-Mail 1×.
 * AK4/AK5: Validierungs-/503-Fehler werden zum Tool-Fehler, ohne Eintrag und ohne Mail.
 * AK6: Nur-lese-Token darf `POST /feedback` und `feedback_send`, aber weiterhin nicht `POST /tasks`.
 * Der Katalog-Zähler 33 steht in tools.test.ts / mcp-handshake.test.ts.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { MailSender } from '../logics/mail.js';

process.env.GOOGLE_ALLOWED_EMAILS = 'mcp-fb-a@example.com,mcp-fb-admin@example.com';
applyTestAuthEnv('mcp-feedback-send-test');

const ENV_KEYS = [
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
const envBackup: Record<string, string | undefined> = {};

let server: TestServer;
let idCounter = 1;
let commits: { path: string; content: string }[] = [];
let mails: { to: string; subject: string; text: string }[] = [];

const mailSender: MailSender = async (payload) => {
	mails.push({ to: payload.to, subject: payload.subject, text: payload.text });
};

type Rpc<T> = { result?: T; error?: { message: string } };

const createToken = async (cookie: string, scope: 'read' | 'readwrite'): Promise<string> => {
	const res = await server.json('/api-tokens', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify({ name: `Client-${idCounter++}`, expiresInDays: 365 }),
	});
	assert.equal(res.status, 201, 'Setup: Token muss anlegbar sein');
	const { id, token } = (await res.json()) as { id: number; token: string };
	if (scope === 'readwrite') {
		const patched = await server.json(`/api-tokens/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ scope }),
		});
		assert.equal(patched.status, 200, 'Setup: Hochstufen muss gelingen');
	}
	return token;
};

const rpc = async <T>(token: string, method: string, params: Record<string, unknown>): Promise<Rpc<T>> => {
	const res = await fetch(`${server.baseUrl}/mcp/v1`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ jsonrpc: '2.0', id: idCounter++, method, params }),
	});
	return (await res.json()) as Rpc<T>;
};

const feedbackSend = (token: string, args: Record<string, unknown>) =>
	rpc<unknown>(token, 'tools/call', { name: 'feedback_send', arguments: args });

const validArgs = { category: 'bug', title: 'Login hängt', description: 'Nach dem Login lädt nichts mehr.' };

describe('MCP-Werkzeug feedback_send (#1890)', () => {
	before(async () => {
		for (const key of ENV_KEYS) envBackup[key] = process.env[key];
		server = await startTestServer({
			obsidianGithubClient: {
				getBranchSha: async () => 'existing-sha',
				createBranch: async () => {},
				commitFile: async (_repo: string, _branch: string, path: string, content: string) => {
					commits.push({ path, content });
				},
			},
			mailSender,
		});
	});

	beforeEach(async () => {
		await resetDb();
		for (const key of ENV_KEYS) delete process.env[key];
		process.env.FEEDBACK_GITHUB_TOKEN = 'test-pat';
		process.env.SMTP_HOST = 'smtp.example.com';
		process.env.SMTP_PORT = '587';
		process.env.SMTP_SECURE = 'false';
		process.env.SMTP_USER = 'smtp-user-1890';
		process.env.SMTP_PASSWORD = 'secret-1890';
		process.env.MAIL_FROM = 'noreply@example.com';
		commits = [];
		mails = [];
		await User.create({
			email: 'mcp-fb-admin@example.com',
			passwordHash: '__test__',
			displayName: 'Admin',
			role: 'admin',
		});
	});

	after(async () => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await server.close();
		closeDb();
	});

	it('AK1: tools/list führt feedback_send mit Pflichtfeldern, ohne write-Markierung', async () => {
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const token = await createToken(cookie, 'read');
		const list = await rpc<{ tools: { name: string; inputSchema?: { required?: string[] } }[] }>(
			token,
			'tools/list',
			{},
		);
		const tool = list.result?.tools.find((t) => t.name === 'feedback_send');
		assert.ok(tool, 'feedback_send muss im Katalog stehen');
		assert.deepEqual([...(tool.inputSchema?.required ?? [])].sort(), ['category', 'description', 'title']);
		// Nicht `write`: sonst würde server.ts das Werkzeug bei Nur-lese-Token abweisen (AK6).
		assert.equal((tool as { write?: unknown }).write, undefined);
	});

	it('AK2/AK3: gültiger Aufruf legt einen Eintrag mit quelle: mcp an und benachrichtigt die Admins 1×', async () => {
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const token = await createToken(cookie, 'readwrite');

		const res = await feedbackSend(token, validArgs);
		assert.equal(res.error, undefined, `Kein Fehler erwartet: ${res.error?.message}`);
		assert.equal(commits.length, 1, 'Genau ein Commit');
		const { content } = commits[0]!;
		assert.match(content, /kategorie:\s*bug/);
		assert.match(content, /mcp-fb-a@example\.com/, 'absendende Person steht im Eintrag');
		assert.match(content, /# Login hängt/);
		assert.match(content, /Nach dem Login lädt nichts mehr\./);
		assert.match(content, /quelle:\s*mcp/);
		assert.doesNotMatch(content, /quelle:\s*app-feedback/);
		assert.deepEqual(
			mails.map((m) => m.to),
			['mcp-fb-admin@example.com'],
		);
	});

	it('AK3: Formular-Eintrag behält quelle: app-feedback', async () => {
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const res = await fetch(`${server.baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(validArgs),
		});
		assert.equal(res.status, 201);
		assert.match(commits[0]!.content, /quelle:\s*app-feedback/);
	});

	it('AK4: ungültige Kategorie, leerer Titel oder leerer Text → Tool-Fehler mit Feldhinweis, kein Eintrag, keine Mail', async () => {
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const token = await createToken(cookie, 'readwrite');
		const cases: [Record<string, unknown>, RegExp][] = [
			[{ ...validArgs, category: 'sonstiges' }, /kategorie|category/i],
			[{ ...validArgs, title: '   ' }, /title/i],
			[{ ...validArgs, description: '' }, /description/i],
		];
		for (const [args, field] of cases) {
			const res = await feedbackSend(token, args);
			assert.ok(res.error, `${JSON.stringify(args)} muss als Tool-Fehler enden`);
			assert.match(res.error.message, field);
		}
		assert.equal(commits.length, 0, 'kein Eintrag');
		assert.equal(mails.length, 0, 'keine Admin-Mail');
	});

	it('AK5: ohne Feedback-Konfiguration (503) liefert das Werkzeug einen Fehler statt Erfolg', async () => {
		delete process.env.FEEDBACK_GITHUB_TOKEN;
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const token = await createToken(cookie, 'readwrite');

		const res = await feedbackSend(token, validArgs);
		assert.ok(res.error, 'Fehler erwartet');
		assert.match(res.error.message, /nicht konfiguriert/, 'Hinweis der Route (503) statt Unknown tool');
		assert.equal(res.result, undefined, 'keine Erfolgsmeldung');
		assert.equal(commits.length, 0);
	});

	it('AK6: Nur-lese-Token darf feedback_send und POST /feedback, POST /tasks bleibt 403', async () => {
		const cookie = await server.register('mcp-fb-a@example.com', 'password123');
		const token = await createToken(cookie, 'read');

		const viaTool = await feedbackSend(token, validArgs);
		assert.equal(viaTool.error, undefined, `feedback_send mit Lese-Token: ${viaTool.error?.message}`);

		const direct = await fetch(`${server.baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(validArgs),
		});
		assert.equal(direct.status, 201, 'POST /feedback mit Lese-Token erlaubt');
		assert.equal(commits.length, 2);

		const task = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ title: 'Darf nicht' }),
		});
		assert.equal(task.status, 403, 'POST /tasks bleibt mit Lese-Token gesperrt');
	});
});
