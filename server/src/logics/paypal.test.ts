import { describe, it, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	verifyWebhookSignature,
	isGracePeriodExpired,
	createPaypalClient,
	assertPaypalConfig,
	applyPaymentEvent,
	coversFirstCycle,
} from './paypal.js';
import { PAYPAL_PLAN_IDS, getPlansCatalog } from './plans.js';
import { Subscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1495 (Spec docs/spec/issue-1495.md) — Webhook-Signaturprüfung (AK2) und
 * Zahlungsausfall-Kulanzfrist (AK7). `server/src/logics/paypal.ts` existiert noch nicht — Rot ist
 * hier der legitime Erst-Zustand für neue Funktionalität (Modul fehlt komplett). KEIN Produktivcode.
 */

describe('paypal.ts — verifyWebhookSignature (#1495 AK2)', () => {
	// #2545 Test-Pflege: der neue Config-Guard bricht ohne Zugangsdaten vor dem Netzaufruf ab — die
	// drei Netzpfad-Tests brauchen jetzt gesetzte Variablen, um unreachable/verified/invalid zu erreichen.
	const savedEnv = { ...process.env };
	beforeEach(() => {
		process.env.PAYPAL_CLIENT_ID = 'id';
		process.env.PAYPAL_CLIENT_SECRET = 'secret';
		process.env.PAYPAL_WEBHOOK_ID = 'wh';
	});
	after(() => {
		process.env = savedEnv;
	});

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

describe('paypal.ts — verifyWebhookSignature ohne Konfiguration (#2545 AK2)', () => {
	it('liefert "unconfigured", loggt die fehlenden Variablen und ruft PayPal nicht auf', async () => {
		const savedEnv = { ...process.env };
		const errors: string[] = [];
		const errorSpy = mock.method(console, 'error', (...args: unknown[]) => errors.push(args.join(' ')));
		const calls: string[] = [];
		const spyingFetch = (async (input: RequestInfo | URL) => {
			calls.push(String(input));
			throw new Error('Netzaufruf bei fehlender Konfiguration unzulässig');
		}) as unknown as typeof fetch;
		try {
			for (const name of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID']) {
				delete process.env[name];
			}

			const result = await verifyWebhookSignature(Buffer.from('{"id":"WH-1"}'), {}, spyingFetch);

			assert.equal(result, 'unconfigured', 'Fehlende Konfiguration muss von "unreachable" unterscheidbar sein');
			assert.equal(calls.length, 0, 'Ohne Zugangsdaten darf kein PayPal-Netzaufruf versucht werden');
			assert.ok(
				errors.some((m) => /PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID/.test(m)),
				'Log muss die fehlenden Variablennamen nennen',
			);
		} finally {
			errorSpy.mock.restore();
			process.env = savedEnv;
		}
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

	// #2545 AK1 (PO-Entscheidung 2026-10-14, Test-Pflege): ganz ohne Zugangsdaten läuft der Server
	// weiter (PayPal-Billing aus) — die Meldung mit den Variablennamen kommt per console.error.
	it('#2545 AK1: läuft in Produktion ohne ALLE PayPal-Variablen weiter und loggt die Variablen', () => {
		const errors: string[] = [];
		const errorSpy = mock.method(console, 'error', (...args: unknown[]) => errors.push(args.join(' ')));
		try {
			assert.doesNotThrow(() => assertPaypalConfig({ NODE_ENV: 'production' }));
			assert.ok(
				errors.some((m) => /PAYPAL_CLIENT_ID/.test(m) && /PAYPAL_CLIENT_SECRET/.test(m)),
				'Meldung muss die fehlenden Variablennamen nennen',
			);
		} finally {
			errorSpy.mock.restore();
		}
	});

	it('#2545 AK1: ohne Zugangsdaten bleibt Dev/Test erlaubt (kein Wurf außerhalb der Produktion)', () => {
		for (const NODE_ENV of ['test', 'development']) {
			assert.doesNotThrow(() => assertPaypalConfig({ NODE_ENV }));
		}
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

// #2546 AK1 (Spec docs/spec/issue-2546.md): jeder PayPal-Fetch muss ein AbortSignal tragen —
// alle 7 Aufrufstellen (verifyWebhookSignature 2×, getAccessToken 1×, createPaypalClient 4×) über
// die fünf Abläufe mit je Token- + Fachaufruf = 10 Aufrufe abgedeckt. Rot heute: kein Signal.
describe('paypal.ts — Fetch-Zeitlimit-Signal (#2546 AK1)', () => {
	it('trägt jeder Fetch-Aufruf (7 Stellen) ein AbortSignal in den Fetch-Optionen', async () => {
		const savedEnv = { ...process.env };
		process.env.PAYPAL_CLIENT_ID = 'id';
		process.env.PAYPAL_CLIENT_SECRET = 'secret';
		process.env.PAYPAL_WEBHOOK_ID = 'wh';
		const signals: unknown[] = [];
		const spyFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			signals.push(init?.signal);
			return new Response(JSON.stringify({}), { status: 200 });
		}) as unknown as typeof fetch;
		try {
			await verifyWebhookSignature(Buffer.from('{"id":"WH-1"}'), { 'paypal-transmission-sig': 'x' }, spyFetch);
			await createPaypalClient(spyFetch).createSubscription('PLAN-X');
			await createPaypalClient(spyFetch).cancel('I-1');
			await createPaypalClient(spyFetch).getSubscription('I-1');
			await createPaypalClient(spyFetch).revise('I-1', 'PLAN-Y');

			assert.equal(signals.length, 10, 'alle fünf Abläufe müssen ihre Token- und Fachaufrufe gemacht haben');
			const ohneSignal = signals.filter((signal) => !(signal instanceof AbortSignal)).length;
			assert.equal(ohneSignal, 0, 'jeder PayPal-Fetch (7 Stellen) muss ein AbortSignal tragen');
		} finally {
			process.env = savedEnv;
		}
	});
});

// #2546 AK2 (Spec docs/spec/issue-2546.md): nie antwortender, abort-bewusster Fake + kleines
// Limit → cancel() lehnt innerhalb des Limits ab. Der Watchdog (3 s) macht den fehlenden Timeout
// als klares Rot sichtbar, statt den Test hängen zu lassen. Produktives fetch bricht über das
// Signal ab — der Fake spiegelt exakt dieses Verhalten (abort-Listener → reject).
describe('paypal.ts — Fetch-Zeitlimit-Abbruch (#2546 AK2)', () => {
	it('bricht cancel() bei nie antwortendem PayPal nach PAYPAL_TIMEOUT_MS ab (unter 1 s)', async () => {
		const savedEnv = { ...process.env };
		process.env.PAYPAL_CLIENT_ID = 'id';
		process.env.PAYPAL_CLIENT_SECRET = 'secret';
		process.env.PAYPAL_TIMEOUT_MS = '100';
		const hangingFetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
			new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('PayPal-Aufruf abgebrochen')));
			}) as unknown as Response) as unknown as typeof fetch;
		let rejected = false;
		const cancelPromise = createPaypalClient(hangingFetch)
			.cancel('I-TIMEOUT')
			.then(
				() => {},
				() => {
					rejected = true;
				},
			);
		let watchdog: NodeJS.Timeout | undefined;
		const start = Date.now();
		try {
			await Promise.race([
				cancelPromise,
				new Promise((_resolve, reject) => {
					watchdog = setTimeout(
						() => reject(new Error('Watchdog: cancel() bricht nicht ab — kein Zeitlimit am Fetch')),
						3000,
					);
				}),
			]);
		} finally {
			clearTimeout(watchdog);
			process.env = savedEnv;
		}
		assert.ok(rejected, 'nie antwortender PayPal-Fetch muss cancel() nach dem Zeitlimit ablehnen');
		assert.ok(
			Date.now() - start < 1000,
			`Abbruch muss bei PAYPAL_TIMEOUT_MS=100 unter 1 s erfolgen, dauerte ${Date.now() - start} ms`,
		);
	});
});

describe('Regel „Guthaben deckt den ersten Zyklus“ an einer Stelle (#2556, Spec docs/spec/issue-2556.md)', () => {
	const NOW = new Date('2026-11-15T00:00:00Z');

	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	const seed = async (creditCents: number) => {
		const user = await User.create({
			email: `u-2556-${Math.random()}@example.com`,
			displayName: 'U',
			passwordHash: 'x',
			plan: 'pro',
		});
		return Subscription.create({
			userId: user.id,
			provider: 'paypal',
			externalSubscriptionId: `I-2556-${Math.random()}`,
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			// Pflichtspalte (allowNull: false, subscription.ts) — für den Regelvergleich ohne Bedeutung.
			currentPeriodEnd: NOW,
			creditCents,
		});
	};

	it('AK2/TF2: coversFirstCycle — Guthaben = Preis → true, 1 ct darunter → false, Guthaben 0 → false', async () => {
		const price = getPlansCatalog().prices.pro.monthly;
		assert.equal(coversFirstCycle(await seed(price)), true, 'Grenzfall: exakt der Preis deckt den ersten Zyklus');
		assert.equal(coversFirstCycle(await seed(price - 1)), false, '1 ct unter dem Preis deckt nicht');
		assert.equal(coversFirstCycle(await seed(0)), false, 'ohne Guthaben deckt nichts');
	});

	it('AK1/TF1: ACTIVATED mit Guthaben exakt zum Preis aktiviert sofort — kein Warten auf den Zahlungseingang', async () => {
		const subscription = await seed(getPlansCatalog().prices.pro.monthly);

		await applyPaymentEvent(
			subscription,
			{ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'I-2556' } },
			NOW,
		);

		await subscription.reload();
		assert.equal(subscription.get('status'), 'active', 'Grenzfall Guthaben = Preis deckt: Aktivierung ohne Zahlung');
	});
});
