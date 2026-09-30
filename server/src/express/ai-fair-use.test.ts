/**
 * Rote Spec-Tests für Issue #1783 (Spec docs/spec/issue-1783.md) — KI-Hilfe: Fair-Use-Drossel statt
 * hartem Kontingent. Deckt AK1–AK4 und AK7 (Server). Rot, bis `aiQuotaMeter.ts` über dem Budget
 * drosselt statt 429 `quota_exhausted` zu senden und `quotaRemaining` entfällt.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import sequelize from '../database.js';

process.env.GOOGLE_ALLOWED_EMAILS = [
	'ak1',
	'ak2',
	'ak2-cap',
	'ak3-pro-low',
	'ak3-pro-high',
	'ak3-off',
	'ak4',
	'ak7-admin',
	'ak7-member',
	'ak7-plain',
]
	.map((name) => `${name}@example.com`)
	.join(',');
applyTestAuthEnv('ai-fair-use-test');

let server: TestServer;

const yearMonth = (): string => new Date().toISOString().slice(0, 7);

const seedUsage = async (userId: number, count: number): Promise<void> => {
	await sequelize.query(
		"INSERT INTO ai_usage (userId, yearMonth, count, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
		{ replacements: [userId, yearMonth(), count] },
	);
};

const countOf = async (userId: number): Promise<number> => {
	const [rows] = await sequelize.query('SELECT count FROM ai_usage WHERE userId = ? AND yearMonth = ?', {
		replacements: [userId, yearMonth()],
	});
	return (rows as { count: number }[])[0]?.count ?? 0;
};

const setup = async (
	email: string,
	plan: 'plus' | 'pro',
	usage: number,
): Promise<{ cookie: string; userId: number }> => {
	const cookie = await server.register(email);
	await User.update({ plan }, { where: { email } });
	const user = await User.findOne({ where: { email } });
	if (usage > 0) await seedUsage(user!.id, usage);
	return { cookie, userId: user!.id };
};

const parseText = (cookie: string): Promise<Response> =>
	fetch(`${server.baseUrl}/tasks/parse-text`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify({ text: 'Steuererklärung bis morgen' }),
	});

describe('KI-Fair-Use-Drossel (#1783)', () => {
	before(async () => {
		server = await startTestServer({ taskTextParser: async () => ({ title: 'Task' }) });
	});
	beforeEach(async () => {
		await resetDb();
		process.env.MONETIZATION_ENFORCED = 'true';
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: unter dem Budget zählt jede Anfrage +1, Antwort ohne quotaRemaining und ohne Drossel-Kennzeichen', async () => {
		const { cookie, userId } = await setup('ak1@example.com', 'plus', 149);
		const res = await parseText(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal('quotaRemaining' in body, false, 'quotaRemaining entfällt');
		assert.equal(body.fairUse, undefined);
		assert.equal(await countOf(userId), 150);
	});

	it('AK2: über dem Budget 200 mit fairUse=throttled, zweite Anfrage im Intervall 429 ai_throttled + Retry-After', async () => {
		const { cookie, userId } = await setup('ak2@example.com', 'plus', 150);
		const first = await parseText(cookie);
		assert.equal(first.status, 200, 'kein quota_exhausted mehr');
		assert.equal(((await first.json()) as { fairUse?: string }).fairUse, 'throttled');

		const second = await parseText(cookie);
		assert.equal(second.status, 429);
		assert.equal(((await second.json()) as { code?: string }).code, 'ai_throttled');
		assert.ok(Number(second.headers.get('retry-after')) > 0, 'Retry-After in Sekunden > 0');
		assert.equal(await countOf(userId), 151, 'abgewiesene Anfrage zählt nicht');
	});

	it('AK2: keine Obergrenze — 3x Budget wird beantwortet', async () => {
		const { cookie } = await setup('ak2-cap@example.com', 'plus', 450);
		const res = await parseText(cookie);
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { fairUse?: string }).fairUse, 'throttled');
	});

	it('AK3: Pro hat Budget 400 — bei 150 Verbrauch nicht gedrosselt, ab 400 gedrosselt', async () => {
		const low = await setup('ak3-pro-low@example.com', 'pro', 150);
		const lowBody = (await (await parseText(low.cookie)).json()) as { fairUse?: string };
		assert.equal(lowBody.fairUse, undefined);

		const high = await setup('ak3-pro-high@example.com', 'pro', 400);
		const highBody = (await (await parseText(high.cookie)).json()) as { fairUse?: string };
		assert.equal(highBody.fairUse, 'throttled');
	});

	it('AK3: Rollout aus → nie gedrosselt, auch bei schnellen Folgeanfragen', async () => {
		delete process.env.MONETIZATION_ENFORCED;
		const { cookie } = await setup('ak3-off@example.com', 'plus', 500);
		for (let i = 0; i < 2; i += 1) {
			const res = await parseText(cookie);
			assert.equal(res.status, 200);
			assert.equal(((await res.json()) as { fairUse?: string }).fairUse, undefined);
		}
	});

	it('AK4: /auth/me liefert ai_assist ohne quotaRemaining', async () => {
		const { cookie } = await setup('ak4@example.com', 'plus', 0);
		const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { cookie } });
		const body = (await res.json()) as { entitlements?: { ai_assist?: Record<string, unknown> } };
		assert.ok(body.entitlements?.ai_assist, 'Setup: ai_assist-Entitlement vorhanden');
		assert.equal('quotaRemaining' in body.entitlements.ai_assist, false);
	});

	it('AK7: Admin-Nutzerliste trägt aiRequestsThisMonth je Nutzer (0 ohne Eintrag), Member erhält 403', async () => {
		const adminCookie = await server.register('ak7-admin@example.com');
		await User.update({ role: 'admin' }, { where: { email: 'ak7-admin@example.com' } });
		const { userId } = await setup('ak7-member@example.com', 'plus', 7);
		const res = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: adminCookie } });
		assert.equal(res.status, 200);
		const users = (await res.json()) as { id: number; email: string; aiRequestsThisMonth?: number }[];
		assert.equal(users.find((u) => u.id === userId)?.aiRequestsThisMonth, 7);
		assert.equal(users.find((u) => u.email === 'ak7-admin@example.com')?.aiRequestsThisMonth, 0);

		const memberCookie = await server.register('ak7-plain@example.com');
		const denied = await fetch(`${server.baseUrl}/admin/users`, { headers: { cookie: memberCookie } });
		assert.equal(denied.status, 403);
	});
});
