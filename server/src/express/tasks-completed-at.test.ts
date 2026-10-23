import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Roter Spec-Vertrag für #2574 (docs/spec/issue-2574.md) — `completedAt` im Task-DTO.
 *
 * AK5: `serializeTask` leitet `completedAt` aus dem `ScoreEntry.zeitpunkt` ab (Assoziation
 * `Task.hasOne(ScoreEntry)`, `server/src/models/index.ts:84`):
 * - Erledigt mit nachgetragenem `completedAt`-Input ⇒ genau dieser Zeitpunkt — im PATCH-Antwortkörper
 *   UND in `GET /tasks` (Wochenansicht darf nicht erst nach Reload stimmen).
 * - Erledigt ohne Input ⇒ Zeitpunkt des Abhakens (±60 s).
 * - Offen ⇒ `null`; nach „Wieder öffnen" ⇒ `null` (Reopen zerstört den ScoreEntry,
 *   `server/src/express/routes/tasks.ts` AwardScoreOnDone/Reopen-Pfad).
 *
 * Rot, bis `serializeTask` das Ausgabefeld liefert. KEIN Produktivcode. Muster: `tasks-missed.test.ts`.
 */

applyTestAuthEnv('test-secret-issue-2574');

const DAY = 24 * 60 * 60 * 1000;

let server: TestServer;
let run = 0;

describe('Task-DTO: completedAt (#2574 AK5)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const auth = async (): Promise<string> => {
		run += 1;
		return server.register(`completed-at-${run}@example.com`);
	};

	const createTask = async (cookie: string, body: Record<string, unknown>): Promise<{ id: number }> => {
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
		assert.equal(res.status, 201, `Task-Anlage muss 201 liefern (${String(body.title)})`);
		return (await res.json()) as { id: number };
	};

	const patchTask = async (
		cookie: string,
		id: number,
		body: Record<string, unknown>,
	): Promise<Record<string, unknown>> => {
		const res = await fetch(`${server.baseUrl}/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
		assert.ok(res.ok, `PATCH /tasks/${id} muss gelingen (ist ${res.status})`);
		return (await res.json()) as Record<string, unknown>;
	};

	const list = async (cookie: string): Promise<Record<string, unknown>[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.ok(res.ok, `GET /tasks muss gelingen (ist ${res.status})`);
		return (await res.json()) as Record<string, unknown>[];
	};

	it('AK5: Erledigt mit nachgetragenem completedAt liefert diesen Zeitpunkt — im PATCH-Body und in GET /tasks', async () => {
		const cookie = await auth();
		const task = await createTask(cookie, { title: 'Nachgetragen erledigt' });
		const nachtrag = new Date(Date.now() - DAY).toISOString();

		const patched = await patchTask(cookie, task.id, { status: 'Done', completedAt: nachtrag });
		assert.equal(
			Date.parse(String(patched.completedAt)),
			Date.parse(nachtrag),
			'PATCH-Antwort trägt den nachgetragenen Erledigt-Zeitpunkt',
		);

		const tasks = await list(cookie);
		const dto = tasks.find((t) => t.id === task.id);
		assert.ok(dto, 'erledigter Task muss in GET /tasks liegen');
		assert.equal(
			Date.parse(String(dto.completedAt)),
			Date.parse(nachtrag),
			'GET /tasks liefert den ScoreEntry-Zeitpunkt',
		);
	});

	it('AK5: Erledigt ohne Input liefert den Abhaken-Zeitpunkt (±60 s)', async () => {
		const cookie = await auth();
		const task = await createTask(cookie, { title: 'Direkt erledigt' });
		await patchTask(cookie, task.id, { status: 'Done' });

		const tasks = await list(cookie);
		const dto = tasks.find((t) => t.id === task.id);
		assert.ok(dto, 'erledigter Task muss in GET /tasks liegen');
		const completedAt = Date.parse(String(dto.completedAt));
		assert.ok(
			Math.abs(completedAt - Date.now()) < 60_000,
			`completedAt (${String(dto.completedAt)}) muss der Zeitpunkt des Abhakens sein`,
		);
	});

	it('AK5: offener Task liefert completedAt = null', async () => {
		const cookie = await auth();
		await createTask(cookie, { title: 'Bleibt offen' });

		const tasks = await list(cookie);
		assert.equal(tasks[0]?.completedAt, null, 'ohne ScoreEntry ist completedAt null (nicht undefined)');
	});

	it('AK5: nach Wieder-Öffnen ist completedAt wieder null', async () => {
		const cookie = await auth();
		const task = await createTask(cookie, { title: 'Wieder geöffnet' });
		await patchTask(cookie, task.id, { status: 'Done' });
		await patchTask(cookie, task.id, { status: 'Open' });

		const tasks = await list(cookie);
		const dto = tasks.find((t) => t.id === task.id);
		assert.ok(dto, 'wieder geöffneter Task muss in GET /tasks liegen');
		assert.equal(dto.completedAt, null, 'Reopen zerstört den ScoreEntry — completedAt fällt auf null');
	});
});
