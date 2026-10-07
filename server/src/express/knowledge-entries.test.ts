import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1936 (Spec docs/spec/issue-1936.md) — Wissens-Einträge-API.
 * AK1: CRUD pro Nutzer (Pro), Datenisolation (404), Grenzen 1–500 Zeichen, höchstens 50 Einträge.
 * AK2: Free/Plus erhalten 403 `plan_required` (`knowledge_entries`, `pro`).
 * Rot, bis Modell `KnowledgeEntry`, Router `/knowledge-entries` und FeatureId existieren.
 */

applyTestAuthEnv('test-secret-knowledge-entries-1936');

let server: TestServer;

const setup = async (email: string, plan: 'free' | 'plus' | 'pro') => {
	const cookie = await server.register(email, 'password123');
	await User.update({ plan }, { where: { email } });
	return cookie;
};

const call = (cookie: string, method: string, path: string, body?: unknown) =>
	fetch(`${server.baseUrl}/knowledge-entries${path}`, {
		method,
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe('Wissens-Einträge API (#1936)', () => {
	before(async () => {
		process.env.MONETIZATION_ENFORCED = 'true';
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('AK1 — Pro legt an, liest, ändert und löscht einen Eintrag', async () => {
		const cookie = await setup('pro-crud@example.com', 'pro');
		const created = await call(cookie, 'POST', '', { text: 'Ich trainiere dienstags im Verein.' });
		assert.equal(created.status, 201);
		const entry = (await created.json()) as { id: number; text: string };
		assert.equal(entry.text, 'Ich trainiere dienstags im Verein.');

		const list = (await (await call(cookie, 'GET', '')).json()) as { id: number; text: string }[];
		assert.deepEqual(
			list.map((e) => e.id),
			[entry.id],
		);

		const patched = await call(cookie, 'PATCH', `/${entry.id}`, { text: 'Ich trainiere mittwochs.' });
		assert.equal(patched.status, 200);
		assert.equal(((await patched.json()) as { text: string }).text, 'Ich trainiere mittwochs.');

		assert.equal((await call(cookie, 'DELETE', `/${entry.id}`)).status, 204);
		assert.deepEqual(await (await call(cookie, 'GET', '')).json(), []);
	});

	it('AK1 — fremde Einträge sind weder sichtbar noch änderbar (404)', async () => {
		const owner = await setup('owner@example.com', 'pro');
		const other = await setup('other@example.com', 'pro');
		const { id } = (await (await call(owner, 'POST', '', { text: 'Privat' })).json()) as { id: number };

		assert.deepEqual(await (await call(other, 'GET', '')).json(), []);
		assert.equal((await call(other, 'PATCH', `/${id}`, { text: 'Fremd' })).status, 404);
		assert.equal((await call(other, 'DELETE', `/${id}`)).status, 404);
		const mine = (await (await call(owner, 'GET', '')).json()) as { text: string }[];
		assert.equal(mine[0]?.text, 'Privat', 'der Eintrag des Eigentümers bleibt unverändert');
	});

	it('AK1 — leerer Text, Text über 500 Zeichen und ein 51. Eintrag ergeben 400', async () => {
		const cookie = await setup('limits@example.com', 'pro');
		assert.equal((await call(cookie, 'POST', '', { text: '   ' })).status, 400);
		assert.equal((await call(cookie, 'POST', '', { text: 'x'.repeat(501) })).status, 400);
		assert.equal((await call(cookie, 'POST', '', { text: 'x'.repeat(500) })).status, 201);
		const { id } = ((await (await call(cookie, 'GET', '')).json()) as { id: number }[])[0]!;
		assert.equal((await call(cookie, 'PATCH', `/${id}`, { text: '' })).status, 400);

		for (let i = 1; i < 50; i++) {
			assert.equal((await call(cookie, 'POST', '', { text: `Eintrag ${i}` })).status, 201);
		}
		assert.equal((await call(cookie, 'POST', '', { text: 'Eintrag 51' })).status, 400, '51. Eintrag');
	});

	for (const plan of ['free', 'plus'] as const) {
		it(`AK2 — ${plan} erhält auf allen Routen 403 plan_required (knowledge_entries, pro)`, async () => {
			const cookie = await setup(`${plan}@example.com`, plan);
			const expected = { code: 'plan_required', feature: 'knowledge_entries', requiredPlan: 'pro' };
			for (const [method, path, body] of [
				['GET', '', undefined],
				['POST', '', { text: 'Test' }],
				['PATCH', '/1', { text: 'Test' }],
				['DELETE', '/1', undefined],
			] as const) {
				const res = await call(cookie, method, path, body);
				assert.equal(res.status, 403, `${method} ${path}`);
				assert.deepEqual(await res.json(), expected, `${method} ${path}`);
			}
		});
	}
});
