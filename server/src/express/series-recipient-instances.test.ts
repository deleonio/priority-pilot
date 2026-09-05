import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1222 — Instanz-Eigentümer und Schreib-Isolation
 * (Vertrag: docs/spec/issue-1222.md, TF4 + TF6 für AK4 + AK6).
 *
 * AK4: Aus einer Empfänger-Serie erzeugte Aufgaben tragen dieselbe `userId` wie die Serie —
 * über `/series/generate-all` UND `/series/:id/generate`. Kernstelle: `logics/series.ts`
 * (`generateDueInstances`) setzt die Instanz-`userId` aktuell auf `options.userId ?? null`
 * statt auf `series.userId` zu defaulten.
 *
 * AK6: PATCH/DELETE des Erstellers auf der fremden Serie → 404 (Schreib-Scope bleibt
 * ownerScope; sonst könnte der Ersteller über `?cascade=true` fremde Aufgaben löschen).
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('series-recipient-instances-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

let server: TestServer;

describe('Empfänger-Serie: Instanz-Eigentümer und Schreib-Isolation (#1222)', () => {
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

	const seedSharedGroup = async (): Promise<void> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		const group = await Group.create({ name: 'Instanz-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	const userIdOf = async (email: string): Promise<number> => {
		const user = await User.findOne({ where: { email } });
		assert.ok(user, `Setup: Konto ${email} muss existieren`);
		return user.id;
	};

	/** Alice legt eine fällige Serie für Bob an und liefert die Serien-ID. */
	const createSeriesForBob = async (): Promise<number> => {
		const res = await fetch(`${server.baseUrl}/series`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: await server.login(ALICE) },
			body: JSON.stringify({
				title: 'Bobs fällige Routine',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2026-01-05T00:00:00.000Z',
				userId: await userIdOf(BOB),
			}),
		});
		assert.equal(res.status, 201, 'Setup: Empfänger-Serie muss anlegbar sein');
		return ((await res.json()) as { id: number }).id;
	};

	const tasksOf = async (
		cookie: string,
	): Promise<Array<{ id: number; userId: number | null; seriesId: number | null }>> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200);
		return (await res.json()) as Array<{ id: number; userId: number | null; seriesId: number | null }>;
	};

	it('generate-all: Instanzen tragen die userId der Serie (Empfänger), nicht null (AK4, TF4)', async () => {
		await seedSharedGroup();
		const seriesId = await createSeriesForBob();
		const bobId = await userIdOf(BOB);

		// Empfänger stößt den Sammel-Lauf an (er ist Eigentümer der Serie).
		const genRes = await fetch(`${server.baseUrl}/series/generate-all`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: await server.login(BOB) },
			body: JSON.stringify({}),
		});
		assert.equal(genRes.status, 200, 'generate-all muss 200 liefern');
		const { created } = (await genRes.json()) as { created: number };
		assert.ok(created > 0, 'die fällige Empfänger-Serie muss Instanzen erzeugen');

		const bobTasks = await tasksOf(await server.login(BOB));
		const instances = bobTasks.filter((task) => task.seriesId === seriesId);
		assert.ok(instances.length > 0, 'der Empfänger sieht die erzeugten Instanzen');
		for (const instance of instances) {
			assert.equal(instance.userId, bobId, 'Instanz-`userId` muss der Serien-Eigentümer sein (nicht null)');
		}
	});

	it('/series/:id/generate: Instanzen tragen dieselbe userId wie die Serie (AK4, TF4)', async () => {
		await seedSharedGroup();
		const seriesId = await createSeriesForBob();
		const bobId = await userIdOf(BOB);

		const genRes = await fetch(`${server.baseUrl}/series/${seriesId}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: await server.login(BOB) },
			body: JSON.stringify({ until: '2026-03-01T00:00:00.000Z' }),
		});
		assert.equal(genRes.status, 201, 'Empfänger kann seine Serie generieren');

		const generated = (await genRes.json()) as Array<{ id: number }>;
		assert.ok(generated.length > 0, 'es müssen Instanzen entstehen');
		const oracles = await Task.findAll({ where: { seriesId } });
		for (const instance of oracles) {
			assert.equal(instance.userId, bobId, 'Instanz-`userId` muss der Serien-Eigentümer sein');
		}
	});

	it('PATCH und DELETE des Erstellers auf der Empfänger-Serie → 404 (AK6, TF6)', async () => {
		await seedSharedGroup();
		const seriesId = await createSeriesForBob();
		const aliceCookie = await server.login(ALICE);

		const patchRes = await fetch(`${server.baseUrl}/series/${seriesId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
			body: JSON.stringify({ title: 'Umbau durch Ersteller' }),
		});
		assert.equal(patchRes.status, 404, 'PATCH des Nicht-Empfängers muss 404 liefern');

		const deleteRes = await fetch(`${server.baseUrl}/series/${seriesId}?cascade=true`, {
			method: 'DELETE',
			headers: { Cookie: aliceCookie },
		});
		assert.equal(deleteRes.status, 404, 'DELETE (auch kaskadierend) des Nicht-Empfängers muss 404 liefern');

		// Empfänger bleibt handlungsfähig (kein Über-Scoping).
		const ownPatch = await fetch(`${server.baseUrl}/series/${seriesId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: await server.login(BOB) },
			body: JSON.stringify({ title: 'Bobs Umbau' }),
		});
		assert.equal(ownPatch.status, 200, 'der Empfänger darf seine Serie weiter patchen');
	});
});
