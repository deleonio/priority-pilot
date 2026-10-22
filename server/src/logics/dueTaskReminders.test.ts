import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Task, PushSubscription, NotificationLog, User, Series } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { collectDueTaskReminders, runDueTaskReminders } from './dueTaskReminders.js';
import type { PushSender } from './push.js';

/**
 * TF5/TF7 (AK5/AK7, #1426, Vertrag: docs/spec/issue-1426.md): der Trigger soll bei konfiguriertem
 * SMTP zusätzlich zur Push-Nachricht genau eine Mail verschicken; ein Mail-Fehler darf den Lauf
 * nicht abbrechen. `logics/mail.ts` existiert noch nicht — daher hier bewusst KEIN Import von dort
 * (würde die ganze Datei per Modul-Fehler rot machen und alle bestehenden Push-only-Tests oben mit
 * reißen). Stattdessen ein lokal typisierter Mail-Stub plus Cast auf die künftige, um einen
 * dritten Parameter erweiterte Signatur von `runDueTaskReminders` (Muster: MEMORY.md
 * 2026-08-23, Intersection-Typ für eine in der Impl-Phase erst entstehende API).
 */
type MailSenderStub = (payload: { to: string; subject: string; text: string }) => Promise<void>;
type RunDueTaskRemindersWithMail = (
	now: Date,
	send?: PushSender,
	mailSend?: MailSenderStub,
) => Promise<{ usersNotified: number }>;
const runDueTaskRemindersWithMail = runDueTaskReminders as unknown as RunDueTaskRemindersWithMail;

const NOW = new Date('2026-07-07T08:00:00Z');

type TaskOverrides = Partial<{
	title: string;
	status: 'Open' | 'In process' | 'Done';
	deadline: Date | null;
	userId: number | null;
}>;

const createTask = (overrides: TaskOverrides = {}) =>
	Task.create({
		title: overrides.title ?? 'Task',
		status: overrides.status ?? 'Open',
		priority: 3,
		estimatedEffort: 0.5,
		deadline: overrides.deadline ?? null,
		userId: overrides.userId ?? null,
	});

const seedSubscription = (userId: number | null, endpoint: string) =>
	PushSubscription.create({ endpoint, p256dh: 'p256dh', auth: 'auth', expirationTime: null, userId });

/** Legt den `User`-Datensatz für `userId: 1` an — Voraussetzung für `User.findByPk` im Mail-Pfad (AK5/AK7). */
const seedUser = () =>
	User.create({ email: 'reminder@example.com', displayName: 'Reminder Empfänger', passwordHash: '__test__' });

/** Erfolgs-Sender: zählt die Aufrufe und liefert die versendete Payload (Vorbild: push.test.ts). */
const okSender =
	(calls: { endpoint: string; body: string }[]): PushSender =>
	(subscription, payload) => {
		calls.push({ endpoint: subscription.endpoint, body: payload });
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

describe('logics/dueTaskReminders — fachlicher Push-Trigger „fällige Aufgaben" (Issue #355)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('erfasst fällige/überfällige offene Tasks, ignoriert ferne Deadlines und erledigte Tasks', async () => {
		await createTask({ title: 'bald fällig', deadline: new Date(NOW.getTime() + 2 * 60 * 60 * 1000), userId: 1 });
		await createTask({ title: 'überfällig', deadline: new Date(NOW.getTime() - 60 * 60 * 1000), userId: 1 });
		await createTask({
			title: 'noch weit weg',
			deadline: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000),
			userId: 1,
		});
		await createTask({
			title: 'erledigt',
			status: 'Done',
			deadline: new Date(NOW.getTime() - 60 * 60 * 1000),
			userId: 1,
		});
		await createTask({ title: 'ohne Deadline', deadline: null, userId: 1 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 1);
		const titles = groups[0].tasks.map((task) => task.title).sort();
		assert.deepEqual(titles, ['bald fällig', 'überfällig']);
	});

	it('isoliert nach userId — jeder Nutzer bekommt nur seine eigenen fälligen Tasks', async () => {
		await createTask({ title: 'A fällig', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'B fällig', deadline: new Date(NOW.getTime() - 1000), userId: 2 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 2);
		const byUser = new Map(groups.map((group) => [group.userId, group.tasks.map((task) => task.title)]));
		assert.deepEqual(byUser.get(1), ['A fällig']);
		assert.deepEqual(byUser.get(2), ['B fällig']);
	});

	it('bündelt mehrere fällige Tasks eines Nutzers in eine Gruppe (keine Notification je Task)', async () => {
		await createTask({ title: 'Task 1', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 2', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 3', deadline: new Date(NOW.getTime() - 1000), userId: 1 });

		const groups = await collectDueTaskReminders(NOW);

		assert.equal(groups.length, 1);
		assert.equal(groups[0].tasks.length, 3);
	});

	it('versendet eine gebündelte Payload je Nutzer über sendPushToUser', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 1);
		assert.equal(calls.length, 1);
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.title, 'Fällige Aufgabe');
		assert.equal(payload.body, 'Rechnung zahlen');
		assert.equal(payload.url, '/');
	});

	it('bündelt bei mehreren fälligen Tasks eine zusammenfassende Payload mit Anzahl', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Task 1', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		await createTask({ title: 'Task 2', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(calls.length, 1, 'genau eine Notification statt einer je Task');
		const payload = JSON.parse(calls[0].body);
		assert.equal(payload.title, 'Fällige Aufgaben');
		assert.match(payload.body, /2/);
	});

	it('ist idempotent — ein zweiter Lauf ohne neue fällige Termine sendet nichts erneut', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const first = await runDueTaskReminders(NOW, okSender(calls));
		const second = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(first.usersNotified, 1);
		assert.equal(second.usersNotified, 0, 'zweiter Lauf ohne neue fällige Termine meldet niemanden erneut');
		assert.equal(calls.length, 1, 'der Versand wurde nicht wiederholt');
		// #2849 AK2 (Test-Pflege): zum Task-Log kommt die Tag-Deckel-Marker-Zeile (<userId>:<lokalesDatum>) hinzu.
		assert.equal(await NotificationLog.count(), 2);
	});

	it('erinnert erneut, wenn sich die Deadline eines bereits gemeldeten Tasks verschiebt', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		const task = await createTask({ title: 'verschoben', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		await runDueTaskReminders(NOW, okSender(calls));
		await task.update({ deadline: new Date(NOW.getTime() + 1000) });
		// #2849 AK2 (Test-Pflege): der Tag-Deckel begrenzt je Nutzer und lokalem Tag auf einen Push —
		// die verschobene Deadline löst die Erinnerung deshalb erst am Folgetag erneut aus.
		const second = await runDueTaskReminders(new Date(NOW.getTime() + 24 * 60 * 60 * 1000), okSender(calls));

		assert.equal(second.usersNotified, 1, 'eine geänderte Deadline löst die Erinnerung erneut aus');
		assert.equal(calls.length, 2);
	});

	it('ohne fällige Tasks bleibt der Lauf ein No-op (kein Versand, kein Log-Eintrag)', async () => {
		await createTask({ title: 'weit weg', deadline: new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0);
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0);
	});

	it('ignoriert Tasks mit userId = null — kein Broadcast an alle Subscriptions', async () => {
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Aufgabe ohne Nutzer', deadline: new Date(NOW.getTime() - 1000), userId: null });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'Tasks ohne userId dürfen keine Push-Nachricht auslösen');
		assert.equal(calls.length, 0);
	});

	it('legt keinen NotificationLog-Eintrag an, wenn der Nutzer keine Subscription hat', async () => {
		// keine seedSubscription für userId 1
		await createTask({ title: 'fällig', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];

		const result = await runDueTaskReminders(NOW, okSender(calls));

		assert.equal(result.usersNotified, 0, 'kein Push → nicht als "notified" zählen');
		assert.equal(calls.length, 0);
		assert.equal(await NotificationLog.count(), 0, 'ohne gesendeten Push kein Log-Eintrag');
	});

	it('AK5: verschickt zusätzlich zur Push-Nachricht genau eine Mail; zweiter Lauf sendet auf keinem Kanal erneut', async () => {
		await seedUser();
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const pushCalls: { endpoint: string; body: string }[] = [];
		const mailCalls: { to: string; subject: string; text: string }[] = [];
		const mailSend: MailSenderStub = (payload) => {
			mailCalls.push(payload);
			return Promise.resolve();
		};

		const first = await runDueTaskRemindersWithMail(NOW, okSender(pushCalls), mailSend);
		const second = await runDueTaskRemindersWithMail(NOW, okSender(pushCalls), mailSend);

		assert.equal(first.usersNotified, 1);
		assert.equal(pushCalls.length, 1, 'genau eine Push-Nachricht');
		assert.equal(mailCalls.length, 1, 'genau eine Mail zusätzlich zur Push-Nachricht');
		assert.equal(second.usersNotified, 0, 'zweiter Lauf ohne neue fällige Termine sendet auf keinem Kanal erneut');
		assert.equal(await NotificationLog.count(), 2, 'Task-Log plus Tag-Deckel-Marker (#2849 AK2), nicht pro Kanal');
	});

	it('AK7: schlägt der Mail-Versand fehl, wird die Push-Nachricht dennoch zugestellt und der Log-Eintrag geschrieben', async () => {
		await seedUser();
		await seedSubscription(1, 'https://push.example.com/a');
		await createTask({ title: 'Rechnung zahlen', deadline: new Date(NOW.getTime() - 1000), userId: 1 });
		const pushCalls: { endpoint: string; body: string }[] = [];
		let failingMailSendCalls = 0;
		const failingMailSend: MailSenderStub = () => {
			failingMailSendCalls++;
			return Promise.reject(new Error('SMTP-Transport fehlgeschlagen'));
		};

		const result = await runDueTaskRemindersWithMail(NOW, okSender(pushCalls), failingMailSend);

		assert.equal(
			failingMailSendCalls,
			1,
			'der Mail-Versand wird tatsächlich versucht (sonst prüft der Test AK7 nicht)',
		);

		assert.equal(result.usersNotified, 1, 'ein fehlgeschlagener Mail-Versand bricht den Lauf nicht ab');
		assert.equal(pushCalls.length, 1, 'die Push-Nachricht wird trotz Mail-Fehler zugestellt');
		assert.equal(
			await NotificationLog.count(),
			2,
			'Log plus Tag-Deckel-Marker (#2849 AK2), weil mindestens ein Kanal erfolgreich war',
		);
	});
	// #1518 AK7 (Spec docs/spec/issue-1518.md, Journey 2): je Serie höchstens eine Instanz im Fälligkeits-Push.
	it('#1518 AK7: fünf fällige Instanzen derselben Serie ergeben genau einen Eintrag', async () => {
		const series = await Series.create({
			title: 'Täglich',
			rhythm: 'daily',
			priority: 3,
			estimatedEffort: 0.5,
			active: true,
			startDate: NOW,
		});
		for (let offset = 0; offset < 5; offset += 1) {
			const occurrence = new Date(NOW.getTime() - offset * 60 * 60 * 1000);
			await Task.create({
				title: 'Täglich',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				deadline: occurrence,
				seriesId: series.id,
				seriesOccurrence: occurrence,
				originSeriesId: series.id,
				userId: 1,
			});
		}
		await createTask({ title: 'Einzeln', deadline: NOW, userId: 1 });

		const groups = await collectDueTaskReminders(NOW);
		assert.equal(groups.length, 1);
		const titles = groups[0].tasks.map((task) => task.title).sort();
		assert.deepEqual(titles, ['Einzeln', 'Täglich'], 'die Serie erscheint genau einmal');
	});
});

// Rote Spec-Tests für #2849 (Spec docs/spec/issue-2849.md): Fenster lokale Stunde 7–8 je
// Empfänger-Zeitzone, Tag-Dedup je Trigger, UTC-Fallback ohne gültige Zone. KEIN Produktivcode.
describe('logics/dueTaskReminders — Fenster & Zeitzone (#2849)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK2: sendet nur bei lokaler Stunde 7–8; ein Wiederholungstick mit neuer fälliger Aufgabe sendet nichts mehr', async () => {
		await User.create({
			email: 'due-berlin@example.com',
			displayName: 'Berlin',
			passwordHash: '__test__',
			zeitzone: 'Europe/Berlin',
		} as never);
		await seedSubscription(1, 'https://push.example.com/d1');
		await createTask({ title: 'eins', deadline: new Date('2026-07-07T05:00:00Z'), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const vorFenster = await runDueTaskReminders(new Date('2026-07-07T03:59:00Z'), send); // 05:59 Berlin
		assert.equal(vorFenster.usersNotified, 0, '05:59 lokal liegt vor dem Fenster');

		const morgens = await runDueTaskReminders(new Date('2026-07-07T05:00:00Z'), send); // 07:00 Berlin
		assert.equal(morgens.usersNotified, 1, '07:00 lokal öffnet das Fenster');

		// Neue fällige Aufgabe im selben Fenster: Tag-Dedup je Trigger verhindert den zweiten Push.
		await createTask({ title: 'zwei', deadline: new Date('2026-07-07T06:20:00Z'), userId: 1 });
		const wiederholung = await runDueTaskReminders(new Date('2026-07-07T06:30:00Z'), send); // 08:30 Berlin
		assert.equal(wiederholung.usersNotified, 0, 'höchstens ein Push je Nutzer und lokalem Tag');
		assert.equal(calls.length, 1);

		// Frische Nutzer für den oberen Fensterrand (Dedup darf die Grenze nicht vorgaukeln).
		// Test-Pflege #2849: die Zeilen referenzieren die Ids 2/3 ohne Anlage — nachgetragen.
		await User.create({
			email: 'due-rand-2@example.com',
			displayName: 'Rand 2',
			passwordHash: '__test__',
			zeitzone: 'Europe/Berlin',
		} as never);
		await seedSubscription(2, 'https://push.example.com/d2');
		await createTask({ title: 'drei', deadline: new Date('2026-07-07T05:00:00Z'), userId: 2 });
		const rand = await runDueTaskReminders(new Date('2026-07-07T06:59:00Z'), send); // 08:59 Berlin
		assert.equal(rand.usersNotified, 1, '08:59 lokal gehört noch zum Fenster');
		await User.create({
			email: 'due-rand-3@example.com',
			displayName: 'Rand 3',
			passwordHash: '__test__',
			zeitzone: 'Europe/Berlin',
		} as never);
		await seedSubscription(3, 'https://push.example.com/d3');
		await createTask({ title: 'vier', deadline: new Date('2026-07-07T05:00:00Z'), userId: 3 });
		const zu = await runDueTaskReminders(new Date('2026-07-07T07:00:00Z'), send); // 09:00 Berlin
		assert.equal(zu.usersNotified, 0, '09:00 lokal liegt außerhalb des Fensters');
		assert.equal(calls.length, 2);
	});

	it('AK3: Fenster folgen der Empfängerzeitzone — New York sendet zu 11:30Z, nicht zu 05:30Z', async () => {
		await User.create({
			email: 'due-ny@example.com',
			displayName: 'NY',
			passwordHash: '__test__',
			zeitzone: 'America/New_York',
		} as never);
		await seedSubscription(1, 'https://push.example.com/d4');
		await createTask({ title: 'ny', deadline: new Date('2026-07-07T10:00:00Z'), userId: 1 });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const nachts = await runDueTaskReminders(new Date('2026-07-07T05:30:00Z'), send); // 01:30 New York
		assert.equal(nachts.usersNotified, 0, '01:30 New York liegt außerhalb — die UTC-Stunde 5:30 zählt nicht');
		const morgens = await runDueTaskReminders(new Date('2026-07-07T11:30:00Z'), send); // 07:30 New York
		assert.equal(morgens.usersNotified, 1, '07:30 New York liegt im Fenster');
		assert.equal(calls.length, 1);
	});

	it('AK5: ohne/ungültige Zeitzone gelten die Fenster in UTC — 05:30Z keiner, 07:30Z beide', async () => {
		await User.create({
			email: 'due-null@example.com',
			displayName: 'Null',
			passwordHash: '__test__',
			zeitzone: null,
		} as never);
		await User.create({
			email: 'due-mars@example.com',
			displayName: 'Mars',
			passwordHash: '__test__',
			zeitzone: 'Mars/Olympus',
		} as never);
		await seedSubscription(1, 'https://push.example.com/d5');
		await seedSubscription(2, 'https://push.example.com/d6');
		await createTask({ title: 'a', deadline: new Date('2026-07-07T04:00:00Z'), userId: 1 });
		await createTask({ title: 'b', deadline: new Date('2026-07-07T04:00:00Z'), userId: 2 });
		const calls: { endpoint: string; body: string }[] = [];
		const send = okSender(calls);

		const frueh = await runDueTaskReminders(new Date('2026-07-07T05:30:00Z'), send);
		assert.equal(frueh.usersNotified, 0, 'UTC 05:30 liegt vor dem Fenster (7–8)');
		const morgens = await runDueTaskReminders(new Date('2026-07-07T07:30:00Z'), send);
		assert.equal(morgens.usersNotified, 2, 'UTC 07:30 liegt im Fenster');
		assert.equal(calls.length, 2);
	});
});
