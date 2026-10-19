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

describe('Kündigung ab der zweiten Laufzeit: Erstattung und Retry (#2745)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	/** PayPal-Abo im zweiten Jahr: eine abgelaufene Rechnung (2025/26) + aktuelle (2026/27, mit saleId). */
	const secondTermSub = async () => {
		const user = await User.create({
			email: '2745-provider@example.com',
			displayName: 'U',
			passwordHash: 'x',
			plan: 'plus',
		});
		const subscription = await Subscription.create({
			userId: user.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2745-PROVIDER',
			plan: 'plus',
			period: 'yearly',
			status: 'active',
			currentPeriodEnd: new Date('2027-06-01T00:00:00Z'),
			cancellationRequestedAt: NOW,
		});
		await Invoice.create({
			userId: user.id,
			subscriptionId: subscription.id,
			number: 'INV-2745-000001',
			periodStart: new Date('2025-06-01T00:00:00Z'),
			periodEnd: new Date('2026-06-01T00:00:00Z'),
			amountCents: 9900,
			paymentStatus: 'paid',
		});
		const current = await Invoice.create({
			userId: user.id,
			subscriptionId: subscription.id,
			number: 'INV-2745-000002',
			periodStart: new Date('2026-06-01T00:00:00Z'),
			periodEnd: new Date('2027-06-01T00:00:00Z'),
			amountCents: 9900,
			paymentStatus: 'paid',
			saleId: 'SALE-2745-PROVIDER',
		});
		return { user, subscription, current };
	};

	const cancelledEvent = {
		id: 'WH-2745',
		type: 'BILLING.SUBSCRIPTION.CANCELLED',
		externalSubscriptionId: 'I-2745-PROVIDER',
		payload: { event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-2745-PROVIDER' } },
	};

	it('CANCELLED des verlängerten Jahresabos löst anteilige Sale-Erstattung aus und setzt das gekürzte Ende', async () => {
		const { subscription, current } = await secondTermSub();
		const refunds: { saleId: string; amountCents: number }[] = [];
		const provider = createPaypalProvider({
			client: {
				createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
				revise: async () => ({}),
				cancel: async () => {},
				refund: async (saleId, amountCents) => {
					refunds.push({ saleId, amountCents });
				},
			},
		});

		await provider.applyEvent(subscription, cancelledEvent, NOW);

		// Periode 2026-06-01→2027-06-01 (365 d), gekürztes Ende 2026-11-01 → 212 d bezahlt nach dem Ende:
		// floor(9900 * 212 / 365) = 5750 Cent.
		assert.deepEqual(refunds, [{ saleId: 'SALE-2745-PROVIDER', amountCents: 5750 }]);
		const reloaded = await subscription.reload();
		assert.equal(
			(reloaded.get('pendingPlanEffectiveAt') as Date).toISOString(),
			'2026-11-01T10:00:00.000Z',
			'Vertragsende = Kündigungseingang + 1 Kalendermonat',
		);
		const credit = await Invoice.findOne({ where: { creditForInvoiceId: current.get('id') as number } });
		assert.ok(credit, 'Gutschrift zur laufenden Rechnung ausgestellt');
		assert.equal(credit?.get('amountCents'), -5750);
	});

	it('Fehlschlagender Refund kassiert das Vertragsende nicht und zählt den Versuch (AK6)', async () => {
		const { subscription } = await secondTermSub();
		const provider = createPaypalProvider({
			client: {
				createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
				revise: async () => ({}),
				cancel: async () => {},
				refund: async () => {
					throw new Error('PAYPAL-DOWN');
				},
			},
		});

		await provider.applyEvent(subscription, cancelledEvent, NOW);

		const reloaded = await subscription.reload();
		assert.equal(
			(reloaded.get('pendingPlanEffectiveAt') as Date).toISOString(),
			'2026-11-01T10:00:00.000Z',
			'das Vertragsende greift trotz Refund-Fehlschlag',
		);
		assert.equal(reloaded.get('refundRetryAttempts'), 1, 'Fehlschlag ist für die Wiederholung gezählt');
	});

	it('Der Sweep wiederholt die Erstattung bis zum Erfolg (#2606-Muster)', async () => {
		const { subscription } = await secondTermSub();
		await subscription.update({ refundRetryAttempts: 1 });
		const refunds: string[] = [];
		const { applyDueGracePeriods } = await import('./lifecycle.js');

		await applyDueGracePeriods(new Date(), {
			refund: async (saleId) => {
				refunds.push(saleId);
			},
		});

		assert.deepEqual(refunds, ['SALE-2745-PROVIDER'], 'Erstattung im Sweep nachgeholt');
		assert.equal((await subscription.reload()).get('refundRetryAttempts'), null, 'Zähler nach Erfolg zurückgesetzt');
	});

	it('CANCELLED des von einem Upgrade abgelösten Alt-Abos erstattet nicht (#1912, Entzug #2237)', async () => {
		const { subscription, current } = await secondTermSub();
		// replacePredecessors-Form (#1912): das Alt-Abo ist lokal `cancelled` + `plan free` ohne
		// Kündigungs-Merker; der Paketentzug (#2237) hinterlässt dieselbe Form. Der späte
		// CANCELLED-Webhook trifft den Early-Return von `applyPlanChange` — und erstattet nicht.
		await subscription.update({ status: 'cancelled', plan: 'free', cancellationRequestedAt: null });
		const refunds: { saleId: string; amountCents: number }[] = [];
		const provider = createPaypalProvider({
			client: {
				createSubscription: async () => ({ approvalUrl: '', externalSubscriptionId: '' }),
				revise: async () => ({}),
				cancel: async () => {},
				refund: async (saleId, amountCents) => {
					refunds.push({ saleId, amountCents });
				},
			},
		});

		await provider.applyEvent(subscription, cancelledEvent, NOW);

		assert.deepEqual(refunds, [], 'Alt-Abo eines Upgrades wird nicht erstattet');
		assert.equal(
			await Invoice.findOne({ where: { creditForInvoiceId: current.get('id') as number } }),
			null,
			'keine Gutschrift zur Rechnung des Alt-Abos',
		);
		assert.equal(
			(await subscription.reload()).get('pendingPlanEffectiveAt'),
			null,
			'das Ende bleibt unangetastet (Early-Return von applyPlanChange)',
		);
	});
});
