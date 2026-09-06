import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * Rote Spec-E2E für #1252 (AK9/AK10, docs/spec/issue-1252.md) — Empfängerauswahl im
 * BEARBEITEN-Formular (Übergabe): sichtbar, solange der Nutzer in mindestens einer Gruppe
 * ist, und bei 375 px UND 320 px ohne horizontales Scrollen bedienbar.
 *
 * Gegen das echte Backend (Muster groups-foreign-task.spec.ts #1213). Empfänger-Konto per
 * `POST /auth/test-login`, Gruppe über die Settings-UI, Einladung über die Nutzersuche,
 * Annahme über die Empfänger-API.
 *
 * AK10 wird per Bounding-Box geprüft — NICHT per scrollWidth: die App-Shell clippt
 * overflow-x:hidden, scrollWidth bleibt strukturell ≤ Viewport (Erfahrung 2026-08-24).
 */

const RECIPIENT_EMAIL = 'handover-recipient@example.com';
const RECIPIENT_NAME = 'Heinz Empfänger';
const GROUP_NAME = 'E2E Übergabe-Gruppe';
const TASK_TITLE = 'E2E Übergabe-Aufgabe';

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
	// #1257: Nutzersuche liegt im zugeklappten Accordion — erst aufklappen.
	await openAccordionSection(page, 'Mitglieder einladen');
	await page.getByRole('searchbox').fill('Empfänger');
	const hit = page.locator('li.group-search-hit').filter({ hasText: RECIPIENT_NAME });
	await expect(hit).toBeVisible();
	await hit.getByRole('button', { name: 'Einladen' }).click();
	// #1257: „Ausstehend" steht im Accordion „Offene Einladungen" — erst aufklappen.
	await openAccordionSection(page, 'Offene Einladungen');
	await expect(page.getByText('Ausstehend')).toBeVisible();
};

/** Legt eine eigene (nicht übergebene) Aufgabe über die UI an. */
const createOwnTaskViaUi = async (page: Page, title: string): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
};

/** Öffnet das Bearbeiten-Formular der ersten Aufgabe in der Liste (Muster crud.spec.ts). */
const openFirstTaskEdit = async (page: Page): Promise<void> => {
	// Die „Weitere Aktionen"-Menüs liegen im Aufgaben-Tab (TaskTree) — das Dashboard zeigt die
	// Aufgabe nur als Karte ohne Aktionsmenü (Test-Pflege: Tab-Wechsel fehlte im Spec-Entwurf).
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
	await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await waitForStableView(page);
};

/** Prüft, dass ein Element vollständig im Viewport liegt (AK10, Bounding-Box statt scrollWidth). */
const expectWithinViewport = async (page: Page, name: string, locator: ReturnType<Page['locator']>): Promise<void> => {
	await expect(locator.first()).toBeVisible();
	const box = await locator.first().boundingBox();
	expect(box, `${name} muss eine Bounding-Box haben`).not.toBeNull();
	const viewport = page.viewportSize();
	expect(viewport).not.toBeNull();
	expect(
		box!.x + box!.width,
		`${name} darf bei ${viewport!.width} px nicht horizontal aus dem Viewport ragen`,
	).toBeLessThanOrEqual(viewport!.width);
};

test.describe('Aufgaben-Übergabe im Bearbeiten-Formular (#1252)', () => {
	/**
	 * Empfänger-Konto + gemeinsame Gruppe anlegen und die Empfänger-Session liefern
	 * (Muster issue-1222-series-recipient.spec.ts). Aufräumen im test.afterEach.
	 */
	const setupSharedGroup = async (page: Page, request: Page['request'], baseURL: string) => {
		const login = await request.post('/auth/test-login', {
			data: { email: RECIPIENT_EMAIL, displayName: RECIPIENT_NAME },
		});
		expect(login.status()).toBe(200);
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		expect(setCookie, 'test-login muss einen Session-Cookie setzen').toBeTruthy();
		const [cookieName, cookieValue] = setCookie.split(';')[0].split('=');
		const recipientContext = await page.context().browser()!.newContext();
		await recipientContext.addCookies([{ name: cookieName.trim(), value: cookieValue.trim(), url: baseURL }]);
		const recipientPage = await recipientContext.newPage();

		await openGroupsTab(page);
		await createGroupAndInvite(page, GROUP_NAME);
		const invitations = (await (await recipientPage.request.get('/api/v1/invitations')).json()) as {
			id: number;
			groupName: string;
		}[];
		const invitation = invitations.find((candidate) => candidate.groupName === GROUP_NAME);
		expect(invitation, 'Einladung muss beim Empfänger anliegen').toBeTruthy();
		expect((await recipientPage.request.post(`/api/v1/invitations/${invitation!.id}/accept`)).status()).toBe(200);

		return { recipientContext, recipientPage };
	};

	test.afterEach(async ({ page }) => {
		// Aufräumen über die echte API (Muster groups-foreign-task.spec.ts): eigene Aufgaben,
		// danach die Gruppe (löst Gruppenmitgliedschaften ab).
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	test('Bearbeiten-Formular mit Gruppe: Empfängerauswahl sichtbar, Übergabe an Mitglied, „Für:"-Kennzeichen (AK9)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { recipientContext, recipientPage } = await setupSharedGroup(page, request, baseURL!);

		try {
			await page.goto('/');
			await waitForStableView(page);
			await createOwnTaskViaUi(page, TASK_TITLE);

			// AK9: Auswahl erscheint im Bearbeiten-Formular, weil der Nutzer in einer Gruppe ist.
			await openFirstTaskEdit(page);
			const recipientSelect = page.getByLabel('Empfänger');
			await expect(recipientSelect).toBeVisible();

			// Übergabe über den einen Speichern-Button (KI-UX: eine Primäraktion).
			await recipientSelect.click();
			await page.getByRole('option', { name: RECIPIENT_NAME }).click();
			await page.locator('kol-dialog').getByRole('button', { name: 'Bearbeiten', exact: true }).click();
			await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
			await waitForStableView(page);

			// Übergebene Sicht: Aufgabe mit „Für:"-Kennzeichen, ohne Bearbeiten-Aktion.
			await expect(page.getByText(`Für: ${RECIPIENT_NAME}`).first()).toBeVisible();

			// Empfänger-Sicht: Aufgabe ist in seiner Liste angekommen.
			await recipientPage.goto('/');
			await waitForStableView(recipientPage);
			await expect(recipientPage.getByText(TASK_TITLE).first()).toBeVisible();
		} finally {
			await recipientContext.close();
		}
	});

	test('Bearbeiten-Formular ohne Gruppe: keine Empfängerauswahl (AK9, unveränderter Flow)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);
		await createOwnTaskViaUi(page, TASK_TITLE);

		await openFirstTaskEdit(page);
		await expect(page.getByLabel('Empfänger')).toHaveCount(0);
	});

	test('375 px und 320 px: Empfängerauswahl im Bearbeiten-Formular ohne Überlauf bedienbar (AK10)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { recipientContext } = await setupSharedGroup(page, request, baseURL!);

		try {
			await page.goto('/');
			await waitForStableView(page);
			await createOwnTaskViaUi(page, TASK_TITLE);

			await page.setViewportSize({ width: 375, height: 812 });
			await openFirstTaskEdit(page);
			await expectWithinViewport(page, 'Empfänger-Auswahl im Edit (375 px)', page.getByLabel('Empfänger'));

			// Schmalster praxisnaher Viewport: Auswahl öffnen und bedienen bleibt im Viewport.
			await page.locator('kol-dialog').getByRole('button', { name: 'Abbrechen' }).click();
			await page.setViewportSize({ width: 320, height: 640 });
			await openFirstTaskEdit(page);
			await expectWithinViewport(page, 'Empfänger-Auswahl im Edit (320 px)', page.getByLabel('Empfänger'));
		} finally {
			await recipientContext.close();
		}
	});
});
