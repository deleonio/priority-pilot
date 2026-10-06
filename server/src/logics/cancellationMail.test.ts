import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Subscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { applyPlanChange } from './paypal.js';
import type { MailSender } from './mail.js';

/**
 * #2308 (Spec docs/spec/issue-2308.md) — AK6/AK7: Die Kündigungsbestätigung geht NUR im
 * CANCELLED-Zweig von `applyPlanChange` raus (vierter, optionaler Parameter = injizierbarer
 * `MailSender`). Rot, bis die Impl-Phase den Versand ergänzt.
 */

const PERIOD_END = new Date('2027-06-01T00:00:00Z');
const NOW = new Date('2027-05-10T00:00:00Z');
const cancelled = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED' };

const seed = async (extra: Record<string, unknown> = {}, status = 'active', plan = 'plus') => {
	const user = await User.create({ email: 'konto@example.com', displayName: 'U', passwordHash: 'x', plan });
	const subscription = await Subscription.create({
		userId: user.id,
		provider: 'paypal',
		externalSubscriptionId: 'I-2308',
		plan,
		period: 'monthly',
		status,
		currentPeriodEnd: PERIOD_END,
		...extra,
	});
	return subscription;
};

const recorder = () => {
	const mails: Parameters<MailSender>[0][] = [];
	const send: MailSender = async (payload) => {
		mails.push(payload);
	};
	return { mails, send };
};

describe('Kündigungsbestätigung per Webhook (#2308)', () => {
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK6: CANCELLED auf laufendes Abo → genau eine Mail an die gespeicherte Adresse mit Datum, Vertragsende, Art und Grund', async () => {
		const subscription = await seed({
			cancellationKind: 'extraordinary',
			cancellationReason: 'Preiserhöhung',
			cancellationEmail: 'kunde@example.com',
			cancellationRequestedAt: new Date('2027-05-09T10:00:00Z'),
		});
		const { mails, send } = recorder();

		await applyPlanChange(subscription, cancelled, NOW, send);

		assert.equal(mails.length, 1);
		assert.equal(mails[0].to, 'kunde@example.com');
		assert.match(mails[0].text, /Preiserhöhung/);
		assert.match(mails[0].text, /außerordentlich/i);
		assert.match(mails[0].text, /0?9\.0?5\.2027/, 'Kündigungsdatum = gespeicherter Eingang');
		assert.match(mails[0].text, /0?1\.0?6\.2027/, 'Vertragsende = currentPeriodEnd');
	});

	it('AK6: ohne gespeicherte Angaben → Konto-Adresse, Art ordentlich, Ereigniszeit als Kündigungsdatum', async () => {
		const subscription = await seed();
		const { mails, send } = recorder();

		await applyPlanChange(subscription, cancelled, NOW, send);

		assert.equal(mails.length, 1);
		assert.equal(mails[0].to, 'konto@example.com');
		assert.doesNotMatch(mails[0].text, /außerordentlich/i);
		assert.match(mails[0].text, /ordentlich/i);
		assert.match(mails[0].text, /0?10\.0?5\.2027/);
	});

	it('AK7: zweites CANCELLED auf ein gekündigtes Abo → keine Mail', async () => {
		const subscription = await seed();
		const { mails, send } = recorder();

		await applyPlanChange(subscription, cancelled, NOW, send);
		await applyPlanChange(subscription, cancelled, NOW, send);

		assert.equal(mails.length, 1);
	});

	it('AK7: abgelöstes Abo (#1912: cancelled + free) und EXPIRED → keine Mail', async () => {
		const superseded = await seed({}, 'cancelled', 'free');
		const { mails, send } = recorder();
		await applyPlanChange(superseded, cancelled, NOW, send);
		assert.equal(mails.length, 0, 'abgelöstes Abo');

		await resetDb();
		const running = await seed();
		await applyPlanChange(running, { event_type: 'BILLING.SUBSCRIPTION.EXPIRED' }, NOW, send);
		assert.equal(mails.length, 0, 'EXPIRED');
	});
});
