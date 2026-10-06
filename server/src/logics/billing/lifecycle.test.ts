import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
import { resetDb, closeDb } from '../../test/helpers.js';
import { applyPaymentEvent } from '../paypal.js';
import { applyDueGracePeriod, applyDueGracePeriods, reconcilePaypalSubscriptions } from './lifecycle.js';
import { PaypalHttpError } from '../paypal.js';

/**
 * #2234 (docs/spec/issue-2234.md): Nach Ablauf der Kulanzfrist fällt `User.plan` auf `free` und das
 * PayPal-Abo wird gekündigt. Die Kündigung ist als `deps.cancel` injiziert — nie echtes PayPal.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T10:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const planOf = async (userId: number) => (await User.findByPk(userId))?.get('plan');

const seed = async (firstFailureAt: Date | null, provider = 'paypal', ext = 'I-GRACE') => {
	const user = await User.create({
		email: `${ext.toLowerCase()}@example.com`,
		displayName: 'G',
		passwordHash: 'x',
		plan: 'pro',
	});
	const subscription = await Subscription.create({
		userId: user.id,
		provider,
		externalSubscriptionId: ext,
		plan: 'pro',
		period: 'monthly',
		status: 'past_due',
		currentPeriodEnd: NOW,
		firstFailureAt,
	});
	return { user, subscription };
};

describe('Kulanzfrist-Ablauf entzieht das Paket (#2234)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: nach Tag 15 → plan free, grace_expired, PayPal-Abo genau einmal gekündigt', async () => {
		const { user, subscription } = await seed(daysAgo(16));
		const cancelled: string[] = [];
		const applied = await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.equal(applied, true);
		assert.deepEqual(cancelled, ['I-GRACE']);
		assert.equal(await planOf(user.id), 'free');
		await subscription.reload();
		assert.equal(subscription.get('status'), 'grace_expired');
		assert.equal(subscription.get('firstFailureAt'), null);
	});

	it('AK1: Google-Play-Abo verliert das Paket ohne cancel-Aufruf', async () => {
		const { user, subscription } = await seed(daysAgo(16), 'google_play', 'GP-GRACE');
		const cancelled: string[] = [];
		await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'free');
	});

	it('AK2: genau Tag 15 → Paket bleibt, kein cancel', async () => {
		const { user, subscription } = await seed(daysAgo(15));
		const cancelled: string[] = [];
		const applied = await applyDueGracePeriod(subscription, NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.equal(applied, false);
		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'pro');
		assert.equal((await subscription.reload()).get('status'), 'past_due');
	});

	it('AK3: wirft cancel, fällt plan trotzdem auf free', async () => {
		const { user, subscription } = await seed(daysAgo(20));
		const warn = console.warn;
		console.warn = () => {};
		try {
			await applyDueGracePeriod(subscription, NOW, {
				cancel: async () => {
					throw new Error('PayPal down');
				},
			});
		} finally {
			console.warn = warn;
		}

		assert.equal(await planOf(user.id), 'free');
		assert.equal((await subscription.reload()).get('status'), 'grace_expired');
	});

	it('AK5: Sweep wirkt ohne /auth/me nur auf abgelaufene Abos', async () => {
		const expired = await seed(daysAgo(30), 'paypal', 'I-EXPIRED');
		const healthy = await seed(null, 'paypal', 'I-HEALTHY');
		const inGrace = await seed(daysAgo(3), 'paypal', 'I-INGRACE');
		const cancelled: string[] = [];
		await applyDueGracePeriods(NOW, { cancel: async (id) => void cancelled.push(id) });

		assert.deepEqual(cancelled, ['I-EXPIRED']);
		assert.equal(await planOf(expired.user.id), 'free');
		assert.equal(await planOf(healthy.user.id), 'pro');
		assert.equal(await planOf(inGrace.user.id), 'pro');
		assert.equal((await healthy.subscription.reload()).get('status'), 'past_due');
	});

	it('AK6: Zahlung in der Frist stellt active her, späterer Lauf entzieht nichts', async () => {
		const { user, subscription } = await seed(daysAgo(10));
		await applyPaymentEvent(subscription, { event_type: 'PAYMENT.SALE.COMPLETED' } as never, NOW, {
			issueInvoice: async () => undefined,
		});
		await subscription.reload();
		assert.equal(subscription.get('status'), 'active');
		assert.equal(subscription.get('firstFailureAt'), null);

		const cancelled: string[] = [];
		const later = new Date(NOW.getTime() + 20 * DAY_MS);
		await applyDueGracePeriod(subscription, later, { cancel: async (id) => void cancelled.push(id) });
		assert.deepEqual(cancelled, []);
		assert.equal(await planOf(user.id), 'pro');
	});
});

/**
 * #2300 (docs/spec/issue-2300.md): täglicher Abgleich der PayPal-Abos. `getSubscription` ist injiziert —
 * nie echtes PayPal. `reconcilePaypalSubscriptions` existiert noch nicht (Rot = fehlender Export).
 */
describe('PayPal-Abgleich (#2300)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	type Remote = { status: string; nextBillingTime?: string };
	const seedSub = async (opts: {
		status?: string;
		periodEndDaysAgo?: number;
		createdAgoMs?: number;
		provider?: string;
		ext: string;
	}) => {
		const user = await User.create({
			email: `${opts.ext.toLowerCase()}@example.com`,
			displayName: 'R',
			passwordHash: 'x',
			plan: 'pro',
		});
		const subscription = await Subscription.create({
			userId: user.id,
			provider: opts.provider ?? 'paypal',
			externalSubscriptionId: opts.ext,
			plan: 'pro',
			period: 'monthly',
			status: opts.status ?? 'active',
			currentPeriodEnd: daysAgo(opts.periodEndDaysAgo ?? 4),
		});
		if (opts.createdAgoMs !== undefined) {
			// Statisches update: instance.update verwirft Auto-Timestamps still (MEMORY 2026-10-05)
			await Subscription.update(
				{ createdAt: new Date(NOW.getTime() - opts.createdAgoMs) },
				{ where: { id: subscription.id } },
			);
		}
		return { user, subscription };
	};
	const stub = (byId: Record<string, Remote | Error>) => {
		const asked: string[] = [];
		return {
			asked,
			getSubscription: async (id: string) => {
				asked.push(id);
				const r = byId[id];
				if (r instanceof Error) throw r;
				if (!r) throw new PaypalHttpError('nicht gefunden', 404);
				return r;
			},
		};
	};
	const captureInfo = async <T>(fn: () => Promise<T>) => {
		const orig = console.info;
		const lines: string[] = [];
		console.info = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
		try {
			return { result: await fn(), lines };
		} finally {
			console.info = orig;
		}
	};
	const reload = (id: number) => Subscription.findByPk(id);

	for (const remote of ['CANCELLED', 'EXPIRED', 'SUSPENDED']) {
		it(`AK1: überfälliges aktives Abo, PayPal ${remote} -> lokal beendet, User.plan free`, async () => {
			const { user, subscription } = await seedSub({ ext: `I-${remote}` });
			const d = stub({ [`I-${remote}`]: { status: remote } });
			await reconcilePaypalSubscriptions(NOW, d);
			assert.equal((await reload(subscription.id))?.get('status'), 'cancelled');
			assert.equal(await planOf(user.id), 'free');
		});
	}

	it('AK2: PayPal ACTIVE -> currentPeriodEnd = next_billing_time, Plan bleibt', async () => {
		const { user, subscription } = await seedSub({ ext: 'I-ACT' });
		const next = '2026-11-20T00:00:00Z';
		await reconcilePaypalSubscriptions(NOW, stub({ 'I-ACT': { status: 'ACTIVE', nextBillingTime: next } }));
		const row = await reload(subscription.id);
		assert.equal(new Date(row?.get('currentPeriodEnd') as Date).toISOString(), new Date(next).toISOString());
		assert.equal(row?.get('status'), 'active');
		assert.equal(await planOf(user.id), 'pro');
	});

	it('AK3: approval_pending > 1 h, bei PayPal nicht aktiv (und 404) -> verworfen, User.plan unverändert', async () => {
		const a = await seedSub({ ext: 'I-PEND1', status: 'approval_pending', createdAgoMs: 2 * 3600_000 });
		const b = await seedSub({ ext: 'I-PEND404', status: 'approval_pending', createdAgoMs: 2 * 3600_000 });
		await reconcilePaypalSubscriptions(NOW, stub({ 'I-PEND1': { status: 'APPROVAL_PENDING' } }));
		assert.equal(await reload(a.subscription.id), null);
		assert.equal(await reload(b.subscription.id), null, '404 zählt wie nicht aktiv');
		assert.equal(await planOf(a.user.id), 'pro');
	});

	it('AK3: junger oder bei PayPal aktiver approval_pending-Checkout bleibt unangetastet', async () => {
		const young = await seedSub({ ext: 'I-YOUNG', status: 'approval_pending', createdAgoMs: 30 * 60_000 });
		const live = await seedSub({ ext: 'I-LIVE', status: 'approval_pending', createdAgoMs: 2 * 3600_000 });
		const d = stub({ 'I-LIVE': { status: 'APPROVED' }, 'I-YOUNG': { status: 'APPROVAL_PENDING' } });
		const { result } = await captureInfo(() => reconcilePaypalSubscriptions(NOW, d));
		assert.equal(result, 0);
		assert.ok(await reload(young.subscription.id));
		assert.ok(await reload(live.subscription.id));
	});

	it('AK4: je Korrektur genau eine Log-Zeile (Präfix, Abo-ID, alt/neu), Rückgabe = Anzahl', async () => {
		await seedSub({ ext: 'I-LOG1' });
		await seedSub({ ext: 'I-LOG2' });
		const d = stub({
			'I-LOG1': { status: 'CANCELLED' },
			'I-LOG2': { status: 'ACTIVE', nextBillingTime: '2026-11-20T00:00:00Z' },
		});
		const { result, lines } = await captureInfo(() => reconcilePaypalSubscriptions(NOW, d));
		assert.equal(result, 2);
		assert.equal(lines.length, 2);
		assert.ok(lines.every((l) => l.startsWith('[paypal-reconcile]')));
		assert.ok(lines.some((l) => l.includes('I-LOG1') && l.includes('active') && l.includes('cancelled')));
		assert.ok(lines.some((l) => l.includes('I-LOG2')));
	});

	it('AK5: Toleranz (<= 3 Tage) und Nicht-PayPal-Abos werden nicht abgefragt', async () => {
		await seedSub({ ext: 'I-TOL', periodEndDaysAgo: 3 });
		await seedSub({ ext: 'I-GP', provider: 'google_play' });
		const d = stub({});
		const { result } = await captureInfo(() => reconcilePaypalSubscriptions(NOW, d));
		assert.equal(result, 0);
		assert.deepEqual(d.asked, []);
	});

	it('AK5: PayPal-Fehler bei einem Abo lässt die übrigen laufen und ändert das betroffene nicht', async () => {
		const bad = await seedSub({ ext: 'I-BAD' });
		const good = await seedSub({ ext: 'I-GOOD' });
		const d = stub({ 'I-BAD': new PaypalHttpError('Gateway', 502), 'I-GOOD': { status: 'CANCELLED' } });
		const { result } = await captureInfo(() => reconcilePaypalSubscriptions(NOW, d));
		assert.equal(result, 1);
		assert.equal((await reload(bad.subscription.id))?.get('status'), 'active');
		assert.equal(await planOf(bad.user.id), 'pro');
		assert.equal((await reload(good.subscription.id))?.get('status'), 'cancelled');
	});
});
