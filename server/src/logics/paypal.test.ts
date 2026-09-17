import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSignature, isGracePeriodExpired, createPaypalClient } from './paypal.js';

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

// #1471 AK1 (Spec docs/spec/issue-1471.md): revise() bei HTTP 200 mit unlesbarem Body —
// kontrollierter {}/approvalUrl-Fallback bleibt, aber der Parse-Fehler wird genau 1× per
// console.warn protokolliert (statt still geschluckt, Muster PR #1480).
describe('paypal.ts — createPaypalClient().revise (#1471 AK1)', () => {
	const tokenAndReviseFetch = (reviseResponse: Response): typeof fetch =>
		(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith('/v1/oauth2/token')) {
				return new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 });
			}
			if (url.endsWith('/revise')) {
				return reviseResponse;
			}
			throw new Error(`unerwarteter fetch: ${url}`);
		}) as unknown as typeof fetch;

	it('bei 200 mit ungültigem JSON: löst mit {} und warnt genau 1× mit Fehlerkontext', async () => {
		const warn = console.warn;
		const calls: unknown[][] = [];
		console.warn = (...args: unknown[]) => calls.push(args);
		try {
			const brokenFetch = tokenAndReviseFetch(
				new Response('<html>Gateway-Fehler</html>', { status: 200, headers: { 'Content-Type': 'application/json' } }),
			);
			const result = await createPaypalClient(brokenFetch).revise('SUB-1', 'PLAN-X');
			assert.deepEqual(result, {}, 'res.ok: Abo-Wechsel war erfolgreich, revise darf nicht werfen');
			assert.equal(calls.length, 1, 'Parse-Fehler wird genau einmal protokolliert');
			assert.ok(
				calls[0]!.some((arg) => typeof arg === 'string' && /revise/i.test(arg)) ||
					calls[0]!.some((arg) => arg instanceof Error),
				'die Warnung nennt Fehlerkontext (revise/Parse-Fehler)',
			);
		} finally {
			console.warn = warn;
		}
	});

	it('bei 200 mit gültiger approve-Link-Antwort: Rückgabe { approvalUrl }, keine Warnung', async () => {
		const warn = console.warn;
		const calls: unknown[][] = [];
		console.warn = (...args: unknown[]) => calls.push(args);
		try {
			const okFetch = tokenAndReviseFetch(
				new Response(JSON.stringify({ links: [{ rel: 'approve', href: 'https://paypal.approve/xyz' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				}),
			);
			const result = await createPaypalClient(okFetch).revise('SUB-1', 'PLAN-X');
			assert.deepEqual(result, { approvalUrl: 'https://paypal.approve/xyz' });
			assert.equal(calls.length, 0, 'gültige Antwort darf keine Warnung erzeugen');
		} finally {
			console.warn = warn;
		}
	});
});
