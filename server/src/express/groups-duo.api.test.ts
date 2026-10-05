import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { ScoreEntry } from '../models/index.js';

// ROTE Spec-Tests (#1974, docs/spec/issue-1974.md, AK1-AK6): `kind`, Duo-Limit und GET /groups/:id/duo fehlen noch.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('groups-duo-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

type GroupDto = { id: number; kind?: string };

describe('Duo (#1974)', () => {
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

	const createGroup = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		post(cookie, '/groups', { name: 'Wir zwei', ...body });

	const userId = async (cookie: string, name: string): Promise<number> => {
		const hits = (await (await get(cookie, `/users/search?query=${encodeURIComponent(name)}`)).json()) as {
			id: number;
			displayName: string;
		}[];
		const id = hits.find((h) => h.displayName === name)?.id;
		assert.ok(id, `Setup: ${name} muss auffindbar sein`);
		return id;
	};

	/** Einladung durch den Admin und Annahme; liefert die Antwort der Annahme. */
	const inviteAndAccept = async (admin: string, member: string, groupId: number, name: string): Promise<Response> => {
		const res = await post(admin, `/groups/${groupId}/invitations`, { userId: await userId(member, name) });
		if (res.status !== 201) return res;
		const received = (await (await get(member, '/invitations')).json()) as { id: number; groupId: number }[];
		const inv = received.find((e) => e.groupId === groupId);
		assert.ok(inv, 'Setup: Einladung sichtbar');
		return post(member, `/invitations/${inv.id}/accept`);
	};

	const duoOf = async (alice: string, bob: string): Promise<number> => {
		const group = (await (await createGroup(alice, { kind: 'duo' })).json()) as GroupDto;
		assert.equal((await inviteAndAccept(alice, bob, group.id, 'Bob')).status, 200, 'Setup: Bob tritt dem Duo bei');
		return group.id;
	};

	it('AK1: kind duo / default group / ungueltig → 400', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const duo = await createGroup(alice, { kind: 'duo' });
		assert.equal(duo.status, 201);
		assert.equal(((await duo.json()) as GroupDto).kind, 'duo');
		const normal = await createGroup(alice, {});
		assert.equal(((await normal.json()) as GroupDto).kind, 'group');
		assert.equal((await createGroup(alice, { kind: 'trio' })).status, 400);
	});

	it('AK2: dritte Annahme und neue Einladung in volles Duo → 409', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const carol = await server.login(CAROL, { displayName: 'Carol' });
		const groupId = await duoOf(alice, bob);
		const res = await post(alice, `/groups/${groupId}/invitations`, { userId: await userId(carol, 'Carol') });
		assert.equal(res.status, 409);
		const members = (await (await get(alice, `/groups/${groupId}/members`)).json()) as unknown[];
		assert.equal(members.length, 2);
	});

	it('AK2: Einladungslink in volles Duo → 409', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const carol = await server.login(CAROL, { displayName: 'Carol' });
		const groupId = await duoOf(alice, bob);
		const link = (await (await post(alice, `/groups/${groupId}/invite-links`)).json()) as { token: string };
		assert.equal((await post(carol, `/invite-links/${link.token}/redeem`)).status, 409);
	});

	it('AK3/AK4: Streak nur aus gemeinsamen Tagen, Mitglieder nur mit Saeulenwerten', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const groupId = await duoOf(alice, bob);
		const complete = async (cookie: string, title: string): Promise<number> => {
			const t = (await (await post(cookie, '/tasks', { title, priority: 3, estimatedEffort: 1 })).json()) as {
				id: number;
			};
			const done = await fetch(`${server.baseUrl}/tasks/${t.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', cookie },
				body: JSON.stringify({ status: 'Done' }),
			});
			assert.equal(done.status, 200);
			return t.id;
		};
		const aliceTask = await complete(alice, 'Alice heute');
		let res = await get(alice, `/groups/${groupId}/duo?tz=UTC`);
		assert.equal(res.status, 200);
		let body = (await res.json()) as { streak: { aktuell: number; best: number } };
		assert.equal(body.streak.aktuell, 0, 'nur Alice erledigt → zaehlt nicht');
		await complete(bob, 'Bob heute');
		res = await get(alice, `/groups/${groupId}/duo?tz=UTC`);
		body = (await res.json()) as typeof body;
		assert.equal(body.streak.aktuell, 1, 'beide erledigt → 1');
		assert.ok(aliceTask > 0 && (await ScoreEntry.count()) === 2);
		const dto = body as unknown as { members: Record<string, unknown>[] };
		assert.equal(dto.members.length, 2);
		for (const m of dto.members) {
			assert.deepEqual(Object.keys(m).sort(), ['name', 'saeulen', 'userId']);
			for (const s of m.saeulen as Record<string, unknown>[]) {
				assert.deepEqual(Object.keys(s).sort(), ['name', 'pillarId', 'wert']);
			}
		}
	});

	it('AK5: Freigabe an Duo → 400; /tasks und /series leer', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const groupId = await duoOf(alice, bob);
		const res = await post(alice, '/tasks', { title: 'Geteilt', priority: 3, estimatedEffort: 1, groupId });
		assert.equal(res.status, 400);
		for (const path of ['tasks', 'series']) {
			const list = await get(bob, `/groups/${groupId}/${path}`);
			assert.equal(list.status, 200);
			assert.deepEqual(await list.json(), []);
		}
	});

	it('AK6: Nicht-Mitglied und normale Gruppe → 404 auf /duo', async () => {
		const alice = await server.login(ALICE, { displayName: 'Alice' });
		const bob = await server.login(BOB, { displayName: 'Bob' });
		const carol = await server.login(CAROL, { displayName: 'Carol' });
		const duoId = await duoOf(alice, bob);
		assert.equal((await get(bob, `/groups/${duoId}/duo`)).status, 200, 'Mitglied sieht das Duo');
		assert.equal((await get(carol, `/groups/${duoId}/duo`)).status, 404);
		const normal = (await (await createGroup(alice, {})).json()) as GroupDto;
		assert.equal((await get(alice, `/groups/${normal.id}/duo`)).status, 404);
	});
});
