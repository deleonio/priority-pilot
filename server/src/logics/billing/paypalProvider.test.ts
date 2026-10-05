import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
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
