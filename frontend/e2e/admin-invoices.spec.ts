import { expect, test, type Page } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-E2E für #1958 (Spec `docs/spec/issue-1958.md`, AK3/AK5): Die Nutzerverwaltung zeigt
 * je Nutzer die aufklappbare Rechnungsansicht (Nummer, Zeitraum, Betrag, Status, Download-Anker)
 * und bleibt bei 375px ohne horizontalen Overflow. #2086 (Test-Pflege, Spec
 * `docs/spec/issue-2086.md` AK6/AK7): der Status ist der echte Zahlungsstatus
 * („Bezahlt“/„Erstattet“) statt des festen „Ausgestellt“.
 *
 * Admin-Session über `POST /auth/test-login` mit `role: 'admin'` (nur NODE_ENV=test); die
 * Rechnungsdaten sind gegroutet (das Invoices-Glob der Admin-Routen): echte Rechnungen entstehen
 * erst über Webhook/Rechnungslauf und sind in E2E nicht herstellbar (Testkonzept: `page.route`
 * nur für nicht echt lauffähige Aufrufe). Die Backend-Grenzen (403/404, byte-identisches PDF)
 * deckt `server/src/express/admin-invoices.test.ts` ab.
 *
 * Test-Pflege #1958 (Impl): Bewusst NICHT die `./fixtures`-Basis (`test` aus `@playwright/test`)
 * — deren `/auth/me`-Mock liefert den generischen „Test User“ OHNE Rolle; die App blendet den
 * Tab „Nutzerverwaltung“ dann als Member aus, obwohl die echte Admin-Session im Cookie-Kontext
 * liegt (erste rote Ausführung: Timeout beim Klick auf „Rechnungen von …“, Snapshot zeigte
 * „Säulen“-Fallback). Ohne Fixture kommt `/auth/me` echt aus der test-login-Session (inkl.
 * `role: 'admin'`) — Muster `login.spec.ts` (ebenso ohne Fixture, wenn `/auth/me` echt sein soll).
 * Zweite Pflege: KoliBris `KolDetails` trägt weder `button` noch eine benannte `group`-Rolle
 * (A11y-Snapshot des ersten Laufs: der zugängliche Name liegt am inneren `generic`) — der
 * Aufklapp-Klick zielt auf den Label-Text (`getByText`, pierct den offenen Shadow-DOM).
 */

const MOBILE = { width: 375, height: 812 } as const;
const ADMIN = { email: 'admin-1958@example.com', displayName: 'Anna Admin' };

const INVOICES = [
	{
		id: 11,
		number: 'INV-2026-000001',
		periodStart: '2026-10-01T00:00:00.000Z',
		periodEnd: '2026-11-01T00:00:00.000Z',
		amountCents: 799,
		taxNote: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
		paymentStatus: 'paid',
	},
	{
		id: 12,
		number: 'INV-2026-000002',
		periodStart: '2026-11-01T00:00:00.000Z',
		periodEnd: '2026-12-01T00:00:00.000Z',
		amountCents: 1499,
		taxNote: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
		paymentStatus: 'refunded',
	},
];

const adminSession = async (page: Page): Promise<void> => {
	const login = await page.request.post('/auth/test-login', {
		data: { email: ADMIN.email, displayName: ADMIN.displayName, role: 'admin' },
	});
	expect(login.status(), 'test-login muss eine Admin-Session liefern').toBe(200);
};

const mockAdminInvoices = async (page: Page): Promise<void> => {
	await page.route('**/api/v1/admin/users/*/invoices', (route) => {
		if (route.request().method() !== 'GET') {
			return route.fallback();
		}
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INVOICES) });
	});
};

test.describe('#1958 Nutzerverwaltung — Rechnungsansicht je Nutzer', () => {
	test('AK3/AK5: Rechnungsansicht klappt auf, zeigt Einträge samt Download und bleibt bei 375px im Viewport', async ({
		page,
	}) => {
		await adminSession(page);
		await mockAdminInvoices(page);
		await page.setViewportSize(MOBILE);
		await page.goto('/app/settings/nutzer');
		await waitForStableView(page, 'Balamentum');

		// AK3: Ansicht je Nutzer, eindeutiges Label, Aufklappen lädt die Rechnungen nach.
		await page.getByText('Rechnungen von Anna Admin').click();

		const entry = page.locator('.admin-user', { hasText: 'Anna Admin' }).locator('li', { hasText: 'INV-2026-000002' });
		await expect(entry).toBeVisible();
		// #2086 AK6 (Test-Pflege): dynamischer Zahlungsstatus statt des festen „Ausgestellt“.
		await expect(entry.getByText('Erstattet')).toBeVisible();
		const paidEntry = page
			.locator('.admin-user', { hasText: 'Anna Admin' })
			.locator('li', { hasText: 'INV-2026-000001' });
		await expect(paidEntry.getByText('Bezahlt')).toBeVisible();
		await expect(page.getByText('Ausgestellt')).toHaveCount(0);
		// AK3: Download-Zugriff je Rechnung — der zugängliche Name nennt die Rechnungsnummer.
		await expect(page.getByRole('button', { name: 'PDF INV-2026-000002 herunterladen' })).toBeVisible();

		// AK5: Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x: hidden.
		const rows = page.locator('.settings-admin-users .admin-user');
		const count = await rows.count();
		expect(count, 'Nutzerverwaltung muss den Admin als Zeile zeigen').toBeGreaterThanOrEqual(1);
		for (let index = 0; index < count; index += 1) {
			const box = await rows.nth(index).boundingBox();
			expect(box, `Zeile ${index} muss vermessen sein`).not.toBeNull();
			expect(box!.x + box!.width, `Zeile ${index} ragt bei 375px aus dem Viewport`).toBeLessThanOrEqual(375 + 0.5);
		}
	});
});
