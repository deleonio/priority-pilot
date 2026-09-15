import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Subscription from './subscription.js';

/**
 * Rote Spec-Tests für #1494 AK6 (Spec docs/spec/issue-1494.md) — Abo-Modell mit Anbieter, externer
 * Abo-ID, Paket, Zeitraum, Status, aktueller Periode und Rechnungsreferenz; ohne Betrags- oder
 * Zahlungsdatenfelder.
 *
 * Rot, bis `server/src/models/subscription.ts` existiert (heute: Modul fehlt komplett).
 * KEIN Produktivcode.
 */

describe('Subscription-Modell (#1494 AK6)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('legt ein Abo an und liest Provider, externe Abo-ID, Paket, Zeitraum, Status, aktuelle Periode und Rechnungsreferenz zurück', async () => {
		const created = await Subscription.create({
			userId: 1,
			provider: 'paypal',
			externalSubscriptionId: 'I-BW452GLLEP1G',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-10-15'),
			invoiceReference: 'INV-2026-001',
		});

		const found = await Subscription.findByPk(created.get('id') as number);
		assert.ok(found, 'Abo muss lesbar sein');
		assert.equal(found.get('provider'), 'paypal');
		assert.equal(found.get('externalSubscriptionId'), 'I-BW452GLLEP1G');
		assert.equal(found.get('plan'), 'pro');
		assert.equal(found.get('period'), 'monthly');
		assert.equal(found.get('status'), 'active');
		assert.ok(found.get('currentPeriodEnd'), 'currentPeriodEnd muss gesetzt sein');
		assert.equal(found.get('invoiceReference'), 'INV-2026-001');
	});

	it('speichert weder Beträge noch Zahlungsdaten — nur die Rechnungsreferenz', () => {
		const attrs = Object.keys(Subscription.getAttributes());
		const forbidden = ['amount', 'amountCents', 'price', 'priceCents', 'cardNumber', 'paymentMethod', 'iban'];
		for (const key of forbidden) {
			assert.ok(!attrs.includes(key), `Subscription darf kein Feld "${key}" tragen`);
		}
	});
});
