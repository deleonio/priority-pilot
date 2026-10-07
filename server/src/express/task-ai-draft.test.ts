/**
 * Rote Spec-Tests für #2350 (Spec docs/spec/issue-2350.md) — AK1–AK3: `POST|DELETE /tasks/:id/ai-draft`.
 * Rot, bis die Route existiert (heute 404 ohne Handler). LLM nur über den Mistral-Endpoint gemockt.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	applyTestAuthEnv,
	setTestLlmProvider,
	type TestServer,
} from '../test/helpers.js';
import { AiUsage, User } from '../models/index.js';
import type { Plan } from '../logics/plans.js';

applyTestAuthEnv('task-ai-draft-test');

let server: TestServer;
const originalFetch = globalThis.fetch;
let llmBodies: string[] = [];

const SUITABLE = 'E-Mail an Krankenkasse wegen Kur-Antrag entwerfen';
const SUMMARY_TITLE = 'Gutachten der Versicherung zusammenfassen';
const UNSUITABLE = 'Fenster putzen';
const DRAFT_TEXT = 'Sehr geehrte Damen und Herren, hiermit beantrage ich eine Kur.';

const stubLlm = (): void => {
	llmBodies = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		if (typeof url === 'string' && (url.includes('api.mistral.ai') || url.includes('openrouter.ai'))) {
			llmBodies.push(String(init?.body ?? ''));
			return new Response(JSON.stringify({ choices: [{ message: { content: DRAFT_TEXT } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return originalFetch(url, init);
	}) as typeof fetch;
};

const setup = async (email: string, plan: Plan, title: string, description?: string) => {
	const cookie = await server.register(email);
	await User.update({ plan }, { where: { email } });
	const created = await fetch(`${server.baseUrl}/tasks`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify({ title, ...(description ? { description } : {}) }),
	});
	assert.equal(created.status, 201, 'Setup: Aufgabe anlegen');
	const task = (await created.json()) as { id: number };
	return { cookie, id: task.id, userId: (await User.findOne({ where: { email } }))!.id };
};

const call = (cookie: string, id: number, method: 'POST' | 'DELETE') =>
	fetch(`${server.baseUrl}/tasks/${id}/ai-draft`, { method, headers: { cookie } });

const usage = async (userId: number): Promise<number> => (await AiUsage.findOne({ where: { userId } }))?.count ?? 0;

const readTask = async (cookie: string, id: number) => {
	const res = await fetch(`${server.baseUrl}/tasks`, { headers: { cookie } });
	return ((await res.json()) as { id: number; description?: string | null; aiDraft?: string | null }[]).find(
		(t) => t.id === id,
	);
};

describe('POST|DELETE /tasks/:id/ai-draft (#2350)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		process.env.MONETIZATION_ENFORCED = 'true';
		await setTestLlmProvider(true);
		stubLlm();
	});
	after(async () => {
		globalThis.fetch = originalFetch;
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: genau ein LLM-Aufruf, Entwurf gespeichert + geliefert, Zählung +1', async () => {
		const { cookie, id, userId } = await setup('draft-ok@example.com', 'plus', SUITABLE);
		const res = await call(cookie, id, 'POST');
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { aiDraft: string }).aiDraft, DRAFT_TEXT);
		assert.equal(llmBodies.length, 1);
		assert.ok(llmBodies[0].includes('Krankenkasse'), 'Prompt enthält den Aufgabentitel');
		assert.equal(await usage(userId), 1);
		assert.equal((await readTask(cookie, id))?.aiDraft, DRAFT_TEXT);
	});

	it('AK1: Prompt hängt von der Kategorie ab (draft vs. summary)', async () => {
		const a = await setup('draft-cat-a@example.com', 'plus', SUITABLE);
		await call(a.cookie, a.id, 'POST');
		const b = await setup('draft-cat-b@example.com', 'plus', SUMMARY_TITLE);
		await call(b.cookie, b.id, 'POST');
		assert.equal(llmBodies.length, 2);
		const stripTitle = (body: string, title: string): string => body.split(title).join('');
		assert.notEqual(stripTitle(llmBodies[0], SUITABLE), stripTitle(llmBodies[1], SUMMARY_TITLE));
	});

	it('AK2: DELETE setzt aiDraft auf null, Beschreibung bleibt', async () => {
		const { cookie, id } = await setup('draft-del@example.com', 'plus', SUITABLE, 'Bitte höflich bleiben');
		assert.equal((await call(cookie, id, 'POST')).status, 200);
		const res = await call(cookie, id, 'DELETE');
		assert.equal(res.status, 204);
		const task = await readTask(cookie, id);
		assert.equal(task?.aiDraft ?? null, null);
		assert.equal(task?.description, 'Bitte höflich bleiben');
	});

	it('AK3: ohne ai_assist 403 plan_required, kein LLM-Aufruf', async () => {
		const { cookie, id } = await setup('draft-free@example.com', 'free', SUITABLE);
		const res = await call(cookie, id, 'POST');
		assert.equal(res.status, 403);
		assert.equal(((await res.json()) as { code?: string }).code, 'plan_required');
		assert.equal(llmBodies.length, 0);
	});

	it('AK3: fremde Task-ID → 404 (POST und DELETE)', async () => {
		const owner = await setup('draft-owner@example.com', 'plus', SUITABLE);
		const other = await setup('draft-other@example.com', 'plus', SUITABLE);
		assert.equal((await call(owner.cookie, owner.id, 'POST')).status, 200, 'Gegenprobe: Besitzer darf');
		llmBodies = [];
		assert.equal((await call(other.cookie, owner.id, 'POST')).status, 404);
		assert.equal((await call(other.cookie, owner.id, 'DELETE')).status, 404);
		assert.equal(llmBodies.length, 0);
		assert.ok((await readTask(owner.cookie, owner.id))?.aiDraft, 'Entwurf des Besitzers bleibt');
	});

	it('AK3: Aufgabe ohne Eignung → 400, kein LLM-Aufruf, keine Zählung', async () => {
		const { cookie, id, userId } = await setup('draft-unsuit@example.com', 'plus', UNSUITABLE);
		const res = await call(cookie, id, 'POST');
		assert.equal(res.status, 400);
		assert.equal(llmBodies.length, 0);
		assert.equal(await usage(userId), 0);
	});
});
