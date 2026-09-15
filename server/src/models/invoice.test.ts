import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import Invoice from './invoice.js';

/**
 * Rote Spec-Tests für #1495 AK9 (Spec docs/spec/issue-1495.md) — Invoice-Modell ohne
 * Zahlungsdatenfeld (nur externe Referenzen/Beträge, keine Karten-/Kontodaten). Rot, bis
 * `server/src/models/invoice.ts` existiert. KEIN Produktivcode.
 */

describe('Invoice-Modell (#1495 AK9)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('legt eine Rechnung an und liest number, periodStart/-End, amountCents, taxNote zurück', async () => {
		const created = await Invoice.create({
			userId: 1,
			subscriptionId: 1,
			number: 'INV-2026-000001',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const found = await Invoice.findByPk(created.get('id') as number);
		assert.ok(found);
		assert.equal(found.get('number'), 'INV-2026-000001');
		assert.equal(found.get('amountCents'), 799);
		assert.match(found.get('taxNote') as string, /§19 UStG/);
	});

	it('erzwingt eindeutige Rechnungsnummern', async () => {
		await Invoice.create({
			userId: 2,
			subscriptionId: 2,
			number: 'INV-2026-000002',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 1499,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		await assert.rejects(
			Invoice.create({
				userId: 3,
				subscriptionId: 3,
				number: 'INV-2026-000002',
				periodStart: new Date('2026-02-01'),
				periodEnd: new Date('2026-03-01'),
				amountCents: 2499,
				taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
			}),
			/Unique|SQLITE_CONSTRAINT/i,
		);
	});

	it('speichert keine Zahlungsdaten (nur den Rechnungsbetrag, keine Karten-/Kontodaten)', () => {
		const attrs = Object.keys(Invoice.getAttributes());
		const forbidden = ['cardNumber', 'paymentMethod', 'iban'];
		for (const key of forbidden) {
			assert.ok(!attrs.includes(key), `Invoice darf kein Feld "${key}" tragen`);
		}
	});
});
