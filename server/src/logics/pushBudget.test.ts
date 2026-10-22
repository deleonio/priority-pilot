import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { NotificationLog, PushSubscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import type { PushSender } from './push.js';
import { createTicker } from '../scheduler/index.js';
import { sendDedupedPush } from './dedupedPush.js';
import { BUDGET_KIND, SERVICE_KINDS, tagVon, vorrangVon, waehleImBudget } from './pushBudget.js';

/**
 * ROTE Spec-Tests für #2853 „Höchstens drei Pushes am Tag“ (Spec `docs/spec/issue-2853.md`).
 * Vertrag: `pushBudget.ts` stellt das Budget-Tor (Grenze 3 je Nutzer und lokalem Tag, gezählt über
 * `push-budget`-Marker in `notification_logs`), die §4-Vorrang-Auswahl, die Service-Kind-Liste und
 * die Gruppen-Tag-Map bereit; der Sitz des Tors ist `sendDedupedPush` (öffentlicher Send-Seam).
 */

const mockSend: PushSender = () => Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);

const payload = { title: 'Budget-Test' };

/** Empfänger (optional mit Zeitzone) mit genau einer Push-Subscription — Voraussetzung für Zustellung. */
const erstelleEmpfaenger = async (email: string, zeitzone?: string): Promise<User> => {
	const recipient = await User.create({
		email,
		displayName: 'Empfänger',
		passwordHash: '__test__',
		...(zeitzone ? { zeitzone } : {}),
	});
	await PushSubscription.create({
		endpoint: `https://push.example/${email}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: recipient.id,
	});
	return recipient;
};

describe('pushBudget — Höchstens drei fachliche Pushes je Nutzer und lokalem Tag (#2853)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: waehleImBudget wählt bei vollem Budget nach Konzept §4 (Vorrang von oben nach unten)', () => {
		const kandidaten = ['milestone', 'due-task', 'streak-reminder', 'task-created', 'monthly-recap'];
		assert.deepEqual(waehleImBudget(kandidaten, 3), ['task-created', 'due-task', 'streak-reminder']);
		assert.deepEqual(waehleImBudget(kandidaten, 0), []);
	});

	it('AK1/TF1: fünf direkte Sends ohne gemeinsamen Tick bleiben First-Come-First-Served (F1.2: über den Tagesverlauf)', async () => {
		const recipient = await erstelleEmpfaenger('budget-fuenf@example.com');
		const kinds = ['care-push', 'streak-reminder', 'milestone', 'monthly-recap', 'task-created'];
		const gesendet: number[] = [];
		for (const [i, kind] of kinds.entries()) {
			const { sent } = await sendDedupedPush(recipient.id, kind, `${kind}:k${i}`, payload, mockSend);
			gesendet.push(sent);
		}

		assert.deepEqual(gesendet, [1, 1, 1, 0, 0]);
		assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3);
		// Der verdrängte Push hinterlässt auch keinen Fach-Log-Eintrag (kein Nachziehen).
		assert.equal(await NotificationLog.count({ where: { kind: 'monthly-recap' } }), 0);
	});

	it('AK1/F1.2: ein Tick wählt gemeinsam nach §4 — Vorrang schlägt Registrierungs-Reihenfolge', async () => {
		const recipient = await erstelleEmpfaenger('budget-tick@example.com');
		const kinds = ['milestone', 'monthly-recap', 'streak-reminder', 'due-task', 'task-created'];
		// Bewusst §4-feindliche Registrierungs-Reihenfolge (§4-Rang 5, 5, 4, 3, 1).
		const { tick } = createTicker(
			kinds.map((kind, i) => ({
				rang: vorrangVon(kind),
				trigger: () => sendDedupedPush(recipient.id, kind, `${kind}:tick${i}`, payload, mockSend),
			})),
		);

		await tick();

		assert.deepEqual(
			(await NotificationLog.findAll({ where: { kind: kinds } })).map((zeile) => zeile.kind).sort(),
			['due-task', 'streak-reminder', 'task-created'],
			'gesendet haben die §4-top-3, nicht die zuerst registrierten',
		);
		assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3);
	});

	it('AK1: das Budget folgt dem lokalen Kalendertag des Empfängers, nicht dem UTC-Tag', async () => {
		const recipient = await erstelleEmpfaenger('budget-berlin@example.com', 'Europe/Berlin');
		const tick = (iso: string, key: string) =>
			sendDedupedPush(recipient.id, 'care-push', `care:${key}`, payload, mockSend, new Date(iso));

		// 22:30Z = 00:30 Ortszeit (lokaler Tag '2026-10-22'); drei Sends füllen den lokalen Tag,
		// der vierte Tick im selben lokalen Tag wird verdrängt, der erste am Folgetag geht raus.
		const eins = await tick('2026-10-21T22:30:00Z', 'a');
		const zwei = await tick('2026-10-21T23:30:00Z', 'b');
		const drei = await tick('2026-10-22T21:30:00Z', 'c');
		const vier = await tick('2026-10-22T21:50:00Z', 'd');
		const fuenf = await tick('2026-10-22T22:10:00Z', 'e');

		assert.deepEqual([eins.sent, zwei.sent, drei.sent, vier.sent, fuenf.sent], [1, 1, 1, 0, 1]);
	});

	it('AK2/TF2: eine Service-Nachricht wird auch bei erschöpftem Budget zugestellt und erhöht den Zähler nicht', async () => {
		const recipient = await erstelleEmpfaenger('budget-service@example.com');
		for (const [i, kind] of ['care-push', 'streak-reminder', 'milestone'].entries()) {
			await sendDedupedPush(recipient.id, kind, `${kind}:voll${i}`, payload, mockSend);
		}
		assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3);

		SERVICE_KINDS.push('test-service');
		try {
			const { sent } = await sendDedupedPush(recipient.id, 'test-service', 'test-service:x', payload, mockSend);
			assert.equal(sent, 1);
			assert.equal(await NotificationLog.count({ where: { kind: BUDGET_KIND } }), 3);
		} finally {
			SERVICE_KINDS.pop();
		}
	});

	it('AK4/TF4: tagVon ordnet alle elf Push-Arten einem der sechs Gruppen-Tags zu', () => {
		const gueltig = new Set(['pp-aufgaben', 'pp-fuersorge', 'pp-erfolge', 'pp-gruppen', 'pp-abo', 'pp-tipps']);
		const kinds = [
			'due-task',
			'daily-top-tasks',
			'care-push',
			'streak-reminder',
			'milestone',
			'monthly-recap',
			'task-created',
			'task-completed',
			'series-generated',
			'geo-nearby-task',
			'abo-service',
		];
		assert.equal(tagVon('abo-service'), 'pp-abo');
		for (const kind of kinds) {
			assert.ok(gueltig.has(tagVon(kind)), `tagVon('${kind}') muss ein gültiges Gruppen-Tag liefern`);
		}
	});

	it('AK4: sendDedupedPush reichert die Payload mit dem Gruppen-Tag des Kinds an', async () => {
		const recipient = await erstelleEmpfaenger('budget-tag@example.com');
		const aufrufe: string[] = [];
		const send: PushSender = (_subscription, p) => {
			aufrufe.push(p);
			return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
		};

		await sendDedupedPush(recipient.id, 'care-push', 'care:tag', { title: 'Fürsorge' }, send);

		assert.equal(JSON.parse(aufrufe[0] ?? '{}').tag, 'pp-fuersorge');
	});

	// #2855 AK8: die sechs neuen Kinds brauchen VORRANG-Eintrag (kein Fallback-Rang) und den
	// Gruppentag ihrer Schaltergruppe (Vertrag: docs/spec/issue-2855.md).
	it('#2855 AK8: neue Kinds in VORRANG (kein Fallback) und TAGS mit korrektem Gruppentag', () => {
		const neuen = ['appreciation', 'welcome-back', 'journal-impulse', 'weekly-recap', 'yearly-recap', 'welcome-steps'];
		for (const kind of neuen) {
			assert.ok(
				vorrangVon(kind) < vorrangVon('unbekannt-kind-x'),
				`${kind} fehlt in der VORRANG-Liste (sortiert sonst als unbekannt nach vorn/hinten)`,
			);
		}
		assert.equal(tagVon('appreciation'), 'pp-fuersorge');
		assert.equal(tagVon('welcome-back'), 'pp-fuersorge');
		assert.equal(tagVon('journal-impulse'), 'pp-fuersorge');
		assert.equal(tagVon('weekly-recap'), 'pp-erfolge');
		assert.equal(tagVon('yearly-recap'), 'pp-erfolge');
		assert.equal(tagVon('welcome-steps'), 'pp-aufgaben');
	});
});
