import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
// Invoice ist (Stand #1495) noch nicht aus models/index.ts re-exportiert — direkter Modul-Import
// (Muster models/invoice.test.ts), um diese Testdatei nicht an einer fremden Produktivlücke
// scheitern zu lassen (SKILL.md: Import-/Syntaxfehler ist kein legitimes Rot).
import Invoice from '../models/invoice.js';
import { issueInvoiceForPeriod } from '../logics/invoices.js';
import type { AppDeps } from './index.js';
import { getPlansCatalog } from '../logics/plans.js';
import { PaypalHttpError, replacePredecessors } from '../logics/paypal.js';
import { prorateUpgrade } from '../logics/proration.js';

/**
 * Rote Spec-Tests für #1505 (Spec docs/spec/issue-1505.md) — AK1-AK5 und AK7. Die Routen
 * `server/src/express/routes/billingSubscriptions.ts` existieren noch nicht: bis dahin liefert
 * jeder Aufruf 404 (ohne Session) bzw. 401 (mit Session, sobald requireAuth den Pfad kennt — der
 * globale `app.use(requireAuth)` greift bereits VOR jeder Router-Existenz, siehe #207) statt der
 * erwarteten Statuscodes. Legitimer Erstzustand für neue Routen. KEIN Produktivcode.
 *
 * `paypalClient` ist ein neuer, injizierbarer `AppDeps`-Eintrag (Vorbild `paypalVerifier`,
 * #1495) — noch nicht in `AppDeps` deklariert, daher der Cast über `unknown`.
 */

applyTestAuthEnv('test-secret-issue-1505');

let server: TestServer;

const login = (email: string) => server.login(email);
const post = (path: string, cookie: string, body: unknown = {}) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const get = (path: string, cookie: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

interface FakePaypalClient {
	createSubscription: (planId: string) => Promise<{ approvalUrl: string; externalSubscriptionId: string }>;
	cancel: (externalSubscriptionId: string) => Promise<void>;
	revise: (externalSubscriptionId: string, targetPlanId: string) => Promise<{ approvalUrl?: string }>;
}

const withClient = (client: Partial<FakePaypalClient>): AppDeps =>
	({
		paypalClient: {
			createSubscription: async (planId: string) => ({
				approvalUrl: `https://paypal.example/approve/${planId}`,
				externalSubscriptionId: `I-${planId}`,
			}),
			cancel: async () => {},
			revise: async () => ({}),
			...client,
		},
	}) as unknown as AppDeps;

describe('Abo-Verwaltungs-API (#1505)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: POST /billing/subscriptions legt ein Abo mit Status approval_pending an und liefert die Zustimmungs-URL', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak1@example.com');

		const res = await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'monthly' });

		assert.equal(res.status, 201);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.ok(body.approvalUrl, 'Antwort muss eine Zustimmungs-URL enthalten');

		const user = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.findOne({ where: { userId: user.id } });
		assert.ok(sub, 'Ein Subscription-Datensatz muss angelegt sein');
		assert.equal(sub?.get('status'), 'approval_pending');
	});

	it('AK2: ein Nutzer mit bereits aktivem Abo bekommt bei erneutem Anlegen 409', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak2-active@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-EXISTING',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions', cookie, { plan: 'pro', period: 'monthly' });
		assert.equal(res.status, 409);
	});

	it('AK3: POST /billing/subscriptions/cancel ruft den Cancel-Aufruf mit der externen Abo-ID auf, plan bleibt unverändert', async () => {
		let calledWith: string | undefined;
		server = await startTestServer(
			withClient({
				cancel: async (externalSubscriptionId: string) => {
					calledWith = externalSubscriptionId;
				},
			}),
		);
		const cookie = await login('ak3@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CANCEL-ME',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		// Test-Pflege #2308: die Kündigung eines laufenden Abos verlangt { kind, email }.
		const res = await post('/billing/subscriptions/cancel', cookie, { kind: 'ordinary', email: 'k@example.com' });

		assert.equal(res.status, 200);
		assert.equal(calledWith, 'I-CANCEL-ME', 'Der Client muss mit der externen Abo-ID aufgerufen werden');
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CANCEL-ME' } });
		assert.equal(sub?.get('plan'), 'pro', 'Der Plan darf sich durch den Aufruf allein nicht ändern (ADR 0013)');
	});

	// Fehlaktivierung/Cancel-Befund aus der Sandbox: ein abgebrochener Checkout liegt als
	// approval_pending-Zeile herauf; PayPal lehnt die Kündigung eines nie zugestimmten Abos mit
	// 4xx ab (vorher: pauschal 502, Zeile blieb für immer offen). 4xx ⇒ lokal entfernen; war die
	// Zustimmung bereits bei PayPal eingegangen (enges Fenster vor ACTIVATED, Review #1998),
	// kündigt derselbe Ruf das echte Abo dort — nur Netz-/Serverfehler lassen die Zeile stehen.
	it('POST /billing/subscriptions/cancel auf einer approval_pending-Zeile: PayPal-Ablehnung (4xx) entfernt sie lokal', async () => {
		server = await startTestServer(
			withClient({
				cancel: async () => {
					throw new PaypalHttpError('nicht kündbar', 422);
				},
			}),
		);
		const cookie = await login('cancel-pending@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-NEVER-APPROVED',
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/cancel', cookie);

		assert.equal(res.status, 200, 'Eine PayPal-Ablehnung (4xx) muss die Zeile lokal aufräumen');
		assert.equal(
			await Subscription.count({ where: { userId: me.id, status: 'approval_pending' } }),
			0,
			'Die approval_pending-Zeile muss entfernt werden',
		);
	});

	it('POST /billing/subscriptions/cancel auf einer approval_pending-Zeile: Netzfehler lässt sie für einen neuen Anlauf stehen', async () => {
		server = await startTestServer(
			withClient({
				cancel: async () => {
					throw new Error('ECONNREFUSED');
				},
			}),
		);
		const cookie = await login('cancel-unreachable@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-UNREACHABLE',
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/cancel', cookie);

		assert.equal(res.status, 502, 'Ein Netzfehler darf die Zeile nicht beseitigen');
		assert.equal(
			await Subscription.count({ where: { userId: me.id, status: 'approval_pending' } }),
			1,
			'Nach Netzfehler bleibt die Zeile für einen neuen Anlauf stehen',
		);
	});

	it('POST /billing/subscriptions/cancel auf einer approval_pending-Zeile kündigt ein dort bereits zugestimmtes Abo wirklich', async () => {
		let cancelCalls = 0;
		server = await startTestServer(
			withClient({
				cancel: async () => {
					cancelCalls += 1;
				},
			}),
		);
		const cookie = await login('cancel-approved-race@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-APPROVED-RACE',
			plan: 'pro',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/cancel', cookie);

		assert.equal(res.status, 200);
		assert.equal(cancelCalls, 1, 'PayPal muss gefragt werden — die Zustimmung kann bereits vorliegen');
		assert.equal(await Subscription.count({ where: { userId: me.id } }), 0, 'Die Zeile wird danach entfernt');
	});

	it('AK4: POST /billing/subscriptions/change ruft den Revise-Aufruf mit der Ziel-Plan-ID auf und liefert die Zustimmungs-URL', async () => {
		let calledWith: [string, string] | undefined;
		server = await startTestServer(
			withClient({
				revise: async (externalSubscriptionId: string, targetPlanId: string) => {
					calledWith = [externalSubscriptionId, targetPlanId];
					return { approvalUrl: 'https://paypal.example/revise' };
				},
			}),
		);
		const cookie = await login('ak4@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CHANGE-ME',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'plus', period: 'monthly' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.equal(
			body.approvalUrl,
			'https://paypal.example/revise',
			'Zustimmungs-URL des Clients muss durchgereicht werden',
		);
		assert.equal(calledWith?.[0], 'I-CHANGE-ME', 'Der Client muss mit der externen Abo-ID aufgerufen werden');
		assert.ok(calledWith?.[1], 'Der Client muss mit der Ziel-Plan-ID aufgerufen werden');
		const sub = await Subscription.findOne({ where: { externalSubscriptionId: 'I-CHANGE-ME' } });
		assert.equal(sub?.get('plan'), 'pro', 'Der Plan darf sich durch den Aufruf allein nicht ändern (ADR 0013)');
	});

	it('AK4: liefert der Client keine Zustimmungs-URL, enthält die Antwort auch keine', async () => {
		server = await startTestServer(withClient({ revise: async () => ({}) }));
		const cookie = await login('ak4-noapproval@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-CHANGE-NOURL',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'plus', period: 'monthly' });

		assert.equal(res.status, 200);
		const body = (await res.json()) as { approvalUrl?: string };
		assert.equal(body.approvalUrl, undefined);
	});

	it('#1912 AK3: Upgrade legt ein neues Abo mit reduziertem ersten Zyklus an (kein revise) und kündigt das alte noch nicht', async () => {
		const created: { planId: string; override?: { firstCycleCents?: number } }[] = [];
		let revised = false;
		let cancelled = false;
		server = await startTestServer(
			withClient({
				createSubscription: (async (planId: string, override?: { firstCycleCents?: number }) => {
					created.push({ planId, override });
					return { approvalUrl: 'https://paypal.example/upgrade', externalSubscriptionId: 'I-NEW' };
				}) as FakePaypalClient['createSubscription'],
				revise: async () => {
					revised = true;
					return {};
				},
				cancel: async () => {
					cancelled = true;
				},
			}),
		);
		const cookie = await login('ak3-1912@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const dayMs = 24 * 60 * 60 * 1000;
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 15 * dayMs),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { approvalUrl?: string }).approvalUrl, 'https://paypal.example/upgrade');
		assert.equal(revised, false, 'Upgrade darf nicht per revise laufen');
		assert.equal(cancelled, false, 'Altes Abo erst nach Bestätigung des neuen kündigen');
		assert.equal(created.length, 1, 'Genau ein neues Abo wird angelegt');
		const first = created[0].override?.firstCycleCents;
		const { prices } = getPlansCatalog();
		assert.ok(
			first !== undefined && first > prices.pro.monthly - prices.plus.monthly && first < prices.pro.monthly,
			`erster Zyklus reduziert, war ${first}`,
		);
	});

	it('#1912: zwei abgebrochene Upgrade-Anläufe hinterlassen genau ein ausstehendes Abo neben dem aktiven', async () => {
		let counter = 0;
		server = await startTestServer(
			withClient({
				createSubscription: (async () => {
					counter += 1;
					return { approvalUrl: 'https://paypal.example/upgrade', externalSubscriptionId: `I-NEW-${counter}` };
				}) as FakePaypalClient['createSubscription'],
			}),
		);
		const cookie = await login('retry-1912@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
		});

		assert.equal((await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status, 200);
		assert.equal((await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status, 200);

		const pending = await Subscription.findAll({ where: { userId: me.id, status: 'approval_pending' } });
		assert.deepEqual(
			pending.map((sub) => sub.get('externalSubscriptionId')),
			['I-NEW-2'],
		);
		const active = await Subscription.findAll({ where: { userId: me.id, status: 'active' } });
		assert.deepEqual(
			active.map((sub) => sub.get('externalSubscriptionId')),
			['I-OLD'],
		);
	});

	it('#1912 AK6: Downgrade bleibt beim revise-Weg — kein neues Abo, kein Guthaben', async () => {
		let created = false;
		let revisedTo: string | undefined;
		server = await startTestServer(
			withClient({
				createSubscription: async () => {
					created = true;
					return { approvalUrl: 'x', externalSubscriptionId: 'I-X' };
				},
				revise: async (_id: string, planId: string) => {
					revisedTo = planId;
					return {};
				},
			}),
		);
		const cookie = await login('ak6-1912@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-DOWN',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
		});

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'plus', period: 'monthly' });

		assert.equal(res.status, 200);
		assert.equal(created, false);
		assert.ok(revisedTo, 'Downgrade nutzt weiter revise');
	});

	it('AK5: GET /billing/invoices liefert nur eigene Rechnungen', async () => {
		server = await startTestServer(withClient({}));
		const cookieA = await login('ak5-a@example.com');
		const cookieB = await login('ak5-b@example.com');
		const meA = (await (await get('/auth/me', cookieA)).json()) as { id: number };
		const meB = (await (await get('/auth/me', cookieB)).json()) as { id: number };
		const subA = await Subscription.create({
			userId: meA.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-A',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const subB = await Subscription.create({
			userId: meB.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-B',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await Invoice.create({
			userId: meA.id,
			subscriptionId: subA.get('id') as number,
			number: 'INV-2026-100001',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});
		await Invoice.create({
			userId: meB.id,
			subscriptionId: subB.get('id') as number,
			number: 'INV-2026-100002',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get('/billing/invoices', cookieA);

		assert.equal(res.status, 200);
		const body = (await res.json()) as { number: string }[];
		assert.equal(body.length, 1, 'Nur die eigene Rechnung darf zurückkommen');
		assert.equal(body[0].number, 'INV-2026-100001');
	});

	// #2086 (Spec docs/spec/issue-2086.md, AK4): der DTO trägt den Zahlungsstatus — der
	// Eigentümer-Route wie der Admin-Route (Spiegel via `serializeInvoice`). Bis zur Impl-Phase
	// fehlt das Feld in `serializeInvoice`: die Value-Assertion scheitert an `undefined`
	// (legitimer Erst-Zustand). KEIN Produktivcode.
	it('AK4 (#2086): GET /billing/invoices liefert je Rechnung den Zahlungsstatus paymentStatus', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak4-2086@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-2086-DTO',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await Invoice.create({
			userId: me.id,
			subscriptionId: sub.get('id') as number,
			number: 'INV-2026-100101',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
			paymentStatus: 'paid',
		} as never);
		await Invoice.create({
			userId: me.id,
			subscriptionId: sub.get('id') as number,
			number: 'INV-2026-100102',
			periodStart: new Date('2026-03-01'),
			periodEnd: new Date('2026-04-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
			paymentStatus: 'refunded',
		} as never);

		const res = await get('/billing/invoices', cookie);

		assert.equal(res.status, 200);
		const body = (await res.json()) as { number: string; paymentStatus?: string }[];
		assert.equal(body.length, 2);
		assert.equal(
			body.find((invoice) => invoice.number === 'INV-2026-100101')?.paymentStatus,
			'paid',
			'Der DTO muss paymentStatus je Rechnung tragen (hier paid)',
		);
		assert.equal(
			body.find((invoice) => invoice.number === 'INV-2026-100102')?.paymentStatus,
			'refunded',
			'Der DTO muss paymentStatus je Rechnung tragen (hier refunded)',
		);
	});

	it('AK5: GET /billing/invoices/{id} einer fremden Rechnung antwortet 404', async () => {
		server = await startTestServer(withClient({}));
		const cookieA = await login('ak5-id-a@example.com');
		const cookieB = await login('ak5-id-b@example.com');
		const meB = (await (await get('/auth/me', cookieB)).json()) as { id: number };
		const subB = await Subscription.create({
			userId: meB.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-ID-B',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const invoiceB = await Invoice.create({
			userId: meB.id,
			subscriptionId: subB.get('id') as number,
			number: 'INV-2026-100003',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get(`/billing/invoices/${invoiceB.get('id')}`, cookieA);

		assert.equal(res.status, 404, 'Fremde Rechnungen dürfen weder inhaltlich noch über den Status verraten werden');
	});

	it('AK5: GET /billing/invoices/{id} der eigenen Rechnung antwortet 200', async () => {
		server = await startTestServer(withClient({}));
		const cookie = await login('ak5-own@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-INV-OWN',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const invoice = await Invoice.create({
			userId: me.id,
			subscriptionId: sub.get('id') as number,
			number: 'INV-2026-100004',
			periodStart: new Date('2026-02-01'),
			periodEnd: new Date('2026-03-01'),
			amountCents: 799,
			taxNote: 'Gemäß §19 UStG wird keine Umsatzsteuer ausgewiesen.',
		});

		const res = await get(`/billing/invoices/${invoice.get('id')}`, cookie);

		assert.equal(res.status, 200);
		const body = (await res.json()) as { number: string };
		assert.equal(body.number, 'INV-2026-100004');
	});

	// #1668: Store-Apps kaufen nie über PayPal (ADR 0016) — Anlage und Wechsel lehnen die Kanäle
	// play und appstore mit 409 ab, ohne PayPal aufzurufen.
	it('#1668: Anlage und Wechsel mit X-Client-Channel play/appstore → 409, kein PayPal-Aufruf', async () => {
		let paypalCalls = 0;
		server = await startTestServer(
			withClient({
				createSubscription: async () => {
					paypalCalls++;
					return { approvalUrl: 'https://paypal.example/approve', externalSubscriptionId: 'I-1' };
				},
				revise: async () => {
					paypalCalls++;
					return {};
				},
			}),
		);
		const cookie = await login('channel@example.com');
		for (const channel of ['play', 'appstore']) {
			for (const path of ['/billing/subscriptions', '/billing/subscriptions/change']) {
				const res = await fetch(`${server.baseUrl}${path}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Client-Channel': channel },
					body: JSON.stringify({ plan: 'plus', period: 'monthly' }),
				});
				assert.equal(res.status, 409, `${path} im Kanal ${channel}`);
			}
		}
		assert.equal(paypalCalls, 0);
		assert.equal(await Subscription.count(), 0);

		const web = await fetch(`${server.baseUrl}/billing/subscriptions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-Client-Channel': 'web' },
			body: JSON.stringify({ plan: 'plus', period: 'monthly' }),
		});
		assert.equal(web.status, 201);
	});

	// #1913 (Spec docs/spec/issue-1913.md): Vorschau des fälligen Betrags vor dem Paketwechsel.
	describe('#1913: POST /billing/subscriptions/change/preview', () => {
		const PREVIEW = '/billing/subscriptions/change/preview';
		const DAY_MS = 24 * 60 * 60 * 1000;
		const seedActive = async (email: string, plan: 'plus' | 'pro', period: 'monthly' | 'yearly' = 'monthly') => {
			const cookie = await login(email);
			const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
			const currentPeriodEnd = new Date(Date.now() + 15 * DAY_MS);
			await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: `I-${email}`,
				plan,
				period,
				status: 'active',
				currentPeriodEnd,
			});
			return { cookie, userId: me.id, currentPeriodEnd };
		};

		it('AK1: Upgrade-Vorschau liefert dieselben Werte wie der anschließende Wechsel, ohne PayPal-Aufruf und DB-Schreibung', async () => {
			const created: { firstCycleCents?: number }[] = [];
			let paypalCalls = 0;
			server = await startTestServer(
				withClient({
					createSubscription: (async (_planId: string, override?: { firstCycleCents?: number }) => {
						paypalCalls += 1;
						created.push({ firstCycleCents: override?.firstCycleCents });
						return { approvalUrl: 'https://paypal.example/upgrade', externalSubscriptionId: 'I-NEW' };
					}) as FakePaypalClient['createSubscription'],
					revise: async () => {
						paypalCalls += 1;
						return {};
					},
				}),
			);
			const { cookie, userId } = await seedActive('ak1-1913@example.com', 'plus');

			const res = await post(PREVIEW, cookie, { plan: 'pro', period: 'monthly' });

			assert.equal(res.status, 200);
			const preview = (await res.json()) as { creditCents: number; dueCents: number };
			assert.equal(paypalCalls, 0, 'Vorschau darf PayPal nicht aufrufen');
			assert.equal(await Subscription.count({ where: { userId } }), 1, 'Vorschau schreibt keine Subscription');
			assert.ok(preview.creditCents > 0 && preview.dueCents > 0, `Werte erwartet, war ${JSON.stringify(preview)}`);

			await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });
			const pending = await Subscription.findOne({ where: { userId, status: 'approval_pending' } });
			assert.equal(preview.dueCents, created[0].firstCycleCents, 'dueCents = firstCycleCents des Wechsels');
			assert.equal(preview.creditCents, pending?.get('creditCents'), 'creditCents = Guthaben des Wechsels');
		});

		it('AK2: Downgrade und Zeitraumwechsel ohne Rangsprung zeigen creditCents 0 und den Katalogpreis', async () => {
			server = await startTestServer(withClient({}));
			const { prices } = getPlansCatalog();
			const down = await seedActive('ak2-down-1913@example.com', 'pro');
			const same = await seedActive('ak2-same-1913@example.com', 'plus');

			const downRes = await post(PREVIEW, down.cookie, { plan: 'plus', period: 'monthly' });
			const sameRes = await post(PREVIEW, same.cookie, { plan: 'plus', period: 'yearly' });

			assert.equal(downRes.status, 200);
			// Test-Pflege (#2049 AK6): die Vorschau nennt zusätzlich den Startzeitpunkt (hier das
			// Periodenende des aktiven Abos) — deepEqual führt das neue Feld mit.
			assert.deepEqual(await downRes.json(), {
				creditCents: 0,
				dueCents: prices.plus.monthly,
				immediate: false,
				startsAt: down.currentPeriodEnd.toISOString(),
			});
			// Test-Pflege (#2142 AK1, PO-Entscheidung): ein Zeitraumwechsel im gleichen Paket wirkt jetzt
			// sofort mit Verrechnung wie ein Upgrade — siehe die #2142-Tests am Dateiende.
			assert.equal(sameRes.status, 200);
		});

		// Sofort-/Periodenende-Semantik (ADR 0013): nur der Rangsprung nach oben wirkt sofort — die
		// Oberfläche hat bewusst keine eigene Rangfolge (planOffers), die Aussage kommt vom Server.
		it('die Vorschau nennt mit immediate, ob der Wechsel sofort wirksam wird (Upgrade) oder zum Periodenende', async () => {
			server = await startTestServer(withClient({}));
			const up = await seedActive('immediate-up@example.com', 'plus');

			const res = await post(PREVIEW, up.cookie, { plan: 'pro', period: 'monthly' });

			assert.equal(res.status, 200);
			const preview = (await res.json()) as { immediate?: boolean };
			assert.equal(preview.immediate, true, 'Ein Upgrade wirkt sofort');
		});

		it('AK3: ungültiges plan/period → 400', async () => {
			server = await startTestServer(withClient({}));
			const { cookie } = await seedActive('ak3-400-1913@example.com', 'plus');

			assert.equal((await post(PREVIEW, cookie, { plan: 'free', period: 'monthly' })).status, 400);
			assert.equal((await post(PREVIEW, cookie, { plan: 'pro', period: 'weekly' })).status, 400);
		});

		it('AK3: ohne Abo → 404', async () => {
			server = await startTestServer(withClient({}));
			const cookie = await login('ak3-404-1913@example.com');

			assert.equal((await post(PREVIEW, cookie, { plan: 'pro', period: 'monthly' })).status, 404);
		});

		it('AK3: ohne Session → 401', async () => {
			server = await startTestServer(withClient({}));
			const res = await fetch(`${server.baseUrl}${PREVIEW}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: 'pro', period: 'monthly' }),
			});

			assert.equal(res.status, 401);
		});
	});

	// AK7: alle vier Routen ohne Session → 401 (requireAuth greift bereits vor Router-Existenz, #207).
	describe('AK7: ohne Session → 401', () => {
		beforeEach(async () => {
			if (!server) server = await startTestServer(withClient({}));
		});

		it('POST /billing/subscriptions ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: 'plus', period: 'monthly' }),
			});
			assert.equal(res.status, 401);
		});

		it('POST /billing/subscriptions/cancel ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions/cancel`, { method: 'POST' });
			assert.equal(res.status, 401);
		});

		it('POST /billing/subscriptions/change ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/subscriptions/change`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ plan: 'pro', period: 'monthly' }),
			});
			assert.equal(res.status, 401);
		});

		it('GET /billing/invoices ohne Session → 401', async () => {
			const res = await fetch(`${server.baseUrl}/billing/invoices`);
			assert.equal(res.status, 401);
		});
	});
});

describe('Rechnungs-PDF-Download (#1955 AK4)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const login = (email: string) => server.login(email);
	const get = (path: string, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });

	/** Legt Nutzer + PayPal-Abo an und erzeugt über den Rechnungslauf eine Rechnung samt PDF-Bytes. */
	const issueFor = async (email: string) => {
		const cookie = await login(email);
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: `I-${email}`,
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		const invoice = await issueInvoiceForPeriod(sub, new Date('2026-11-01T10:00:00Z'), async () => {});
		return { cookie, invoice };
	};

	it('AK4: GET /billing/invoices/{id}/pdf liefert dem Eigentümer Header und byte-identische Bytes', async () => {
		server = await startTestServer(withClient({}));
		const { cookie, invoice } = await issueFor('pdf-owner@example.com');
		const number = invoice.get('number') as string;

		const res = await get(`/billing/invoices/${invoice.get('id')}/pdf`, cookie);

		assert.equal(res.status, 200);
		assert.ok(
			(res.headers.get('content-type') ?? '').includes('application/pdf'),
			'Content-Type muss application/pdf sein',
		);
		assert.ok(
			(res.headers.get('content-disposition') ?? '').includes(number),
			'Content-Disposition muss den Dateinamen aus der Rechnungsnummer tragen',
		);
		await invoice.reload();
		const stored = (invoice.get({ plain: true }) as { pdfBytes?: Uint8Array }).pdfBytes;
		assert.ok(stored, 'Die Rechnung muss gespeicherte PDF-Bytes haben');
		const body = Buffer.from(await res.arrayBuffer());
		assert.ok(body.equals(Buffer.from(stored)), 'Der Download muss byte-identisch zu den gespeicherten Bytes sein');
	});

	it('AK4: GET /billing/invoices/{id}/pdf einer fremden Rechnung antwortet 404', async () => {
		server = await startTestServer(withClient({}));
		const { invoice } = await issueFor('pdf-b@example.com');
		const cookieA = await login('pdf-a@example.com');

		const res = await get(`/billing/invoices/${invoice.get('id')}/pdf`, cookieA);

		assert.equal(res.status, 404, 'Fremde PDFs dürfen weder inhaltlich noch über den Status verraten werden');
	});

	// #2049 (Spec docs/spec/issue-2049.md): ein gekündigtes Abo mit Restlaufzeit
	// (`status:'cancelled'`, `currentPeriodEnd > now`) gilt als laufendes Abo — Upgrade wie bei
	// aktiv, Weiterführen/Downgrade als neues Abo mit start_time = Periodenende. Rot: change/preview
	// liefern heute 404 und die Anlage würde sofort abbuchen.
	describe('#2049: gekündigtes Abo mit Restlaufzeit', () => {
		const DAY_MS = 24 * 60 * 60 * 1000;
		const PREVIEW = '/billing/subscriptions/change/preview';

		const seedCancelled = async (email: string, plan: 'plus' | 'pro', remainingDays = 15) => {
			const cookie = await login(email);
			const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
			const periodEnd = new Date(Date.now() + remainingDays * DAY_MS);
			await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: `I-${email}`,
				plan,
				period: 'monthly',
				status: 'cancelled',
				currentPeriodEnd: periodEnd,
			});
			return { cookie, userId: me.id, periodEnd };
		};

		const captureCreate = () => {
			const calls: { planId?: string; firstCycleCents?: number; startTime?: Date }[] = [];
			const client = withClient({
				createSubscription: (async (planId: string, override?: { firstCycleCents?: number; startTime?: Date }) => {
					calls.push({ planId, firstCycleCents: override?.firstCycleCents, startTime: override?.startTime });
					return { approvalUrl: 'https://paypal.example/approve', externalSubscriptionId: 'I-NEW' };
				}) as FakePaypalClient['createSubscription'],
			});
			return { client, calls };
		};

		it('TF1/AK1: change und preview finden ein gekündigtes Abo mit Restlaufzeit (200 statt 404)', async () => {
			server = await startTestServer(withClient({}));
			const { cookie } = await seedCancelled('tf1-2049@example.com', 'plus');

			assert.equal(
				(await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' })).status,
				200,
				'change muss das gekündigte Abo mit Restlaufzeit als aktuell behandeln',
			);
			assert.equal(
				(await post(PREVIEW, cookie, { plan: 'pro', period: 'monthly' })).status,
				200,
				'preview muss das gekündigte Abo mit Restlaufzeit als aktuell behandeln',
			);
		});

		it('TF2/AK2: Upgrade bei gekündigtem Abo liefert approvalUrl und reduziert den ersten Zyklus um das Restguthaben', async () => {
			const { client, calls } = captureCreate();
			server = await startTestServer(client);
			const { cookie, periodEnd } = await seedCancelled('tf2-2049@example.com', 'plus');

			const res = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });

			assert.equal(res.status, 200);
			const body = (await res.json()) as { approvalUrl?: string };
			assert.ok(body.approvalUrl, 'Antwort muss eine Zustimmungs-URL enthalten');
			const { prices } = getPlansCatalog();
			const periodStart = new Date(periodEnd);
			periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
			const { firstCycleCents } = prorateUpgrade({
				oldPriceCents: prices.plus.monthly,
				newPriceCents: prices.pro.monthly,
				periodStart,
				periodEnd,
				now: new Date(),
			});
			assert.ok(calls[0], 'PayPal-Anlage muss ausgelöst worden sein');
			assert.equal(
				calls[0]?.firstCycleCents,
				firstCycleCents,
				'erster Zyklus = neuer Preis minus Restguthaben (gleiche Rechnung wie beim aktiven Abo)',
			);
		});

		it('TF3/AK3: Weiterführen legt ein neues Abo mit start_time = Periodenende an, ohne sofortige Abbuchung', async () => {
			const { client, calls } = captureCreate();
			server = await startTestServer(client);
			const { cookie, periodEnd } = await seedCancelled('tf3-2049@example.com', 'plus');

			const res = await post('/billing/subscriptions', cookie, { plan: 'plus', period: 'monthly' });

			assert.equal(res.status, 201);
			assert.ok(calls[0]?.startTime, 'Anlage muss mit Startzeitpunkt-Override laufen');
			assert.equal(
				(calls[0]?.startTime as Date).toISOString(),
				periodEnd.toISOString(),
				'erste Abbuchung startet erst zum Periodenende des gekündigten Abos',
			);
			assert.equal(calls[0]?.firstCycleCents, undefined, 'Weiterführen bucht nicht sofort ab');
		});

		it('TF4/AK4: Downgrade bei gekündigtem Abo legt ein neues Abo mit Start am Periodenende an', async () => {
			let reviseCalls = 0;
			const { calls } = captureCreate();
			const revised = withClient({
				revise: async () => {
					reviseCalls += 1;
					return {};
				},
				createSubscription: (async (_planId: string, override?: { firstCycleCents?: number; startTime?: Date }) => {
					calls.push({ firstCycleCents: override?.firstCycleCents, startTime: override?.startTime });
					return { approvalUrl: 'https://paypal.example/approve', externalSubscriptionId: 'I-NEW' };
				}) as FakePaypalClient['createSubscription'],
			});
			server = await startTestServer(revised);
			const { cookie, periodEnd } = await seedCancelled('tf4-2049@example.com', 'pro');

			const res = await post('/billing/subscriptions/change', cookie, { plan: 'plus', period: 'monthly' });

			assert.equal(res.status, 200);
			assert.equal(reviseCalls, 0, 'Downgrade darf nicht über revise auf der gekündigten Zeile laufen');
			assert.ok(calls[0]?.startTime, 'Downgrade muss ein neues Abo mit Startzeitpunkt anlegen');
			assert.equal(
				(calls[0]?.startTime as Date).toISOString(),
				periodEnd.toISOString(),
				'Downgrade startet erst am Periodenende des gekündigten Abos',
			);
			assert.equal(calls[0]?.firstCycleCents, undefined, 'Downgrade bucht nicht sofort ab');
		});

		it('TF5/AK5: Nachfolge-Aktivierung leert pendingPlan der gekündigten Vorgänger-Zeile', async () => {
			server = await startTestServer(withClient({}));
			const cookie = await login('tf5-2049@example.com');
			const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
			const periodEnd = new Date(Date.now() + 10 * DAY_MS);
			await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: 'I-OLD-2049',
				plan: 'plus',
				period: 'monthly',
				status: 'cancelled',
				currentPeriodEnd: periodEnd,
				pendingPlan: 'free',
				pendingPlanEffectiveAt: periodEnd,
			});
			const successor = await Subscription.create({
				userId: me.id,
				provider: 'paypal',
				externalSubscriptionId: 'I-NEW-ACTIVATED',
				plan: 'pro',
				period: 'monthly',
				status: 'active',
				currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
			});

			await replacePredecessors(successor, { cancel: async () => {} });

			const old = await Subscription.findOne({ where: { externalSubscriptionId: 'I-OLD-2049' } });
			assert.equal(old?.get('pendingPlan') ?? null, null, 'geplanter Free-Fall des alten Abos entfällt');
			assert.equal(old?.get('pendingPlanEffectiveAt') ?? null, null);
		});

		it('TF6/AK6: preview nennt in allen drei Fällen Betrag und Startzeitpunkt', async () => {
			server = await startTestServer(withClient({}));
			const up = await seedCancelled('tf6-up-2049@example.com', 'plus');
			const resume = await seedCancelled('tf6-resume-2049@example.com', 'plus');
			const down = await seedCancelled('tf6-down-2049@example.com', 'pro');

			const asPreview = async (cookie: string, plan: string) =>
				(await (await post(PREVIEW, cookie, { plan, period: 'monthly' })).json()) as {
					dueCents?: number;
					startsAt?: string;
				};
			const upBody = await asPreview(up.cookie, 'pro');
			const resumeBody = await asPreview(resume.cookie, 'plus');
			const downBody = await asPreview(down.cookie, 'plus');

			assert.ok(typeof upBody.dueCents === 'number', 'Upgrade-Vorschau nennt den Betrag');
			assert.ok(typeof upBody.startsAt === 'string', 'Upgrade-Vorschau nennt den Startzeitpunkt');
			assert.ok(
				Math.abs(new Date(upBody.startsAt as string).getTime() - Date.now()) < 5 * 60 * 1000,
				'Upgrade wirkt sofort',
			);
			assert.ok(typeof resumeBody.startsAt === 'string', 'Weiterführen-Vorschau nennt den Startzeitpunkt');
			assert.equal(new Date(resumeBody.startsAt as string).toISOString(), resume.periodEnd.toISOString());
			assert.ok(typeof downBody.startsAt === 'string', 'Downgrade-Vorschau nennt den Startzeitpunkt');
			assert.equal(new Date(downBody.startsAt as string).toISOString(), down.periodEnd.toISOString());
		});
	});
});

describe('Zeitraumwechsel sofort + Wechsel-Lücke (#2142, Spec docs/spec/issue-2142.md)', () => {
	const DAY_MS = 24 * 60 * 60 * 1000;
	const PREVIEW = '/billing/subscriptions/change/preview';

	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server?.close();
		await closeDb();
	});

	const seed = async (
		email: string,
		attrs: { plan: 'plus' | 'pro'; period: 'monthly' | 'yearly'; currentPeriodEnd: Date; creditCents?: number },
	) => {
		const cookie = await login(email);
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: `I-${email}`,
			status: 'active',
			...attrs,
		});
		return { cookie, userId: me.id };
	};

	it('AK1: Zeitraumwechsel im gleichen Paket wirkt sofort — Vorschau und /change verrechnen wie ein Upgrade (kein revise)', async () => {
		const created: { firstCycleCents?: number }[] = [];
		let revised = false;
		server = await startTestServer(
			withClient({
				createSubscription: (async (_planId: string, override?: { firstCycleCents?: number }) => {
					created.push({ firstCycleCents: override?.firstCycleCents });
					return { approvalUrl: 'https://paypal.example/period', externalSubscriptionId: 'I-NEW' };
				}) as FakePaypalClient['createSubscription'],
				revise: async () => {
					revised = true;
					return {};
				},
			}),
		);
		const { prices } = getPlansCatalog();
		const currentPeriodEnd = new Date(Date.now() + 15 * DAY_MS);
		const { cookie, userId } = await seed('ak1-2142@example.com', { plan: 'pro', period: 'monthly', currentPeriodEnd });

		const res = await post(PREVIEW, cookie, { plan: 'pro', period: 'yearly' });

		assert.equal(res.status, 200);
		const preview = (await res.json()) as { creditCents: number; dueCents: number; immediate: boolean };
		assert.equal(preview.immediate, true, 'Zeitraumwechsel wirkt sofort');
		assert.ok(
			preview.creditCents > 0 && preview.creditCents < prices.pro.monthly,
			`anteiliges Guthaben, war ${preview.creditCents}`,
		);
		assert.equal(preview.dueCents, prices.pro.yearly - preview.creditCents, 'due = Listenpreis neu - Guthaben');

		const change = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'yearly' });
		assert.equal(change.status, 200);
		assert.equal(revised, false, 'kein revise zum Periodenende');
		assert.equal(created.length, 1, 'neues Abo mit reduziertem ersten Zyklus');
		assert.equal(created[0].firstCycleCents, preview.dueCents, 'Vorschau == erster Zyklus');
		const pending = await Subscription.findOne({ where: { userId, status: 'approval_pending' } });
		assert.equal(pending?.get('creditCents'), preview.creditCents);
	});

	it('AK3: Wechsel auf ein Abo, das auf seine erste Abbuchung wartet, wird in Vorschau UND /change mit 409 abgelehnt', async () => {
		let paypalCalls = 0;
		server = await startTestServer(
			withClient({
				createSubscription: (async () => {
					paypalCalls += 1;
					return { approvalUrl: 'x', externalSubscriptionId: 'I-X' };
				}) as FakePaypalClient['createSubscription'],
				revise: async () => {
					paypalCalls += 1;
					return {};
				},
			}),
		);
		// Frisches Upgrade-Abo: ACTIVATED lief, SALE.COMPLETED fehlt — Periode endet noch jetzt (#2230), Guthaben gesetzt.
		const { cookie } = await seed('ak3-2142@example.com', {
			plan: 'pro',
			period: 'monthly',
			currentPeriodEnd: new Date(Date.now() - 1000),
			creditCents: 400,
		});

		const preview = await post(PREVIEW, cookie, { plan: 'pro', period: 'yearly' });
		const change = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'yearly' });

		assert.equal(preview.status, 409, 'Vorschau lehnt ab');
		assert.equal(change.status, 409, '/change lehnt ab');
		assert.equal(paypalCalls, 0, 'kein PayPal-Aufruf');
	});
});

/**
 * #2238 (Spec docs/spec/issue-2238.md) — AK2/AK4: Die Bestätigung (ACTIVATED) eines Upgrades mit
 * ausstehender Restschuld aktiviert das Abo nicht — es gibt nie zwei aktive Zeilen je Nutzer, und
 * eine Kündigung trifft das laufende Abo, nicht die ausstehende Zeile.
 */
describe('Upgrade-Aktivierung erst mit Zahlungseingang (#2238)', () => {
	const DAY_MS = 24 * 60 * 60 * 1000;

	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server?.close();
		await closeDb();
	});

	const webhook = (type: string) =>
		fetch(`${server.baseUrl}/webhooks/paypal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'paypal-transmission-sig': 'ok' },
			body: JSON.stringify({
				id: `WH-2238-${type}`,
				event_type: type,
				resource: { id: 'I-UPGRADE-2238', billing_agreement_id: 'I-UPGRADE-2238' },
			}),
		});

	/** Laufendes Plus-Abo + Upgrade per /change (Zustand vor der Bestätigung). */
	const seedUpgradeJourney = async (email: string, paypalClient: Partial<FakePaypalClient> = {}) => {
		server = await startTestServer({
			paypalClient: {
				createSubscription: async () => ({
					approvalUrl: 'https://paypal.example/2238',
					externalSubscriptionId: 'I-UPGRADE-2238',
				}),
				cancel: async () => {},
				revise: async () => ({}),
				...paypalClient,
			},
			paypalVerifier: async () => 'verified',
			mailSender: async () => {},
		} as unknown as AppDeps);
		const cookie = await login(email);
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-RUNNING-2238',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(Date.now() + 15 * DAY_MS),
		});
		const change = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'monthly' });
		assert.equal(change.status, 200, 'Setup: Upgrade muss angelegt sein');
		return { cookie, userId: me.id };
	};

	it('AK2: nach ACTIVATED (ohne Zahlungseingang) gibt es je Nutzer höchstens ein aktives Abo', async () => {
		const { userId } = await seedUpgradeJourney('ak2-2238@example.com');

		await webhook('BILLING.SUBSCRIPTION.ACTIVATED');

		const active = await Subscription.findAll({ where: { userId, status: 'active' } });
		assert.equal(active.length, 1, 'das Upgrade-Abo darf vor dem Zahlungseingang nicht aktiv werden');
		const upgrade = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE-2238' } });
		assert.notEqual(upgrade?.get('status'), 'active', 'die Upgrade-Zeile bleibt ausstehend');
	});

	it('AK2: erst SALE.COMPLETED macht das Upgrade aktiv und kündigt den Vorgänger', async () => {
		const { userId } = await seedUpgradeJourney('ak2b-2238@example.com');

		await webhook('PAYMENT.SALE.COMPLETED');

		const active = await Subscription.findAll({ where: { userId, status: 'active' } });
		assert.equal(active.length, 1, 'genau eine aktive Zeile');
		assert.equal(active[0]?.get('externalSubscriptionId'), 'I-UPGRADE-2238');
		const old = await Subscription.findOne({ where: { externalSubscriptionId: 'I-RUNNING-2238' } });
		assert.equal(old?.get('status'), 'cancelled', 'der Vorgänger ist gekündigt');
	});

	it('AK4: cancel mit ausstehendem Upgrade kündigt das laufende Abo, nicht die ausstehende Zeile', async () => {
		let calledWith: string | undefined;
		const { cookie } = await seedUpgradeJourney('ak4-2238@example.com', {
			cancel: async (externalSubscriptionId: string) => {
				calledWith = externalSubscriptionId;
			},
		});
		await webhook('BILLING.SUBSCRIPTION.ACTIVATED');

		// Test-Pflege #2308: die Kündigung eines laufenden Abos verlangt { kind, email }.
		const res = await post('/billing/subscriptions/cancel', cookie, { kind: 'ordinary', email: 'k@example.com' });

		assert.equal(res.status, 200);
		assert.equal(calledWith, 'I-RUNNING-2238', 'PayPal-Kündigung muss das laufende Abo treffen');
		const upgrade = await Subscription.findOne({ where: { externalSubscriptionId: 'I-UPGRADE-2238' } });
		assert.ok(upgrade, 'die ausstehende Upgrade-Zeile bleibt bestehen');
	});

	it('Review #1: zweites /change nach ACTIVATED, vor SALE.COMPLETED → 409, Zeile und PayPal-Abo unangetastet', async () => {
		const paypalCalls: string[] = [];
		const { cookie, userId } = await seedUpgradeJourney('review1-2238@example.com', {
			createSubscription: async () => {
				paypalCalls.push('create');
				return { approvalUrl: 'https://paypal.example/2238', externalSubscriptionId: 'I-UPGRADE-2238' };
			},
			cancel: async () => {
				paypalCalls.push('cancel');
			},
			revise: async () => {
				paypalCalls.push('revise');
				return {};
			},
		});
		await webhook('BILLING.SUBSCRIPTION.ACTIVATED');
		paypalCalls.length = 0;

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'yearly' });

		assert.equal(res.status, 409);
		assert.deepEqual(paypalCalls, [], 'kein PayPal-Aufruf');
		const pending = await Subscription.findAll({ where: { userId, status: 'approval_pending' } });
		assert.equal(pending.length, 1, 'die genehmigte Upgrade-Zeile bleibt bestehen');
		assert.equal(pending[0]?.get('externalSubscriptionId'), 'I-UPGRADE-2238');
	});

	it('Review #1: ein nie bestätigtes Upgrade (kein ACTIVATED) bleibt per /change ersetzbar', async () => {
		const { cookie } = await seedUpgradeJourney('review1b-2238@example.com');

		const res = await post('/billing/subscriptions/change', cookie, { plan: 'pro', period: 'yearly' });

		assert.equal(res.status, 200);
	});
});

describe('Anteilige Verrechnung beim Upgrade (#2143, Spec docs/spec/issue-2143.md)', () => {
	const CHANGE = '/billing/subscriptions/change';
	const PREVIEW = '/billing/subscriptions/change/preview';
	const dayMs = 24 * 60 * 60 * 1000;
	const plus = () => getPlansCatalog().prices.plus.monthly;
	const pro = () => getPlansCatalog().prices.pro.monthly;

	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		await server?.close();
	});

	const seed = async (email: string, currentPeriodEnd: Date, firstCycle: number[]) => {
		await server?.close();
		server = await startTestServer(
			withClient({
				createSubscription: (async (_planId: string, override?: { firstCycleCents?: number }) => {
					firstCycle.push(override?.firstCycleCents as number);
					return { approvalUrl: 'https://paypal.example/upgrade', externalSubscriptionId: 'I-NEW' };
				}) as FakePaypalClient['createSubscription'],
			}),
		);
		const cookie = await login(email);
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-OLD',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd,
		});
		return { cookie, userId: me.id };
	};

	it('AK1/TF1: Upgrade zur Halbzeit rechnet etwa die Hälfte als Guthaben an', async () => {
		const first: number[] = [];
		const { cookie, userId } = await seed('ak1-2143@example.com', new Date(Date.now() + 15 * dayMs), first);

		const res = await post(CHANGE, cookie, { plan: 'pro', period: 'monthly' });

		assert.equal(res.status, 200);
		const pending = await Subscription.findOne({ where: { userId, status: 'approval_pending' } });
		const credit = pending?.get('creditCents') as number;
		assert.ok(
			credit >= Math.floor((plus() * 14) / 31) && credit <= Math.floor((plus() * 16) / 28) && credit < plus(),
			`Guthaben etwa halb, war ${credit}`,
		);
		assert.equal(first[0], pro() - credit, 'firstCycleCents = Preis neu - Guthaben');
	});

	it('AK2/TF2: Vorschau liefert dasselbe creditCents/dueCents wie der Wechsel', async () => {
		const first: number[] = [];
		const { cookie, userId } = await seed('ak2-2143@example.com', new Date(Date.now() + 15 * dayMs), first);

		const preview = (await (await post(PREVIEW, cookie, { plan: 'pro', period: 'monthly' })).json()) as {
			creditCents: number;
			dueCents: number;
		};
		await post(CHANGE, cookie, { plan: 'pro', period: 'monthly' });
		const pending = await Subscription.findOne({ where: { userId, status: 'approval_pending' } });

		assert.ok(preview.creditCents > 0 && preview.creditCents < plus(), `Halbzeit-Guthaben, war ${preview.creditCents}`);
		assert.equal(preview.creditCents, pending?.get('creditCents'));
		assert.equal(preview.dueCents, first[0]);
	});

	for (const day of ['2027-01-31', '2028-02-29', '2026-10-31']) {
		it(`AK3/TF3: Upgrade am Periodenbeginn rechnet das volle Guthaben an (${day})`, async () => {
			mock.timers.enable({ apis: ['Date'], now: new Date(`${day}T12:00:00.000Z`) });
			try {
				const first: number[] = [];
				const end = new Date();
				end.setUTCMonth(end.getUTCMonth() + 1);
				const { cookie, userId } = await seed('ak3-2143@example.com', end, first);

				const res = await post(CHANGE, cookie, { plan: 'pro', period: 'monthly' });

				assert.equal(res.status, 200);
				const pending = await Subscription.findOne({ where: { userId, status: 'approval_pending' } });
				assert.equal(pending?.get('creditCents'), plus());
				assert.equal(first[0], pro() - plus());
			} finally {
				mock.timers.reset();
			}
		});
	}
});
