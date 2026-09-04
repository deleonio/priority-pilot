import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1213 (AK8, docs/spec/issue-1213.md) — Aufgabe für ein anderes
 * Gruppenmitglied über die UI anlegen; Hinweise „Für: …" (Ersteller-Sicht) und
 * „Erstellt von: …" (Empfänger-Sicht); bei 375 px kein horizontaler Überlauf.
 *
 * Gegen das echte Backend (Muster groups.spec.ts / crud.spec.ts). Das Empfänger-Konto wird
 * per `POST /auth/test-login` angelegt und in einem eigenen Browser-Context mit übernommenem
 * Session-Cookie bedient (Muster groups-invitations.spec.ts); die Gruppe selbst entsteht über
 * die Settings-UI, die Einladung über die Nutzersuche, das Annehmen über die Empfänger-API.
 *
 * AK8 wird per Bounding-Box geprüft — NICHT per scrollWidth: die App-Shell clippt
 * overflow-x:hidden, scrollWidth bleibt strukturell ≤ Viewport (Erfahrung 2026-08-24).
 */

const INVITEE_EMAIL = 'foreign-task@example.com';
const INVITEE_NAME = 'Ines Empfängerin';

/** Öffnet die Einstellungen direkt auf dem Gruppen-Tab (Muster groups.spec.ts). */
const openGroupsTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await expect(page.getByRole('tab', { name: 'Gruppen', exact: true })).toBeVisible();
};

/** Legt über die UI eine Gruppe an und lädt das Empfänger-Konto per Nutzersuche ein. */
const createGroupAndInvite = async (page: Page, groupName: string): Promise<void> => {
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeVisible();
	await page.getByRole('textbox', { name: 'Name' }).fill(groupName);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	await waitForStableView(page, 'Gruppen');

	await page.getByRole('listitem').filter({ hasText: groupName }).click();
	await page.getByRole('searchbox').fill('Empfängerin');
	await expect(page.getByText(INVITEE_NAME)).toBeVisible();
	await page.getByRole('button', { name: 'Einladen' }).click();
	await expect(page.getByText('Ausstehend')).toBeVisible();
};

/** Legt über die UI eine Aufgabe für das Empfänger-Konto an (Empfänger-Auswahl im Formular). */
const createForeignTaskViaUi = async (page: Page, title: string): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);

	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	// Empfänger-Auswahl (KolSingleSelect → Combobox mit role="option", Muster series-rhythm.spec.ts).
	await page.getByLabel('Empfänger').click();
	await page.getByRole('option', { name: INVITEE_NAME }).click();
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
};

/** Prüft, dass ein Element vollständig im Viewport liegt (AK8, Bounding-Box statt scrollWidth). */
const expectWithinViewport = async (page: Page, name: string, locator: ReturnType<Page['locator']>): Promise<void> => {
	await expect(locator.first()).toBeVisible();
	const box = await locator.first().boundingBox();
	expect(box, `${name} muss eine Bounding-Box haben`).not.toBeNull();
	const viewport = page.viewportSize();
	expect(viewport).not.toBeNull();
	expect(box!.x + box!.width, `${name} darf bei 375 px nicht horizontal aus dem Viewport ragen`).toBeLessThanOrEqual(
		viewport!.width,
	);
};

test.describe('Aufgabe für ein Gruppenmitglied (#1213)', () => {
	test.afterEach(async ({ page }) => {
		// Aufräumen über die echte API, damit nachfolgende Tests leer starten (crud.spec.ts-Muster).
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	test('Aufgabe für anderes Mitglied: Ersteller sieht „Für: …", Empfänger „Erstellt von: …" (AK8)', async ({
		page,
		request,
		baseURL,
	}) => {
		// Empfänger-Konto anlegen und in eigenem Context anmelden (Muster groups-invitations.spec.ts).
		const login = await request.post('/auth/test-login', {
			data: { email: INVITEE_EMAIL, displayName: INVITEE_NAME },
		});
		expect(login.status()).toBe(200);
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		expect(setCookie, 'test-login muss einen Session-Cookie setzen').toBeTruthy();
		const [cookieName, cookieValue] = setCookie.split(';')[0].split('=');
		const inviteeContext = await page.context().browser()!.newContext();
		await inviteeContext.addCookies([{ name: cookieName.trim(), value: cookieValue.trim(), url: baseURL! }]);
		const inviteePage = await inviteeContext.newPage();

		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Übergabe');

			// Empfänger nimmt über die API an (Annahme-UI ist #1212-Thema, hier nur Setup).
			const invitations = (await (await inviteePage.request.get('/api/v1/invitations')).json()) as {
				id: number;
				groupName: string;
			}[];
			const invitation = invitations.find((candidate) => candidate.groupName === 'E2E Übergabe');
			expect(invitation, 'Einladung muss beim Empfänger anliegen').toBeTruthy();
			const accept = await inviteePage.request.post(`/api/v1/invitations/${invitation!.id}/accept`);
			expect(accept.status()).toBe(200);

			// Ersteller legt die Aufgabe über die UI für das Empfänger-Konto an.
			await page.goto('/');
			await waitForStableView(page);
			await createForeignTaskViaUi(page, 'E2E Übergabe-Aufgabe #1');

			// Ersteller-Sicht: Aufgabe lesbar, gekennzeichnet mit „Für: <Empfänger>".
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			const creatorRow = page.getByText('E2E Übergabe-Aufgabe #1', { exact: true });
			await expect(creatorRow).toBeVisible();
			await expect(page.getByText(`Für: ${INVITEE_NAME}`)).toBeVisible();

			// Empfänger-Sicht: Aufgabe in eigener Liste, gekennzeichnet mit „Erstellt von: <Ersteller>".
			await inviteePage.goto('/');
			await waitForStableView(inviteePage);
			await inviteePage.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await expect(inviteePage.getByText('E2E Übergabe-Aufgabe #1', { exact: true })).toBeVisible();
			await expect(inviteePage.getByText(/Erstellt von: /)).toBeVisible();
		} finally {
			await inviteeContext.close();
		}
	});

	test('375 px: Empfängerauswahl und Listen-Hinweise ohne horizontalen Überlauf (AK8)', async ({
		page,
		request,
		baseURL,
	}) => {
		const login = await request.post('/auth/test-login', {
			data: { email: INVITEE_EMAIL, displayName: INVITEE_NAME },
		});
		expect(login.status()).toBe(200);
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		const [cookieName, cookieValue] = setCookie.split(';')[0].split('=');
		const inviteeContext = await page.context().browser()!.newContext();
		await inviteeContext.addCookies([{ name: cookieName.trim(), value: cookieValue.trim(), url: baseURL! }]);
		const inviteePage = await inviteeContext.newPage();

		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Schmal Übergabe');
			const invitations = (await (await inviteePage.request.get('/api/v1/invitations')).json()) as {
				id: number;
				groupName: string;
			}[];
			const invitation = invitations.find((candidate) => candidate.groupName === 'E2E Schmal Übergabe');
			expect(invitation).toBeTruthy();
			expect((await inviteePage.request.post(`/api/v1/invitations/${invitation!.id}/accept`)).status()).toBe(200);

			await page.setViewportSize({ width: 375, height: 812 });
			await page.goto('/');
			await waitForStableView(page);

			// Empfängerauswahl im Formular bleibt im Viewport.
			await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await page.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(page);
			await expectWithinViewport(page, 'Empfänger-Auswahl', page.getByLabel('Empfänger'));

			await page.getByRole('textbox', { name: 'Titel' }).fill('E2E Übergabe-Aufgabe #2');
			await page.getByLabel('Empfänger').click();
			await page.getByRole('option', { name: INVITEE_NAME }).click();
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

			// Hinweis „Für: …" in der Liste bleibt im Viewport.
			await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await expectWithinViewport(page, 'Für-Hinweis', page.getByText(/Für: /));

			// Empfänger-Seite: „Erstellt von: …" ebenfalls ohne Überlauf.
			await inviteePage.setViewportSize({ width: 375, height: 812 });
			await inviteePage.goto('/');
			await waitForStableView(inviteePage);
			await inviteePage.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
			await expectWithinViewport(inviteePage, 'Erstellt-von-Hinweis', inviteePage.getByText(/Erstellt von: /));
		} finally {
			await inviteeContext.close();
		}
	});
});
