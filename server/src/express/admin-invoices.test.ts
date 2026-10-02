import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { Subscription } from '../models/index.js';
// Invoice ist noch nicht aus models/index.ts re-exportiert — direkter Modul-Import
// (Muster `billing-subscriptions.test.ts`).
import Invoice from '../models/invoice.js';
import { issueInvoiceForPeriod } from '../logics/invoices.js';

/**
 * Rote Spec-Tests für #1958 (Spec docs/spec/issue-1958.md) — Admin-Rechnungs-Zugriff in der
 * Nutzerverwaltung. Die Routen `GET /admin/users/{id}/invoices` und
 * `GET /admin/users/{id}/invoices/{invoiceId}/pdf` existieren noch nicht: Express antwortet
 * darauf mit 404 (auch mit Session) statt der erwarteten Statuscodes — legitimer Erstzustand
 * für neue Routen (die Bestands-Routen `GET /billing/invoices*` dienen als Spiegel/Muster und
 * bleiben unverändert). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1958');

let server: TestServer;

const login = (email: string, options?: Parameters<TestServer['login']>[1]) => server.login(email, options);
const get = (path: string, cookie: string) => fetch(`${server.baseUrl}${path}`, { headers: { Cookie: cookie } });

/** Legt Nutzer + PayPal-Abo an und erzeugt über den Rechnungslauf eine Rechnung samt PDF-Bytes (Muster `billing-subscriptions.test.ts`). */
const issueFor = async (email: string): Promise<{ userId: number; invoice: Invoice }> => {
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
	return { userId: me.id, invoice };
};

describe('Admin-Rechnungs-API (#1958)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: GET /admin/users/{id}/invoices liefert dem Admin die Rechnungen des Nutzers mit denselben Feldern wie die Eigentümer-Route, neueste zuerst', async () => {
		server = await startTestServer({});
		const cookie = await login('nutzer-1958@example.com');
		const me = (await (await get('/auth/me', cookie)).json()) as { id: number };
		const sub = await Subscription.create({
			userId: me.id,
			provider: 'paypal',
			externalSubscriptionId: 'I-1958',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-12-01'),
		});
		await issueInvoiceForPeriod(sub, new Date('2026-11-01T10:00:00Z'), async () => {});
		// Zweite Periode: Periodenende weiterschieben, erneut ausstellen (der Idempotenz-Guard
		// des Rechnungslaufs keyed auf periodEnd — so entstehen zwei echte Rechnungen).
		await sub.update({ currentPeriodEnd: new Date('2027-01-01') });
		await issueInvoiceForPeriod(sub, new Date('2026-12-01T10:00:00Z'), async () => {});

		const admin = await login('admin-1958@example.com', { role: 'admin' });
		const res = await get(`/admin/users/${me.id}/invoices`, admin);

		assert.equal(res.status, 200);
		const adminList = (await res.json()) as Array<Record<string, unknown>>;
		const ownerList = (await (await get('/billing/invoices', cookie)).json()) as Array<Record<string, unknown>>;
		assert.deepEqual(
			adminList,
			ownerList,
			'Admin-Liste muss exakt der Eigentümer-Liste entsprechen (gleiche Felder, gleiche Ordnung)',
		);
		assert.equal(adminList.length, 2);
		assert.deepEqual(
			Object.keys(adminList[0]).sort(),
			['amountCents', 'id', 'number', 'periodEnd', 'periodStart', 'taxNote'],
			'DTO muss die Felder der Eigentümer-Route tragen',
		);
		// Neueste zuerst: zweite Periode (periodStart 2026-12-01) vor der ersten (2026-11-01).
		assert.equal(adminList[0].periodStart, '2026-12-01T00:00:00.000Z');
		assert.equal(adminList[1].periodStart, '2026-11-01T00:00:00.000Z');
	});

	it('AK2: GET /admin/users/{id}/invoices/{invoiceId}/pdf liefert dem Admin denselben Download wie dem Eigentümer (Header, byte-identisch)', async () => {
		server = await startTestServer({});
		const { userId, invoice } = await issueFor('pdf-nutzer-1958@example.com');
		const admin = await login('admin-1958@example.com', { role: 'admin' });

		const adminRes = await get(`/admin/users/${userId}/invoices/${invoice.get('id')}/pdf`, admin);
		const ownerRes = await get(
			`/billing/invoices/${invoice.get('id')}/pdf`,
			await login('pdf-nutzer-1958@example.com'),
		);

		assert.equal(adminRes.status, 200);
		assert.ok(
			(adminRes.headers.get('content-type') ?? '').includes('application/pdf'),
			'Content-Type muss application/pdf sein',
		);
		assert.ok(
			(adminRes.headers.get('content-disposition') ?? '').includes(invoice.get('number') as string),
			'Content-Disposition muss die Rechnungsnummer tragen',
		);
		const adminBytes = Buffer.from(await adminRes.arrayBuffer());
		const ownerBytes = Buffer.from(await ownerRes.arrayBuffer());
		assert.ok(ownerBytes.length > 0, 'Vorbedingung: Eigentümer-Download muss Bytes liefern');
		assert.ok(adminBytes.equals(ownerBytes), 'Admin-Download muss byte-identisch zum Eigentümer-Download sein');
	});

	it('AK2: GET .../pdf einer Altrechnung ohne gespeicherte PDF-Bytes antwortet 404', async () => {
		server = await startTestServer({});
		const { userId, invoice } = await issueFor('alt-1958@example.com');
		await invoice.update({ pdfBytes: null });
		const admin = await login('admin-1958@example.com', { role: 'admin' });

		// Vorbedingung (Roter Lauf: die Route existiert noch nicht — Express-Default-404 wäre sonst
		// ein zahnloses Grün): die Listen-Route muss existieren und die Rechnung listen.
		const list = await get(`/admin/users/${userId}/invoices`, admin);
		assert.equal(list.status, 200, 'Vorbedingung: die Listen-Route muss existieren');
		const listed = (await list.json()) as Array<{ id: number }>;
		assert.ok(
			listed.some((entry) => entry.id === invoice.get('id')),
			'Vorbedingung: die Rechnung muss gelistet sein',
		);

		const res = await get(`/admin/users/${userId}/invoices/${invoice.get('id')}/pdf`, admin);

		assert.equal(res.status, 404, 'Ohne gespeicherte PDF-Bytes darf es keinen Download geben');
	});

	it('AK2: GET .../pdf mit einer Rechnungs-Id, die nicht zum Nutzer auf der Route gehört, antwortet 404', async () => {
		server = await startTestServer({});
		const aCookie = await login('a-1958@example.com');
		const a = (await (await get('/auth/me', aCookie)).json()) as { id: number };
		const b = await issueFor('b-1958@example.com');
		const admin = await login('admin-1958@example.com', { role: 'admin' });

		// Vorbedingung (wie oben): die Listen-Route von Nutzer A muss existieren — und die fremde
		// Rechnung von B darf dort natürlich nicht auftauchen.
		const list = await get(`/admin/users/${a.id}/invoices`, admin);
		assert.equal(list.status, 200, 'Vorbedingung: die Listen-Route muss existieren');
		const listed = (await list.json()) as Array<{ id: number }>;
		assert.ok(
			!listed.some((entry) => entry.id === b.invoice.get('id')),
			'Die Liste von A darf die fremde Rechnung nicht enthalten',
		);

		const res = await get(`/admin/users/${a.id}/invoices/${b.invoice.get('id')}/pdf`, admin);

		assert.equal(res.status, 404, 'Die falsche Nutzer-Id auf der Route darf die fremde Rechnung nicht verraten');
	});

	it('AK1/AK4: ohne Admin-Rolle antworten beide Admin-Rechnungs-Routen mit 403', async () => {
		server = await startTestServer({});
		const { userId, invoice } = await issueFor('nutzer-1958@example.com');
		const member = await login('member-1958@example.com', { role: 'member' });

		const list = await get(`/admin/users/${userId}/invoices`, member);
		const pdf = await get(`/admin/users/${userId}/invoices/${invoice.get('id')}/pdf`, member);

		assert.equal(list.status, 403, 'Die Rechnungsliste muss ohne Admin-Rolle 403 liefern');
		assert.equal(pdf.status, 403, 'Der PDF-Download muss ohne Admin-Rolle 403 liefern');
	});
});
