/**
 * Rote Spec-Tests für #1462 (Spec docs/spec/issue-1462.md, T7) — Downgrade/Kündigung ohne
 * Datenverlust, Guards sperren allein den Schreibzugriff.
 *
 * TF1/TF2/TF4 (AK1/AK2/AK4): voller Zyklus max → free → max, Bestand zählt vor/nach identisch,
 * Lese-Endpunkte bleiben 200. TF3-Pendant (AK3) prüft hier zusätzlich die im Harness-Kommentar
 * benannte Lücke: `applyPlanChange`/`applyDuePendingPlan` (logics/paypal.ts) schreiben bislang nur
 * `Subscription.plan`, nicht `User.plan` — ohne Abgleich bleibt `requirePlanFeature` nach einer
 * Kündigung grün. Rot, bis der Abgleich existiert (KEIN Produktivcode in diesem PR).
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User, Group, GroupMember, Task, PlaceFavorite, AiUsage } from '../models/index.js';
import { applyPlanChange, type PaypalWebhookEvent } from '../logics/paypal.js';
import Subscription from '../models/subscription.js';
import { AI_ASSIST_MONTHLY_QUOTA } from '../logics/plans.js';

applyTestAuthEnv('plan-downgrade-test');

let server: TestServer;

const setPlan = async (email: string, plan: 'free' | 'pro' | 'max' | 'ultimate'): Promise<void> => {
	await User.update({ plan }, { where: { email } });
};

/** Baut Bestand über alle vier in AK2 gezählten Datentypen für `email` auf (Paket muss `max` sein). */
const seedFullPortfolio = async (email: string): Promise<{ userId: number }> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, 'Setup: Nutzer muss existieren');
	const userId = user!.get('id') as number;

	const group = await Group.create({ name: 'Testgruppe', description: null });
	await GroupMember.create({ groupId: group.id, userId, role: 'admin', joinedAt: new Date() });

	const taskA = await Task.create({ title: 'Task A', userId, latitude: 52.52, longitude: 13.405 });
	const taskB = await Task.create({ title: 'Task B', userId, latitude: 48.137, longitude: 11.575 });
	await taskA.addDependency(taskB, { through: { weight: 1 } });

	await PlaceFavorite.create({ userId, name: 'Büro', address: 'Musterstr. 1', latitude: 52.52, longitude: 13.405 });

	return { userId };
};

interface Portfolio {
	groups: number;
	tasksWithCoords: number;
	favorites: number;
	dependencies: number;
}

const countPortfolio = async (userId: number): Promise<Portfolio> => {
	const groups = await GroupMember.count({ where: { userId } });
	const tasksWithCoords = await Task.count({ where: { userId, latitude: { [Op.ne]: null } } });
	const favorites = await PlaceFavorite.count({ where: { userId } });
	const tasks = await Task.findAll({ where: { userId } });
	let dependencies = 0;
	for (const task of tasks) {
		dependencies += (await (task as unknown as { getDependencies: () => Promise<unknown[]> }).getDependencies()).length;
	}
	return { groups, tasksWithCoords, favorites, dependencies };
};

describe('Downgrade und Kündigung ohne Datenverlust (#1462)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
		delete process.env.MONETIZATION_ENFORCED;
	});
	after(async () => {
		delete process.env.MONETIZATION_ENFORCED;
		if (server) await server.close();
		await closeDb();
	});

	it('AK1/AK2: Downgrade auf free sperrt Entitlements, löscht aber keinen Datensatz und Lese-Routen bleiben 200', async () => {
		const email = 'ak1-ak2@example.com';
		const cookie = await server.register(email);
		await setPlan(email, 'max');
		const { userId } = await seedFullPortfolio(email);
		const before = await countPortfolio(userId);

		await setPlan(email, 'free');
		process.env.MONETIZATION_ENFORCED = 'true';

		const me = await server.json('/auth/me', { headers: { Cookie: cookie } });
		assert.equal(me.status, 200);
		const meBody = (await me.json()) as {
			entitlements: Record<string, { allowed: boolean; requiredPlan: string }>;
		};
		for (const feature of ['groups', 'ai_assist', 'graph_write', 'location_reminders', 'mcp_readwrite']) {
			assert.equal(meBody.entitlements[feature]?.allowed, false, `${feature} muss nach Downgrade gesperrt sein`);
			assert.ok(meBody.entitlements[feature]?.requiredPlan, `${feature} braucht requiredPlan`);
		}

		const groupsRes = await server.json('/groups', { headers: { Cookie: cookie } });
		assert.equal(groupsRes.status, 200, 'GET /groups muss trotz Downgrade lesbar bleiben');
		const tasksRes = await server.json('/tasks', { headers: { Cookie: cookie } });
		assert.equal(tasksRes.status, 200, 'GET /tasks muss trotz Downgrade lesbar bleiben');
		const favoritesRes = await server.json('/place-favorites', { headers: { Cookie: cookie } });
		assert.equal(favoritesRes.status, 200, 'GET /place-favorites muss trotz Downgrade lesbar bleiben');

		const after = await countPortfolio(userId);
		assert.deepEqual(after, before, 'Bestand darf sich durch einen Downgrade nicht verändern');
	});

	it('AK3: nach einer wirksamen Kündigung ist User.plan free und eine Schreibroute liefert 403 plan_required', async () => {
		const email = 'ak3@example.com';
		const cookie = await server.register(email);
		await setPlan(email, 'max');
		const user = await User.findOne({ where: { email } });
		const userId = user!.get('id') as number;
		const subscription = await Subscription.create({
			userId,
			provider: 'paypal',
			externalSubscriptionId: 'I-AK3-CANCEL',
			plan: 'max',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		});

		const cancelEvent: PaypalWebhookEvent = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED' };
		await applyPlanChange(subscription, cancelEvent, new Date());

		const reloadedUser = await User.findByPk(userId);
		assert.equal(
			reloadedUser?.plan,
			'free',
			'Nach einer Kündigung muss User.plan (die für Guards maßgebliche Quelle) auf free stehen',
		);

		process.env.MONETIZATION_ENFORCED = 'true';
		const res = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'Nach Kündigung' }),
		});
		assert.equal(res.status, 403, 'POST /groups muss nach Kündigung 403 liefern');
		const body = (await res.json()) as { code?: string };
		assert.equal(body.code, 'plan_required');
	});

	it('AK4: ein erneutes Upgrade auf das vorherige Paket stellt Schreibzugriffe wieder her, Bestand bleibt unverändert', async () => {
		const email = 'ak4@example.com';
		const cookie = await server.register(email);
		await setPlan(email, 'max');
		const { userId } = await seedFullPortfolio(email);
		const before = await countPortfolio(userId);

		process.env.MONETIZATION_ENFORCED = 'true';
		await setPlan(email, 'free');
		await setPlan(email, 'max');

		const after = await countPortfolio(userId);
		assert.deepEqual(after, before, 'Der ursprüngliche Bestand aus AK2 muss unverändert vorhanden sein');

		const res = await server.json('/groups', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ name: 'Nach Re-Upgrade' }),
		});
		assert.equal(
			res.status,
			201,
			'POST /groups muss nach Re-Upgrade wieder gelingen (Schreibzugriff wiederhergestellt)',
		);
	});

	it('AK5: die ai_usage-Zeile des Monats bleibt beim Downgrade erhalten, quotaRemaining ist unter free 0', async () => {
		const email = 'ak5@example.com';
		const cookie = await server.register(email);
		await setPlan(email, 'max');
		const user = await User.findOne({ where: { email } });
		const userId = user!.get('id') as number;
		const yearMonth = new Date().toISOString().slice(0, 7);
		await AiUsage.create({ userId, yearMonth, count: AI_ASSIST_MONTHLY_QUOTA.max });

		await setPlan(email, 'free');
		process.env.MONETIZATION_ENFORCED = 'true';

		const row = await AiUsage.findOne({ where: { userId, yearMonth } });
		assert.ok(row, 'Die ai_usage-Zeile des laufenden Monats darf beim Downgrade nicht gelöscht werden');
		assert.equal(row?.get('count'), AI_ASSIST_MONTHLY_QUOTA.max, 'Der gebuchte Verbrauch bleibt unverändert stehen');

		const me = await server.json('/auth/me', { headers: { Cookie: cookie } });
		const meBody = (await me.json()) as { entitlements: Record<string, { quotaRemaining?: number }> };
		assert.equal(
			meBody.entitlements.ai_assist?.quotaRemaining,
			0,
			'quotaRemaining muss unter free (Kontingent 0) 0 sein, auch wenn der Verbrauch aus dem max-Paket stammt',
		);
	});
});
