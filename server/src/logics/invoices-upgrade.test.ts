import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueInvoiceForPeriod } from './invoices.js';

/** Rote Spec-Tests für #1912 AK5 (Spec docs/spec/issue-1912.md). Eigene Datei: `invoices-issue.test.ts` schließt die DB in `after()`. */

describe('invoices.ts — Verrechnung beim Upgrade (#1912 AK5)', () => {
	const now = new Date('2026-04-01T00:00:00Z');

	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	const makeSub = async (email: string, extra: Record<string, unknown>) => {
		const user = await User.create({ email, displayName: 'U', passwordHash: 'x' });
		return Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: `I-${email}`,
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
			...extra,
		});
	};

	it('weist Paketpreis und Verrechnung (negativ) als Positionen aus; Summe = erster Zyklus', async () => {
		const sub = await makeSub('upgrade@example.com', { creditCents: 249 });
		const invoice = await issueInvoiceForPeriod(sub, now, async () => {});
		assert.deepEqual(
			(invoice.get('lineItems') as { amountCents: number }[]).map((i) => i.amountCents),
			[899, -249],
		);
		assert.equal(invoice.get('amountCents'), 650);
	});

	it('Rechnung ohne Verrechnung bleibt gültig: voller Preis, keine Verrechnungsposition', async () => {
		const sub = await makeSub('normal@example.com', {});
		const invoice = await issueInvoiceForPeriod(sub, now, async () => {});
		assert.equal(invoice.get('amountCents'), 899);
		const items = (invoice.get('lineItems') ?? []) as { amountCents: number }[];
		assert.ok(items.every((i) => i.amountCents > 0));
	});

	it('AK3: Guthaben über dem Preis wird nur um den verrechneten Betrag gemindert, der Rest bleibt', async () => {
		const user = await User.create({ email: 'carry@example.com', displayName: 'U', passwordHash: 'x' });
		const sub = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-carry',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: now,
			creditCents: 1500,
		});
		await issueInvoiceForPeriod(sub, now, async () => {});
		const reloaded = await Subscription.findByPk(sub.get('id') as number);
		assert.equal(reloaded?.get('creditCents'), 1500 - 899, 'Rest = Guthaben − Paketpreis');
	});
});
