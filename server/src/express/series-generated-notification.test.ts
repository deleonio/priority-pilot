import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Group, GroupMember, NotificationLog, PushSubscription, Series, Task, User } from '../models/index.js';
import type { PushSender } from '../logics/push.js';

/**
 * Rote Spec-Tests für #1253 — Push, wenn eine Serie Instanzen erzeugt, die A für B angelegt hat
 * (Vertrag: docs/spec/issue-1253.md, TF1–TF6 für AK1–AK6).
 *
 * Rollen wie #1224 (tasks-created-notification.test.ts): Alice (Erstellerin), Bob (Empfänger,
 * gemeinsame Gruppe). Die Serien werden direkt per Model-Seed angelegt (`createdById`/`userId`),
 * der Auslöser muss laut Analyse in der GenerierungsLOGIK sitzen — deshalb genügt Bob als
 * Aufrufer von POST /series/generate-all. Versand über den injizierten PushSender gemockt.
 *
 * Rot, bis die Generierung den neuen Auslöser `series-generated` (eigene NotificationLog-kind,
 * dedupeKey = seriesId:ersteInstanzId) anstößt. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
applyTestAuthEnv('series-generated-notification-test');

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const KIND = 'series-generated';

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

/** UTC-Mitternacht `offsetDays` Tage relativ zu heute (Muster series.test.ts). */
const futureDate = (offsetDays: number): Date => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offsetDays);
	result.setUTCHours(0, 0, 0, 0);
	return result;
};

interface SeedSeries {
	userId: number;
	createdById: number | null;
	startDate?: Date;
}

/** Serien-Template direkt per Model-Seed; startDate default = Tag 29 (im 30-Tage-Horizont von
 * generate-all liegt dann genau EIN Termin — deterministische Einzel-Instanz für AK1–AK3). */
const seedSeries = async ({ userId, createdById, startDate }: SeedSeries): Promise<Series> =>
	Series.create({
		title: 'Wochenputz',
		rhythm: 'weekly',
		priority: 3,
		estimatedEffort: 1,
		active: true,
		startDate: startDate ?? futureDate(29),
		userId,
		createdById,
	});

const generateAll = async (cookie: string): Promise<{ created: number }> => {
	const res = await fetch(`${server.baseUrl}/series/generate-all`, {
		method: 'POST',
		headers: { Cookie: cookie },
	});
	assert.equal(res.status, 200, 'POST /series/generate-all muss 200 liefern');
	return (await res.json()) as { created: number };
};

const instanceCount = async (seriesId: number): Promise<number> => Task.count({ where: { seriesId } });

describe('Push bei fremd angelegten Serien-Instanzen (#1253)', () => {
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

	// ── AK1: eine Nachricht an B mit Serientitel und Ersteller-Anzeigename ────────────

	it('Serie von Alice für Bob erzeugt eine Instanz → genau 1 Push mit Titel + „Alice“, 1 Log-Eintrag (AK1)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const series = await seedSeries({ userId: bobId, createdById: await userIdOf(ALICE) });
		await seedSubscription(bobId, 'https://push.example/bob-1');

		const result = await generateAll(await server.login(BOB));
		assert.equal(result.created, 1, 'der Lauf erzeugt genau die eine fällige Instanz');

		assert.equal(calls.length, 1, 'genau eine Nachricht an B — nicht mehr, nicht weniger');
		const payload = JSON.parse(calls[0].body) as { title: string; body?: string };
		const text = `${payload.title} ${payload.body ?? ''}`;
		assert.ok(text.includes('Wochenputz'), 'die Nachricht nennt den Serientitel');
		assert.ok(text.includes('Alice Erstellerin'), 'die Nachricht nennt den Anzeigenamen der Erstellerin');
		assert.ok(text.includes('1'), 'die Nachricht nennt die Zahl der neuen Aufgaben');

		const logs = await NotificationLog.findAll({ where: { kind: KIND } });
		assert.equal(logs.length, 1, 'genau ein Dedupe-Eintrag zur Serie/dem Lauf');
		assert.ok(
			!['task-created', 'due-task', 'daily-top-tasks'].includes(logs[0].kind),
			'die eigene kind kollidiert nicht mit den bestehenden Auslösern',
		);
		assert.equal(await instanceCount(series.id), 1, 'die Instanz ist angelegt');
	});

	// ── AK2: Selbst-/Bestandsanlagen bleiben still ────────────────────────────────────

	it('Bobs eigene Serie und Alt-Bestand ohne createdById → kein Versand, kein Log-Eintrag (AK2)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		await seedSubscription(bobId, 'https://push.example/bob-1');
		// Selbst-Anlage (createdById = Eigentümer) …
		await seedSeries({ userId: bobId, createdById: bobId });
		// … und Alt-Bestand ohne Ersteller-Eintrag: beide lösen nichts aus.
		await seedSeries({ userId: bobId, createdById: null });

		const result = await generateAll(await server.login(BOB));
		assert.equal(result.created, 2, 'beide Serien erzeugen ihre Instanz ganz regulär');

		assert.equal(calls.length, 0, 'eigene/erstellerlose Serien lösen keine Nachricht aus');
		const logs = await NotificationLog.findAll({ where: { kind: KIND } });
		assert.equal(logs.length, 0, 'zur Selbst-Anlage wird kein Dedupe-Eintrag angelegt');
	});

	// ── AK3: Wiederholungslauf deduped ────────────────────────────────────────────────

	it('zweiter generate-all-Lauf über dasselbe Fenster → kein zweiter Versand, keine Dubletten (AK3)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const series = await seedSeries({ userId: bobId, createdById: await userIdOf(ALICE) });
		await seedSubscription(bobId, 'https://push.example/bob-1');

		const first = await generateAll(await server.login(BOB));
		assert.equal(first.created, 1, 'erster Lauf erzeugt die Instanz');
		assert.equal(calls.length, 1, 'erster Lauf versendet genau eine Nachricht');

		const second = await generateAll(await server.login(BOB));
		assert.equal(second.created, 0, 'zweiter Lauf über dasselbe Fenster erzeugt keine neue Instanz');
		assert.equal(calls.length, 1, 'der dedupeKey verhindert die zweite Nachricht');
		assert.equal(await instanceCount(series.id), 1, 'die Aufgaben sind nicht dupliziert');
		const logs = await NotificationLog.findAll({ where: { kind: KIND } });
		assert.equal(logs.length, 1, 'auch beim Wiederholungslauf bleibt es beim einen Log-Eintrag');
	});

	// ── AK4: Bündelung — eine Nachricht je Serie und Lauf mit Anzahl ───────────────────

	it('daily-Serie erzeugt mehrere Instanzen auf einmal → genau 1 Nachricht mit Anzahl im Text (AK4)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		// Start heute: der 30-Tage-Horizont von generate-all deckt viele daily-Termine ab.
		await seedSeries({ userId: bobId, createdById: await userIdOf(ALICE), startDate: futureDate(0) });
		await seedSubscription(bobId, 'https://push.example/bob-1');

		const result = await generateAll(await server.login(BOB));
		assert.ok(result.created >= 2, `der Lauf erzeugt mehrere Instanzen (war ${result.created})`);

		assert.equal(calls.length, 1, 'mehrere Instanzen derselben Serie bündeln zu EINER Nachricht');
		const payload = JSON.parse(calls[0].body) as { title: string; body?: string };
		const text = `${payload.title} ${payload.body ?? ''}`;
		assert.ok(text.includes('Wochenputz'), 'die gebündelte Nachricht nennt den Serientitel');
		assert.ok(text.includes(String(result.created)), 'die Nachricht nennt die Zahl der neuen Aufgaben im Text');
	});

	// ── AK5: wirfender Sender — Generierung und Antwort bleiben unberührt ─────────────

	it('PushSender wirft → 200 mit korrekter created-Zahl, Aufgaben vorhanden, Fehler protokolliert (AK5)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const series = await seedSeries({ userId: bobId, createdById: await userIdOf(ALICE) });
		await seedSubscription(bobId, 'https://push.example/bob-1');
		senderFails = true;
		const warnings: unknown[] = [];
		const originalWarn = console.warn;
		const originalError = console.error;
		console.warn = (...args: unknown[]): void => warnings.push(args);
		console.error = (...args: unknown[]): void => warnings.push(args);

		try {
			const result = await generateAll(await server.login(BOB));
			assert.equal(result.created, 1, 'der Versandfehler darf die created-Zahl nicht verfälschen');
		} finally {
			console.warn = originalWarn;
			console.error = originalError;
		}
		assert.ok(warnings.length > 0, 'der Versandfehler wird serverseitig protokolliert');
		assert.equal(await instanceCount(series.id), 1, 'die Aufgabe wurde trotzdem erzeugt');
	});

	// ── AK6: kein Push-Abo — Verlauf unverändert, kein Log-Eintrag ────────────────────

	it('Bob ohne PushSubscription → 200, Aufgaben erzeugt, kein Log-Eintrag (AK6)', async () => {
		await seedSharedGroup();
		const bobId = await userIdOf(BOB);
		const series = await seedSeries({ userId: bobId, createdById: await userIdOf(ALICE) });

		const result = await generateAll(await server.login(BOB));
		assert.equal(result.created, 1, 'fehlendes Abo darf die Generierung nicht blockieren');
		assert.equal(await instanceCount(series.id), 1, 'die Aufgabe ist angelegt');
		assert.equal(calls.length, 0, 'ohne Abo gibt es keinen Versand');
		const logs = await NotificationLog.findAll({ where: { kind: KIND } });
		assert.equal(logs.length, 0, 'ohne Versand wird kein Dedupe-Eintrag angelegt');
	});
});
