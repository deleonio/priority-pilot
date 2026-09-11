import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { NotificationLog, PushSubscription, ScoreEntry, Task, User } from '../models/index.js';
import type { PushSender } from '../logics/push.js';

/**
 * Rote Spec-Tests für #1363 — lobende Push-Meldung bei neu erreichten Meilensteinen
 * (Vertrag: docs/spec/issue-1363.md, TF1/TF2/TF6/TF7 für AK1/AK2/AK6/AK7).
 *
 * Rot, bis `PATCH /tasks/:id` nach dem Statuswechsel auf „Done" den Vorher/Nachher-Meilensteinstand
 * vergleicht und `notifyReachedMilestones` aufruft. KEIN Produktivcode in dieser Spec-Phase.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'milestone@example.com';
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
applyTestAuthEnv('tasks-milestone-push-test');

const EMAIL = 'milestone@example.com';

let server: TestServer;
const calls: { endpoint: string; body: string }[] = [];
let senderFails = false;

const mockSender: PushSender = (subscription, payload) => {
	calls.push({ endpoint: subscription.endpoint, body: payload });
	if (senderFails) {
		return Promise.reject(new Error('Push-Dienst nicht erreichbar (Test)'));
	}
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Setup: Konto ${email} muss existieren`);
	return user.id;
};

describe('Meilenstein-Push bei Statuswechsel auf Done (#1363)', () => {
	before(async () => {
		server = await startTestServer({ pushSender: mockSender });
	});
	beforeEach(async () => {
		await resetDb();
		calls.length = 0;
		senderFails = false;
	});
	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const patch = (cookie: string, path: string, body: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});
	const post = (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const createTask = async (cookie: string): Promise<number> => {
		// estimatedEffort × priority = 1 × 5 = 5 Basispunkte je Task (Grenzen: priority 1–5,
		// estimatedEffort 0.1–1, tasks.ts:258/270).
		const res = await post(cookie, { title: 'Meilenstein-Task', priority: 5, estimatedEffort: 1 });
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	/**
	 * Bringt den Nutzer per direkt erzeugten ScoreEntries auf 45 Punkte (knapp unter der
	 * punkte-50-Schwelle), ohne 9 Tasks über die API abzuarbeiten — der anschließende „Done" der
	 * Test-Task (5 Punkte) überschreitet die Schwelle bei exakt 50.
	 */
	const seedFortyFivePoints = async (userId: number): Promise<void> => {
		for (let i = 0; i < 9; i++) {
			const task = await Task.create({
				title: `Vorlauf-Task ${i}`,
				priority: 5,
				estimatedEffort: 1,
				status: 'Done',
				userId,
			});
			await ScoreEntry.create({ taskId: task.id, punkte: 5, pünktlich: true, zeitpunkt: new Date() });
		}
	};

	const seedSubscription = (userId: number, endpoint: string): Promise<PushSubscription> =>
		PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

	// ── AK1/TF1: Push-Subscription vorhanden, Schwelle wird überschritten ───────────

	it('Done überschreitet die punkte-50-Schwelle → genau eine Push-Nachricht mit Meilenstein-Text (AK1)', async () => {
		const cookie = await server.login(EMAIL, { displayName: 'Meilenstein-Nutzerin' });
		const userId = await userIdOf(EMAIL);
		await seedSubscription(userId, 'https://push.example/milestone-1');
		await seedFortyFivePoints(userId);
		const taskId = await createTask(cookie);

		const res = await patch(cookie, `/tasks/${taskId}`, { status: 'Done' });
		assert.equal(res.status, 200, 'PATCH auf Done muss 200 liefern');

		assert.equal(calls.length, 1, 'genau eine Meilenstein-Nachricht beim Überschreiten der Schwelle');
		const payload = JSON.parse(calls[0].body) as { title: string; body?: string; url?: string };
		const text = `${payload.title} ${payload.body ?? ''}`;
		assert.ok(/50/.test(text), 'die Nachricht nennt die erreichte Schwelle');
		assert.equal(payload.url, '/', 'die Nachricht verlinkt auf die App-Wurzel');
	});

	// ── AK2/TF2: kein Push-Opt-in → kein Versand, kein Log, PATCH bleibt unberührt ──

	it('ohne Push-Subscription → kein Versand, 200, keine NotificationLog-Zeile (AK2)', async () => {
		const cookie = await server.login(EMAIL, { displayName: 'Meilenstein-Nutzerin' });
		const taskId = await createTask(cookie);

		const res = await patch(cookie, `/tasks/${taskId}`, { status: 'Done' });
		assert.equal(res.status, 200, 'fehlendes Push-Abo darf den PATCH nicht blockieren');

		assert.equal(calls.length, 0, 'ohne Abo gibt es keinen Versand');
		const logs = await NotificationLog.findAll({ where: { kind: 'milestone' } });
		assert.equal(logs.length, 0, 'ohne Versand entsteht kein Dedupe-Eintrag');
	});

	// ── AK6/TF6: wirfender PushSender bricht den PATCH nicht ────────────────────────

	it('PushSender wirft → PATCH bleibt trotzdem 200 mit Task-JSON (AK6)', async () => {
		const cookie = await server.login(EMAIL, { displayName: 'Meilenstein-Nutzerin' });
		const userId = await userIdOf(EMAIL);
		await seedSubscription(userId, 'https://push.example/milestone-1');
		await seedFortyFivePoints(userId);
		const taskId = await createTask(cookie);
		senderFails = true;
		const originalWarn = console.warn;
		const originalError = console.error;
		const warnings: unknown[] = [];
		console.warn = (...args: unknown[]): void => warnings.push(args);
		console.error = (...args: unknown[]): void => warnings.push(args);

		let res: Response;
		try {
			res = await patch(cookie, `/tasks/${taskId}`, { status: 'Done' });
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
		}

		assert.equal(res.status, 200, 'ein fehlgeschlagener Meilenstein-Versand darf den PATCH nicht kippen');
		const task = (await res.json()) as { id: number; status: string };
		assert.equal(task.status, 'Done', 'der Task ist trotz Versandfehler erledigt');
		assert.ok(warnings.length > 0, 'der Versandfehler wird serverseitig protokolliert');
	});

	// ── AK7/TF7: Score-Rücknahme (Done → Open) löst keine Meldung aus ──────────────

	it('Statuswechsel weg von Done (Score-Rücknahme, #228) löst keine Meilenstein-Meldung aus (AK7)', async () => {
		const cookie = await server.login(EMAIL, { displayName: 'Meilenstein-Nutzerin' });
		const userId = await userIdOf(EMAIL);
		await seedSubscription(userId, 'https://push.example/milestone-1');
		await seedFortyFivePoints(userId);
		const taskId = await createTask(cookie);

		await patch(cookie, `/tasks/${taskId}`, { status: 'Done' });
		assert.equal(calls.length, 1, 'Vorbedingung: Done hat den Meilenstein bereits gemeldet');
		calls.length = 0;

		const res = await patch(cookie, `/tasks/${taskId}`, { status: 'Open' });
		assert.equal(res.status, 200, 'Wiedereröffnen muss 200 liefern');
		assert.equal(calls.length, 0, 'die Score-Rücknahme beim Wiedereröffnen löst keinen Versand aus');
	});
});
