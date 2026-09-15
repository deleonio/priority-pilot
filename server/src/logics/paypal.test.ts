import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSignature, isGracePeriodExpired } from './paypal.js';

/**
 * Rote Spec-Tests für #1495 (Spec docs/spec/issue-1495.md) — Webhook-Signaturprüfung (AK2) und
 * Zahlungsausfall-Kulanzfrist (AK7). `server/src/logics/paypal.ts` existiert noch nicht — Rot ist
 * hier der legitime Erst-Zustand für neue Funktionalität (Modul fehlt komplett). KEIN Produktivcode.
 */

describe('paypal.ts — verifyWebhookSignature (#1495 AK2)', () => {
	it('bei Nichterreichbarkeit von PayPal liefert die Prüfung "unreachable" statt zu werfen', async () => {
		const unreachableFetch = (async () => {
			throw new Error('ECONNREFUSED');
		}) as unknown as typeof fetch;

		const result = await verifyWebhookSignature(Buffer.from('{"id":"WH-1"}'), { 'paypal-transmission-sig': 'x' }, unreachableFetch);

		assert.equal(result, 'unreachable', 'Netzfehler darf nicht als "invalid" durchgehen (sonst geht das Ereignis verloren)');
	});

	it('bei erreichbarem PayPal mit verification_status=SUCCESS liefert die Prüfung "verified"', async () => {
		const okFetch = (async () =>
			new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 })) as unknown as typeof fetch;

		const result = await verifyWebhookSignature(Buffer.from('{"id":"WH-1"}'), { 'paypal-transmission-sig': 'ok' }, okFetch);

		assert.equal(result, 'verified');
	});

	it('bei erreichbarem PayPal mit verification_status=FAILURE liefert die Prüfung "invalid"', async () => {
		const failFetch = (async () =>
			new Response(JSON.stringify({ verification_status: 'FAILURE' }), { status: 200 })) as unknown as typeof fetch;

		const result = await verifyWebhookSignature(Buffer.from('{"id":"WH-1"}'), { 'paypal-transmission-sig': 'bad' }, failFetch);

		assert.equal(result, 'invalid');
	});
});

describe('paypal.ts — isGracePeriodExpired (#1495 AK7)', () => {
	const firstFailureAt = new Date('2026-01-01T00:00:00Z');

	it('an Tag 14 nach dem ersten Fehlschlag ist die Kulanzfrist noch nicht abgelaufen', () => {
		const day14 = new Date('2026-01-15T00:00:00Z');
		assert.equal(isGracePeriodExpired(firstFailureAt, day14), false);
	});

	it('ab Tag 15 nach dem ersten Fehlschlag ist die Kulanzfrist abgelaufen', () => {
		const day15 = new Date('2026-01-16T00:00:00Z');
		assert.equal(isGracePeriodExpired(firstFailureAt, day15), true);
	});
});
