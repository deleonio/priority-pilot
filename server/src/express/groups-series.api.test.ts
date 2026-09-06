import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Series, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1254 — Gruppenübersicht der füreinander angelegten Serien
 * (Vertrag: docs/spec/issue-1254.md, TF1/TF2/TF3 für AK1–AK4).
 *
 * Rollen: Alice (Gruppen-Admin, legt für andere an), Bob und Anna (Mitglieder),
 * Carol (Drittkonto ohne Mitgliedschaft). Geseedet wird direkt an den Modellen —
 * Muster groups-tasks.api.test.ts (#1223); Gruppen-CRUD und die /tasks-Route sind
 * dort abgedeckt (dedup).
 *
 * Rot, bis GET /groups/:id/series existiert (aktuell 404). KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,anna@example.com,carol@example.com';
applyTestAuthEnv('groups-series-api-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const ANNA = 'anna@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

/** Eintrag der Gruppen-Serien-Liste gemäß Spec #1254 (exakt dieser Feldsatz, AK2). */
interface GroupSeriesDto {
	id: number;
	title: string;
	rhythm: string;
	active: boolean;
	ownerName: string;
	creatorName: string;
}

/** User-ID zum Konto nachsehen (Modell-Zugriff nur fürs Seeding/Orakel, nie fürs SUT). */
const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Gruppen-Serien-Liste „Füreinander angelegte Serien“ (#1254)', () => {
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

	/**
	 * Seedet Alice (Admin), Bob und Anna (Mitglieder) plus Carol ohne Gruppenbezug und legt
	 * die Gruppe an. Anzeigenamen so, dass case-insensitive und Byte-Sortierung auseinanderlaufen
	 * („anna …“ vor „Bob …“, byte- wäre umgekehrt — AK4).
	 */
	const seedGroup = async (): Promise<Group> => {
		await server.login(ALICE, { displayName: 'Alice Admin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		await server.login(ANNA, { displayName: 'anna mitarbeiterin' });
		await server.login(CAROL, { displayName: 'Carol Fremd' });
		const group = await Group.create({ name: 'Spec-Gruppe #1254', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ANNA), role: 'member', joinedAt: new Date() });
		return group;
	};

	const getGroupSeries = async (cookie: string | undefined, groupId: number): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}/series`, {
			headers: cookie ? { Cookie: cookie } : {},
		});

	/** Serie direkt am Modell seeden (SUT ist der GET-Endpunkt, nicht POST /series). */
	const seedSeries = async (values: {
		title: string;
		ownerId: number | null;
		creatorId: number | null;
		rhythm?: 'daily' | 'weekly' | 'monthly';
		active?: boolean;
	}): Promise<Series> =>
		Series.create({
			title: values.title,
			rhythm: values.rhythm ?? 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: values.active ?? true,
			startDate: new Date('2026-10-01T00:00:00Z'),
			userId: values.ownerId,
			createdById: values.creatorId,
		});

	it('liefert genau die füreinander angelegten Serien der Gruppe mit reduziertem Feldsatz (AK1, AK2)', async () => {
		const group = await seedGroup();
		const [aliceId, bobId, carolId] = await Promise.all([ALICE, BOB, CAROL].map(userIdOf));

		const contained = await seedSeries({ title: 'Wochentliche Übergabe', ownerId: bobId, creatorId: aliceId });
		const containedResting = await seedSeries({
			title: 'Ruhende Übergabe',
			ownerId: bobId,
			creatorId: aliceId,
			rhythm: 'daily',
			active: false,
		});

		// Ausschlusssfälle: Selbst-Anlage, Fremd-Ersteller, Altbestand ohne Ersteller.
		await seedSeries({ title: 'Eigene Serie', ownerId: aliceId, creatorId: aliceId });
		await seedSeries({ title: 'Fremde Serie für Mitglied', ownerId: bobId, creatorId: carolId });
		await seedSeries({ title: 'Altbestand ohne Ersteller', ownerId: bobId, creatorId: null });

		const res = await getGroupSeries(await server.login(ALICE), group.id);
		assert.equal(res.status, 200, 'GET /groups/:id/series muss als Mitglied 200 liefern');
		const list = (await res.json()) as GroupSeriesDto[];

		assert.deepEqual(
			list.map((entry) => entry.id).sort((a, b) => a - b),
			[contained.id, containedResting.id].sort((a, b) => a - b),
			'AK1: genau die zwei füreinander angelegten Serien — Selbst-Anlage (auch für den Admin), Fremd-Ersteller und Altbestand fehlen',
		);

		// AK2: exakt dieser Feldsatz, Anzeigenamen statt E-Mails, keine Beschreibung/Adresse/Koordinaten.
		const entry = list.find((candidate) => candidate.id === contained.id);
		assert.ok(entry, 'Übergabe-Serie muss enthalten sein');
		assert.deepEqual(
			Object.keys(entry).sort(),
			['active', 'creatorName', 'id', 'ownerName', 'rhythm', 'title'],
			'AK2: Feldsatz ist genau id, title, rhythm, active, ownerName, creatorName',
		);
		assert.equal(entry.ownerName, 'Bob Empfänger', 'AK2: Anzeigename des Eigentümers');
		assert.equal(entry.creatorName, 'Alice Admin', 'AK2: Anzeigename des Erstellers');
		assert.equal(entry.rhythm, 'weekly', 'AK2: Rhythmus wird geliefert');
		assert.equal(entry.active, true, 'aktive Serie trägt active:true');
		const resting = list.find((candidate) => candidate.id === containedResting.id);
		assert.ok(resting, 'ruhende Übergabe-Serie muss enthalten sein');
		assert.equal(
			resting.active,
			false,
			'ruhende Serie (restCrossMemberSeries) bleibt sichtbar und als active:false gekennzeichnet',
		);
		const raw = JSON.stringify(list);
		assert.ok(!raw.includes('@'), 'AK2: keine E-Mail-Adressen in der Antwort');
		assert.ok(
			!raw.includes('description') &&
				!raw.includes('address') &&
				!raw.includes('latitude') &&
				!raw.includes('longitude'),
			'AK2: weder description noch address noch Koordinaten',
		);
	});

	it('sortiert stabil: ownerName case-insensitive, dann title case-insensitive, dann id (AK4)', async () => {
		const group = await seedGroup();
		const [aliceId, annaId, bobId] = await Promise.all([ALICE, ANNA, BOB].map(userIdOf));

		// Erwartete Reihenfolge: „anna …“ (case-insensitive vor „Bob …“) mit Titeln b/a (aufsteigend
		// => a zuerst) plus Gleichstand-Paar (Tie per id), dann „Bob …“ — byte-weise wäre „Bob …“ zuerst.
		const annaB = await seedSeries({ title: 'Serie B', ownerId: annaId, creatorId: aliceId });
		const annaA = await seedSeries({ title: 'Serie a', ownerId: annaId, creatorId: aliceId });
		const annaTieFirst = await seedSeries({ title: 'Tie', ownerId: annaId, creatorId: bobId });
		const annaTieSecond = await seedSeries({ title: 'Tie', ownerId: annaId, creatorId: bobId });
		const bobEntry = await seedSeries({ title: 'Bob-Serie', ownerId: bobId, creatorId: aliceId });
		assert.ok(annaTieSecond.id > annaTieFirst.id, 'Setup: Id-Reihenfolge für den Tie-Breaker');

		const res = await getGroupSeries(await server.login(ANNA), group.id);
		assert.equal(res.status, 200, 'GET /groups/:id/series muss als Mitglied 200 liefern');
		const list = (await res.json()) as GroupSeriesDto[];

		assert.deepEqual(
			list.map((entry) => entry.id),
			[annaA.id, annaB.id, annaTieFirst.id, annaTieSecond.id, bobEntry.id],
			'AK4: ownerName case-insensitive vor „Bob“, darin title aufsteigend („a“ vor „B“), Gleichstand per id',
		);
	});

	it('Nichtmitglied erhält 404 mit Hinweistext, unauthentifizierter Request 401 (AK3)', async () => {
		const group = await seedGroup();

		const carolRes = await getGroupSeries(await server.login(CAROL), group.id);
		assert.equal(carolRes.status, 404, 'Konto ohne Membership muss 404 bekommen (keine Existenz-Leakage)');
		// Defensiv parsen: solange die Route fehlt, antwortet Express mit einer HTML-404-Seite.
		const carolBody = (await carolRes.json().catch(() => null)) as { message?: string } | null;
		assert.equal(carolBody?.message, 'Gruppe nicht gefunden.', 'AK3: bestehender Fehlertext');

		const anonRes = await getGroupSeries(undefined, group.id);
		assert.equal(anonRes.status, 401, 'Request ohne Session muss 401 bekommen (globales requireAuth)');
	});
});
