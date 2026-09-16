import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1518 (Spec docs/spec/issue-1518.md, Journey 1) — `GET /tasks/nearby` listet je
 * Serie höchstens eine Instanz (AK5): bei fünf nahen Instanzen derselben Serie bleibt genau ein
 * Eintrag. Eigene Datei, weil `tasks-nearby.test.ts` (#1066) ihren Server im `after` schließt und
 * ein weiteres Top-Level-`describe` dort ohne Server liefe. KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1518');

/** Referenzposition: Berlin (Alexanderplatz) — wie in tasks-nearby.test.ts. */
const LAT = 52.5219;
const LON = 13.4132;

let server: TestServer;

const dayFromTodayUtc = (days: number): string => {
	const day = new Date();
	day.setUTCHours(0, 0, 0, 0);
	day.setUTCDate(day.getUTCDate() + days);
	return day.toISOString();
};

describe('GET /tasks/nearby — eine Instanz je Serie (#1518)', () => {
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

	const post = (cookie: string, path: string, body: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	it('AK5: fünf nahe Instanzen derselben Serie ergeben genau einen Eintrag', async () => {
		const cookie = await server.register('nearby-series@example.com', 'password123');
		const created = await post(cookie, '/series', {
			title: 'Einkaufen',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: dayFromTodayUtc(0),
			latitude: LAT + 0.004,
			longitude: LON,
		});
		assert.equal(created.status, 201);
		const series = (await created.json()) as { id: number };

		const generated = await post(cookie, `/series/${series.id}/generate`, { until: dayFromTodayUtc(4) });
		assert.equal(generated.status, 201);
		const instances = (await generated.json()) as { id: number }[];
		assert.equal(instances.length, 5, 'Setup: fünf Instanzen (heute bis heute+4)');

		const res = await fetch(`${server.baseUrl}/tasks/nearby?lat=${LAT}&lon=${LON}`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200);
		const items = (await res.json()) as { id: number; title: string }[];
		assert.equal(items.length, 1, 'je Serie höchstens ein Eintrag');
		assert.equal(items[0].title, 'Einkaufen');
	});
});
