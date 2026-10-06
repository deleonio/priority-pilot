import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../../models/index.js';
import { resetDb, closeDb } from '../../test/helpers.js';
import { applyPaymentEvent } from '../paypal.js';
import type { MailPayload } from '../mail.js';
import { applyDueGracePeriod } from './lifecycle.js';

/** #2306 (docs/spec/issue-2306.md): Mails bei Zahlungsausfall und Paketentzug — Versand als `mailSend` injiziert. */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T10:00:00Z');

const seed = async (firstFailureAt: Date | null, status = 'active') => {
	const user = await User.create({ email: 'abo@example.com', displayName: 'A', passwordHash: 'x', plan: 'pro' });
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-MAIL',
		plan: 'pro',
		period: 'monthly',
		status,
		currentPeriodEnd: NOW,
		firstFailureAt,
	});
	return { user, subscription };
};

const recorder = (fail = false) => {
	const sent: MailPayload[] = [];
	const mailSend = async (payload: MailPayload) => {
		sent.push(payload);
		if (fail) {
			throw new Error('smtp down');
		}
	};
	return { sent, mailSend };
};

const failed = (type: string) => ({ event_type: type }) as never;

describe('Mail bei Zahlungsausfall (#2306)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	for (const type of ['BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.DENIED']) {
		it(`AK1: erstes ${type} → genau eine Mail mit Fristende und PayPal-Link`, async () => {
			const { subscription } = await seed(null);
			const { sent, mailSend } = recorder();
			await applyPaymentEvent(subscription, failed(type), NOW, { mailSend });
			assert.equal(sent.length, 1);
			assert.equal(sent[0].to, 'abo@example.com');
			assert.match(sent[0].text, /04\.\s?11\.\s?2026|4\.\s?November 2026|2026-11-04/);
			assert.match(sent[0].text, /https:\/\/www\.paypal\.com\//);
		});
	}

	it('AK2: weiterer Fehlschlag in derselben Frist → keine zweite Mail', async () => {
		const { subscription } = await seed(null);
		const { sent, mailSend } = recorder();
		await applyPaymentEvent(subscription, failed('BILLING.SUBSCRIPTION.PAYMENT.FAILED'), NOW, { mailSend });
		await applyPaymentEvent(subscription, failed('PAYMENT.SALE.DENIED'), new Date(NOW.getTime() + DAY_MS), {
			mailSend,
		});
		assert.equal(sent.length, 1);
	});

	it('AK4: werfender Mailversand → past_due und firstFailureAt bleiben gesetzt', async () => {
		const { subscription } = await seed(null);
		const { sent, mailSend } = recorder(true);
		await applyPaymentEvent(subscription, failed('BILLING.SUBSCRIPTION.PAYMENT.FAILED'), NOW, { mailSend });
		assert.equal(sent.length, 1, 'Versand wurde versucht');
		await subscription.reload();
		assert.equal(subscription.get('status'), 'past_due');
		assert.ok(subscription.get('firstFailureAt'));
	});
});

describe('Mail bei Paketentzug (#2306)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK3: Entzug → genau eine Mail „Abo beendet, jetzt Free"', async () => {
		const { subscription } = await seed(new Date(NOW.getTime() - 16 * DAY_MS), 'past_due');
		const { sent, mailSend } = recorder();
		assert.equal(await applyDueGracePeriod(subscription, NOW, { mailSend }), true);
		assert.equal(sent.length, 1);
		assert.equal(sent[0].to, 'abo@example.com');
		assert.match(sent[0].text, /Free/);
	});

	it('AK3: laufende Frist → keine Mail', async () => {
		const { subscription } = await seed(new Date(NOW.getTime() - 5 * DAY_MS), 'past_due');
		const { sent, mailSend } = recorder();
		assert.equal(await applyDueGracePeriod(subscription, NOW, { mailSend }), false);
		assert.equal(sent.length, 0);
	});

	it('AK4: werfender Mailversand → plan free und grace_expired bleiben', async () => {
		const { user, subscription } = await seed(new Date(NOW.getTime() - 16 * DAY_MS), 'past_due');
		const { sent, mailSend } = recorder(true);
		assert.equal(await applyDueGracePeriod(subscription, NOW, { mailSend }), true);
		assert.equal(sent.length, 1, 'Versand wurde versucht');
		await subscription.reload();
		assert.equal(subscription.get('status'), 'grace_expired');
		assert.equal((await User.findByPk(user.id))?.get('plan'), 'free');
	});
});
