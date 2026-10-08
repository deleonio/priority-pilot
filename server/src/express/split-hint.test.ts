import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1994 (Spec: docs/spec/issue-1994.md) — Aufteilen-Hinweis.
 * AK1–AK3: `GET /next` trägt `reasons.split` bei erkanntem Muster (>= 3 offene Aufgaben mit
 * Aufwand >= 0.6 und postponeCount >= 2), ohne Score/Auswahl zu ändern. AK4: `GET/PUT
 * /split-hint-config` (Muster `/care-config`), Schalter aus ⇒ kein `reasons.split`.
 * Rot, bis Route und Erkennung existieren.
 */

process.env.GOOGLE_ALLOWED_EMAILS =
	'split-a@example.com,split-ak1@example.com,split-ak2a@example.com,split-ak2b@example.com,split-ak2c@example.com,split-ak3@example.com,split-ak4@example.com,split-ak4b@example.com,split-b@example.com';
applyTestAuthEnv('test-secret-issue-1994');

type NextDto = {
	id: number;
	score?: number;
	scoreBreakdown?: unknown;
	reasons?: { split?: { postponeCount: number } };
};

let server: TestServer;

const getJson = (path: string, cookie: string): Promise<Response> => server.json(path, { headers: { Cookie: cookie } });

const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/split-hint-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const getNext = async (cookie: string): Promise<NextDto> => (await getJson('/next', cookie)).json() as Promise<NextDto>;

/** Legt Aufgaben des Nutzers an; Priorität 5 für die erste, damit sie in `/next` vorn liegt. */
const seed = async (
	email: string,
	specs: Array<{ effort: number; postponed: number; status?: 'open' | 'done' }>,
): Promise<number[]> => {
	const user = await User.findOne({ where: { email } });
	const ids: number[] = [];
	for (const [index, spec] of specs.entries()) {
		const task = await Task.create({
			title: `Aufgabe ${index}`,
			priority: index === 0 ? 5 : 1,
			estimatedEffort: spec.effort,
			postponeCount: spec.postponed,
			userId: user!.id,
			...(spec.status === 'done' ? { status: 'done' } : {}),
		} as never);
		ids.push(task.id);
	}
	return ids;
};

const gross = { effort: 0.8, postponed: 3 };

describe('Aufteilen-Hinweis — GET /next + /split-hint-config (#1994)', () => {
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

	it('AK1: 3 große, verschobene Aufgaben, empfohlene ist eine davon → reasons.split.postponeCount', async () => {
		const cookie = await server.login('split-ak1@example.com');
		const [erste] = await seed('split-ak1@example.com', [{ effort: 0.8, postponed: 4 }, gross, gross]);
		const next = await getNext(cookie);
		assert.equal(next.id, erste);
		assert.deepEqual(next.reasons?.split, { postponeCount: 4 });
	});

	it('AK2: nur 2 solche Aufgaben → kein reasons.split', async () => {
		const cookie = await server.login('split-ak2a@example.com');
		await seed('split-ak2a@example.com', [gross, gross, { effort: 0.8, postponed: 1 }]);
		assert.equal((await getNext(cookie)).reasons?.split, undefined);
	});

	it('AK2: empfohlene Aufgabe unter der Schwelle (Aufwand 0.5) → kein reasons.split', async () => {
		const cookie = await server.login('split-ak2b@example.com');
		await seed('split-ak2b@example.com', [{ effort: 0.5, postponed: 5 }, gross, gross, gross]);
		assert.equal((await getNext(cookie)).reasons?.split, undefined);
	});

	it('AK2: erledigte Aufgabe zählt nicht zum Muster', async () => {
		const cookie = await server.login('split-ak2c@example.com');
		await seed('split-ak2c@example.com', [gross, gross, { ...gross, status: 'done' }]);
		assert.equal((await getNext(cookie)).reasons?.split, undefined);
	});

	it('AK3: Score, Breakdown und Auswahl sind mit und ohne Hinweis identisch', async () => {
		const cookie = await server.login('split-ak3@example.com');
		await seed('split-ak3@example.com', [gross, gross, gross]);
		const mit = await getNext(cookie);
		assert.ok(mit.reasons?.split, 'Vorbedingung: Muster erkannt');
		await putConfig(cookie, { splitHintEnabled: false });
		const ohne = await getNext(cookie);
		assert.equal(ohne.id, mit.id);
		assert.equal(ohne.score, mit.score);
		assert.deepEqual(ohne.scoreBreakdown, mit.scoreBreakdown);
	});

	it('AK4: GET liefert Default true, PUT/GET-Roundtrip, Schalter aus ⇒ kein reasons.split', async () => {
		const cookie = await server.login('split-ak4@example.com');
		await seed('split-ak4@example.com', [gross, gross, gross]);
		assert.deepEqual(await (await getJson('/split-hint-config', cookie)).json(), { splitHintEnabled: true });
		assert.equal((await putConfig(cookie, { splitHintEnabled: false })).status, 200);
		assert.deepEqual(await (await getJson('/split-hint-config', cookie)).json(), { splitHintEnabled: false });
		assert.equal((await getNext(cookie)).reasons?.split, undefined);
	});

	it('AK4: Nicht-Boolean → 400 ohne Persistenz', async () => {
		const cookie = await server.login('split-ak4b@example.com');
		assert.equal((await putConfig(cookie, { splitHintEnabled: 'nein' })).status, 400);
		assert.deepEqual(await (await getJson('/split-hint-config', cookie)).json(), { splitHintEnabled: true });
	});

	it('AK4: Dataisolation — Schalter von A ändert B nicht', async () => {
		const cookieA = await server.login('split-a@example.com');
		const cookieB = await server.login('split-b@example.com');
		await putConfig(cookieA, { splitHintEnabled: false });
		assert.deepEqual(await (await getJson('/split-hint-config', cookieB)).json(), { splitHintEnabled: true });
	});
});
