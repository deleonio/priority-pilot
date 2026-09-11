import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, NotificationLog, PushSubscription, User } from '../models/index.js';
import type { PushSender } from '../logics/push.js';

/**
 * Rote Spec-Tests für #1391 — Aufgaben-Ersteller per Push benachrichtigen, wenn eine für ihn
 * angelegte Aufgabe erledigt wurde (Vertrag: docs/spec/issue-1391.md, TF1/TF3/TF4/TF5 für
 * AK1/AK3/AK4/AK5).
 *
 * Rollen wie #1224 (tasks-created-notification.test.ts): Alice (Erstellerin, Empfängerin der
 * Erledigt-Nachricht), Bob (Empfänger der Aufgabe, erledigt sie). Der Versand wird über den
 * injizierten `PushSender` (AppDeps → startTestServer, helpers.ts:119) gemockt — kein echter
 * Web-Push. Rot, bis `PATCH /tasks/:id` nach dem Commit den neuen Auslöser `task-completed`
 * (eigene NotificationLog-kind, dedupeKey = Task-Id) anstößt. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
applyTestAuthEnv('tasks-completed-notification-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

interface SentPush {
	endpoint: string;
	body: string;
}

let server: TestServer;
const calls: SentPush[] = [];
let senderFails = false;

/** Mock-Sender: zählt Aufrufe, kann per `senderFails` zum Werfen gezwungen werden (TF5/AK5). */
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

const seedSubscription = (userId: number, endpoint: string): Promise<PushSubscription> =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

describe('Benachrichtigung bei erledigter, fremd angelegter Aufgabe (#1391)', () => {
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

	/** Seedet Alice/Bob inkl. Zwei-Personen-Gruppe (Alice admin, Bob member) — Vorbild #1224. */
	const seedSharedGroup = async (): Promise<void> => {
		await server.login(ALICE, { displayName: 'Alice Erstellerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		const group = await Group.create({ name: 'Spec-Gruppe', description: null });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(ALICE), role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: await userIdOf(BOB), role: 'member', joinedAt: new Date() });
	};

	const postTask = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const patchTask = async (cookie: string, id: number, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	/** Legt über Alice eine Aufgabe für Bob an (createdById = Alice, userId = Bob). */
	const createTaskForBob = async (title: string): Promise<number> => {
		const bobId = await userIdOf(BOB);
		const res = await postTask(await server.login(ALICE), { title, userId: bobId });
		assert.equal(res.status, 201, 'Setup: POST für Bob muss 201 liefern');
		return ((await res.json()) as { id: number }).id;
	};

	// ── AK1: Ersteller mit Abo bekommt genau eine Nachricht je Abo, mit Titel + Erlediger-Name ──

	it('Bob erledigt Alices Aufgabe → genau eine Nachricht je Alice-Abo mit Titel und Bobs Anzeigename (AK1)', async () => {
		await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);
		await seedSubscription(aliceId, 'https://push.example/alice-1');
		await seedSubscription(aliceId, 'https://push.example/alice-2');
		const taskId = await createTaskForBob('Rasen mähen');

		const res = await patchTask(await server.login(BOB), taskId, { status: 'Done' });
		assert.equal(res.status, 200, 'PATCH auf Done muss 200 liefern');

		assert.equal(calls.length, 2, 'je Abo von Alice genau ein Versand (nicht mehr, nicht weniger)');
		assert.deepEqual(
			calls.map((call) => call.endpoint).sort(),
			['https://push.example/alice-1', 'https://push.example/alice-2'],
			'versendet wird an Alices eigene Abos',
		);
		const payload = JSON.parse(calls[0].body) as { title: string; body?: string };
		const text = `${payload.title} ${payload.body ?? ''}`;
		assert.ok(text.includes('Rasen mähen'), 'die Nachricht nennt den Aufgabentitel');
		assert.ok(text.includes('Bob Empfänger'), 'die Nachricht nennt den Anzeigenamen des Erledigers');
	});

	// ── AK3: Selbst-Anlage / kein Ersteller löst keine Nachricht aus ────────────────

	it('Bob erledigt selbst angelegte Aufgabe (kein createdById) → kein Versand, kein NotificationLog-Eintrag (AK3)', async () => {
		await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);
		await seedSubscription(aliceId, 'https://push.example/alice-1');
		const bobCookie = await server.login(BOB);

		const res1 = await postTask(bobCookie, { title: 'Eigene Aufgabe ohne Ersteller' });
		assert.equal(res1.status, 201);
		const taskId1 = ((await res1.json()) as { id: number }).id;
		const done1 = await patchTask(bobCookie, taskId1, { status: 'Done' });
		assert.equal(done1.status, 200);

		assert.equal(calls.length, 0, 'ohne createdById gibt es keinen Versand');
		const logs = await NotificationLog.findAll({ where: { kind: 'task-completed' } });
		assert.equal(logs.length, 0, 'ohne echten Fremd-Ersteller wird kein Dedupe-Eintrag angelegt');
	});

	// ── AK4: Dedupe — pro Aufgabe höchstens eine Erledigt-Nachricht ─────────────────

	it('erneutes Done-Patchen und Wiedereröffnen+erneutes Done lösen keinen zweiten Versand aus (AK4)', async () => {
		await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);
		await seedSubscription(aliceId, 'https://push.example/alice-1');
		const taskId = await createTaskForBob('Mehrfach erledigt');
		const bobCookie = await server.login(BOB);

		const first = await patchTask(bobCookie, taskId, { status: 'Done' });
		assert.equal(first.status, 200);
		assert.equal(calls.length, 1, 'erster Übergang auf Done sendet genau einmal');

		const secondDone = await patchTask(bobCookie, taskId, { status: 'Done' });
		assert.equal(secondDone.status, 200, 'erneutes Done bei bereits erledigtem Task bleibt 200');
		assert.equal(calls.length, 1, 'erneutes Done ohne echten Übergang sendet nicht erneut');

		const reopen = await patchTask(bobCookie, taskId, { status: 'Open' });
		assert.equal(reopen.status, 200);
		const doneAgain = await patchTask(bobCookie, taskId, { status: 'Done' });
		assert.equal(doneAgain.status, 200);
		assert.equal(calls.length, 1, 'Wiedereröffnen und erneutes Erledigen sendet für dieselbe Aufgabe kein zweites Mal');

		const logs = await NotificationLog.findAll({ where: { kind: 'task-completed', dedupeKey: String(taskId) } });
		assert.equal(logs.length, 1, 'je Aufgabe genau eine Dedupe-Zeile, auch nach mehrfachem Done');
	});

	// ── AK5: wirfender Sender — PATCH bleibt 200, kein Log-Eintrag ──────────────────

	it('PushSender wirft → PATCH bleibt 200 mit aktualisiertem Task, keine NotificationLog-Zeile (AK5)', async () => {
		await seedSharedGroup();
		const aliceId = await userIdOf(ALICE);
		await seedSubscription(aliceId, 'https://push.example/alice-1');
		const taskId = await createTaskForBob('Versand schlägt fehl');
		senderFails = true;

		const res = await patchTask(await server.login(BOB), taskId, { status: 'Done' });
		assert.equal(res.status, 200, 'ein fehlgeschlagener Versand darf nicht als Fehler durchgereicht werden');
		const body = (await res.json()) as { status: string };
		assert.equal(body.status, 'Done', 'der aktualisierte Task wird trotzdem zurückgegeben');

		const logs = await NotificationLog.findAll({ where: { kind: 'task-completed' } });
		assert.equal(logs.length, 0, 'bei sent=0 (Versand fehlgeschlagen) wird keine Dedupe-Zeile angelegt');
	});
});
