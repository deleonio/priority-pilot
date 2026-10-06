import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
// Invoice ist (Stand #1495) nicht aus models/index.ts re-exportiert — direkter Modul-Import
// (Muster billing-subscriptions.test.ts), damit der Import nicht an einer fremden Lücke scheitert.
import Invoice from '../../models/invoice.js';
import { resetDb, closeDb } from '../../test/helpers.js';
import { createPaypalProvider } from './paypalProvider.js';

/**
 * #1912 AK3/AK4: Die Bestätigung eines Upgrade-Abos kündigt das alte und schaltet das neue Paket frei;
 * der spätere CANCELLED-Webhook des alten Abos stuft den Nutzer nicht auf `free` herunter.
 * #2140 AK4: „Bestätigung" ist der Zahlungseingang (`PAYMENT.SALE.COMPLETED` des neuen Abos), nicht
 * schon `ACTIVATED` — bis dahin gilt das alte Abo und Paket.
 */

const NOW = new Date('2026-10-01T10:00:00Z');

const planOf = async (userId: number) => (await User.findByPk(userId))?.get('plan');

describe('PayPal-Upgrade: Ablösung des alten Abos (#1912)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('ACTIVATED des neuen Abos ändert nichts, erst dessen Zahlungseingang kündigt das alte und setzt pro; CANCELLED des alten bleibt ohne Downgrade', async () => {
		const cancelled: string[] = [];
		const provider = createPaypalProvider({
			client: {
				createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
				revise: async () => ({}),
				cancel: async (id) => {
					cancelled.push(id);
				},
			},
		});
		const user = await User.create({ email: 'up@example.com', displayName: 'U', passwordHash: 'x', plan: 'plus' });
		const base = { userId: user.id, provider: 'paypal', period: 'monthly', currentPeriodEnd: NOW };
		const old = await Subscription.create({ ...base, externalSubscriptionId: 'I-OLD', plan: 'plus', status: 'active' });
		const next = await Subscription.create({
			...base,
			externalSubscriptionId: 'I-NEW',
			plan: 'pro',
			status: 'approval_pending',
			creditCents: 249,
		});
		const event = (type: string, id: string) => ({
			id: `WH-${type}`,
			type,
			externalSubscriptionId: id,
			payload: { event_type: type, resource: { id, billing_agreement_id: id } },
		});

		await provider.applyEvent(next, event('BILLING.SUBSCRIPTION.ACTIVATED', 'I-NEW'), NOW);

		assert.deepEqual(cancelled, [], 'ACTIVATED allein kündigt das alte Abo nicht');
		assert.equal((await old.reload()).get('status'), 'active');
		assert.equal(await planOf(user.id), 'plus');

		await provider.applyEvent(next, event('PAYMENT.SALE.COMPLETED', 'I-NEW'), NOW);

		assert.deepEqual(cancelled, ['I-OLD']);
		assert.equal((await old.reload()).get('status'), 'cancelled');
		assert.equal(await planOf(user.id), 'pro');

		await provider.applyEvent(old, event('BILLING.SUBSCRIPTION.CANCELLED', 'I-OLD'), NOW);

		assert.equal(await planOf(user.id), 'pro');
	});
});

describe('Aufgeschobenes Abo übernimmt das Paket erst mit der ersten Abbuchung (#2239)', () => {
	// Freischaltmatrix: docs/spec/issue-2239.md — nur eine Zahlung (erste Abbuchung oder ganz
	// deckendes Guthaben, #2230) löst Vorgänger-Ablösung und User.plan-Übernahme aus.
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	const DAY_MS = 24 * 60 * 60 * 1000;
	let run = 0;
	const provider = createPaypalProvider({
		client: {
			createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
			revise: async () => ({}),
			cancel: async () => {},
		},
	});
	const event = (type: string, id: string) => ({
		id: `WH-${type}`,
		type,
		externalSubscriptionId: id,
		payload: { event_type: type, resource: { id, billing_agreement_id: id } },
	});
	/** Gekündigter Vorgänger mit Restlaufzeit (#1959-Vormerkung) plus aufgeschobene Nachfolgezeile (#2049). */
	const seed = async (paidPlan: 'plus' | 'pro', nextPlan: 'plus' | 'pro', creditCents = 0) => {
		const user = await User.create({
			email: `defer-2239-${(run += 1)}@example.com`,
			displayName: 'D',
			passwordHash: 'x',
			plan: paidPlan,
		});
		const restEnd = new Date(Date.now() + 10 * DAY_MS);
		const base = { userId: user.id, provider: 'paypal', period: 'monthly' };
		const old = await Subscription.create({
			...base,
			externalSubscriptionId: 'I-OLD-2239',
			plan: paidPlan,
			status: 'cancelled',
			currentPeriodEnd: restEnd,
			pendingPlan: 'free',
			pendingPlanEffectiveAt: restEnd,
		});
		const next = await Subscription.create({
			...base,
			externalSubscriptionId: 'I-NEW-2239',
			plan: nextPlan,
			status: 'approval_pending',
			creditCents,
			// Startaufschub: erste Periode beginnt zum Vorgänger-Ende (Muster POST /billing/subscriptions).
			currentPeriodEnd: restEnd,
		});
		return { user, old, next };
	};

	it('AK1: ACTIVATED des aufgeschobenen Abos ändert weder User.plan noch die Vorgängerzeile', async () => {
		const { user, old, next } = await seed('pro', 'plus');

		await provider.applyEvent(next, event('BILLING.SUBSCRIPTION.ACTIVATED', 'I-NEW-2239'), NOW);

		assert.equal(await planOf(user.id), 'pro', 'ohne Abbuchung bleibt das bezahlte Paket');
		const reloaded = await old.reload();
		assert.equal(reloaded.get('status'), 'cancelled');
		assert.equal(
			reloaded.get('pendingPlan'),
			'free',
			'Free-Fall des Vorgängers bleibt bis zur ersten Abbuchung stehen',
		);
		assert.ok(reloaded.get('pendingPlanEffectiveAt'), 'geplanter Wirksamkeitszeitpunkt bleibt stehen');
	});

	it('AK3: erste Abbuchung des aufgeschobenen Abos übernimmt das Paket, löst den Vorgänger und stellt die Rechnung aus', async () => {
		const { user, old, next } = await seed('pro', 'plus');

		await provider.applyEvent(next, event('BILLING.SUBSCRIPTION.ACTIVATED', 'I-NEW-2239'), NOW);
		await provider.applyEvent(next, event('PAYMENT.SALE.COMPLETED', 'I-NEW-2239'), NOW);

		assert.equal(await planOf(user.id), 'plus', 'die erste Abbuchung übernimmt das Zielpaket');
		const reloaded = await old.reload();
		assert.equal(reloaded.get('pendingPlan') ?? null, null, 'Vorgänger-Ablösung läuft mit der Abbuchung');
		assert.equal(
			await Invoice.count({ where: { subscriptionId: next.get('id') as number } }),
			1,
			'genau eine Rechnung für die Nachfolgezeile',
		);
	});

	it('AK4: Guthaben, das den ersten Zyklus ganz deckt, ersetzt den Vorgänger weiterhin schon bei ACTIVATED', async () => {
		const { user, old, next } = await seed('plus', 'pro', 899); // pro monatlich = 899 Cent, Guthaben deckt ganz (#2230)

		await provider.applyEvent(next, event('BILLING.SUBSCRIPTION.ACTIVATED', 'I-NEW-2239'), NOW);

		assert.equal(await planOf(user.id), 'pro', 'Guthaben ist die Zahlung — Paket gilt schon bei ACTIVATED');
		const reloaded = await old.reload();
		assert.equal(reloaded.get('pendingPlan') ?? null, null, 'Vorgänger-Ablösung läuft mit der Aktivierung');
	});
});
