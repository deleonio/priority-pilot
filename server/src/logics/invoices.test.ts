import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import { nextInvoiceNumber } from './invoices.js';

/**
 * Rote Spec-Tests für #1495 AK8 (Spec docs/spec/issue-1495.md) — lückenlos aufsteigende
 * Rechnungsnummern, auch bei parallelen Aufrufen. `server/src/logics/invoices.ts` existiert noch
 * nicht — Rot ist der legitime Erst-Zustand für neue Funktionalität. KEIN Produktivcode.
 */

describe('invoices.ts — nextInvoiceNumber (#1495 AK8)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('vergibt aufsteigende, lückenlose Nummern bei sequenziellen Aufrufen', async () => {
		const now = new Date('2026-03-01T00:00:00Z');
		const first = await nextInvoiceNumber(now);
		const second = await nextInvoiceNumber(now);
		const third = await nextInvoiceNumber(now);

		assert.notEqual(first, second);
		assert.notEqual(second, third);
		const numbers = [first, second, third].map((n) => Number(n.split('-').pop()));
		assert.deepEqual(numbers, [numbers[0], numbers[0] + 1, numbers[0] + 2], 'Nummern müssen lückenlos aufsteigen');
	});

	it('vergibt bei parallelen Aufrufen keine doppelte Nummer', async () => {
		const now = new Date('2026-03-02T00:00:00Z');
		const results = await Promise.all(Array.from({ length: 10 }, () => nextInvoiceNumber(now)));
		assert.equal(new Set(results).size, 10, 'Jede vergebene Nummer muss eindeutig sein');
	});
});
