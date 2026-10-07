/**
 * Rote Spec-Tests für #2349 (Spec docs/spec/issue-2349.md) — AK3: `aiSuitability` in der
 * Task-Antwort nur für Nutzer mit `ai_assist`. Rot, bis das Feld ausgeliefert wird.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import type { Plan } from '../logics/plans.js';

applyTestAuthEnv('tasks-ai-suitability-test');

let server: TestServer;

const SUITABLE = 'E-Mail an Krankenkasse wegen Kur-Antrag entwerfen';
const UNSUITABLE = 'Fenster putzen';

type TaskWithSuitability = { title: string; aiSuitability?: string | null };

const seedAndList = async (email: string, plan: Plan): Promise<TaskWithSuitability[]> => {
	const cookie = await server.register(email);
	await User.update({ plan }, { where: { email } });
	for (const title of [SUITABLE, UNSUITABLE]) {
		const created = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify({ title }),
		});
		assert.equal(created.status, 201, 'Setup: Aufgabe anlegen');
	}
	const res = await fetch(`${server.baseUrl}/tasks`, { headers: { cookie } });
	assert.equal(res.status, 200);
	return (await res.json()) as TaskWithSuitability[];
};

describe('Task-Antwort: aiSuitability (#2349)', () => {
	before(async () => {
		server = await startTestServer();
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

	it('AK3: Nutzer mit ai_assist (plus) erhält Kategorie, ungeeignete Aufgabe null', async () => {
		const tasks = await seedAndList('suit-plus@example.com', 'plus');
		assert.equal(tasks.find((t) => t.title === SUITABLE)?.aiSuitability, 'draft');
		assert.equal(tasks.find((t) => t.title === UNSUITABLE)?.aiSuitability ?? null, null);
	});

	it('AK3: free-Nutzer ohne ai_assist erhält kein aiSuitability', async () => {
		const tasks = await seedAndList('suit-free@example.com', 'free');
		assert.equal(tasks.length, 2);
		for (const task of tasks) {
			assert.equal(task.aiSuitability ?? null, null, `${task.title}: Feld fehlt oder null`);
		}
	});
});
