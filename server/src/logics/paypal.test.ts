import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSignature, isGracePeriodExpired, createPaypalClient, assertPaypalConfig } from './paypal.js';
import { PAYPAL_PLAN_IDS } from './plans.js';

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

// #1471 AK1: revise() bei HTTP 200 mit unlesbarem Body —
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

describe('paypal.ts — createPaypalClient().createSubscription (#2235 AK1)', () => {
	it('sendet ohne PAYPAL_CANCEL_URL eine cancel_url, die von return_url abweicht und billing=cancelled trägt', async () => {
		const saved = { cancel: process.env.PAYPAL_CANCEL_URL, ret: process.env.PAYPAL_RETURN_URL };
		delete process.env.PAYPAL_CANCEL_URL;
		delete process.env.PAYPAL_RETURN_URL;
		let sent: { application_context?: { return_url?: string; cancel_url?: string } } = {};
		const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith('/v1/oauth2/token')) {
				return new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 });
			}
			sent = JSON.parse(String(init?.body));
			return new Response(
				JSON.stringify({ id: 'I-1', links: [{ rel: 'approve', href: 'https://paypal.example/approve' }] }),
				{ status: 201 },
			);
		}) as unknown as typeof fetch;
		try {
			await createPaypalClient(fakeFetch).createSubscription('PLAN-X');
		} finally {
			if (saved.cancel !== undefined) process.env.PAYPAL_CANCEL_URL = saved.cancel;
			if (saved.ret !== undefined) process.env.PAYPAL_RETURN_URL = saved.ret;
		}
		const ctx = sent.application_context;
		assert.ok(ctx?.cancel_url && ctx.return_url, 'return_url und cancel_url müssen gesetzt sein');
		assert.notEqual(ctx.cancel_url, ctx.return_url);
		assert.match(ctx.cancel_url, /billing=cancelled/);
	});
});

describe('paypal.ts — createPaypalClient().createSubscription mit Gebühr und Start (#2241)', () => {
	it('sendet setup_fee und start_time gemeinsam im Plan-Override', async () => {
		let sent: { start_time?: string; plan?: { payment_preferences?: { setup_fee?: { value?: string } } } } = {};
		const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input).endsWith('/v1/oauth2/token')) {
				return new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 });
			}
			sent = JSON.parse(String(init?.body));
			return new Response(JSON.stringify({ id: 'I-2241', links: [] }), { status: 201 });
		}) as unknown as typeof fetch;
		const startTime = new Date('2027-03-06T00:00:00.000Z');

		await createPaypalClient(fakeFetch).createSubscription('PLAN-X', { firstCycleCents: 1669, startTime });

		assert.equal(sent.start_time, startTime.toISOString());
		assert.equal(sent.plan?.payment_preferences?.setup_fee?.value, '16.69');
	});
});

describe('paypal.ts — assertPaypalConfig (#2302)', () => {
	const planVars = Object.values(PAYPAL_PLAN_IDS).flatMap((p) => Object.values(p).map((e) => e.envVar));
	const full = (): NodeJS.ProcessEnv => ({
		NODE_ENV: 'production',
		PAYPAL_CLIENT_ID: 'id',
		PAYPAL_CLIENT_SECRET: 'secret',
		PAYPAL_WEBHOOK_ID: 'wh',
		PAYPAL_RETURN_URL: 'https://x.test/app/settings',
		...Object.fromEntries(planVars.map((v) => [v, 'P-1'])),
	});

	for (const name of [
		'PAYPAL_CLIENT_ID',
		'PAYPAL_CLIENT_SECRET',
		'PAYPAL_WEBHOOK_ID',
		'PAYPAL_RETURN_URL',
		...planVars,
	]) {
		it(`wirft in Produktion, wenn ${name} fehlt`, () => {
			const env = full();
			// Whitespace zählt als fehlend; mindestens ein Zugangsdatum bleibt gesetzt (PayPal aktiv).
			env[name] = '  ';
			if (name === 'PAYPAL_CLIENT_ID') env.PAYPAL_CLIENT_SECRET = 'secret';
			assert.throws(() => assertPaypalConfig(env), new RegExp(name));
		});
	}

	it('nennt alle fehlenden Variablen und keine Werte', () => {
		const env = { NODE_ENV: 'production', PAYPAL_CLIENT_ID: 'geheim-id' };
		assert.throws(
			() => assertPaypalConfig(env),
			(e: Error) =>
				/PAYPAL_WEBHOOK_ID/.test(e.message) &&
				/PAYPAL_PLAN_ID_PRO_YEARLY/.test(e.message) &&
				!/geheim-id/.test(e.message),
		);
	});

	it('wirft bei vollständiger Konfiguration nicht', () => {
		assert.doesNotThrow(() => assertPaypalConfig(full()));
	});

	it('wirft ohne Zugangsdaten (PayPal aus) auch in Produktion nicht', () => {
		assert.doesNotThrow(() => assertPaypalConfig({ NODE_ENV: 'production' }));
	});

	it('wirft außerhalb von Produktion nie', () => {
		for (const NODE_ENV of ['test', 'development', '']) {
			assert.doesNotThrow(() => assertPaypalConfig({ NODE_ENV, PAYPAL_CLIENT_ID: 'id' }));
		}
	});
});

describe('paypal.ts — createPaypalClient().getSubscription (#2300)', () => {
	const fetchWith = (res: Response, seen: string[]): typeof fetch =>
		(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith('/v1/oauth2/token')) {
				return new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 });
			}
			seen.push(url);
			return res;
		}) as unknown as typeof fetch;

	it('GET /v1/billing/subscriptions/{id}: mappt status und billing_info.next_billing_time', async () => {
		const seen: string[] = [];
		const body = { status: 'ACTIVE', billing_info: { next_billing_time: '2026-11-20T00:00:00Z' } };
		const result = await createPaypalClient(
			fetchWith(new Response(JSON.stringify(body), { status: 200 }), seen),
		).getSubscription('I-1');
		assert.ok(seen[0]!.endsWith('/v1/billing/subscriptions/I-1'));
		assert.deepEqual(result, { status: 'ACTIVE', nextBillingTime: '2026-11-20T00:00:00Z' });
	});

	it('404 wirft PaypalHttpError mit status 404', async () => {
		await assert.rejects(
			createPaypalClient(fetchWith(new Response('{}', { status: 404 }), [])).getSubscription('I-X'),
			(e: unknown) => (e as { status?: number }).status === 404,
		);
	});
});
