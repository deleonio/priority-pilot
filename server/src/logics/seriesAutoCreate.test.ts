import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { resetDb, closeDb } from '../test/helpers.js';
import { PushSubscription, Series, Task, User } from '../models/index.js';
import type { PushSender } from './push.js';
import { runSeriesAutoCreate } from './seriesAutoCreate.js';

/**
 * Rote Spec-Tests für #2356 — täglicher Server-Job `runSeriesAutoCreate` (Vertrag:
 * docs/spec/issue-2356.md): legt für alle aktiven Serien mit `autoCreate: true` die fälligen
 * Instanzen an (Horizont 30 Tage, max. 5 offene, nutzerübergreifend), idempotent, mit gebündelter
 * #1253-Benachrichtigung bei fremd angelegten Serien.
 *
 * Rot, bis `logics/seriesAutoCreate.ts` mit `runSeriesAutoCreate(now, pushSender?)` existiert.
 * KEIN Produktivcode.
 */
beforeEach(async () => {
	await resetDb();
	pushes.length = 0;
});
after(closeDb);

const pushes: string[] = [];
const mockSend: PushSender = (subscription) => {
	pushes.push(subscription.endpoint);
	return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
};

const day = (offset: number): Date => {
	const result = new Date();
	result.setUTCDate(result.getUTCDate() + offset);
	result.setUTCHours(0, 0, 0, 0);
	return result;
};

const makeUser = (name: string): Promise<User> =>
	User.create({ email: `${name}@example.com`, displayName: name, passwordHash: '__test__' });

const makeSeries = (title: string, userId: number, extra: Partial<Parameters<typeof Series.create>[0]> = {}) =>
	Series.create({
		title,
		rhythm: 'weekly',
		priority: 3,
		estimatedEffort: 1,
		active: true,
		startDate: day(0),
		userId,
		...extra,
	});

const countFor = (seriesId: number): Promise<number> => Task.count({ where: { seriesId } });

describe('runSeriesAutoCreate (#2356)', () => {
	// AK1
	it('legt nur für aktive autoCreate-Serien Instanzen an (Fünfer-Grenze)', async () => {
		const alice = await makeUser('alice');
		const auto = await makeSeries('Auto', alice.id);
		const manual = await makeSeries('Vorlage', alice.id, { autoCreate: false });
		const dormant = await makeSeries('Ruhend', alice.id, { active: false });

		await runSeriesAutoCreate(new Date(), mockSend);

		assert.equal(await countFor(auto.id), 5, 'autoCreate-Serie: fünf offene Instanzen');
		assert.equal(await countFor(manual.id), 0, 'autoCreate=false: nichts');
		assert.equal(await countFor(dormant.id), 0, 'ruhende Serie: nichts');
	});

	// AK1 — Horizont 30 Tage
	it('respektiert den Horizont von 30 Tagen', async () => {
		const alice = await makeUser('alice');
		const within = await makeSeries('Knapp drin', alice.id, { startDate: day(25) });
		const beyond = await makeSeries('Zu weit', alice.id, { startDate: day(35) });

		await runSeriesAutoCreate(new Date(), mockSend);

		assert.equal(await countFor(within.id), 1, 'Termin an Tag 25 liegt im Horizont, Tag 32 nicht');
		assert.equal(await countFor(beyond.id), 0, 'Start nach dem Horizont: nichts');
	});

	// AK2
	it('erfasst Serien aller Nutzer und setzt die Instanzen auf den jeweiligen Eigentümer', async () => {
		const alice = await makeUser('alice');
		const bob = await makeUser('bob');
		const seriesA = await makeSeries('A', alice.id);
		const seriesB = await makeSeries('B', bob.id);

		await runSeriesAutoCreate(new Date(), mockSend);

		const tasksA = await Task.findAll({ where: { seriesId: seriesA.id } });
		const tasksB = await Task.findAll({ where: { seriesId: seriesB.id } });
		assert.ok(tasksA.length > 0 && tasksB.length > 0, 'beide Nutzer erhalten Instanzen');
		assert.ok(tasksA.every((task) => task.userId === alice.id));
		assert.ok(tasksB.every((task) => task.userId === bob.id));
	});

	// AK3
	it('erzeugt bei zwei Läufen hintereinander keine Dubletten', async () => {
		const alice = await makeUser('alice');
		const series = await makeSeries('Einmalig', alice.id);

		await runSeriesAutoCreate(new Date(), mockSend);
		const afterFirst = await countFor(series.id);
		await runSeriesAutoCreate(new Date(), mockSend);

		assert.equal(afterFirst, 5);
		assert.equal(await countFor(series.id), afterFirst, 'zweiter Lauf legt nichts nach');
	});

	// AK4
	it('benachrichtigt den Empfänger einer fremd angelegten Serie genau einmal gebündelt', async () => {
		const alice = await makeUser('alice');
		const bob = await makeUser('bob');
		await PushSubscription.create({
			endpoint: 'https://push.example/bob-1',
			p256dh: 'p256dh',
			auth: 'auth',
			expirationTime: null,
			userId: bob.id,
		});
		await makeSeries('Wochenputz', bob.id, { createdById: alice.id });

		await runSeriesAutoCreate(new Date(), mockSend);

		assert.deepEqual(pushes, ['https://push.example/bob-1'], 'eine gebündelte Push trotz mehrerer Instanzen');
	});
});
