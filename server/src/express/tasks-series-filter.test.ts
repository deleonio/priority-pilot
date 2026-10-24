import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Series, Task, User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #2942 (Spec docs/spec/issue-2942.md, AK1) — Instanzlisten-Filter am
 * vorhandenen `GET /tasks` (Container-Entscheidung zu #2937: kein neuer Endpunkt).
 *
 * AK1: `GET /tasks?seriesId=<id>` bzw. `?originSeriesId=<id>` liefert ALLE Instanzen im
 *   Lese-Scope des Nutzers — inklusive erledigter und archivierter (der übliche
 *   Archiv-Ausschluss gilt in Kombination mit diesen Parametern nicht) und inklusive
 *   abgekoppelter Instanzen (`seriesId` null, `originSeriesId` erhalten) bei `originSeriesId`.
 *   Fremde Serie → leere Liste; Aufruf ohne Parameter bleibt unverändert.
 *
 * Rot, bis die Query-Filter `seriesId`/`originSeriesId` in `createTasksRouter` existieren
 * (bis dahin werden unbekannte Query-Parameter ignoriert → Archiv/Scope-Assertions laufen
 * ins Leere). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-2942');

let server: TestServer;
let run = 0;

/** UTC-Mitternacht `offsetDays` Tage relativ zu heute (Muster series-instances.api.test.ts). */
const futureDate = (offsetDays: number): Date => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offsetDays);
	result.setUTCHours(0, 0, 0, 0);
	return result;
};

describe('GET /tasks Instanz-Filter seriesId/originSeriesId (#2942 AK1)', () => {
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

	const register = async (label: string): Promise<{ cookie: string; userId: number }> => {
		const cookie = await server.register(`series-filter-${label}-${(run += 1)}@example.com`);
		const user = await User.findOne({ where: { email: `series-filter-${label}-${run}@example.com` } });
		assert.ok(user, 'Setup: Konto muss existieren');
		return { cookie, userId: user.id };
	};

	const listIds = async (cookie: string, query: string): Promise<number[]> => {
		const res = await fetch(`${server.baseUrl}/tasks${query}`, { headers: { Cookie: cookie } });
		assert.ok(res.ok, `GET /tasks${query} muss gelingen (ist ${res.status})`);
		return ((await res.json()) as { id: number }[]).map((t) => t.id);
	};

	const createInstance = async (cookie: string, seriesId: number, title: string): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/series/${seriesId}/instances`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ title }),
		});
		assert.equal(res.status, 201, `Instanz-Anlage muss 201 liefern (${title})`);
		return ((await res.json()) as { id: number }).id;
	};

	const patchTask = async (cookie: string, id: number, body: Record<string, unknown>): Promise<void> => {
		const res = await fetch(`${server.baseUrl}/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
		assert.ok(res.ok, `PATCH /tasks/${id} muss gelingen (ist ${res.status})`);
	};

	it('AK1 — ?seriesId/?originSeriesId liefern offene, erledigte, archivierte und abgekoppelte Instanzen', async () => {
		const { cookie, userId } = await register('main');
		const series = await Series.create({
			title: 'Wochenputz',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 1,
			active: true,
			startDate: futureDate(29),
			autoCreate: true,
			userId,
			createdById: userId,
		});

		const open = await createInstance(cookie, series.id, 'Instanz offen');
		const done = await createInstance(cookie, series.id, 'Instanz erledigt');
		await patchTask(cookie, done, { status: 'Done' });
		const archived = await createInstance(cookie, series.id, 'Instanz archiviert');
		await fetch(`${server.baseUrl}/tasks/${archived}/archive`, { method: 'POST', headers: { Cookie: cookie } });
		// Abgekoppelt (#553): Live-Link `seriesId` fällt auf null, Herkunft `originSeriesId` bleibt.
		const decoupled = await Task.create({
			title: 'Abgekoppelte Instanz',
			priority: 3,
			deadline: futureDate(5),
			seriesId: null,
			originSeriesId: series.id,
			userId,
			createdById: userId,
		});

		const bySeries = await listIds(cookie, `?seriesId=${series.id}`);
		assert.deepEqual(
			bySeries.sort((a, b) => a - b),
			[open, done, archived].sort((a, b) => a - b),
			'?seriesId: offene + erledigte + archivierte Instanz, ohne abgekoppelte',
		);

		const byOrigin = await listIds(cookie, `?originSeriesId=${series.id}`);
		assert.deepEqual(
			byOrigin.sort((a, b) => a - b),
			[open, done, archived, decoupled.id].sort((a, b) => a - b),
			'?originSeriesId: zusätzlich auch die abgekoppelte Instanz (Provenienz)',
		);
	});

	it('AK1 — fremde Serie → leere Liste; Aufruf ohne Parameter unverändert', async () => {
		const alice = await register('alice');
		const series = await Series.create({
			title: 'Allices Serie',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 1,
			active: true,
			startDate: futureDate(29),
			autoCreate: true,
			userId: alice.userId,
			createdById: alice.userId,
		});
		const own = await createInstance(alice.cookie, series.id, 'Allices Instanz');

		const bob = await register('bob');
		assert.deepEqual(
			await listIds(bob.cookie, `?seriesId=${series.id}`),
			[],
			'fremde Serie: Lese-Scope schließt fremde Instanzen aus',
		);
		assert.deepEqual(await listIds(bob.cookie, `?originSeriesId=${series.id}`), [], 'dito für originSeriesId');

		// Ohne Parameter bleibt das Verhalten unverändert: bob sieht seine (leere) Liste,
		// alice ihre offene Instanz — nicht aber die archivierte aus dem anderen Test.
		assert.deepEqual(await listIds(bob.cookie, ''), []);
		const plain = await listIds(alice.cookie, '');
		assert.ok(plain.includes(own), 'ohne Parameter: offene Instanz bleibt sichtbar (unverändert)');
	});
});
