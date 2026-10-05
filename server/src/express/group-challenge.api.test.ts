import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
// ROTER Spec-Test (#1992, docs/spec/issue-1992.md, AK1/AK2/AK4): Modell und Routen fehlen noch.
import { GroupChallenge } from '../models/index.js';

process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('group-challenge-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';
const DAY = 24 * 60 * 60 * 1000;

let server: TestServer;

describe('Gruppen-Challenge (#1992)', () => {
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

	const post = (cookie: string, path: string, body?: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	const get = (cookie: string, path: string): Promise<Response> =>
		fetch(`${server.baseUrl}${path}`, { headers: { cookie } });

	const setup = async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const carol = await server.login(CAROL, { displayName: 'Carol' });
		const group = (await (await post(alice, '/groups', { name: 'Team' })).json()) as { id: number };
		const hits = (await (await get(alice, '/users/search?query=Bob')).json()) as { id: number; displayName: string }[];
		const bobId = hits.find((h) => h.displayName === 'Bob')?.id;
		assert.ok(bobId, 'Setup: Bob auffindbar');
		assert.equal((await post(alice, `/groups/${group.id}/invitations`, { userId: bobId })).status, 201);
		const received = (await (await get(bob, '/invitations')).json()) as { id: number; groupId: number }[];
		const inv = received.find((e) => e.groupId === group.id);
		assert.ok(inv, 'Setup: Einladung sichtbar');
		assert.equal((await post(bob, `/invitations/${inv.id}/accept`)).status, 200);
		return { alice, bob, carol, groupId: group.id };
	};

	it('AK1: Start 201 mit endsAt = startsAt + 7 Tage', async () => {
		const { bob, groupId } = await setup();
		const res = await post(bob, `/groups/${groupId}/challenge`);
		assert.equal(res.status, 201);
		const dto = (await res.json()) as { startsAt: string; endsAt: string };
		assert.equal(new Date(dto.endsAt).getTime() - new Date(dto.startsAt).getTime(), 7 * DAY);
	});

	it('AK1: zweiter Start während laufender Challenge → 409', async () => {
		const { alice, bob, groupId } = await setup();
		assert.equal((await post(alice, `/groups/${groupId}/challenge`)).status, 201);
		assert.equal((await post(bob, `/groups/${groupId}/challenge`)).status, 409);
	});

	it('AK1: Nicht-Mitglied → 404 bei Start und Lesen', async () => {
		const { carol, groupId } = await setup();
		assert.equal((await post(carol, `/groups/${groupId}/challenge`)).status, 404);
		assert.equal((await get(carol, `/groups/${groupId}/challenge`)).status, 404);
	});

	it('AK2: laufend vor endsAt, beendet danach — ohne Job', async () => {
		const { alice, groupId } = await setup();
		await post(alice, `/groups/${groupId}/challenge`);
		const laufend = (await (await get(alice, `/groups/${groupId}/challenge`)).json()) as { status: string };
		assert.equal(laufend.status, 'laufend');
		await GroupChallenge.update({ endsAt: new Date(Date.now() - 1000) }, { where: { groupId } });
		const beendet = (await (await get(alice, `/groups/${groupId}/challenge`)).json()) as { status: string };
		assert.equal(beendet.status, 'beendet');
	});

	it('AK4: Rangfolge-Einträge enthalten nur name, rang, balance', async () => {
		const { alice, groupId } = await setup();
		await post(alice, `/groups/${groupId}/challenge`);
		const dto = (await (await get(alice, `/groups/${groupId}/challenge`)).json()) as {
			rangfolge: Record<string, unknown>[];
		};
		assert.equal(dto.rangfolge.length, 2);
		for (const eintrag of dto.rangfolge) assert.deepEqual(Object.keys(eintrag).sort(), ['balance', 'name', 'rang']);
	});
});
