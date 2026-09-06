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

/**
 * Rote Spec-Tests für #1250 — Ersteller-Lesezugriff endet mit der Gruppenmitgliedschaft
 * (Vertrag: docs/spec/issue-1250.md, TF5 für AK5; TF6-Anteil Serien für AK6).
 *
 * Erwartung: der `createdById`-Zweig von `seriesReadScope` wird an die AKTUELLE gemeinsame
 * Gruppenmitgliedschaft gebunden. Rot, solange der Zweig bedingungslos gilt. KEIN Produktivcode.
 */
describe('Ersteller-Lesezugriff endet mit der Gruppenmitgliedschaft (#1250, Serien)', () => {
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

	/** Alice+Bob als Admins (self-leave ohne letzten-Admin-409), Carol ohne Gruppe. */
	const seedGroupWithTwoAdmins = async (): Promise<number> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(CAROL, { displayName: 'Carol Dritte' });
		const group = await Group.create({ name: 'Spec-Gruppe', description: null });
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);
		await GroupMember.create({ groupId: group.id, userId: aliceId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: bobId, role: 'admin', joinedAt: new Date() });
		return group.id;
	};

	const postSeriesFor1250 = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
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

	const listSeriesFor1250 = async (cookie: string): Promise<CreatedBySeriesDto[]> => {
		const res = await fetch(`${server.baseUrl}/series`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /series muss 200 liefern');
		return (await res.json()) as CreatedBySeriesDto[];
	};

	const createSeriesForBob = async (): Promise<number> => {
		const res = await postSeriesFor1250(await server.login(ALICE), {
			title: 'Bobs Serie aus der Gruppe',
			userId: await userIdOf(BOB),
		});
		assert.equal(res.status, 201, 'Setup: Serie für Gruppenmitglied muss anlegbar sein');
		return ((await res.json()) as CreatedBySeriesDto).id;
	};

	const aliceSees = async (seriesId: number): Promise<boolean> => {
		const list = await listSeriesFor1250(await server.login(ALICE));
		return list.some((series) => series.id === seriesId);
	};

	const leaveGroup = async (cookie: string, groupId: number, targetUserId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/members/${targetUserId}`, {
			method: 'DELETE',
			headers: { Cookie: cookie },
		});

	it('AK5/TF5: Serie folgt Mitgliedschaft — sichtbar, nach Austritt weg, nach Wiedereintritt zurück', async () => {
		const groupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const seriesId = await createSeriesForBob();

		// AK7-Deckel: Detail-Zugriff der Erstellerin bleibt 404 (seriesReadScope nur für die Liste).
		const detailRes = await fetch(`${server.baseUrl}/series/${seriesId}`, {
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(detailRes.status, 404, 'AK7: GET /series/:id bleibt für die Erstellerin 404');

		assert.ok(await aliceSees(seriesId), 'mit gemeinsamer Gruppe sieht Alice die Serie');

		const leaveRes = await leaveGroup(await server.login(ALICE), groupId, aliceId);
		assert.equal(leaveRes.status, 204, 'Setup: self-leave muss 204 liefern (zwei Admins geseedet)');
		assert.ok(!(await aliceSees(seriesId)), 'nach Austritt darf Alice die Serie nicht mehr sehen');

		await GroupMember.create({ groupId, userId: aliceId, role: 'member', joinedAt: new Date() });
		assert.ok(await aliceSees(seriesId), 'nach Wiedereintritt sieht Alice die Serie wieder');

		// Eigentümer unberührt (AK3-Analogon): Bob sieht die Serie mit Ersteller-Kennzeichen.
		const bobList = await listSeriesFor1250(await server.login(BOB));
		const series = bobList.find((candidate) => candidate.id === seriesId);
		assert.ok(series, 'Bob sieht die Serie immer');
		assert.equal(series.createdById, aliceId, 'createdById bleibt auf der Erstellerin');
		assert.equal(series.createdByName, 'Alice Erstellerin', 'createdByName bleibt die Erstellerin');
	});

	it('AK5/TF5: Admin-Entfernung und Gruppenlöschung beenden den Serien-Lesezugriff', async () => {
		// Admin-Entfernung
		const groupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const seriesId = await createSeriesForBob();
		assert.ok(await aliceSees(seriesId), 'mit gemeinsamer Gruppe sieht Alice die Serie');
		const removeRes = await leaveGroup(await server.login(BOB), groupId, aliceId);
		assert.equal(removeRes.status, 204, 'Setup: Admin-Entfernung muss 204 liefern');
		assert.ok(!(await aliceSees(seriesId)), 'nach Admin-Entfernung weg');

		// Gruppenlöschung
		const secondGroupId = await seedGroupWithTwoAdmins();
		const secondSeriesId = await createSeriesForBob();
		assert.ok(await aliceSees(secondSeriesId), 'mit neuer gemeinsamer Gruppe sichtbar');
		const deleteRes = await fetch(`${server.baseUrl}/groups/${secondGroupId}`, {
			method: 'DELETE',
			headers: { Cookie: await server.login(ALICE) },
		});
		assert.equal(deleteRes.status, 204, 'Setup: Gruppenlöschung als Admin muss 204 liefern');
		assert.ok(!(await aliceSees(secondSeriesId)), 'nach Gruppenlöschung weg');
	});

	it('AK5/TF5: eine verbleibende gemeinsame Gruppe genügt für Serien (AK4-Analogon)', async () => {
		const firstGroupId = await seedGroupWithTwoAdmins();
		const aliceId = await userIdOf(ALICE);
		const secondGroup = await Group.create({ name: 'Zweite Gruppe', description: null });
		await GroupMember.create({ groupId: secondGroup.id, userId: aliceId, role: 'member', joinedAt: new Date() });
		await GroupMember.create({
			groupId: secondGroup.id,
			userId: await userIdOf(BOB),
			role: 'member',
			joinedAt: new Date(),
		});
		const seriesId = await createSeriesForBob();
		assert.ok(await aliceSees(seriesId), 'mit zwei gemeinsamen Gruppen sichtbar');

		const leaveRes = await leaveGroup(await server.login(ALICE), firstGroupId, aliceId);
		assert.equal(leaveRes.status, 204, 'Setup: Austritt aus der ersten Gruppe muss 204 liefern');
		assert.ok(await aliceSees(seriesId), 'eine verbleibende gemeinsame Gruppe genügt');
	});

	it('AK6/TF6: Bestandsserie ohne createdById bleibt gruppenunabhängig Eigentümer-only', async () => {
		await seedGroupWithTwoAdmins();
		const legacy = await Series.create({
			title: 'Altbestand 1250',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2030-01-07T00:00:00.000Z'),
			userId: await userIdOf(BOB),
		});

		const bobList = await listSeriesFor1250(await server.login(BOB));
		assert.ok(
			bobList.some((series) => series.id === legacy.id),
			'Eigentümer sieht die Bestandsserie',
		);
		assert.ok(!(await aliceSees(legacy.id)), 'trotz gemeinsamer Gruppe: kein createdById-Zweig für Bestand');
	});
});
