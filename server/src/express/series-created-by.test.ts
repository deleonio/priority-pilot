import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Series, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1222 — Serie für ein Gruppenmitglied anlegen
 * (Vertrag: docs/spec/issue-1222.md, TF1–TF3, TF5, TF7 für AK1–AK3, AK5, AK7).
 *
 * Muster: tasks-created-by.test.ts (#1213). Rollen: Alice (Ersteller), Bob (Empfänger,
 * gemeinsame Gruppe), Carol (Drittkonto ohne gemeinsame Gruppe).
 *
 * Rot, bis POST/GET /series das optionale `userId` auswertet, die Serie `createdById` trägt
 * und das Series-DTO `createdById`, `createdByName`, `forUserId`, `forUserName` liefert.
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('series-created-by-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

/** Erwartete Series-DTO-Felder gemäß Spec #1222 (Implementierung ergänzt die Felder nullable). */
interface CreatedBySeriesDto {
	id: number;
	title: string;
	userId?: number | null;
	createdById?: number | null;
	createdByName?: string | null;
	forUserId?: number | null;
	forUserName?: string | null;
}

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Serie für ein Gruppenmitglied (#1222)', () => {
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
		await server.login(CAROL, { displayName: 'Carol Dritte' });
		const group = await Group.create({ name: 'Spec-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	const postSeries = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/series`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				active: true,
				startDate: '2030-01-07T00:00:00.000Z',
				...body,
			}),
		});

	const listSeries = async (cookie: string): Promise<CreatedBySeriesDto[]> => {
		const res = await fetch(`${server.baseUrl}/series`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /series muss 200 liefern');
		return (await res.json()) as CreatedBySeriesDto[];
	};

	// ── AK1: ohne `userId` wie bisher ────────────────────────────────────────────────

	it('POST /series ohne userId gehört dem Aufrufer, kein Für-Kennzeichen (AK1, TF1)', async () => {
		await seedSharedGroup();
		const aliceCookie = await server.login(ALICE);

		const res = await postSeries(aliceCookie, { title: 'Meine Routine' });
		assert.equal(res.status, 201, 'POST ohne userId muss weiterhin 201 liefern');
		const dto = (await res.json()) as CreatedBySeriesDto;

		assert.equal(dto.createdById, await userIdOf(ALICE), 'createdById ist das eigene Konto');
		assert.equal(dto.forUserId, null, 'forUserId bleibt null (kein Empfänger)');
		assert.equal(dto.forUserName, null, 'forUserName bleibt null');
	});

	// ── AK2: fremde userId ohne gemeinsame Gruppe → 403, kein Datensatz ──────────────

	it('POST /series mit userId ohne gemeinsame Gruppe → 403 und keine Serie (AK2, TF2)', async () => {
		await seedSharedGroup();
		const aliceCookie = await server.login(ALICE);
		const carolId = await userIdOf(CAROL);

		const res = await postSeries(aliceCookie, { title: 'Verbotene Serie', userId: carolId });
		assert.equal(res.status, 403, 'ohne gemeinsame Gruppe muss 403 kommen');

		const carolList = await listSeries(await server.login(CAROL));
		assert.ok(!carolList.some((series) => series.title === 'Verbotene Serie'), 'keine Serie beim Empfänger');
		const aliceList = await listSeries(aliceCookie);
		assert.ok(!aliceList.some((series) => series.title === 'Verbotene Serie'), 'keine Serie beim Aufrufer');

		const badType = await postSeries(aliceCookie, { title: 'Typ-Check', userId: 'bob' });
		assert.equal(badType.status, 400, 'userId ohne Ganzzahl muss 400 liefern');
	});

	// ── AK3: Serie gehört dem Empfänger, Ersteller ist Creator ───────────────────────

	it('POST /series mit Gruppenmitglied: userId = Empfänger, createdById = Ersteller (AK3, TF3)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);

		const res = await postSeries(await server.login(ALICE), { title: 'Bobs Routine', userId: bobId });
		assert.equal(res.status, 201, 'POST mit gemeinsamer Gruppen-userId muss 201 liefern');
		const dto = (await res.json()) as CreatedBySeriesDto;

		assert.equal(dto.userId, bobId, 'die Serie gehört dem Empfänger');
		assert.equal(dto.createdById, await userIdOf(ALICE), 'createdById ist der Ersteller');
	});

	// ── AK5: Ersteller liest die Serie mit Für-Kennzeichen ───────────────────────────

	it('GET /series des Erstellers enthält fremde Serie mit forUserId/forUserName (AK5, TF5)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const aliceCookie = await server.login(ALICE);

		const res = await postSeries(aliceCookie, { title: 'Übergabe-Routine', userId: bobId });
		assert.equal(res.status, 201);
		const seriesId = ((await res.json()) as CreatedBySeriesDto).id;

		const aliceList = await listSeries(aliceCookie);
		const foreign = aliceList.find((candidate) => candidate.id === seriesId);
		assert.ok(foreign, 'Ersteller muss die für Bob angelegte Serie lesend sehen');
		assert.equal(foreign.forUserId, bobId, 'Für-Kennzeichen nennt das Empfänger-Konto');
		assert.equal(foreign.forUserName, 'Bob Empfänger', 'Für-Kennzeichen nennt den Empfänger-Namen');

		const own = aliceList.find((candidate) => candidate.id !== seriesId);
		if (own) {
			assert.equal(own.forUserId, null, 'eigene Serie bleibt ohne Für-Kennzeichen');
		}
	});

	// ── AK7: Bestandsserie ohne createdById bleibt lesbar ────────────────────────────

	it('Bestandsserie ohne createdById bleibt lesbar, Kennzeichen null (AK7, TF7)', async () => {
		await seedSharedGroup();
		const bobCookie = await server.login(BOB);

		// Altbestand direkt am Modell: kein createdById gesetzt (Spalte fehlt bzw. NULL).
		const legacy = await Series.create({
			title: 'Altbestand',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2030-01-07T00:00:00.000Z'),
			userId: await userIdOf(BOB),
		});

		const list = await listSeries(bobCookie);
		const series = list.find((candidate) => candidate.id === legacy.id);
		assert.ok(series, 'Bestandsserie bleibt in der Liste');
		assert.equal(series.createdById, null, 'createdById bleibt null');
		assert.equal(series.forUserId, null, 'forUserId bleibt null');
	});
});
