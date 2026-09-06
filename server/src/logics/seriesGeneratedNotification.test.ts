import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb } from '../test/helpers.js';
import { NotificationLog, PushSubscription, Series, Task, User } from '../models/index.js';
import type { PushSender } from './push.js';
import { notifySeriesGenerated } from './seriesGeneratedNotification.js';

/**
 * Rote Spec-Tests für #1253 — Unit-Vertrag des Serien-Benachrichtigungstriggers (TF7 für
 * AK3/AK4/AK7, Vertrag: docs/spec/issue-1253.md): Dedupe-Bindung des Schlüssels an die erzeugte
 * Aufgabe und Bündelung mehrerer Instanzen zu einer Nachricht, isoliert mit gemocktem `send`.
 *
 * Rot, bis `logics/seriesGeneratedNotification.ts` mit `notifySeriesGenerated` existiert.
 * KEIN Produktivcode.
 */
beforeEach(resetDb);
after(closeDb);

interface SentPush {
	endpoint: string;
	body: string;
}

const calls: SentPush[] = [];
const mockSend: PushSender = (subscription, payload) => {
	calls.push({ endpoint: subscription.endpoint, body: payload });
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

/** Seedet Alice (Erstellerin) + Bob (Empfänger) mit Abo und liefert deren Ids. */
const seedUsers = async (): Promise<{ aliceId: number; bobId: number }> => {
	const alice = await User.create({
		email: 'alice@example.com',
		displayName: 'Alice Erstellerin',
		googleId: 'spec-alice',
	});
	const bob = await User.create({ email: 'bob@example.com', displayName: 'Bob Empfänger', googleId: 'spec-bob' });
	await PushSubscription.create({
		endpoint: 'https://push.example/bob-1',
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: bob.id,
	});
	return { aliceId: alice.id, bobId: bob.id };
};

/** Serie für B, angelegt von A — plus `count` bereits erzeugte Instanzen (returns Tasks). */
const seedSeriesWithInstances = async (
	aliceId: number,
	bobId: number,
	count: number,
): Promise<{ series: Series; instances: Task[] }> => {
	const series = await Series.create({
		title: 'Wochenputz',
		rhythm: 'weekly',
		priority: 3,
		estimatedEffort: 1,
		active: true,
		startDate: new Date(),
		userId: bobId,
		createdById: aliceId,
	});
	const instances: Task[] = [];
	for (let index = 0; index < count; index += 1) {
		const deadline = new Date();
		deadline.setUTCDate(deadline.getUTCDate() + index);
		instances.push(
			await Task.create({
				title: series.title,
				priority: series.priority,
				estimatedEffort: series.estimatedEffort,
				description: null,
				deadline,
				seriesId: series.id,
				seriesOccurrence: deadline,
				isException: false,
				originSeriesId: series.id,
				userId: bobId,
				autoDeleteAfterDeadline: false,
			}),
		);
	}
	return { series, instances };
};

const textOf = (call: SentPush): string => {
	const payload = JSON.parse(call.body) as { title: string; body?: string };
	return `${payload.title} ${payload.body ?? ''}`;
};

describe('notifySeriesGenerated (#1253, TF7)', () => {
	// AK4/AK7: Bündelung — alle Instanzen eines Laufs in EINER Nachricht mit Anzahl.
	it('mehrere Instanzen eines Laufs → genau 1 Versand mit Serientitel, Ersteller und Anzahl', async () => {
		const { aliceId, bobId } = await seedUsers();
		const { series, instances } = await seedSeriesWithInstances(aliceId, bobId, 3);
		const alice = await User.findByPk(aliceId);

		await notifySeriesGenerated(series, instances, alice, mockSend);

		assert.equal(calls.length, 1, 'ein Lauf der Serie erzeugt genau eine gebündelte Nachricht');
		const text = textOf(calls[0]);
		assert.ok(text.includes('Wochenputz'), 'die Nachricht nennt den Serientitel');
		assert.ok(text.includes('Alice Erstellerin'), 'die Nachricht nennt den Ersteller-Anzeigenamen');
		assert.ok(text.includes('3'), 'die Nachricht nennt die Zahl der neuen Aufgaben');
	});

	// AK3: Dedupe — Schlüssel bindet an die erzeugte Aufgabe; Wiederholung schweigt.
	it('zweiter Aufruf mit derselben ersten Instanz → kein zweiter Versand (dedupeKey-Bindung)', async () => {
		const { aliceId, bobId } = await seedUsers();
		const { series, instances } = await seedSeriesWithInstances(aliceId, bobId, 1);
		const alice = await User.findByPk(aliceId);

		await notifySeriesGenerated(series, instances, alice, mockSend);
		await notifySeriesGenerated(series, instances, alice, mockSend);

		assert.equal(calls.length, 1, 'derselbe Lauf (gleiche erste Instanz) deduped zum zweiten Aufruf');
		const logs = await NotificationLog.findAll({ where: { kind: 'series-generated' } });
		assert.equal(logs.length, 1, 'genau ein Dedupe-Eintrag');
		assert.equal(
			logs[0].dedupeKey,
			`${series.id}:${instances[0].id}`,
			'der dedupeKey bindet an Serie UND erzeugte Aufgabe (erste Instanz des Laufs)',
		);
	});

	// AK3: Ein NEUER Lauf (andere erste Instanz) ist ein neuer Schlüssel — erneut benachrichtigen.
	it('neuer Lauf mit anderer erster Instanz → erneuter Versand mit eigenem dedupeKey', async () => {
		const { aliceId, bobId } = await seedUsers();
		const { series, instances } = await seedSeriesWithInstances(aliceId, bobId, 1);
		const alice = await User.findByPk(aliceId);
		await notifySeriesGenerated(series, instances, alice, mockSend);

		const nextDeadline = new Date();
		nextDeadline.setUTCDate(nextDeadline.getUTCDate() + 7);
		const nextInstance = await Task.create({
			title: series.title,
			priority: series.priority,
			estimatedEffort: series.estimatedEffort,
			description: null,
			deadline: nextDeadline,
			seriesId: series.id,
			seriesOccurrence: nextDeadline,
			isException: false,
			originSeriesId: series.id,
			userId: bobId,
			autoDeleteAfterDeadline: false,
		});
		await notifySeriesGenerated(series, [nextInstance], alice, mockSend);

		assert.equal(calls.length, 2, 'ein neuer Lauf (neue Aufgabe) ist keine Dublette im Sinne des Dedupes');
		const logs = await NotificationLog.findAll({ where: { kind: 'series-generated' } });
		assert.deepEqual(
			logs.map((log) => log.dedupeKey).sort(),
			[`${series.id}:${instances[0].id}`, `${series.id}:${nextInstance.id}`].sort(),
			'je Lauf ein eigener dedupeKey aus Serie + erster Instanz-Id',
		);
	});

	// AK2 (Logikseite): Selbst-/erstellerlose Serien lösen nichts aus — der Aufrufer
	// entscheidet nicht mit, die Logik selbst muss still bleiben.
	it('Selbst-Anlage und Serie ohne createdById → kein Versand, kein Log-Eintrag', async () => {
		const { aliceId, bobId } = await seedUsers();
		const own = await seedSeriesWithInstances(bobId, bobId, 1);
		const legacy = await Series.create({
			title: 'Altbestand',
			rhythm: 'weekly',
			priority: 3,
			estimatedEffort: 1,
			active: true,
			startDate: new Date(),
			userId: bobId,
			createdById: null,
		});
		const legacyTask = await Task.create({
			title: legacy.title,
			priority: legacy.priority,
			estimatedEffort: legacy.estimatedEffort,
			description: null,
			deadline: new Date(),
			seriesId: legacy.id,
			seriesOccurrence: new Date(),
			isException: false,
			originSeriesId: legacy.id,
			userId: bobId,
			autoDeleteAfterDeadline: false,
		});

		await notifySeriesGenerated(own.series, own.instances, null, mockSend);
		await notifySeriesGenerated(legacy, [legacyTask], null, mockSend);

		assert.equal(calls.length, 0, 'Selbst-Anlage und Altbestand lösen keinen Versand aus');
		const logs = await NotificationLog.findAll({ where: { kind: 'series-generated' } });
		assert.equal(logs.length, 0, 'und keinen Dedupe-Eintrag');
	});

	// AK4/Fehlisolation: ein leerer Lauf benachrichtigt gar nicht.
	it('Lauf ohne neue Instanzen → kein Versand', async () => {
		const { aliceId, bobId } = await seedUsers();
		const { series } = await seedSeriesWithInstances(aliceId, bobId, 1);
		const alice = await User.findByPk(aliceId);

		await notifySeriesGenerated(series, [], alice, mockSend);

		assert.equal(calls.length, 0, 'ohne erzeugte Instanzen gibt es nichts zu melden');
	});
});
