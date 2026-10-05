import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTE Spec-Tests (#2244, docs/spec/issue-2244.md) — „Kurz zurückstellen" der Vorschlagskarte.
 *
 * Vertrag: `POST /tasks/:id/snooze` setzt serverseitig `snoozedUntil = jetzt + 3 h`; `ladeFreieTasks`
 * (`logics/find.ts`) blendet solche Aufgaben in `GET /next` und `GET /suggestions` bis zum Ablauf aus.
 * `postponeCount` und die Bewertung bleiben unberührt. Rot, bis Route, Spalte und Filter existieren.
 */
describe('#2244 — Aufgabe kurz zurückstellen (Server)', () => {
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

	const snooze = (id: number, headers: Record<string, string> = {}) =>
		fetch(`${server.baseUrl}/tasks/${id}/snooze`, { method: 'POST', headers });
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	type Scored = { id: number; postponeCount?: number; scoreBreakdown?: { total: number } };
	const nextTask = async () => (await (await get('/next')).json()) as Scored | null;
	const suggestionIds = async () =>
		((await (await get('/suggestions')).json()) as Array<{ id: number }>).map((t) => t.id);

	it('AK1/AK2: Snooze setzt jetzt + 3 h; /next und /suggestions blenden die Aufgabe aus', async () => {
		const rang1 = await Task.create({ title: 'Rang 1', priority: 5, estimatedEffort: 1 });
		const rang2 = await Task.create({ title: 'Rang 2', priority: 2, estimatedEffort: 1 });
		assert.equal((await nextTask())?.id, rang1.id, 'Vorbedingung: Rang 1 führt');

		const before = Date.now();
		const res = await snooze(rang1.id);
		assert.ok(res.status >= 200 && res.status < 300, `Snooze muss 2xx liefern, war ${res.status}`);

		const row = await Task.findByPk(rang1.id);
		const until = (row as unknown as { snoozedUntil: Date | null }).snoozedUntil;
		assert.ok(until, 'snoozedUntil wurde gesetzt');
		const hours = (until.getTime() - before) / 3_600_000;
		assert.ok(hours > 2.99 && hours < 3.01, `Frist ist 3 h (war ${hours} h)`);

		assert.equal((await nextTask())?.id, rang2.id, '/next liefert die andere Aufgabe');
		assert.deepEqual(await suggestionIds(), [rang2.id], '/suggestions ohne die zurückgestellte Aufgabe');
	});

	it('AK2: abgelaufene Frist — Aufgabe wird wieder vorgeschlagen', async () => {
		const rang1 = await Task.create({ title: 'Rang 1', priority: 5, estimatedEffort: 1 });
		await Task.create({ title: 'Rang 2', priority: 2, estimatedEffort: 1 });
		assert.equal((await snooze(rang1.id)).status, 200, 'Snooze akzeptiert');

		// Statisches Update: `instance.update` verwirft Auto-Timestamps still, hier nur zur Sicherheit gleich.
		await Task.update({ snoozedUntil: new Date(Date.now() - 1000) } as never, { where: { id: rang1.id } });

		assert.equal((await nextTask())?.id, rang1.id, 'nach Ablauf wieder Rang 1');
		assert.ok((await suggestionIds()).includes(rang1.id));
	});

	it('AK3: postponeCount bleibt 0, Score nach Ablauf = Score vor dem Snooze', async () => {
		const rang1 = await Task.create({ title: 'Rang 1', priority: 5, estimatedEffort: 1 });
		await Task.create({ title: 'Rang 2', priority: 2, estimatedEffort: 1 });
		const scoreVorher = (await nextTask())?.scoreBreakdown?.total;
		assert.ok(scoreVorher !== undefined, 'Vorbedingung: Score lesbar');

		assert.equal((await snooze(rang1.id)).status, 200, 'Snooze akzeptiert');
		const row = await Task.findByPk(rang1.id);
		assert.equal(row?.postponeCount, 0, 'Snooze zählt nicht als Verschieben');

		await Task.update({ snoozedUntil: new Date(Date.now() - 1000) } as never, { where: { id: rang1.id } });
		const danach = await nextTask();
		assert.equal(danach?.id, rang1.id);
		assert.equal(danach?.postponeCount, 0);
		assert.equal(danach?.scoreBreakdown?.total, scoreVorher, 'Bewertung unverändert');
	});

	it('AK4: einzige freie Aufgabe zurückgestellt — /next liefert null', async () => {
		const einzige = await Task.create({ title: 'Einzige', priority: 5, estimatedEffort: 1 });
		const res = await snooze(einzige.id);
		assert.ok(res.status >= 200 && res.status < 300, `Snooze muss 2xx liefern, war ${res.status}`);

		assert.equal(await nextTask(), null);
	});

	it('AK5: nicht existierende oder fremde Aufgabe → 404, nichts verändert', async () => {
		assert.equal((await snooze(999_999)).status, 404, 'unbekannte ID');

		const cookieA = await server.login('snooze-a@example.test');
		const cookieB = await server.login('snooze-b@example.test');
		const created = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookieA },
			body: JSON.stringify({ title: 'Fremd', priority: 3, estimatedEffort: 1 }),
		});
		const { id } = (await created.json()) as { id: number };

		assert.equal((await snooze(id, { Cookie: cookieA })).status, 200, 'Positivkontrolle: Eigentümer darf');
		await Task.update({ snoozedUntil: null } as never, { where: { id } });
		assert.equal((await snooze(id, { Cookie: cookieB })).status, 404, 'fremde Aufgabe');
		const row = await Task.findByPk(id);
		assert.equal((row as unknown as { snoozedUntil: Date | null }).snoozedUntil ?? null, null, 'unverändert');
	});
});
