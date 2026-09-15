import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sequelize from '../database.js';
import WebhookEvent from './webhookEvent.js';

/**
 * Rote Spec-Tests für #1495 AK9 (Spec docs/spec/issue-1495.md) — WebhookEvent-Modell ohne
 * Zahlungsdatenfeld, mit Dedup-Grundlage (provider + externalEventId). Rot, bis
 * `server/src/models/webhookEvent.ts` existiert. KEIN Produktivcode.
 */

describe('WebhookEvent-Modell (#1495 AK9)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('legt ein Ereignis an und liest provider, externalEventId, eventType, verified, rawPayload zurück', async () => {
		const created = await WebhookEvent.create({
			provider: 'paypal',
			externalEventId: 'WH-EVENT-1',
			eventType: 'BILLING.SUBSCRIPTION.ACTIVATED',
			rawPayload: '{"id":"WH-EVENT-1"}',
			verified: false,
		});

		const found = await WebhookEvent.findByPk(created.get('id') as number);
		assert.ok(found);
		assert.equal(found.get('provider'), 'paypal');
		assert.equal(found.get('externalEventId'), 'WH-EVENT-1');
		assert.equal(found.get('eventType'), 'BILLING.SUBSCRIPTION.ACTIVATED');
		assert.equal(found.get('verified'), false);
		assert.equal(found.get('rawPayload'), '{"id":"WH-EVENT-1"}');
	});

	it('lehnt ein zweites Ereignis mit gleichem provider+externalEventId ab (Dedup-Grundlage AK3)', async () => {
		await WebhookEvent.create({
			provider: 'paypal',
			externalEventId: 'WH-EVENT-DUP',
			eventType: 'BILLING.SUBSCRIPTION.UPDATED',
			rawPayload: '{}',
			verified: true,
		});

		await assert.rejects(
			WebhookEvent.create({
				provider: 'paypal',
				externalEventId: 'WH-EVENT-DUP',
				eventType: 'BILLING.SUBSCRIPTION.UPDATED',
				rawPayload: '{}',
				verified: true,
			}),
			/Unique|SQLITE_CONSTRAINT/i,
		);
	});

	it('speichert keine Zahlungsdaten', () => {
		const attrs = Object.keys(WebhookEvent.getAttributes());
		const forbidden = ['cardNumber', 'paymentMethod', 'iban', 'amount', 'amountCents'];
		for (const key of forbidden) {
			assert.ok(!attrs.includes(key), `WebhookEvent darf kein Feld "${key}" tragen`);
		}
	});
});
