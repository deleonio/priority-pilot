import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { AiUsage, Pillar, Task, User } from '../models/index.js';
import { currentYearMonth } from './aiQuotaMeter.js';
import type { ActivityAdvisor, AdviseActivitiesInput } from '../llm/llm.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1804 (Spec docs/spec/issue-1804.md) — KI-Vorschlag in
 * `GET /scores/care-suggestions` für Plus/Pro. Der Berater wird über `AppDeps.activityAdvisor`
 * injiziert (kein echter Provider).
 *
 * AK1 (TF1): Plus/Pro mit Defizit → genau ein `typ: 'ki'`, nur eigene Aufgaben im Advisor-Input.
 * AK2 (TF2): Free → kein `ki`, Advisor 0×, keine Buchung.
 * AK3 (TF3): Plus ohne Defizit → Advisor 0×, keine Buchung.
 * AK4 (TF4): Advisor wirft → 200, Bestand/Vorlagen, Buchung zurückgenommen.
 * AK5 (TF5): eine Buchung nach Erfolg; gedrosselt → kein `ki`, 200.
 * AK6 (TF6): zweiter Abruf am selben Tag → gleicher Vorschlag, Advisor 1×, Buchung 1×.
 * AK7 (TF7): `ai-quota-coverage.test.ts` scannt `scoresRouter` nicht und bleibt unberührt grün.
 *
 * #1873 (Spec docs/spec/issue-1873.md): AK1 KI an Position 0, AK2 Überlast → Berater 0×, AK3 parallele
 * Abrufe → 1 Aufruf/1 Buchung, AK4 Berater erhält die 20 neuesten Aufgaben nach `createdAt`.
 *
 * Rot, bis die Route den Berater aufruft (heute: kein `ki`-Eintrag). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1804-care-ki');

interface Vorschlag {
	typ: string;
	saeuleId: number;
	titel: string;
	beschreibung: string | null;
	anlass?: string;
}

let server: TestServer;
let aufrufe: AdviseActivitiesInput[];
let advisorImpl: ActivityAdvisor;

const advisor: ActivityAdvisor = (input, provider, userId) => {
	aufrufe.push(input);
	return advisorImpl(input, provider, userId);
};

const KI_TITEL = 'Mit Anna wandern gehen';
const KI_GRUND = 'Du hast schon öfter Bewegung mit Freunden geplant.';

const getCare = (cookie: string): Promise<Response> =>
	server.json('/scores/care-suggestions', { headers: { Cookie: cookie } });

const leseVorschlaege = async (cookie: string): Promise<Vorschlag[]> => {
	const res = await getCare(cookie);
	assert.equal(res.status, 200, 'Vorschlags-Endpunkt muss 200 liefern');
	return ((await res.json()) as { vorschlaege: Vorschlag[] }).vorschlaege;
};

const nurKi = (vorschlaege: Vorschlag[]): Vorschlag[] => vorschlaege.filter((v) => v.typ === 'ki');

/** Registriert ein Konto mit Paket `plan` und liefert Cookie, Nutzer-ID und erste Säule. */
const setup = async (email: string, plan: 'free' | 'plus' | 'pro') => {
	const cookie = await server.register(email, 'password123');
	await User.update({ plan }, { where: { email } });
	const user = (await User.findOne({ where: { email } }))!;
	const saeule = (await Pillar.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] }))[0]!;
	return { cookie, userId: user.id, saeuleId: saeule.id };
};

const createTask = async (cookie: string, title: string, pillarId: number): Promise<void> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort: 0.5, pillars: [{ pillarId, share: 100 }] }),
	});
	assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
};

const verbrauch = async (userId: number): Promise<number> =>
	(await AiUsage.findOne({ where: { userId, yearMonth: currentYearMonth() } }))?.count ?? 0;

describe('GET /scores/care-suggestions — KI-Vorschlag Plus/Pro (#1804)', () => {
	before(async () => {
		server = await startTestServer({ activityAdvisor: advisor });
	});

	beforeEach(async () => {
		await resetDb();
		aufrufe = [];
		advisorImpl = async (input) => [{ activity: KI_TITEL, reason: KI_GRUND, pillarIds: [input.pillars[0]?.id ?? 0] }];
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	for (const plan of ['plus', 'pro'] as const) {
		it(`AK1 (${plan}): Defizit → genau ein KI-Vorschlag zur ersten Defizit-Säule, nur eigene Aufgaben im Advisor`, async () => {
			const eigen = await setup(`care-ki-${plan}@example.com`, plan);
			const fremd = await setup(`care-ki-${plan}-fremd@example.com`, 'plus');
			await createTask(eigen.cookie, 'EigeneAufgabeAlpha', eigen.saeuleId);
			await createTask(fremd.cookie, 'FremdeAufgabeGeheim', fremd.saeuleId);

			const vorschlaege = await leseVorschlaege(eigen.cookie);
			const ki = nurKi(vorschlaege);
			assert.equal(ki.length, 1, 'genau ein KI-Vorschlag');
			assert.equal(ki[0]!.titel, KI_TITEL);
			assert.equal(ki[0]!.beschreibung, KI_GRUND);
			assert.equal(ki[0]!.anlass, 'defizit');
			assert.equal(ki[0]!.saeuleId, eigen.saeuleId, 'zur ersten defizitären Säule');
			assert.ok(
				vorschlaege.some((v) => v.typ !== 'ki'),
				'Bestand/Vorlagen bleiben zusätzlich erhalten',
			);

			assert.equal(aufrufe.length, 1);
			const eingabe = JSON.stringify(aufrufe[0]);
			assert.ok(eingabe.includes('EigeneAufgabeAlpha'), 'Advisor kennt die eigenen Aufgaben');
			assert.ok(!eingabe.includes('FremdeAufgabeGeheim'), 'fremde Aufgaben dürfen nie in den Advisor');
		});
	}

	it('AK2: Free-Konto → kein KI-Vorschlag, Advisor nicht aufgerufen, keine Buchung', async () => {
		const { cookie, userId } = await setup('care-ki-free@example.com', 'free');
		const vorschlaege = await leseVorschlaege(cookie);
		assert.equal(nurKi(vorschlaege).length, 0);
		assert.ok(vorschlaege.length > 0, 'Bestand/Vorlagen bleiben');
		assert.equal(aufrufe.length, 0);
		assert.equal(await verbrauch(userId), 0);
	});

	it('AK3: Plus ohne Defizit → kein KI-Aufruf, keine Buchung', async () => {
		const { cookie, userId } = await setup('care-ki-nodef@example.com', 'plus');
		await Pillar.destroy({ where: { userId } });
		assert.equal(nurKi(await leseVorschlaege(cookie)).length, 0);
		assert.equal(aufrufe.length, 0);
		assert.equal(await verbrauch(userId), 0);
	});

	it('AK4: Advisor wirft → 200 mit Bestand/Vorlagen ohne Fehlerfeld, Buchung zurückgenommen', async () => {
		const { cookie, userId } = await setup('care-ki-fehler@example.com', 'plus');
		advisorImpl = async () => {
			throw new Error('Provider nicht erreichbar');
		};
		const res = await getCare(cookie);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { vorschlaege: Vorschlag[]; error?: unknown };
		assert.equal(body.error, undefined, 'kein Fehlerfeld');
		assert.equal(aufrufe.length, 1, 'Advisor wurde versucht');
		assert.equal(nurKi(body.vorschlaege).length, 0);
		assert.ok(body.vorschlaege.length > 0, 'Bestand/Vorlagen wie ohne KI');
		assert.equal(await verbrauch(userId), 0, 'Buchung zurückgenommen');
	});

	it('AK5: erfolgreicher KI-Vorschlag bucht genau einen Punkt', async () => {
		const { cookie, userId } = await setup('care-ki-buchung@example.com', 'plus');
		assert.equal(nurKi(await leseVorschlaege(cookie)).length, 1);
		assert.equal(await verbrauch(userId), 1);
	});

	it('AK5: greift die Fair-Use-Drossel, fehlt der KI-Vorschlag ohne Fehler (200)', async (t) => {
		// Die Fair-Use-Drossel greift nur bei aktivem Rollout (Muster `ai-fair-use.test.ts`).
		process.env.MONETIZATION_ENFORCED = 'true';
		t.after(() => {
			delete process.env.MONETIZATION_ENFORCED;
		});
		const { cookie, userId } = await setup('care-ki-drossel@example.com', 'plus');
		await AiUsage.create({ userId, yearMonth: currentYearMonth(), count: 150 });
		// Erster Über-Budget-Aufruf belegt den Intervall-Slot (#1783) — der zweite wird gedrosselt.
		const slot = await server.json('/pillars/advisor', { method: 'POST', headers: { Cookie: cookie }, body: '{}' });
		assert.equal(slot.status, 200, 'Setup: erster Über-Budget-Aufruf läuft durch');
		const vorher = aufrufe.length;

		assert.equal(nurKi(await leseVorschlaege(cookie)).length, 0);
		assert.equal(aufrufe.length, vorher, 'gedrosselt → kein Provider-Aufruf');
	});

	it('AK6: zweiter Abruf am selben Tag → gleicher Vorschlag, Advisor 1×, Buchung 1×', async () => {
		const { cookie, userId } = await setup('care-ki-cache@example.com', 'plus');
		const erster = nurKi(await leseVorschlaege(cookie));
		const zweiter = nurKi(await leseVorschlaege(cookie));
		assert.equal(erster.length, 1);
		assert.deepEqual(zweiter, erster, 'gespeicherter Vorschlag');
		assert.equal(aufrufe.length, 1, 'Advisor nicht erneut aufgerufen');
		assert.equal(await verbrauch(userId), 1, 'keine zweite Buchung');
	});

	it('#1873 AK1: KI-Vorschlag steht an Position 0 der Liste', async () => {
		const { cookie } = await setup('care-ki-pos0@example.com', 'plus');
		const vorschlaege = await leseVorschlaege(cookie);
		assert.equal(vorschlaege[0]?.typ, 'ki', 'erster Eintrag ist der KI-Vorschlag');
	});

	it('#1873 AK2: Überlast → Berater nicht aufgerufen, nichts gebucht', async () => {
		const { cookie, userId } = await setup('care-ki-ueberlast@example.com', 'plus');
		const wirksamkeit = (await Pillar.findOne({ where: { userId, name: 'Wirksamkeit' } }))!;
		const created = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({
				title: 'Überlast',
				priority: 3,
				estimatedEffort: 1,
				pillars: [{ pillarId: wirksamkeit.id, share: 100 }],
			}),
		});
		const { id } = (await created.json()) as { id: number };
		const done = await server.json(`/tasks/${id}`, {
			method: 'PATCH',
			headers: { Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});
		assert.equal(done.status, 200, 'Setup: Statuswechsel auf Done');

		const vorschlaege = await leseVorschlaege(cookie);
		assert.equal(vorschlaege[0]?.anlass, 'ueberlast', 'Setup: Überlast liegt vor');
		assert.equal(aufrufe.length, 0, 'Berater nicht aufgerufen');
		assert.equal(await verbrauch(userId), 0, 'keine Buchung');
	});

	it('#1873 AK3: zwei gleichzeitige Abrufe → Berater 1×, eine Buchung', async () => {
		const { cookie, userId } = await setup('care-ki-parallel@example.com', 'plus');
		const [a, b] = await Promise.all([getCare(cookie), getCare(cookie)]);
		assert.equal(a.status, 200);
		assert.equal(b.status, 200);
		assert.equal(aufrufe.length, 1, 'Berater genau 1×');
		assert.equal(await verbrauch(userId), 1, 'genau eine Buchung');
	});

	it('#1873: wirft die Buchung einmal, wird der Fehler nicht gecacht — zweiter Abruf liefert 200', async (t) => {
		const { cookie } = await setup('care-ki-buchungsfehler@example.com', 'plus');
		t.mock.method(
			AiUsage,
			'update',
			async () => {
				throw new Error('DB nicht erreichbar');
			},
			{ times: 1 },
		);
		assert.equal((await getCare(cookie)).status, 500);
		assert.equal((await getCare(cookie)).status, 200);
	});

	it('#1873 AK4: Berater erhält die 20 neuesten Aufgaben nach createdAt', async () => {
		const { cookie, saeuleId } = await setup('care-ki-neueste@example.com', 'plus');
		for (let i = 1; i <= 21; i++) {
			await createTask(cookie, `Aufgabe-A${String(i).padStart(2, '0')}`, saeuleId);
		}
		// Umgekehrt zur ID-Reihenfolge: die zuerst angelegte Aufgabe (A01) ist die neueste.
		const tasks = await Task.findAll({ order: [['id', 'ASC']] });
		const basis = Date.UTC(2026, 0, 1);
		for (const [index, task] of tasks.entries()) {
			await Task.update(
				{ createdAt: new Date(basis + (tasks.length - index) * 86_400_000) },
				{ where: { id: task.id }, silent: true },
			);
		}
		await leseVorschlaege(cookie);
		assert.equal(aufrufe.length, 1);
		const eingabe = JSON.stringify(aufrufe[0]);
		assert.ok(eingabe.includes('Aufgabe-A01'), 'neueste Aufgabe enthalten');
		assert.ok(!eingabe.includes('Aufgabe-A21'), 'älteste Aufgabe (21.) nicht enthalten');
	});
});
