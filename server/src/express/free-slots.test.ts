import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { CalendarEvent, CalendarSource, User } from '../models/index.js';

/**
 * Spec-Tests für #1990 (Spec docs/spec/issue-1990.md) — AK3 (Einstellung pro Nutzer, Validierung,
 * Datenisolation) und AK4 (ohne Kalenderquelle 200 + leere Liste). Muster: geo-config.test.ts.
 * #2686 (Spec docs/spec/issue-2686.md): Fehler beim Laden von /tasks/free-slots erzeugt genau einen
 * console.error mit Ursache (AK1), der Leerfall loggt nichts (AK2). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1990');

let server: TestServer;

const getConfig = (cookie: string): Promise<Response> =>
	server.json('/free-slot-config', { headers: { Cookie: cookie } });
const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/free-slot-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

/** console.error-Spy (Muster feedback.test.ts) — restore im finally Pflicht. */
const spyConsoleError = (): { calls: unknown[][]; restore: () => void } => {
	const calls: unknown[][] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => {
		calls.push(args);
	};
	return {
		calls,
		restore: () => {
			console.error = original;
		},
	};
};

describe('Freie Zeit (#1990)', () => {
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

	it('AK3: ohne Session → 401', async () => {
		assert.equal((await getConfig('cookie=none')).status, 401);
	});

	it('AK3: GET liefert Default 30, PUT speichert, GET liefert den gespeicherten Wert', async () => {
		const cookie = await server.register('free-slot-put@example.com', 'password123');
		assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 30 });
		assert.equal((await putConfig(cookie, { freeSlotMinMinutes: 45 })).status, 200);
		assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 45 });
	});

	for (const [label, value] of [
		['unter 10', 9],
		['über 240', 241],
		['nicht ganzzahlig', 30.5],
		['kein Number', '30'],
	] as const) {
		it(`AK3: PUT weist ${label} ab (400), nichts wird gespeichert`, async () => {
			const cookie = await server.register(`free-slot-bad-${label.replace(/\W/g, '')}@example.com`);
			assert.equal((await putConfig(cookie, { freeSlotMinMinutes: value })).status, 400);
			assert.deepEqual(await (await getConfig(cookie)).json(), { freeSlotMinMinutes: 30 });
		});
	}

	it('AK3: Dataisolation — B sieht nicht den Wert von A', async () => {
		const a = await server.register('free-slot-a@example.com', 'password123');
		const b = await server.register('free-slot-b@example.com', 'password123');
		await putConfig(a, { freeSlotMinMinutes: 120 });
		assert.deepEqual(await (await getConfig(b)).json(), { freeSlotMinMinutes: 30 });
	});

	it('AK4+AK2: ohne Kalenderquelle liefert GET /tasks/free-slots 200 und [] — ohne Log', async () => {
		const cookie = await server.register('free-slot-empty@example.com', 'password123');
		const { calls, restore } = spyConsoleError();
		try {
			const res = await server.json('/tasks/free-slots', { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
			assert.equal(calls.length, 0, 'Der Leerfall (keine Kalenderquelle) loggt nichts (#2686 AK2)');
		} finally {
			restore();
		}
	});

	it('AK1 (#2686): Fehler beim Laden → genau ein console.error mit Ursache, Antwort bleibt 200 und []', async () => {
		const cookie = await server.register('free-slot-err@example.com', 'password123');
		const user = await User.findOne({ where: { email: 'free-slot-err@example.com' } });
		await CalendarSource.create({
			userId: user!.id,
			name: 'ICS',
			type: 'ics',
			url: 'https://example.com/kalender-2686.ics',
		});
		const originalFindAll = CalendarEvent.findAll;
		CalendarEvent.findAll = async () => {
			throw new Error('kalender-2686');
		};
		const { calls, restore } = spyConsoleError();
		try {
			const res = await server.json('/tasks/free-slots', { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
			assert.equal(calls.length, 1, `Genau eine Logzeile, erhalten ${calls.length}`);
			assert.ok(
				calls[0].some((arg) => arg instanceof Error && arg.message === 'kalender-2686'),
				'Die Fehlerursache (Error-Objekt) ist als Argument geloggt',
			);
		} finally {
			restore();
			CalendarEvent.findAll = originalFindAll;
		}
	});
});
