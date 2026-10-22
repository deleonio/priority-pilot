import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, Task, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import type { MailSender } from './mail.js';
import { sendDedupedPush } from './dedupedPush.js';
import { BUDGET_KIND } from './pushBudget.js';
import { runDailyDigest } from './dailyDigest.js';

/**
 * Tests für den Morgen-Digest „Dein Tag“ (#2853 AK3, Spec `docs/spec/issue-2853.md`): fällige
 * Aufgaben und Top-Aufgaben gehen als **genau eine** Push-Nachricht je Nutzer und lokalem Tag
 * raus, mit den URL-Regeln aus Konzept §6. Ein Wiederholungstick am selben lokalen Tag sendet
 * nichts — auch nicht mit neuer fälliger Aufgabe. Seit F2.2 geht zusätzlich die Morgen-Mail
 * (#1426) an die SMTP-Empfänger. Dazu die Fenster-/Zeitzonen-Tests (#2849) des früheren
 * due-task-Triggers, dessen Verantwortung mit der Bündelung auf den Digest überging.
 *
 * Nutzer ohne `zeitzone` fallen auf UTC — `NOW` (08:00Z) liegt im Morgenfenster 7–9 UTC.
 */

const NOW = new Date('2026-07-07T08:00:00Z');

const pushCalls: string[] = [];
const mockSend: PushSender = (_subscription, p) => {
	pushCalls.push(p);
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

const seedSubscription = async (userId: number): Promise<void> => {
	await PushSubscription.create({
		endpoint: `https://push.example/user-${userId}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId,
	});
};

const createTask = (overrides: Partial<{ title: string; deadline: Date | null; priority: number; userId: number }>) =>
	Task.create({
		title: 'Aufgabe',
		status: 'Open',
		priority: 2,
		estimatedEffort: 1,
		deadline: null,
		userId: 1,
		...overrides,
	});

/** Empfänger-Datensatz (E-Mail und/oder Zeitzone) — Voraussetzung für Mail-Pfad und Zeitzonen-Fenster. */
const erstelleEmpfaenger = async (email: string, zeitzone?: string): Promise<User> =>
	User.create({
		email,
		displayName: 'Empfänger',
		passwordHash: '__test__',
		...(zeitzone ? { zeitzone } : {}),
	} as never);

describe('dailyDigest — Morgen-Push „Dein Tag“ (#2853 AK3)', () => {
	beforeEach(async () => {
		await resetDb();
		pushCalls.length = 0;
	});
	after(async () => {
		await closeDb();
	});

	it('AK3/TF3: bündelt fällige und Top-Aufgaben zu genau einer Nachricht „Dein Tag“ mit Karte-Deadlines-URL', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
		await createTask({ title: 'Laufen', priority: 3 });

		const result = await runDailyDigest(NOW, mockSend);

		assert.equal(result.usersNotified, 1);
		assert.equal(pushCalls.length, 1, 'genau eine gebündelte Nachricht statt zwei Morgen-Pushes');
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.title, 'Dein Tag');
		assert.equal(payload.url, '/#karte-deadlines', 'mehrere Aufgaben mit fälliger dabei → Karte „Fällig“');
	});

	it('#2850 AK3: ausgeschaltete Gruppe „Aufgaben und Erinnerungen“ stoppt den Digest', async () => {
		const empfaenger = await erstelleEmpfaenger('gruppe-aus@example.com');
		await empfaenger.update({ taskPushEnabled: false } as never);
		await seedSubscription(empfaenger.id);
		await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z'), userId: empfaenger.id });

		const result = await runDailyDigest(NOW, mockSend);

		assert.equal(result.usersNotified, 0);
		assert.equal(pushCalls.length, 0);
	});

	it('AK3: enthält die Nachricht genau eine Aufgabe, öffnet sie diese Aufgabe', async () => {
		await seedSubscription(1);
		const task = await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });

		await runDailyDigest(NOW, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.url, `/tasks/${task.id}`);
	});

	it('AK3: mehrere Top-Aufgaben ohne fällige öffnen die Karte „Top-Aufgaben“', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', priority: 1 });
		await createTask({ title: 'Laufen', priority: 3 });

		await runDailyDigest(NOW, mockSend);

		assert.equal(pushCalls.length, 1);
		const payload = JSON.parse(pushCalls[0] ?? '{}');
		assert.equal(payload.url, '/#karte-top-aufgaben');
	});

	it('AK3: ein Wiederholungstick am selben lokalen Tag sendet nichts — auch nicht mit neuer fälliger Aufgabe', async () => {
		await seedSubscription(1);
		await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
		await runDailyDigest(NOW, mockSend);
		assert.equal(pushCalls.length, 1);

		await createTask({ title: 'Neu dazugekommen', deadline: new Date('2026-07-07T12:00:00Z') });
		const result = await runDailyDigest(NOW, mockSend);

		assert.equal(result.usersNotified, 0);
		assert.equal(pushCalls.length, 1, 'kein zweiter „Dein Tag“-Push am selben lokalen Tag');
	});

	// #2849-Fenster des früheren due-task-Triggers, auf den Digest (Fenster 7–9) übertragen.
	describe('Fenster & Zeitzone (#2849)', () => {
		it('AK2: sendet nur bei lokaler Stunde 7–9; ein Wiederholungstick mit neuer fälliger Aufgabe sendet nichts mehr', async () => {
			await erstelleEmpfaenger('digest-berlin@example.com', 'Europe/Berlin');
			await seedSubscription(1);
			await createTask({ title: 'eins', deadline: new Date('2026-07-07T05:00:00Z') });

			const vorFenster = await runDailyDigest(new Date('2026-07-07T03:59:00Z'), mockSend); // 05:59 Berlin
			assert.equal(vorFenster.usersNotified, 0, '05:59 lokal liegt vor dem Fenster');

			const morgens = await runDailyDigest(new Date('2026-07-07T05:00:00Z'), mockSend); // 07:00 Berlin
			assert.equal(morgens.usersNotified, 1, '07:00 lokal öffnet das Fenster');

			// Neue fällige Aufgabe im selben Fenster: Tag-Deckel verhindert den zweiten Push.
			await createTask({ title: 'zwei', deadline: new Date('2026-07-07T06:20:00Z') });
			const wiederholung = await runDailyDigest(new Date('2026-07-07T06:30:00Z'), mockSend); // 08:30 Berlin
			assert.equal(wiederholung.usersNotified, 0, 'höchstens ein „Dein Tag“ je Nutzer und lokalem Tag');
			assert.equal(pushCalls.length, 1);

			// Frische Nutzer für die Fensterränder (der Dedup darf die Grenze nicht vorgaukeln).
			await erstelleEmpfaenger('digest-rand@example.com', 'Europe/Berlin');
			await seedSubscription(2);
			await createTask({ title: 'drei', deadline: new Date('2026-07-07T05:00:00Z'), userId: 2 });
			const rand = await runDailyDigest(new Date('2026-07-07T06:59:00Z'), mockSend); // 08:59 Berlin
			assert.equal(rand.usersNotified, 1, '08:59 lokal gehört noch zum Fenster');
			await erstelleEmpfaenger('digest-zu@example.com', 'Europe/Berlin');
			await seedSubscription(3);
			await createTask({ title: 'vier', deadline: new Date('2026-07-07T05:00:00Z'), userId: 3 });
			const zu = await runDailyDigest(new Date('2026-07-07T07:00:00Z'), mockSend); // 09:00 Berlin
			assert.equal(zu.usersNotified, 0, '09:00 lokal liegt außerhalb des Fensters');
			assert.equal(pushCalls.length, 2);
		});

		it('AK3: Fenster folgen der Empfängerzeitzone — New York sendet zu 11:30Z, nicht zu 05:30Z', async () => {
			const ny = await erstelleEmpfaenger('digest-ny@example.com', 'America/New_York');
			await seedSubscription(ny.id);
			await createTask({ title: 'ny', deadline: new Date('2026-07-07T10:00:00Z'), userId: ny.id });

			const nachts = await runDailyDigest(new Date('2026-07-07T05:30:00Z'), mockSend); // 01:30 New York
			assert.equal(nachts.usersNotified, 0, '01:30 New York liegt außerhalb — die UTC-Stunde 5:30 zählt nicht');
			const morgens = await runDailyDigest(new Date('2026-07-07T11:30:00Z'), mockSend); // 07:30 New York
			assert.equal(morgens.usersNotified, 1, '07:30 New York liegt im Fenster');
			assert.equal(pushCalls.length, 1);
		});

		it('AK5: ohne/ungültige Zeitzone gelten die Fenster in UTC — 05:30Z keiner, 07:30Z beide', async () => {
			await erstelleEmpfaenger('digest-null@example.com');
			await User.create({
				email: 'digest-mars@example.com',
				displayName: 'Mars',
				passwordHash: '__test__',
				zeitzone: 'Mars/Olympus',
			} as never);
			await seedSubscription(1);
			await seedSubscription(2);
			await createTask({ title: 'a', deadline: new Date('2026-07-07T04:00:00Z'), userId: 1 });
			await createTask({ title: 'b', deadline: new Date('2026-07-07T04:00:00Z'), userId: 2 });

			const frueh = await runDailyDigest(new Date('2026-07-07T05:30:00Z'), mockSend);
			assert.equal(frueh.usersNotified, 0, 'UTC 05:30 liegt vor dem Fenster (7–9)');
			const morgens = await runDailyDigest(new Date('2026-07-07T07:30:00Z'), mockSend);
			assert.equal(morgens.usersNotified, 2, 'UTC 07:30 liegt im Fenster');
			assert.equal(pushCalls.length, 2);
		});
	});

	describe('Morgen-Mail (#1426, F2.2)', () => {
		it('AK5: verschickt zusätzlich zur Push-Nachricht genau eine Mail; zweiter Tick sendet auf keinem Kanal erneut', async () => {
			await erstelleEmpfaenger('digest-mail@example.com');
			await seedSubscription(1);
			await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
			const mailCalls: { to: string; subject: string; text: string }[] = [];
			const mailSend: MailSender = (payload) => {
				mailCalls.push(payload);
				return Promise.resolve();
			};

			const first = await runDailyDigest(NOW, mockSend, mailSend);
			const second = await runDailyDigest(NOW, mockSend, mailSend);

			assert.equal(first.usersNotified, 1);
			assert.equal(pushCalls.length, 1, 'genau eine Push-Nachricht');
			assert.equal(mailCalls.length, 1, 'genau eine Mail zusätzlich zur Push-Nachricht');
			assert.equal(mailCalls[0].subject, 'Dein Tag');
			assert.match(mailCalls[0].text, /Steuer/, 'die Mail trägt den Tagesplan (fällige + Top-Aufgaben)');
			assert.equal(second.usersNotified, 0, 'Wiederholungstick sendet auf keinem Kanal erneut');
			assert.equal(mailCalls.length, 1, 'kein zweiter Mail-Versand');
			assert.equal(
				await NotificationLog.count(),
				2,
				'Digest-Schlüssel (Tag-Deckel, #2849 AK2) plus Budget-Marker (#2853), nicht pro Kanal',
			);
		});

		it('bei vollem Budget geht nur die Mail raus; der Nur-Mail-Fall schließt den Tag ab, ohne Budget zu zählen', async () => {
			await erstelleEmpfaenger('digest-mailonly@example.com');
			await seedSubscription(1);
			await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
			// Budget des lokalen Tags füllen (drei fachliche Pushes, Konzept §4) — über einen eigenen
			// Sender, damit pushCalls ausschließlich den Digest-Versand zeigt.
			const budgetSend: PushSender = () => Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
			for (const [i, kind] of ['care-push', 'streak-reminder', 'milestone'].entries()) {
				await sendDedupedPush(1, kind, `${kind}:voll${i}`, { title: 'Budget' }, budgetSend, NOW);
			}
			const mailCalls: { to: string; subject: string; text: string }[] = [];
			const mailSend: MailSender = (payload) => {
				mailCalls.push(payload);
				return Promise.resolve();
			};

			const first = await runDailyDigest(NOW, mockSend, mailSend);

			assert.equal(first.usersNotified, 1, 'die Mail trägt den Tick allein');
			assert.equal(pushCalls.length, 0, 'der Push ist verdrängt');
			assert.equal(mailCalls.length, 1);
			assert.equal(
				await NotificationLog.count({ where: { kind: 'daily-digest' } }),
				1,
				'der Nur-Mail-Fall zieht den Digest-Schlüssel nach (sonst Mail je Tick erneut)',
			);
			assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3, 'die Mail verbraucht kein Budget');

			const second = await runDailyDigest(NOW, mockSend, mailSend);

			assert.equal(second.usersNotified, 0);
			assert.equal(mailCalls.length, 1, 'kein zweiter Mail-Versand am selben Tag');
		});

		it('AK7: schlägt der Mail-Versand fehl, wird die Push-Nachricht dennoch zugestellt', async () => {
			await erstelleEmpfaenger('digest-mailfail@example.com');
			await seedSubscription(1);
			await createTask({ title: 'Steuer', deadline: new Date('2026-07-07T10:00:00Z') });
			let failingMailSendCalls = 0;
			const failingMailSend: MailSender = () => {
				failingMailSendCalls += 1;
				return Promise.reject(new Error('SMTP-Transport fehlgeschlagen'));
			};

			const result = await runDailyDigest(NOW, mockSend, failingMailSend);

			assert.equal(failingMailSendCalls, 1, 'der Mail-Versand wird tatsächlich versucht (sonst prüft der Test nichts)');
			assert.equal(result.usersNotified, 1, 'ein fehlgeschlagener Mail-Versand bricht den Lauf nicht ab');
			assert.equal(pushCalls.length, 1, 'die Push-Nachricht wird trotz Mail-Fehler zugestellt');
			assert.equal(
				await NotificationLog.count(),
				2,
				'Digest-Schlüssel plus Budget-Marker, weil der Push-Kanal erfolgreich war',
			);
		});
	});
});
