import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, Pillar, Series, SeriesPillar, Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #1252 — Übergabe einer Serie an ein Gruppenmitglied über
 * PATCH /series/:id (Vertrag: docs/spec/issue-1252.md, AK6/AK8).
 *
 * AK8: gleiches Verhalten wie die Task-Übergabe — nach `userId`-PATCH gehört die Serie dem
 * Empfänger, die Übergebende steht als Erstellerin und sieht die Serie mit „Für:"-Kennzeichen;
 * bereits erzeugte Instanzen bleiben beim bisherigen Eigentümer (KEINE Kaskade des Eigentümers).
 *
 * AK6: SeriesPillar-Beiträge zeigen nach der Übergabe auf keine Säule der bisherigen
 * Eigentümerin (Invariante; übernehmen oder verwerfen ist Impl-Entscheidung).
 *
 * 400/403-Spiegel des eigenständigen Series-Empfängerblocks (series.ts PATCH) wird hier
 * mitgetestet — die Task-Gegenstücke (tasks-handover.test.ts) testen nur PATCH /tasks/:id,
 * ein Copy-Paste-Fehler in der Series-Variante bliebe sonst unentdeckt. Der Schreib-Scope
 * (Ersteller → 404) bleibt durch series-recipient-instances.test.ts (#1222) gedeckt — Dedup.
 * Rot, bis PATCH /series/:id ein optionales `userId` auswertet. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
applyTestAuthEnv('series-handover-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const CAROL = 'carol@example.com';

let server: TestServer;

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Serien-Übergabe an ein Gruppenmitglied (#1252)', () => {
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
		await server.login(ALICE, { displayName: 'Alice Eigentümerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		// Carol existiert als Drittkonto ohne Gruppenbezug (403-Fall).
		await server.login(CAROL, { displayName: 'Carol Ohne Gruppe' });
		const group = await Group.create({ name: 'Serien-Übergabe-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	/** Serien-Template im Eigentum von Alice (fällig, damit sich Instanzen erzeugen lassen). */
	const seedAliceSeries = async (): Promise<Series> => {
		const aliceId = await userIdOf(ALICE);
		return Series.create({
			title: 'Wöchentliche Übergabe-Routine',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: new Date('2026-01-05T00:00:00Z'),
			userId: aliceId,
		});
	};

	const patchSeries = async (cookie: string | undefined, id: number, body: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}/series/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie ?? '' },
			body: JSON.stringify(body),
		});

	it('userId ohne Ganzzahl → 400; ohne gemeinsame Gruppe → 403 ohne Teil-Änderung (Spiegel des Task-Verhaltens)', async () => {
		await seedSharedGroup();
		const series = await seedAliceSeries();
		const aliceCookie = await server.login(ALICE);
		const carolId = await userIdOf(CAROL);

		const badType = await patchSeries(aliceCookie, series.id, { userId: 'bob' });
		assert.equal(badType.status, 400, 'nicht-ganzzahliges userId muss 400 liefern (wie bei Aufgaben)');

		const foreign = await patchSeries(aliceCookie, series.id, { userId: carolId, title: 'Unerlaubte Änderung' });
		assert.equal(foreign.status, 403, 'Empfänger ohne gemeinsame Gruppe muss 403 liefern (wie bei Aufgaben)');

		const oracle = await Series.findByPk(series.id);
		assert.ok(oracle);
		assert.equal(oracle.userId, await userIdOf(ALICE), 'Eigentümer unverändert');
		assert.equal(oracle.title, 'Wöchentliche Übergabe-Routine', 'keine Teil-Änderung — Titel bleibt alt');
	});

	it('Übergabe: Serie gehört Bob, Alice sieht sie mit „Für:"-Kennzeichen als Erstellerin (AK8)', async () => {
		await seedSharedGroup();
		const series = await seedAliceSeries();
		const aliceId = await userIdOf(ALICE);
		const bobId = await userIdOf(BOB);

		const res = await patchSeries(await server.login(ALICE), series.id, { userId: bobId });
		assert.equal(res.status, 200, 'Serien-Übergabe an Gruppenmitglied muss 200 liefern');

		// Empfänger-Sicht: eigene Serie ohne Kennzeichen.
		const bobList = (await (
			await fetch(`${server.baseUrl}/series`, { headers: { Cookie: await server.login(BOB) } })
		).json()) as Array<Record<string, unknown>>;
		const handedOver = bobList.find((entry) => entry.id === series.id);
		assert.ok(handedOver, 'AK8: die übergebene Serie muss in GET /series von Bob auftauchen');
		assert.equal(handedOver.userId, bobId, 'AK8: Bob ist neuer Eigentümer');
		assert.equal(handedOver.createdById, aliceId, 'AK8: die Übergebende steht als Erstellerin');
		assert.equal(handedOver.forUserId, null, 'AK8: Bob bekommt kein „Für:"-Kennzeichen für die eigene Serie');

		// Bisherige Eigentümerin: Ersteller-Zweig mit Kennzeichen.
		const aliceList = (await (
			await fetch(`${server.baseUrl}/series`, { headers: { Cookie: await server.login(ALICE) } })
		).json()) as Array<Record<string, unknown>>;
		const asCreator = aliceList.find((entry) => entry.id === series.id);
		assert.ok(asCreator, 'AK8: Alice sieht die übergebene Serie weiterhin (Ersteller-Zweig)');
		assert.equal(asCreator.forUserId, bobId, 'AK8: „Für:"-Kennzeichen zeigt auf den Empfänger');
		assert.equal(asCreator.forUserName, 'Bob Empfänger', 'AK8: Empfänger-Name wird aufgelöst');
	});

	it('bereits erzeugte Instanzen bleiben bei Alice — Eigentümer wird nicht kaskadiert (AK8)', async () => {
		await seedSharedGroup();
		const series = await seedAliceSeries();
		const aliceId = await userIdOf(ALICE);

		// Instanz so erzeugen, wie es der Generator tut: Eigentümerin = Alice.
		await Task.create({
			title: 'Instanz vor Übergabe',
			status: 'Open',
			priority: 3,
			estimatedEffort: 0.5,
			seriesId: series.id,
			userId: aliceId,
		});

		const res = await patchSeries(await server.login(ALICE), series.id, {
			userId: await userIdOf(BOB),
			applyToInstances: true,
		});
		assert.equal(res.status, 200);

		const instances = await Task.findAll({ where: { seriesId: series.id } });
		assert.ok(instances.length > 0, 'Oracle: Instanz muss existieren');
		for (const instance of instances) {
			assert.equal(instance.userId, aliceId, 'AK8: Instanzen bleiben beim bisherigen Eigentümer');
		}
		const template = await Series.findByPk(series.id);
		assert.ok(template);
		assert.equal(template.userId, await userIdOf(BOB), 'AK8: nur das Template wechselt den Eigentümer');
	});

	it('SeriesPillar-Beiträge zeigen nach der Übergabe auf keine Säule von Alice (AK6, Serien-Invariante)', async () => {
		await seedSharedGroup();
		const series = await seedAliceSeries();
		const aliceId = await userIdOf(ALICE);

		const pillar = await Pillar.create({
			name: 'Nur-Alice-Wohl',
			description: 'Alice-eigene Säule',
			userId: aliceId,
			weight: 100,
		});
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillar.id, share: 100, confidence: 100 });

		const res = await patchSeries(await server.login(ALICE), series.id, { userId: await userIdOf(BOB) });
		assert.equal(res.status, 200);

		const contributions = await SeriesPillar.findAll({ where: { seriesId: series.id } });
		const referencedPillars =
			contributions.length === 0
				? []
				: await Pillar.findAll({ where: { id: contributions.map((entry) => entry.pillarId) } });
		assert.ok(
			referencedPillars.every((entry) => entry.userId !== aliceId),
			'AK6: nach der Übergabe darf kein Serien-Beitrag auf eine Säule der bisherigen Eigentümerin zeigen',
		);
	});
});
