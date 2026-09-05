import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1212 (AK1/AK9–AK12) — Nutzersuche, Einladen, Annehmen/Ablehnen,
 * Mitglied entfernen (Vertrag: docs/spec/issue-1212.md). Gegen das echte Backend, analog
 * `groups.spec.ts` (#1211).
 *
 * Zweiter Nutzer: `POST /auth/test-login` (nur bei NODE_ENV=test registriert, e2e-Backend läuft
 * mit NODE_ENV=test — Muster `google-signup.spec.ts`). Die eingeladene Person agiert in einem
 * eigenen Browser-Context mit übernommenem Session-Cookie, damit beide Seiten der Einladung
 * (einladender Admin, eingeladene Person) in derselben Testlaufzeit real geprüft werden.
 *
 * AK12 (375px ohne horizontales Scrollen) wird per Bounding-Box geprüft — NICHT per
 * scrollWidth (App-Shell clippt overflow-x:hidden, Erfahrung 2026-08-24, s. groups.spec.ts).
 */

const openGroupsTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await expect(page.getByRole('tab', { name: 'Gruppen', exact: true })).toBeVisible();
};

const createGroupViaUi = async (page: Page, name: string): Promise<void> => {
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeVisible();
	await page.getByRole('textbox', { name: 'Name' }).fill(name);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	await waitForStableView(page, 'Gruppen');
};

test.describe('Gruppen-Einladungen (#1212)', () => {
	test.afterEach(async ({ page }) => {
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	// ── AK1: Nutzersuche innerhalb des Gruppendetails ─────────────────────────────────

	test('Nutzersuche findet ein Konto ab 3 Zeichen Namensfragment (AK1)', async ({ page, request }) => {
		await request.post('/auth/test-login', {
			data: { email: 'invite-search@example.com', displayName: 'Sina Suchbar' },
		});

		await openGroupsTab(page);
		await createGroupViaUi(page, 'E2E Einladen');
		await page.getByRole('listitem').filter({ hasText: 'E2E Einladen' }).click();

		await page.getByRole('searchbox').fill('Such');
		await expect(page.getByText('Sina Suchbar')).toBeVisible();
	});

	// ── AK9–AK12: Einladen, Annehmen, Entfernen, 375px ────────────────────────────────

	test('eingeladene Person nimmt an, erscheint als Mitglied, Admin entfernt sie wieder (AK6/AK9)', async ({
		page,
		request,
		baseURL,
	}) => {
		// Zweite Person: eigener Browser-Context mit übernommenem Session-Cookie (Muster google-signup.spec.ts).
		const login = await request.post('/auth/test-login', {
			data: { email: 'invitee@example.com', displayName: 'Ines Eingeladen' },
		});
		expect(login.status()).toBe(200);
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		expect(setCookie, 'test-login muss einen Session-Cookie setzen').toBeTruthy();
		const [name, value] = setCookie.split(';')[0].split('=');
		const inviteeContext = await page.context().browser()!.newContext();
		await inviteeContext.addCookies([{ name: name.trim(), value: value.trim(), url: baseURL! }]);
		const inviteePage = await inviteeContext.newPage();

		try {
			await openGroupsTab(page);
			await createGroupViaUi(page, 'E2E Mitgliedschaft');
			await page.getByRole('listitem').filter({ hasText: 'E2E Mitgliedschaft' }).click();

			await page.getByRole('searchbox').fill('Eingeladen');
			await expect(page.getByText('Ines Eingeladen')).toBeVisible();
			await page.getByRole('button', { name: 'Einladen' }).click();
			await expect(page.getByText('Ausstehend')).toBeVisible();

			// Eingeladene Person nimmt an. Auf den Einladungs-Abschnitt gescoped: nach dem Annehmen
			// steht der Gruppenname weiterhin auf der Seite — dann aber als eigene Gruppe.
			await openGroupsTab(inviteePage);
			const receivedInvitations = inviteePage.locator('.group-received-invitations');
			await expect(receivedInvitations.getByText('E2E Mitgliedschaft')).toBeVisible();
			await inviteePage.getByRole('button', { name: 'Annehmen' }).click();
			await expect(receivedInvitations.getByText('E2E Mitgliedschaft')).toBeHidden();

			// Admin sieht die neue Person jetzt als Mitglied (nicht mehr „Ausstehend").
			// Exact-Match statt reinem Textsuche (#1221): der neue Rollen-Button trägt den Namen
			// ebenfalls in seinem Label ("… zum Administrator machen"), ein loser Treffer wäre doppelt.
			await page.reload();
			await openGroupsTab(page);
			await page.getByRole('listitem').filter({ hasText: 'E2E Mitgliedschaft' }).click();
			await expect(page.getByText('Ines Eingeladen', { exact: true })).toBeVisible();
			await expect(page.getByText('Ausstehend')).toBeHidden();

			// Admin entfernt die Person wieder (AK9). Auf die Mitgliederliste gescoped: die
			// aufgeklappte Gruppenkarte ist selbst ein listitem und enthält den Namen ebenfalls.
			const memberRow = page.locator('.group-members').getByRole('listitem').filter({ hasText: 'Ines Eingeladen' });
			await memberRow.getByRole('button', { name: 'Entfernen' }).click();
			await page.locator('kol-dialog').getByRole('button', { name: 'Entfernen', exact: true }).click();
			// Auf die Mitgliederliste gescoped, Exact-Match (#1221, s. o.): der schließende
			// Bestätigungsdialog trägt den Namen ebenfalls, ein loser Treffer wäre doppelt.
			await expect(page.locator('.group-members').getByText('Ines Eingeladen', { exact: true })).toBeHidden();
		} finally {
			await inviteeContext.close();
		}
	});

	// ── AK12: 375px ohne horizontalen Überlauf (Bounding-Box, nicht scrollWidth) ──────

	test('Gruppendetail mit Suche und Mitgliederliste bleibt bei 375px ohne horizontalen Überlauf (AK12)', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openGroupsTab(page);
		await createGroupViaUi(page, 'E2E Schmal Detail');
		await page.getByRole('listitem').filter({ hasText: 'E2E Schmal Detail' }).click();

		const searchBox = page.getByRole('searchbox');
		await expect(searchBox).toBeVisible();
		const searchBoxBox = await searchBox.boundingBox();
		expect(searchBoxBox).not.toBeNull();
		expect(searchBoxBox!.x + searchBoxBox!.width, 'Suchfeld ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(
			375,
		);

		// Gemessen wird die Mitgliederzeile, nicht die umschließende Gruppenkarte (auch ein listitem).
		const memberRow = page.locator('.group-members').getByRole('listitem').first();
		const memberBox = await memberRow.boundingBox();
		expect(memberBox).not.toBeNull();
		expect(memberBox!.x + memberBox!.width, 'Mitgliederzeile ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(
			375,
		);
	});
});
