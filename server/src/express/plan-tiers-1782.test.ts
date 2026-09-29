import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User, Task } from '../models/index.js';

/**
 * Rote Spec-Tests für #1782 (Spec docs/spec/issue-1782.md) — API-Verhalten der Pakete free/plus/pro.
 * AK2/AK7: `/auth/me`, AK3: `/plans`, AK4: gewichtete Abhängigkeiten, AK5: Downgrade, AK6: MCP-Token-Scope.
 * Rot, weil der Server `plus`/`graph_weight` noch nicht kennt.
 */

applyTestAuthEnv('plan-tiers-1782-test');

let server: TestServer;

const setPlan = (email: string, plan: string): Promise<unknown> => User.update({ plan }, { where: { email } });

interface Me {
	plan?: string;
	entitlements?: Record<string, { allowed: boolean; requiredPlan: string }>;
}
const me = async (cookie: string): Promise<{ status: number; body: Me }> => {
	const res = await fetch(`${server.baseUrl}/auth/me`, { headers: { Cookie: cookie } });
	return { status: res.status, body: (await res.json()) as Me };
};

const json = (cookie: string, method: string, path: string, body?: unknown): Promise<Response> =>
	fetch(`${server.baseUrl}${path}`, {
		method,
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

/** Nutzer mit Paket und zwei Aufgaben; liefert Cookie und Task-IDs. */
const setup = async (email: string, plan: string): Promise<{ cookie: string; a: number; b: number }> => {
	const cookie = await server.register(email, 'password123');
	await setPlan(email, plan);
	const userId = (await User.findOne({ where: { email } }))!.get('id') as number;
	const a = await Task.create({ title: 'A', userId });
	const b = await Task.create({ title: 'B', userId });
	return { cookie, a: a.id, b: b.id };
};

describe('Pakete free/plus/pro über die API (#1782)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('AK2: /auth/me liefert je Paket die Matrix (free ohne graph_weight, plus mit, mcp_readwrite nur pro)', async () => {
		const expected: Record<string, [boolean, boolean, boolean]> = {
			free: [true, false, false], // graph_write, graph_weight, mcp_readwrite
			plus: [true, true, false],
			pro: [true, true, true],
		};
		for (const [plan, [write, weight, readwrite]] of Object.entries(expected)) {
			const { cookie } = await setup(`me-${plan}@example.com`, plan);
			const { body } = await me(cookie);
			assert.equal(body.plan, plan);
			assert.equal(body.entitlements?.graph_write?.allowed, write, `${plan} graph_write`);
			assert.equal(body.entitlements?.graph_weight?.allowed, weight, `${plan} graph_weight`);
			assert.equal(body.entitlements?.graph_weight?.requiredPlan, 'plus');
			assert.equal(body.entitlements?.mcp_readwrite?.allowed, readwrite, `${plan} mcp_readwrite`);
			assert.equal(body.entitlements?.mcp_readwrite?.requiredPlan, 'pro');
		}
	});

	it('AK7: Altwerte max/ultimate in users.plan führen bei /auth/me nicht zu 500', async () => {
		for (const legacy of ['max', 'ultimate']) {
			const { cookie } = await setup(`legacy-${legacy}@example.com`, legacy);
			const { status, body } = await me(cookie);
			assert.equal(status, 200, `${legacy} darf kein 500 liefern`);
			assert.ok(body.entitlements, `${legacy}: Entitlement-Map vorhanden`);
		}
	});

	it('AK3: GET /plans liefert plus/pro-Preise, keine Einträge für max/ultimate', async () => {
		const res = await fetch(`${server.baseUrl}/plans`);
		const body = (await res.json()) as { prices: Record<string, unknown> };
		assert.deepEqual(Object.keys(body.prices).sort(), ['free', 'plus', 'pro']);
		assert.deepEqual(body.prices.plus, { monthly: 499, quarterly: 1347, yearly: 4790 });
		assert.deepEqual(body.prices.pro, { monthly: 999, quarterly: 2697, yearly: 9590 });
	});

	it('AK4: Free legt ohne weight an und entfernt (Rollout an), mit weight 403 graph_weight ohne Kante', async () => {
		const { cookie, a, b } = await setup('dep-free@example.com', 'free');
		process.env.MONETIZATION_ENFORCED = 'true';

		const plain = await json(cookie, 'POST', `/tasks/${a}/dependencies`, { dependingTaskId: b });
		assert.equal(plain.status, 201, 'einfache Abhängigkeit für Free');
		const removed = await json(cookie, 'DELETE', `/tasks/${a}/dependencies/${b}`);
		assert.equal(removed.status, 204, 'Entfernen für Free');

		const weighted = await json(cookie, 'POST', `/tasks/${a}/dependencies`, { dependingTaskId: b, weight: 0.5 });
		assert.equal(weighted.status, 403);
		const err = (await weighted.json()) as { code?: string; feature?: string; requiredPlan?: string };
		assert.equal(err.code, 'plan_required');
		assert.equal(err.feature, 'graph_weight');
		assert.equal(err.requiredPlan, 'plus');
		const task = await Task.findByPk(a);
		const deps = await (task as unknown as { getDependencies: () => Promise<unknown[]> }).getDependencies();
		assert.equal(deps.length, 0, 'nichts angelegt');
	});

	it('AK4: Plus darf weight setzen', async () => {
		const { cookie, a, b } = await setup('dep-plus@example.com', 'plus');
		process.env.MONETIZATION_ENFORCED = 'true';
		const res = await json(cookie, 'POST', `/tasks/${a}/dependencies`, { dependingTaskId: b, weight: 0.5 });
		assert.equal(res.status, 201);
	});

	it('AK5: nach Downgrade Plus → Free bleibt die Gewichts-Kante lesbar, weight-Schreiben liefert 403', async () => {
		const email = 'down-plus@example.com';
		const { cookie, a, b } = await setup(email, 'plus');
		process.env.MONETIZATION_ENFORCED = 'true';
		assert.equal(
			(await json(cookie, 'POST', `/tasks/${a}/dependencies`, { dependingTaskId: b, weight: 0.5 })).status,
			201,
		);

		await setPlan(email, 'free');
		const read = await json(cookie, 'GET', `/tasks/${a}`);
		assert.equal(read.status, 200, 'Lesen bleibt offen');
		const task = await Task.findByPk(a);
		const deps = await (task as unknown as { getDependencies: () => Promise<unknown[]> }).getDependencies();
		assert.equal(deps.length, 1, 'Kante bleibt in der DB');
		const write = await json(cookie, 'POST', `/tasks/${a}/dependencies`, { dependingTaskId: b, weight: 0.8 });
		assert.equal(write.status, 403);
	});

	it('AK6: Plus-Token kann nicht auf readwrite hochgestuft werden (403, requiredPlan pro), Pro schon', async () => {
		const scopeOf = async (email: string, plan: string): Promise<Response> => {
			const { cookie } = await setup(email, plan);
			const created = await json(cookie, 'POST', '/api-tokens', { name: 'CLI', expiresInDays: 30 });
			assert.equal(created.status, 201, `${plan}: Token anlegbar (mcp_read)`);
			const { id } = (await created.json()) as { id: number };
			process.env.MONETIZATION_ENFORCED = 'true';
			return json(cookie, 'PATCH', `/api-tokens/${id}`, { scope: 'readwrite' });
		};
		const plus = await scopeOf('tok-plus@example.com', 'plus');
		assert.equal(plus.status, 403);
		assert.equal(((await plus.json()) as { requiredPlan?: string }).requiredPlan, 'pro');
		assert.equal((await scopeOf('tok-pro@example.com', 'pro')).status, 200);
	});
});
