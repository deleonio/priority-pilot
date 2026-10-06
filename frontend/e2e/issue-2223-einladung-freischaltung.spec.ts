import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * #2223: E-Mail-Einladung in eine Gruppe bis zur Freischaltung (ADR 0019, #1983) gegen das echte
 * Backend. Die eingeladene Adresse existiert vorher nicht; die Einladung legt Konto und Zulassung
 * (`allowEmail(email, 'einladung')`) an. Der E2E-Server läuft ohne Allowlist (Pass-Through) — jeder
 * Login gelingt —, deshalb prüft erst `GET /admin/allowed-emails`, ob die Freischaltung wirklich
 * passiert ist. "Ohne Einladung kein Zugang" deckt der API-Test `allowance-flows.api.test.ts` ab.
 * Google-OAuth läuft nicht echt; `POST /auth/test-login` ersetzt den Login (nur NODE_ENV=test).
 */
test('E-Mail-Einladung schaltet die Adresse frei, die eingeladene Person landet in der App (#2223)', async ({
	playwright,
	browser,
	baseURL,
}) => {
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const inviteeEmail = `e2e-2223-eingeladen-${suffix}@example.com`;

	const loginContext = async (email: string, role?: 'admin'): Promise<APIRequestContext> => {
		const context = await playwright.request.newContext({ baseURL: baseURL! });
		const login = await context.post('/auth/test-login', { data: { email, displayName: email, role } });
		expect(login.status(), `test-login ${email}`).toBe(200);
		return context;
	};

	const inviter = await loginContext(`e2e-2223-einladend-${suffix}@example.com`);
	const admin = await loginContext(`e2e-2223-admin-${suffix}@example.com`, 'admin');
	const inviteeContext = await browser.newContext({ baseURL: baseURL! });
	let groupId: number | undefined;

	try {
		const before = await admin.get('/api/v1/admin/allowed-emails');
		expect(await before.json()).not.toContainEqual(expect.objectContaining({ email: inviteeEmail }));

		const groupRes = await inviter.post('/api/v1/groups', { data: { name: `E2E Einladung ${suffix}` } });
		expect(groupRes.status()).toBe(201);
		groupId = ((await groupRes.json()) as { id: number }).id;
		const inviteRes = await inviter.post(`/api/v1/groups/${groupId}/invitations`, { data: { email: inviteeEmail } });
		expect(inviteRes.status(), 'Einladung an unbekannte Adresse').toBe(201);

		const allowed = await admin.get('/api/v1/admin/allowed-emails');
		expect(await allowed.json()).toContainEqual(expect.objectContaining({ email: inviteeEmail, origin: 'einladung' }));

		// Erst jetzt anmelden: ein vorhandenes Konto würde die Einladung ohne Freischaltung annehmen.
		const inviteeApi = await loginContext(inviteeEmail);
		await inviteeContext.addCookies((await inviteeApi.storageState()).cookies);
		await inviteeApi.dispose();
		const page = await inviteeContext.newPage();
		await page.goto('/app/');
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	} finally {
		if (groupId !== undefined) {
			await inviter.delete(`/api/v1/groups/${groupId}`);
		}
		await inviteeContext.close();
		await Promise.all([inviter.dispose(), admin.dispose()]);
	}
});
