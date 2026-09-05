import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, NotificationLog, PushSubscription, User } from '../models/index.js';
import { isPushConfigured, type PushSender } from '../logics/push.js';

/**
 * Rote Spec-Tests für #1224 — Benachrichtigung, wenn jemand eine Aufgabe für mich anlegt
 * (Vertrag: docs/spec/issue-1224.md, TF1–TF6 für AK1–AK6).
 *
 * Rollen wie #1213 (tasks-created-by.test.ts): Alice (Erstellerin), Bob (Empfänger, gemeinsame
 * Gruppe), Carol (Drittkonto ohne gemeinsame Gruppe). Der Versand wird über den injizierten
 * `PushSender` (AppDeps → startTestServer, helpers.ts:119) gemockt — kein echter Web-Push.
 *
 * Rot, bis POST /tasks nach dem Commit den neuen Auslöser `task-created` (eigene NotificationLog-
 * kind, dedupeKey = Task-Id) ohne Blockierung/Blockier-Risiko des Anlegens anstößt. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com,carol@example.com';
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
applyTestAuthEnv('tasks-created-notification-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

interface SentPush {
	endpoint: string;
	body: string;
}

let server: TestServer;
const calls: SentPush[] = [];
let senderFails = false;

/** Mock-Sender: zählt Aufrufe, kann per `senderFails` zum Werfen gezwungen werden (TF4/AK4). */
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

describe('Benachrichtigung bei fremd angelegter Aufgabe (#1224)', () => {
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

	/** Seedet Alice/Bob inkl. Zwei-Personen-Gruppe (Alice admin, Bob member) — Vorbild #1213. */
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

	const listTasks = async (cookie: string): Promise<{ id: number; title: string }[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
		return (await res.json()) as { id: number; title: string }[];
	};

	// ── AK1: Empfänger mit Abo bekommt genau eine Nachricht je Abo, mit Titel + Ersteller-Name ──

	it('Aufgabe für Bob angelegt → genau eine Nachricht je Abo mit Titel und Anzeigename von Alice (AK1)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		await seedSubscription(bobId, 'https://push.example/bob-1');
		await seedSubscription(bobId, 'https://push.example/bob-2');

		const res = await postTask(await server.login(ALICE), { title: 'Milch holen', userId: bobId });
		assert.equal(res.status, 201, 'POST mit empfänger-userId muss 201 liefern');

		assert.equal(calls.length, 2, 'je Abo von Bob genau ein Versand (nicht mehr, nicht weniger)');
		assert.deepEqual(
			calls.map((call) => call.endpoint).sort(),
			['https://push.example/bob-1', 'https://push.example/bob-2'],
			'versendet wird an Bs eigene Abos',
		);
		const payload = JSON.parse(calls[0].body) as { title: string; body?: string };
		const text = `${payload.title} ${payload.body ?? ''}`;
		assert.ok(text.includes('Milch holen'), 'die Nachricht nennt den Aufgabentitel');
		assert.ok(text.includes('Alice Erstellerin'), 'die Nachricht nennt den Anzeigenamen der Erstellerin');
	});

	// ── AK2: Selbst-Anlage löst keine Nachricht aus ──────────────────────────────────

	it('Alice legt für sich selbst an → kein Versand, kein NotificationLog-Eintrag (AK2)', async () => {
		await seedSharedGroup();
		const aliceCookie = await server.login(ALICE);
		const aliceId = await userIdOf(ALICE);

		const res1 = await postTask(aliceCookie, { title: 'Eigene Aufgabe ohne userId' });
		assert.equal(res1.status, 201, 'POST ohne userId muss 201 liefern');
		const res2 = await postTask(aliceCookie, { title: 'Eigene Aufgabe mit eigener ID', userId: aliceId });
		assert.equal(res2.status, 201, 'POST mit der eigenen ID muss 201 liefern');

		assert.equal(calls.length, 0, 'der Ersteller erhält keine Nachricht über die eigene Anlage');
		const logs = await NotificationLog.findAll({ where: { kind: 'task-created' } });
		assert.equal(logs.length, 0, 'zur Selbst-Anlage wird kein Dedupe-Eintrag angelegt');
	});

	// ── AK3: Empfänger ohne Abo — Anlegen bleibt unbeeinträchtigt ────────────────────

	it('Bob ohne Push-Abo → 201 und Aufgabe in Bs Liste (AK3)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const bobCookie = await server.login(BOB);

		const res = await postTask(await server.login(ALICE), { title: 'Ohne Abo angelegt', userId: bobId });
		assert.equal(res.status, 201, 'fehlendes Abo darf das Anlegen nicht blockieren');
		const bobList = await listTasks(bobCookie);
		assert.ok(
			bobList.some((task) => task.title === 'Ohne Abo angelegt'),
			'die Aufgabe ist bei Bob angelegt',
		);
		assert.equal(calls.length, 0, 'ohne Abo gibt es keinen Versand');
	});

	// ── AK4: wirfender Sender — Anlegen bleibt erhalten, Fehler wird protokolliert ───

	it('PushSender wirft → trotzdem 201, Aufgabe angelegt, Fehler protokolliert (AK4)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		await seedSubscription(bobId, 'https://push.example/bob-1');
		senderFails = true;
		const warnings: unknown[] = [];
		const originalWarn = console.warn;
		const originalError = console.error;
		console.warn = (...args: unknown[]): void => warnings.push(args);
		console.error = (...args: unknown[]): void => warnings.push(args);

		try {
			const res = await postTask(await server.login(ALICE), { title: 'Push liegt brach', userId: bobId });
			assert.equal(res.status, 201, 'ein fehlgeschlagener Versand darf nicht als Fehler durchgereicht werden');
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
		}
		assert.ok(warnings.length > 0, 'der Versandfehler wird serverseitig protokolliert');

		const bobList = await listTasks(await server.login(BOB));
		assert.ok(
			bobList.some((task) => task.title === 'Push liegt brach'),
			'die Aufgabe wurde trotzdem angelegt',
		);
	});

	// ── AK5: Dedupe — eigene kind, dedupeKey = Task-Id, pro Aufgabe ──────────────────

	it('NotificationLog: kind=task-created, dedupeKey = Task-Id; zweite Aufgabe bekommt eigenen Eintrag (AK5)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		await seedSubscription(bobId, 'https://push.example/bob-1');

		const res1 = await postTask(await server.login(ALICE), { title: 'Erste fremde Aufgabe', userId: bobId });
		assert.equal(res1.status, 201);
		const taskId1 = ((await res1.json()) as { id: number }).id;

		const logs1 = await NotificationLog.findAll({ where: { kind: 'task-created' } });
		assert.equal(logs1.length, 1, 'genau ein Dedupe-Eintrag zur ersten Aufgabe');
		assert.equal(logs1[0].dedupeKey, String(taskId1), 'der dedupeKey ist aus der Aufgaben-Id gebildet');
		assert.ok(
			!['due-task', 'daily-top-tasks'].includes(logs1[0].kind),
			'die eigene kind kollidiert nicht mit den Scheduler-Auslösern',
		);

		// Zweiter POST = zweite Aufgabe: Dedupe gilt pro Aufgabe, nicht global pro Nutzer.
		const res2 = await postTask(await server.login(ALICE), { title: 'Zweite fremde Aufgabe', userId: bobId });
		assert.equal(res2.status, 201);
		const taskId2 = ((await res2.json()) as { id: number }).id;
		assert.notEqual(taskId2, taskId1, 'der zweite POST legt eine eigenständige Aufgabe an');

		assert.equal(calls.length, 2, 'die zweite Aufgabe bekommt ihre eigene Nachricht');
		const logs2 = await NotificationLog.findAll({ where: { kind: 'task-created' } });
		assert.equal(logs2.length, 2, 'je Aufgabe genau ein Dedupe-Eintrag');
		assert.deepEqual(
			logs2.map((log) => log.dedupeKey).sort(),
			[String(taskId1), String(taskId2)].sort(),
			'je Aufgabe ein eigener dedupeKey aus der Aufgaben-Id',
		);
	});

	// ── AK6: Injektion über AppDeps — kein VAPID-Gate im Weg ─────────────────────────

	it('Versand läuft über den injizierten PushSender, ohne dass Web-Push konfiguriert ist (AK6)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		await seedSubscription(bobId, 'https://push.example/bob-1');
		assert.equal(isPushConfigured(), false, 'Test läuft bewusst ohne VAPID-Konfiguration');

		const res = await postTask(await server.login(ALICE), { title: 'Ohne VAPID benachrichtigt', userId: bobId });
		assert.equal(res.status, 201);
		assert.equal(calls.length, 1, 'der neue Codepfad nutzt den injizierten Sender, nicht das VAPID-Gate');
	});
});
