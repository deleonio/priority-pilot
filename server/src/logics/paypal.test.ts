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

		const result = await verifyWebhookSignature(
			Buffer.from('{"id":"WH-1"}'),
			{ 'paypal-transmission-sig': 'x' },
			unreachableFetch,
		);

		assert.equal(
			result,
			'unreachable',
			'Netzfehler darf nicht als "invalid" durchgehen (sonst geht das Ereignis verloren)',
		);
	});

	it('bei erreichbarem PayPal mit verification_status=SUCCESS liefert die Prüfung "verified"', async () => {
		const okFetch = (async () =>
			new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 })) as unknown as typeof fetch;

		const result = await verifyWebhookSignature(
			Buffer.from('{"id":"WH-1"}'),
			{ 'paypal-transmission-sig': 'ok' },
			okFetch,
		);

		assert.equal(result, 'verified');
	});

	it('bei erreichbarem PayPal mit verification_status=FAILURE liefert die Prüfung "invalid"', async () => {
		const failFetch = (async () =>
			new Response(JSON.stringify({ verification_status: 'FAILURE' }), { status: 200 })) as unknown as typeof fetch;

		const result = await verifyWebhookSignature(
			Buffer.from('{"id":"WH-1"}'),
			{ 'paypal-transmission-sig': 'bad' },
			failFetch,
		);

		assert.equal(result, 'invalid');
	});
});

// #1506 AK5 (Spec docs/spec/issue-1506.md, Test-Pflege-Bedarf): die Kulanzfrist wurde von 14 auf
// 15 Tage verlängert (PO-Entscheidung #1461, ADR 0013) — die alten Tag-14/15-Fälle widersprechen
// der neuen Grenze und wurden durch Tag-15/16 ersetzt.
describe('paypal.ts — isGracePeriodExpired (#1506 AK5)', () => {
	const firstFailureAt = new Date('2026-01-01T00:00:00Z');

	it('an Tag 15 nach dem ersten Fehlschlag ist die Kulanzfrist noch nicht abgelaufen', () => {
		const day15 = new Date('2026-01-16T00:00:00Z');
		assert.equal(isGracePeriodExpired(firstFailureAt, day15), false);
	});

	it('ab Tag 16 nach dem ersten Fehlschlag ist die Kulanzfrist abgelaufen', () => {
		const day16 = new Date('2026-01-17T00:00:00Z');
		assert.equal(isGracePeriodExpired(firstFailureAt, day16), true);
	});
});
