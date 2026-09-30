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
			[999, -249],
		);
		assert.equal(invoice.get('amountCents'), 750);
	});

	it('Rechnung ohne Verrechnung bleibt gültig: voller Preis, keine Verrechnungsposition', async () => {
		const sub = await makeSub('normal@example.com', {});
		const invoice = await issueInvoiceForPeriod(sub, now, async () => {});
		assert.equal(invoice.get('amountCents'), 999);
		const items = (invoice.get('lineItems') ?? []) as { amountCents: number }[];
		assert.ok(items.every((i) => i.amountCents > 0));
	});
});
