import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import {
	Dependency,
	FcmToken,
	Group,
	GroupMember,
	Pillar,
	ScoreEntry,
	Series,
	SeriesPillar,
	Subscription,
	Task,
	TaskPillar,
	User,
} from '../models/index.js';
import Invoice from '../models/invoice.js';

/** Konto löschen (#1671): Daten weg, Session beendet, Sperren bei Abo und letztem Gruppen-Admin. */
applyTestAuthEnv('delete-account');

let server: TestServer;

const deleteMe = (cookie: string) => server.json('/auth/me', { method: 'DELETE', headers: { cookie } });
const me = (cookie: string) => server.json('/auth/me', { headers: { cookie } });
const idOf = async (cookie: string) => ((await (await me(cookie)).json()) as { id: number }).id;

const subscribe = (userId: number, status: string) =>
	Subscription.create({
		userId,
		provider: 'paypal',
		externalSubscriptionId: `I-${userId}-${status}`,
		plan: 'pro',
		period: 'monthly',
		status,
		currentPeriodEnd: new Date('2026-12-01'),
	});

const groupWith = async (members: [number, 'admin' | 'member'][]) => {
	const group = await Group.create({ name: 'Familie', description: null });
	for (const [userId, role] of members) {
		await GroupMember.create({ groupId: group.id, userId, role, joinedAt: new Date() });
	}
	return group;
};

describe('Konto löschen (#1671)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server.close();
		await closeDb();
	});

	it('entfernt Nutzer und eigene Daten, beendet die Session, Rechnungen bleiben', async () => {
		const cookie = await server.login('weg@example.com');
		const userId = await idOf(cookie);
		const other = await idOf(await server.login('bleibt@example.com'));
		await Task.create({ title: 'Eigene', priority: 1, estimatedEffort: 1, userId });
		const forOther = await Task.create({
			title: 'Für B',
			priority: 1,
			estimatedEffort: 1,
			userId: other,
			createdById: userId,
		});
		await FcmToken.create({ token: 'geraet', userId });
		const sub = await subscribe(userId, 'cancelled');
		await Invoice.create({
			userId,
			subscriptionId: sub.id,
			number: 'INV-2026-200001',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});
		const soleGroup = await groupWith([[userId, 'admin']]);

		const res = await deleteMe(cookie);
		assert.equal(res.status, 204);
		assert.equal((await me(cookie)).status, 401);

		assert.equal(await User.count({ where: { id: userId } }), 0);
		assert.equal(await Task.count({ where: { userId } }), 0);
		assert.equal(await Pillar.count({ where: { userId } }), 0);
		assert.equal(await FcmToken.count(), 0);
		assert.equal(await Group.count({ where: { id: soleGroup.id } }), 0);
		assert.equal(await Invoice.count({ where: { userId } }), 1, 'Rechnung bleibt erhalten');
		const kept = await Task.findByPk(forOther.id);
		assert.ok(kept, 'Aufgabe für eine andere Person bleibt');
		assert.equal(kept.createdById, null);
	});

	it('räumt Säulen-Beiträge, Punkte und Abhängigkeiten der eigenen Aufgaben und Serien mit ab', async () => {
		const cookie = await server.login('kaskade@example.com');
		const userId = await idOf(cookie);
		const pillar = await Pillar.create({ name: 'Arbeit', description: '', weight: 100, userId });
		const first = await Task.create({ title: 'Erste', priority: 1, estimatedEffort: 1, userId });
		const second = await Task.create({ title: 'Zweite', priority: 1, estimatedEffort: 1, userId });
		await TaskPillar.create({ taskId: first.id, pillarId: pillar.id, share: 100, confidence: 100 });
		await ScoreEntry.create({ taskId: first.id, punkte: 10, pünktlich: true, zeitpunkt: new Date() });
		await Dependency.create({ dependentTaskId: second.id, dependingTaskId: first.id });
		const series = await Series.create({
			title: 'Woechentlich',
			rhythm: 'weekly',
			priority: 1,
			estimatedEffort: 1,
			startDate: new Date('2026-01-05T00:00:00.000Z'),
			userId,
		});
		await SeriesPillar.create({ seriesId: series.id, pillarId: pillar.id, share: 100, confidence: 100 });

		assert.equal((await deleteMe(cookie)).status, 204);
		assert.equal(await TaskPillar.count(), 0);
		assert.equal(await ScoreEntry.count(), 0);
		assert.equal(await Dependency.count(), 0);
		assert.equal(await SeriesPillar.count(), 0);
		assert.equal(await Series.count(), 0);
	});

	it('beendet auch die Sessions auf anderen Geräten', async () => {
		const first = await server.login('zwei@example.com');
		const second = await server.login('zwei@example.com');
		assert.equal((await deleteMe(first)).status, 204);
		assert.equal((await me(second)).status, 401);
	});

	it('lehnt mit laufendem oder ausstehendem Abo ab (409), das Konto bleibt', async () => {
		for (const status of ['active', 'approval_pending']) {
			const cookie = await server.login(`abo-${status}@example.com`);
			await subscribe(await idOf(cookie), status);
			const res = await deleteMe(cookie);
			assert.equal(res.status, 409, status);
			assert.equal(((await res.json()) as { code: string }).code, 'subscription_active');
			assert.equal((await me(cookie)).status, 200);
		}
	});

	it('lehnt als letzter Admin einer Gruppe mit weiteren Mitgliedern ab (409), mit zweitem Admin nicht', async () => {
		const cookie = await server.login('admin@example.com');
		const userId = await idOf(cookie);
		const member = await idOf(await server.login('mitglied@example.com'));
		const group = await groupWith([
			[userId, 'admin'],
			[member, 'member'],
		]);
		const refused = await deleteMe(cookie);
		assert.equal(refused.status, 409);
		assert.equal(((await refused.json()) as { code: string }).code, 'last_group_admin');

		await GroupMember.update({ role: 'admin' }, { where: { groupId: group.id, userId: member } });
		assert.equal((await deleteMe(cookie)).status, 204);
		assert.equal(await GroupMember.count({ where: { groupId: group.id } }), 1, 'Gruppe bleibt mit dem anderen Admin');
	});

	it('verlangt eine Session (401)', async () => {
		assert.equal((await server.json('/auth/me', { method: 'DELETE' })).status, 401);
	});
});
