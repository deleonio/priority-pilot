import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../../test/helpers.js';
import { Pillar, Task, TaskPillar, User } from '../../models/index.js';
import type { ClassifyPillarsInput, PillarClassifier, PillarSuggestion } from '../../llm/llm.js';

// Tests für den Batch zur Neuberechnung der Säulenverteilung (POST /admin/tasks/reassign-pillars):
// Alle Aufgaben eines Kontos — inkl. erledigter — werden mit dem injizierten Klassifikator neu
// zugeordnet und ersatzlos gespeichert (share-Summe 100); Status/Punkte bleiben unberührt.
process.env.GOOGLE_ALLOWED_EMAILS = 'admin@example.com,member@example.com';
applyTestAuthEnv('reassign-pillars-test');

const ADMIN_EMAIL = 'admin@example.com';
const MEMBER_EMAIL = 'member@example.com';

let server: TestServer;
let classifier: PillarClassifier;
let recorded: { title: string; description?: string; pillarIds: number[] }[] = [];

const postAs = (cookie: string, path: string) =>
	fetch(`${server.baseUrl}${path}`, { method: 'POST', headers: { Cookie: cookie } });

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Nutzer ${email} muss existieren`);
	return user.id;
};

const contributionsOf = async (taskId: number) =>
	TaskPillar.findAll({ where: { taskId: taskId }, order: [['pillarId', 'ASC']] });

describe('POST /admin/tasks/reassign-pillars — Batch-Neuzuordnung der Säulenverteilung', () => {
	before(async () => {
		classifier = (async (input: ClassifyPillarsInput) => {
			recorded.push({
				title: input.title,
				description: input.description,
				pillarIds: input.pillars.map((pillar) => pillar.id),
			});
			// Beide S\u00e4ulen vorschlagen, Konfidenz 60/40 \u2014 der Batch muss auf share 60/40 normieren.
			const suggestions: PillarSuggestion[] =
				input.pillars.length > 0
					? [
							{ pillarId: input.pillars[0].id, confidence: 60 },
							{ pillarId: input.pillars[input.pillars.length - 1].id, confidence: 40 },
						]
					: [];
			return suggestions;
		}) as PillarClassifier;
		server = await startTestServer({ pillarClassifier: classifier });
	});
	beforeEach(async () => {
		await resetDb();
		recorded = [];
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('ordnet offene UND erledigte Aufgaben neu zu, ohne Status/Punkte zu ändern', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		const pillarA = await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		const pillarB = await Pillar.create({ userId: memberId, name: 'Gesundheit', weight: 1 });
		const open = await Task.create({ title: 'Steuererklärung', status: 'Open', userId: memberId });
		const done = await Task.create({ title: 'Marathon laufen', status: 'Done', userId: memberId });
		await TaskPillar.create({ taskId: open.id, pillarId: pillarB.id, share: 100, confidence: 100 });

		const res = await postAs(adminCookie, '/admin/tasks/reassign-pillars');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; failed: number; skipped: number; users: number };
		assert.equal(body.updated, 2, 'beide Aufgaben neu zugeordnet');
		assert.equal(body.failed, 0);
		assert.equal(body.skipped, 0);
		assert.equal(body.users, 1, 'ein Konto verarbeitet');

		for (const task of [open, done]) {
			const contributions = await contributionsOf(task.id);
			assert.equal(contributions.length, 2);
			const sum = contributions.reduce((acc, entry) => acc + entry.share, 0);
			assert.ok(Math.abs(sum - 100) < 1e-6, `share-Summe muss 100 sein (Task ${task.id})`);
			const byId = new Map(contributions.map((entry) => [entry.pillarId, entry]));
			assert.equal(byId.get(pillarA.id)?.share, 60);
			assert.equal(byId.get(pillarB.id)?.share, 40);
		}

		// Klassifikator erhielt Titel (und die S\u00e4ulen des EIGENT\u00dcMERS, nicht die des Admins).
		const titles = recorded.map((entry) => entry.title).sort();
		assert.deepEqual(titles, ['Marathon laufen', 'Steuererklärung']);
		for (const entry of recorded) {
			assert.ok(entry.pillarIds.includes(pillarA.id));
			assert.ok(entry.pillarIds.includes(pillarB.id));
		}

		// Status unberührt — der Batch \u00f6ffnet Aufgaben nur f\u00fcr die Neuberechnung.
		await open.reload();
		await done.reload();
		assert.equal(open.status, 'Open');
		assert.equal(done.status, 'Done');
	});

	it('lässt bei fehlendem Vorschlag die bisherige Zuordnung unverändert (skipped)', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		const pillar = await Pillar.create({ userId: memberId, name: 'Familie', weight: 1 });
		const task = await Task.create({ title: 'Wochenendausflug', status: 'Done', userId: memberId });
		await TaskPillar.create({ taskId: task.id, pillarId: pillar.id, share: 100, confidence: 90 });

		// Router nutzt den bei Start injizierten Klassifikator — leere Antwort simulieren wir
		// über einen zweiten Server mit leerem Klassifikator (Login dort: eigenes Session-Secret).
		const emptyClassifier: PillarClassifier = async () => [];
		const emptyServer = await startTestServer({ pillarClassifier: emptyClassifier });
		try {
			const emptyAdminCookie = await emptyServer.login(ADMIN_EMAIL, { role: 'admin' });
			const res = await fetch(`${emptyServer.baseUrl}/admin/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: emptyAdminCookie },
			});
			assert.equal(res.status, 200);
			const body = (await res.json()) as { updated: number; skipped: number };
			assert.equal(body.updated, 0);
			assert.equal(body.skipped, 1);
		} finally {
			await emptyServer.close();
		}

		const contributions = await contributionsOf(task.id);
		assert.equal(contributions.length, 1, 'Zuordnung bleibt unverändert');
		assert.equal(contributions[0].pillarId, pillar.id);
		assert.equal(contributions[0].confidence, 90);
	});

	it('verbietet Member den Aufruf (403)', async () => {
		const memberCookie = await server.login(MEMBER_EMAIL, { role: 'member' });
		const res = await postAs(memberCookie, '/admin/tasks/reassign-pillars');
		assert.equal(res.status, 403);
	});

	it('begrenzt den Lauf auf limit und meldet die restlichen Aufgaben (remaining)', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Aufgabe 1', status: 'Open', userId: memberId });
		await Task.create({ title: 'Aufgabe 2', status: 'Open', userId: memberId });

		const res = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?limit=1`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; remaining: number };
		assert.equal(body.updated, 1, 'nur eine Aufgabe im ersten Lauf');
		assert.equal(body.remaining, 1, 'die zweite Aufgabe bleibt für den nächsten Lauf offen');
	});

	it('setzt mit offset beim zweiten Lauf disjunkt fort, statt dieselbe Portion erneut zu verarbeiten (Finding #5)', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Aufgabe 1', status: 'Open', userId: memberId });
		await Task.create({ title: 'Aufgabe 2', status: 'Open', userId: memberId });

		const first = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?limit=1`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(first.status, 200);
		const firstBody = (await first.json()) as { updated: number; failed: number; skipped: number; remaining: number };
		const firstTitles = recorded.map((entry) => entry.title);
		assert.equal(firstTitles.length, 1, 'erster Lauf klassifiziert genau eine Aufgabe');

		recorded = [];
		const secondOffset = firstBody.updated + firstBody.failed + firstBody.skipped;
		const second = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?limit=1&offset=${secondOffset}`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(second.status, 200);
		const secondBody = (await second.json()) as { updated: number; remaining: number };
		const secondTitles = recorded.map((entry) => entry.title);
		assert.equal(secondTitles.length, 1, 'zweiter Lauf klassifiziert genau eine Aufgabe');

		assert.notDeepEqual(firstTitles, secondTitles, 'zweiter Lauf verarbeitet eine ANDERE Aufgabe als der erste');
		assert.deepEqual(
			[...firstTitles, ...secondTitles].sort(),
			['Aufgabe 1', 'Aufgabe 2'],
			'beide Aufgaben zusammen einmal verarbeitet',
		);
		assert.equal(secondBody.updated, 1);
		assert.equal(secondBody.remaining, 0, 'nach beiden Läufen bleibt nichts mehr offen');
	});

	it('beschränkt den Lauf mit status=open auf offene und laufende Aufgaben (#1614)', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const memberId = await userIdOf(MEMBER_EMAIL);

		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Offen', status: 'Open', userId: memberId });
		await Task.create({ title: 'Läuft', status: 'In process', userId: memberId });
		const done = await Task.create({ title: 'Erledigt', status: 'Done', userId: memberId });

		const res = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?status=open`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as { updated: number; remaining: number };
		assert.equal(body.updated, 2, 'offene UND laufende Aufgabe');
		// `remaining` zählt dieselbe Auswahl wie der Lauf — sonst meldete es die erledigte mit.
		assert.equal(body.remaining, 0);
		assert.equal((await contributionsOf(done.id)).length, 0, 'erledigte Aufgabe unberührt');
	});

	it('weist einen ungültigen status mit 400 ab', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const res = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?status=halboffen`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(res.status, 400);
	});

	it('weist ein ungültiges limit mit 400 ab', async () => {
		const adminCookie = await server.login(ADMIN_EMAIL, { role: 'admin' });
		const res = await fetch(`${server.baseUrl}/admin/tasks/reassign-pillars?limit=0`, {
			method: 'POST',
			headers: { Cookie: adminCookie },
		});
		assert.equal(res.status, 400);
	});

	it('weist einen zweiten, gleichzeitigen Lauf mit 409 ab', async () => {
		await server.login(MEMBER_EMAIL, { role: 'member' });
		const memberId = await userIdOf(MEMBER_EMAIL);
		await Pillar.create({ userId: memberId, name: 'Karriere', weight: 1 });
		await Task.create({ title: 'Aufgabe', status: 'Open', userId: memberId });

		// Klassifikator hängt, bis der zweite Aufruf schon unterwegs war — simuliert die lange
		// Laufzeit eines echten Batches, gegen die das Lauf-Flag schützen soll.
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slowClassifier: PillarClassifier = (async (input: ClassifyPillarsInput) => {
			await gate;
			return input.pillars.length > 0 ? [{ pillarId: input.pillars[0].id, confidence: 100 }] : [];
		}) as PillarClassifier;
		const slowServer = await startTestServer({ pillarClassifier: slowClassifier });
		const postOnSlowServer = (cookie: string) =>
			fetch(`${slowServer.baseUrl}/admin/tasks/reassign-pillars`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});
		try {
			const slowAdminCookie = await slowServer.login(ADMIN_EMAIL, { role: 'admin' });
			const first = postOnSlowServer(slowAdminCookie);
			// Kurz warten, damit der erste Request das Lauf-Flag sicher gesetzt hat.
			await new Promise((resolve) => setTimeout(resolve, 20));
			const second = await postOnSlowServer(slowAdminCookie);
			assert.equal(second.status, 409);
			release();
			const firstRes = await first;
			assert.equal(firstRes.status, 200);
		} finally {
			await slowServer.close();
		}
	});
});
