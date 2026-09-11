import { expect, test } from '@playwright/test';

/**
 * Spec-Test (#1136, docs/spec/issue-1136.md, AK4): Der Neu-Nutzer-Sign-up-Pfad über Google
 * endet im Dashboard — nicht im Dauerspinner. Ein echter Google-OAuth-Zyklus ist in der E2E-
 * Umgebung nicht durchlaufbar; die Session wird daher über `POST /auth/test-login` erzeugt
 * (nur bei NODE_ENV=test registriert, siehe server/src/express/routes/auth.ts). Damit spricht
 * der Test — anders als `login.spec.ts`, das `/auth/me` im Browser mockt — die echte
 * Session-/`/auth/me`-Kette an.
 *
 * Die App wird auf mobilem Viewport (375 px) geprüft (Mobile-First).
 */
test.describe('#1136 — Neu-Nutzer-Sign-up-Pfad (echte Session)', () => {
	test('AK4: erster Login führt ins Dashboard — kein Dauerspinner (Mobile 375px)', async ({
		page,
		request,
		baseURL,
	}) => {
		// Session erzeugen (Find-or-create analog zum OAuth-Pfad).
		const login = await request.post('/auth/test-login', {
			data: { email: 'google-signup-e2e@example.com', displayName: 'Neuer Google Nutzer' },
		});
		expect(login.status()).toBe(200);

		// Session-Cookie aus dem Set-Cookie-Header des Backends in den Browser-Kontext übernehmen.
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		expect(setCookie, 'Test-Login muss einen Session-Cookie setzen').toBeTruthy();
		const [name, value] = setCookie.split(';')[0].split('=');
		await page.context().addCookies([{ name: name.trim(), value: value.trim(), url: baseURL! }]);

		// Der „erste Login" landet direkt in der App.
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		// Kein Dauerspinner: der Auth-Ladehinweis ist weg und der Login-Button nie erschienen.
		await expect(page.getByText('Authentifizierung wird geprüft')).toBeHidden();
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeHidden();
	});
});
