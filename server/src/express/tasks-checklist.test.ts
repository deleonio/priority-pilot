import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTE Spec-Tests (#531) — Checklisten-Feld in Tasks.
 *
 * Ein Task bekommt ein optionales `checklist`-Array (Default `[]`) mit Einträgen der Form
 * `{ id: UUID, title: 1–255 Zeichen, completed: boolean (Default false) }`. GET/POST/PATCH `/tasks`
 * unterstützen das Feld; `serializeTask` gibt es mit. Validierung: Titel nicht leer, `id` gültige
 * UUID, max. 50 Items (#2462, zuvor 20). Bestehende Tasks bleiben unberührt (Backward-Kompatibilität).
 *
 * Weder das Modell (`server/src/models/task.ts`) noch `validateTaskFields`/`serializeTask`
 * (`server/src/express/routes/tasks.ts`) noch die OpenAPI kennen `checklist` bisher — `validateTaskFields`
 * ignoriert unbekannte Felder stillschweigend, `serializeTask` gibt das Feld nicht aus. Diese Tests sind
 * daher rot, bis die Umsetzung das Feld modellseitig, in Validierung/Serialisierung und im API-Vertrag
 * führt. Bewusst rein über HTTP formuliert (Black-Box-Vertrag, implementierungsunabhängig).
 */
describe('#531 — Checklisten-Feld in Tasks', () => {
	let server: TestServer;

	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const patch = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	const createTask = async (body: Record<string, unknown>): Promise<number> => {
		const res = await post('/tasks', body);
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	const UUID = '550e8400-e29b-41d4-a716-446655440000';
	const UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

	it('AC3/T1: POST /tasks mit checklist → 201, Liste gespeichert und zurückgegeben', async () => {
		const checklist = [
			{ id: UUID, title: 'Erster Schritt', completed: false },
			{ id: UUID_2, title: 'Zweiter Schritt', completed: true },
		];
		const res = await post('/tasks', { title: 'Mit Checkliste', checklist });
		assert.equal(res.status, 201);
		const created = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(created.checklist, checklist);
	});

	it('AC1/T2: POST /tasks ohne checklist → Default [] (rückwärtskompatibel)', async () => {
		const id = await createTask({ title: 'Ohne Checkliste' });
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(task.checklist, []);
	});

	it('AC2: Checklist-Item ohne completed → Default false', async () => {
		const res = await post('/tasks', {
			title: 'Default-completed',
			checklist: [{ id: UUID, title: 'Nur id+title' }],
		});
		assert.equal(res.status, 201);
		const created = (await res.json()) as { checklist: { completed: boolean }[] };
		assert.equal(created.checklist.length, 1);
		assert.equal(created.checklist[0].completed, false);
	});

	it('AC3/T3: PATCH /tasks/:id aktualisiert die Checklisten-Items', async () => {
		const id = await createTask({ title: 'Patch-Mich' });
		const neueItems = [{ id: UUID, title: 'Geändert', completed: true }];
		const res = await patch(`/tasks/${id}`, { checklist: neueItems });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(updated.checklist, neueItems);
	});

	it('AC4/T4: Checklist-Item mit leerem Titel → 400', async () => {
		const res = await post('/tasks', {
			title: 'Ungültiges Item',
			checklist: [{ id: UUID, title: '   ', completed: false }],
		});
		assert.equal(res.status, 400);
	});

	it('AC4/T5: Checklist-Item mit ungültiger id (keine UUID) → 400', async () => {
		const res = await post('/tasks', {
			title: 'Ungültige id',
			checklist: [{ id: 'keine-uuid', title: 'Gültiger Titel', completed: false }],
		});
		assert.equal(res.status, 400);
	});

	it('#2462/AK1: POST /tasks mit 50 Checklist-Items → 201, persistent und im Response', async () => {
		const items = Array.from({ length: 50 }, (_, i) => ({
			id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
			title: `Item ${i}`,
			completed: i % 2 === 0,
		}));
		const res = await post('/tasks', { title: 'Volle Checkliste', checklist: items });
		assert.equal(res.status, 201);
		const created = (await res.json()) as { id: number; checklist: typeof items };
		assert.equal(created.checklist.length, 50, 'alle 50 Einträge müssen im Response liegen');
		assert.equal(created.checklist[49].title, 'Item 49', 'der 50. Eintrag muss enthalten sein');
		const res2 = await get(`/tasks/${created.id}`);
		assert.equal(res2.status, 200);
		const stored = (await res2.json()) as { checklist: typeof items };
		assert.equal(stored.checklist.length, 50, 'die 50 Einträge müssen persistent gespeichert sein');
	});

	it('#2462/AK1: PATCH /tasks/:id mit 50 Checklist-Items → 200', async () => {
		const id = await createTask({ title: 'Patch auf 50' });
		const items = Array.from({ length: 50 }, (_, i) => ({
			id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
			title: `Item ${i}`,
			completed: false,
		}));
		const res = await patch(`/tasks/${id}`, { checklist: items });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { checklist: unknown[] };
		assert.equal(updated.checklist.length, 50);
	});

	it('#2462/AK2: 51. Checklist-Item → 400 mit Meldung /höchstens 50/', async () => {
		const zuViele = Array.from({ length: 51 }, (_, i) => ({
			id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
			title: `Item ${i}`,
			completed: false,
		}));
		const res = await post('/tasks', { title: 'Zu viele Items', checklist: zuViele });
		assert.equal(res.status, 400);
		const body = (await res.json()) as { message: string };
		assert.match(body.message, /höchstens 50/, 'die Meldung muss das neue Limit 50 nennen');
	});

	it('AC5/T7: bestehender Task liefert checklist: [] (Backward-Kompatibilität)', async () => {
		const id = await createTask({ title: 'Alt-Task' });
		const res = await get(`/tasks/${id}`);
		assert.equal(res.status, 200);
		const task = (await res.json()) as { checklist: unknown[] };
		assert.deepEqual(task.checklist, []);
	});

	it('AC3: GET /tasks (Liste) liefert je Task ein checklist-Feld', async () => {
		await createTask({ title: 'Listen-Task' });
		const res = await get('/tasks');
		assert.equal(res.status, 200);
		const tasks = (await res.json()) as { checklist: unknown[] }[];
		assert.ok(tasks.length > 0);
		for (const task of tasks) {
			assert.ok(Array.isArray(task.checklist), 'jeder Task braucht ein checklist-Array');
		}
	});

	// ── #2467 — Checklisten-Done-Guard (Spec docs/spec/issue-2467.md) ────────────────────

	it('#2467/AK1: PATCH Done mit offenem gespeicherten Checkpunkt → 409, Status und Checkliste unverändert', async () => {
		const id = await createTask({
			title: 'Offene Liste',
			checklist: [
				{ id: UUID, title: 'Offen', completed: false },
				{ id: UUID_2, title: 'Erledigt', completed: true },
			],
		});
		const res = await patch(`/tasks/${id}`, { status: 'Done' });
		assert.equal(res.status, 409, 'Erledigen mit offenem Checkpunkt muss abgelehnt werden');
		const body = (await res.json()) as { message: string };
		assert.match(body.message, /offen/i, 'die Meldung muss den offenen Checkpunkt benennen');
		const after = await get(`/tasks/${id}`);
		assert.equal(after.status, 200);
		const task = (await after.json()) as { status: string; checklist: { completed: boolean }[] };
		assert.notEqual(task.status, 'Done', 'der Status darf nicht auf Done gewechselt sein');
		assert.equal(task.checklist[0].completed, false, 'die Checkliste darf nicht verändert sein');
	});

	it('#2467/AK1: PATCH Done mit im selben Request mitgesendeter offener Checkliste → 409', async () => {
		const id = await createTask({ title: 'Kombiniert offen' });
		const res = await patch(`/tasks/${id}`, {
			status: 'Done',
			checklist: [{ id: UUID, title: 'Noch offen', completed: false }],
		});
		assert.equal(res.status, 409, 'auch die mitgesendete offene Liste muss die Ablehnung auslösen');
		const body = (await res.json()) as { message: string };
		assert.match(body.message, /offen/i);
	});

	it('#2467/AK2: ohne Checkliste und mit abgehakter Checkliste bleibt Done möglich, Reopen ungefragt', async () => {
		const ohneId = await createTask({ title: 'Ohne Liste' });
		const resOhne = await patch(`/tasks/${ohneId}`, { status: 'Done' });
		assert.equal(resOhne.status, 200, 'Done ohne Checkliste darf nicht blockiert werden');

		const mitId = await createTask({
			title: 'Fertige Liste',
			checklist: [{ id: UUID, title: 'Erledigt', completed: true }],
		});
		const resMit = await patch(`/tasks/${mitId}`, { status: 'Done' });
		assert.equal(resMit.status, 200, 'Done mit vollständig abgehakter Checkliste darf nicht blockiert werden');

		const offenId = await createTask({
			title: 'Reopen ohne Prüfung',
			checklist: [{ id: UUID, title: 'Offen', completed: false }],
		});
		const reopen = await patch(`/tasks/${offenId}`, { status: 'Open' });
		assert.equal(reopen.status, 200, 'Reopen bleibt ohne Prüfung möglich');
	});

	it('#2467/AK4: PATCH {status: Done, checklist: alle completed} in einem Request → 200, Liste übernommen', async () => {
		const id = await createTask({
			title: 'Im Dialog erledigt',
			checklist: [{ id: UUID, title: 'Erster', completed: false }],
		});
		const neueListe = [
			{ id: UUID, title: 'Erster', completed: true },
			{ id: UUID_2, title: 'Zweiter', completed: true },
		];
		const res = await patch(`/tasks/${id}`, { status: 'Done', checklist: neueListe });
		assert.equal(res.status, 200, 'Done plus abgehakte Liste im selben Request muss gelingen');
		const updated = (await res.json()) as { status: string; checklist: typeof neueListe };
		assert.equal(updated.status, 'Done');
		assert.deepEqual(updated.checklist, neueListe);
	});
});
