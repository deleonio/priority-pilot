import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1964 (Spec docs/spec/issue-1964.md) — Verpasst-Auswahl,
 * Verschiebe-Zähler und Archivieren.
 *
 * AK1: `GET /tasks?missed=1` liefert genau die überfälligen offenen Tasks OHNE
 *   Auto-Löschen-Häkchen (mit Häkchen laufen weiter über den 3-Tage-Cron); nicht Überfällige,
 *   Done- und archivierte Tasks erscheinen nie.
 * AK3: `PATCH /tasks/:id` mit späterer Deadline inkrementiert `postponeCount` auf 1, zweites
 *   Verschieben auf 2; ein Patch ohne Deadline-Verlängerung zählt nicht.
 * AK4: `POST /tasks/:id/archive` setzt `archivedAt` ohne Statuswechsel; die archivierte Aufgabe
 *   fehlt in Standardliste und Verpasst-Auswahl, `GET /tasks/:id` liefert sie weiter.
 * AK5 ist Regression (bestehende Auto-Lösch-Tests bleiben grün) — hier bewusst kein Test.
 *
 * Rot, bis Modell (`postponeCount`/`archivedAt`), `?missed=1`-Filter, PATCH-Inkrement und
 * Archiv-Aktion existieren. KEIN Produktivcode.
 *
 * #2427 (Verpasst-Grenze, docs/spec/issue-2427.md): die beiden Tests am Ende sichern, dass eine
 * Deadline erst ab dem Folgetag als verpasst zählt.
 */

applyTestAuthEnv('test-secret-issue-1964');

const DAY = 24 * 60 * 60 * 1000;

let server: TestServer;
let run = 0;

describe('Verpasst-Bereich (#1964)', () => {
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
		return server.register(`missed-${run}@example.com`);
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

	const list = async (cookie: string, query = ''): Promise<{ id: number }[]> => {
		const res = await fetch(`${server.baseUrl}/tasks${query}`, { headers: { Cookie: cookie } });
		assert.ok(res.ok, `GET /tasks${query} muss gelingen (ist ${res.status})`);
		return (await res.json()) as { id: number }[];
	};

	it('AK1 — Verpasst-Auswahl: ohne Häkchen drin, mit Häkchen/nicht überfällig/Done draußen', async () => {
		const cookie = await auth();
		const past = new Date(Date.now() - DAY).toISOString();
		const future = new Date(Date.now() + DAY).toISOString();
		const keep = await createTask(cookie, { title: 'Verpasst ohne Häkchen', deadline: past });
		const noCheck = await patchTask(cookie, keep.id, { autoDeleteAfterDeadline: false });
		assert.equal(noCheck.autoDeleteAfterDeadline, false);
		const auto = await createTask(cookie, { title: 'Läuft in den 3-Tage-Cron', deadline: past });
		await patchTask(cookie, auto.id, { autoDeleteAfterDeadline: true });
		const open = await createTask(cookie, { title: 'Noch nicht fällig', deadline: future });
		const done = await createTask(cookie, { title: 'Erledigt', deadline: past });
		await patchTask(cookie, done.id, { status: 'Done' });

		const missed = await list(cookie, '?missed=1');
		assert.deepEqual(
			missed.map((t) => t.id),
			[keep.id],
			'Verpasst-Auswahl: genau die überfällige offene Aufgabe ohne Häkchen',
		);
		void open;
	});

	it('AK3 — Verschiebung nach hinten inkrementiert postponeCount (1, dann 2); sonstiger Patch nicht', async () => {
		const cookie = await auth();
		const now = Date.now();
		const task = await createTask(cookie, { title: 'Zähler', deadline: new Date(now + DAY).toISOString() });

		let after = await patchTask(cookie, task.id, { deadline: new Date(now + 2 * DAY).toISOString() });
		assert.equal(after.postponeCount, 1, 'erste Verschiebung nach hinten → Zähler 1');

		after = await patchTask(cookie, task.id, { deadline: new Date(now + 3 * DAY).toISOString() });
		assert.equal(after.postponeCount, 2, 'zweite Verschiebung nach hinten → Zähler 2');

		after = await patchTask(cookie, task.id, { title: 'Zähler umbenannt' });
		assert.equal(after.postponeCount, 2, 'Patch ohne Deadline-Verlängerung ändert den Zähler nicht');
	});

	it('AK4 — Archivieren: raus aus Liste/Verpasst, GET by id behält archivedAt, Status unverändert', async () => {
		const cookie = await auth();
		const task = await createTask(cookie, {
			title: 'Archiv-Kandidat',
			deadline: new Date(Date.now() - DAY).toISOString(),
		});

		const res = await fetch(`${server.baseUrl}/tasks/${task.id}/archive`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		assert.ok(res.ok, `POST /tasks/${task.id}/archive muss gelingen (ist ${res.status})`);
		const archived = (await res.json()) as Record<string, unknown>;
		assert.ok(archived.archivedAt, 'Archiv-Aktion setzt archivedAt');
		assert.equal(archived.status, 'Open', 'Archivieren ist kein Statuswechsel');

		const all = await list(cookie);
		assert.ok(!all.some((t) => t.id === task.id), 'archivierte Aufgabe fehlt in der Standardliste');
		const missed = await list(cookie, '?missed=1');
		assert.ok(!missed.some((t) => t.id === task.id), 'archivierte Aufgabe fehlt in der Verpasst-Auswahl');

		const direct = await fetch(`${server.baseUrl}/tasks/${task.id}`, { headers: { Cookie: cookie } });
		assert.ok(direct.ok, 'archivierte Aufgabe ist nicht gelöscht — GET by id muss liefern');
		const dto = (await direct.json()) as Record<string, unknown>;
		assert.ok(dto.archivedAt, 'GET by id liefert archivedAt weiter');
	});

	it('Archiv-Ansicht: ?archived=1 liefert nur Archiviertes, unarchive bringt die Aufgabe zurück', async () => {
		const cookie = await auth();
		const task = await createTask(cookie, { title: 'Archiv-Ansicht' });
		await createTask(cookie, { title: 'Bleibt in der Liste' });
		await fetch(`${server.baseUrl}/tasks/${task.id}/archive`, { method: 'POST', headers: { Cookie: cookie } });

		const archived = await list(cookie, '?archived=1');
		assert.deepEqual(
			archived.map((t) => t.id),
			[task.id],
		);

		const res = await fetch(`${server.baseUrl}/tasks/${task.id}/unarchive`, {
			method: 'POST',
			headers: { Cookie: cookie },
		});
		assert.ok(res.ok, `POST /tasks/${task.id}/unarchive muss gelingen (ist ${res.status})`);
		assert.equal(((await res.json()) as { archivedAt: unknown }).archivedAt, null);
		assert.deepEqual(await list(cookie, '?archived=1'), []);
		assert.ok(
			(await list(cookie)).some((t) => t.id === task.id),
			'wiederhergestellte Aufgabe steht wieder in der Liste',
		);
	});

	it('Erledigt mit completedAt = Deadline bucht pünktlich zum Zeitpunkt der Deadline; Zukunft wird abgelehnt', async () => {
		const cookie = await auth();
		const deadline = new Date(Date.now() - DAY).toISOString();
		const task = await createTask(cookie, { title: 'Pünktlich nachgetragen', deadline });

		const future = await fetch(`${server.baseUrl}/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'Done', completedAt: new Date(Date.now() + DAY).toISOString() }),
		});
		assert.equal(future.status, 400, 'ein Erledigt-Zeitpunkt in der Zukunft ist ungültig');

		await patchTask(cookie, task.id, { status: 'Done', completedAt: deadline });
		const entry = await ScoreEntry.findOne({ where: { taskId: task.id } });
		assert.ok(entry, 'Erledigen vergibt einen ScoreEntry');
		assert.equal(entry.pünktlich, true);
		assert.equal(entry.zeitpunkt.toISOString(), deadline);
	});

	it('#2427 AK1 — Deadline heute (00:00 UTC) ist nicht verpasst, egal wann abgerufen wird', async () => {
		const cookie = await auth();
		const today = new Date().toISOString().slice(0, 10); // heutiger UTC-Tag → 00:00 UTC
		const task = await createTask(cookie, { title: 'Heute fällig', deadline: today });

		const missed = await list(cookie, '?missed=1');
		assert.ok(!missed.some((t) => t.id === task.id), 'Deadline heute zählt erst ab dem Folgetag als verpasst');
	});

	it('#2427 AK2 — Deadline gestern erscheint in der Verpasst-Auswahl', async () => {
		const cookie = await auth();
		const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
		const task = await createTask(cookie, { title: 'Gestern fällig', deadline: yesterday });

		const missed = await list(cookie, '?missed=1');
		assert.ok(
			missed.some((t) => t.id === task.id),
			'Deadline gestern ist verpasst',
		);
	});
});
