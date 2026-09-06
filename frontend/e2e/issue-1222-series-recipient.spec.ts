import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * E2E für #1222 (AK8–AK10, docs/spec/issue-1222.md) — Serie für ein anderes Gruppenmitglied
 * über die UI anlegen (Muster groups-foreign-task.spec.ts #1213). Gegen das echte Backend:
 * Empfänger-Konto per `POST /auth/test-login`, eigener Browser-Context mit übernommenem
 * Session-Cookie; Gruppe entsteht über die Settings-UI, Einladung über die Nutzersuche,
 * Annahme über die Empfänger-API.
 *
 * AK10 wird per Bounding-Box geprüft — NICHT per scrollWidth: die App-Shell clippt
 * overflow-x:hidden, scrollWidth bleibt strukturell ≤ Viewport (Erfahrung 2026-08-24).
 * Geprüft wird bei 375 px UND 320 px (Card-Padding schluckt sonst Überlauf).
 */

// Bewusst nicht 'series-recipient@example.com' — die teilt groups-series-for-each-other.spec.ts;
// test-login (findOrCreate per E-Mail) würde den dortigen Nutzer wiederverwenden und nie
// umbenennen, die Suche nach 'Ronny Empfänger' ginge bei gemeinsamer Ausführung leer.
const RECIPIENT_EMAIL = 'series-recipient-1222@example.com';
const RECIPIENT_NAME = 'Ronny Empfänger';
const GROUP_NAME = 'E2E Serien-Übergabe';
const SERIES_TITLE = 'E2E Übergabe-Serie';

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

/** Legt über die UI eine Serie für das Empfänger-Konto an (Serie-Modus + Empfänger-Auswahl, AK8). */
const createSeriesForRecipientViaUi = async (page: Page, title: string): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);

	// In den Serie-Modus schalten (Switch statt Button-Paar, Muster series.spec.ts).
	await page.getByTestId('mode-switch').getByRole('checkbox').click();
	await waitForStableView(page);

	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	await page.getByLabel('Startdatum').fill('2026-12-07');
	// Empfänger-Auswahl (KolSingleSelect → Combobox mit role="option", Muster groups-foreign-task.spec.ts).
	await page.getByLabel('Empfänger').click();
	await page.getByRole('option', { name: RECIPIENT_NAME }).click();

	const seriesCreated = page.waitForResponse(
		(response) => response.url().includes('/api/v1/series') && response.request().method() === 'POST',
	);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await seriesCreated;
};

/** Öffnet den Serien-Tab (Muster series-tab.spec.ts). */
const openSeriesTab = async (page: Page): Promise<void> => {
	await page.getByRole('tab', { name: 'Serien', exact: true }).click();
	await expect(page.getByTestId('series-tree')).toBeVisible();
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

test.describe('Serie für ein Gruppenmitglied (#1222)', () => {
	/**
	 * Legt Empfänger-Konto + gemeinsame Gruppe an und liefert den angemeldeten Empfänger-Context.
	 * Aufräumen macht der jeweilige Test im `finally` (Serie gehört dem Empfänger → dessen Session).
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

	test('Serie für anderes Mitglied: Ersteller sieht „Für: …" ohne Aktionen, Empfänger handlungsfähig (AK8/AK9)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { recipientContext, recipientPage } = await setupSharedGroup(page, request, baseURL!);

		try {
			await page.goto('/');
			await waitForStableView(page);
			await createSeriesForRecipientViaUi(page, SERIES_TITLE);

			// Ersteller-Sicht: Serie lesbar mit „Für:"-Kennzeichen, aber OHNE Bearbeiten/Löschen
			// (Schreibzugriffe wären die 404-Sackgasse, AK6 — keine Geister-Fokusziele).
			await page.reload();
			await waitForStableView(page);
			await openSeriesTab(page);
			await expect(page.getByText(SERIES_TITLE, { exact: true })).toBeVisible();
			await expect(page.getByText(`Für: ${RECIPIENT_NAME}`)).toBeVisible();
			await expect(page.getByTestId('series-tree').getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0);
			await expect(page.getByTestId('series-tree').getByRole('button', { name: 'Löschen' })).toHaveCount(0);

			// Empfänger-Sicht: eigene Serie ohne Kennzeichen, mit Aktionen.
			await recipientPage.goto('/');
			await waitForStableView(recipientPage);
			await openSeriesTab(recipientPage);
			await expect(recipientPage.getByText(SERIES_TITLE, { exact: true })).toBeVisible();
			await expect(recipientPage.getByText(/Für: /)).toHaveCount(0);
			await expect(recipientPage.getByTestId('series-tree').getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
		} finally {
			const series = (await (await recipientPage.request.get('/api/v1/series')).json()) as { id: number }[];
			for (const entry of series) {
				await recipientPage.request.delete(`/api/v1/series/${entry.id}`);
			}
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
			for (const group of groups) {
				await page.request.delete(`/api/v1/groups/${group.id}`);
			}
			await recipientContext.close();
		}
	});

	test('375 px und 320 px: Empfängerauswahl (Serie-Modus) und „Für:"-Hinweis ohne Überlauf (AK10)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { recipientContext, recipientPage } = await setupSharedGroup(page, request, baseURL!);

		try {
			await page.goto('/');
			await waitForStableView(page);

			// Formular bei 375 px: Empfängerauswahl bleibt im Serie-Modus im Viewport.
			await page.setViewportSize({ width: 375, height: 812 });
			await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await page.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(page);
			await page.getByTestId('mode-switch').getByRole('checkbox').click();
			await waitForStableView(page);
			await expectWithinViewport(page, 'Empfänger-Auswahl (375 px)', page.getByLabel('Empfänger'));

			await page.getByRole('textbox', { name: 'Titel' }).fill(SERIES_TITLE);
			await page.getByLabel('Startdatum').fill('2026-12-07');
			await page.getByLabel('Empfänger').click();
			await page.getByRole('option', { name: RECIPIENT_NAME }).click();
			const seriesCreated = page.waitForResponse(
				(response) => response.url().includes('/api/v1/series') && response.request().method() === 'POST',
			);
			await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
			await seriesCreated;

			// Serien-Tab: „Für:"-Hinweis bleibt bei 375 px im Viewport.
			await page.reload();
			await waitForStableView(page);
			await openSeriesTab(page);
			await expectWithinViewport(page, 'Für-Hinweis (375 px)', page.getByText(/Für: /));

			// 320 px (schmalster praxisnaher Viewport): derselbe Check für das Badge.
			await page.setViewportSize({ width: 320, height: 640 });
			await openSeriesTab(page);
			await expectWithinViewport(page, 'Für-Hinweis (320 px)', page.getByText(/Für: /));

			// Formular bei 320 px erneut: Empfängerauswahl bleibt bedienbar im Viewport.
			await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await page.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(page);
			await page.getByTestId('mode-switch').getByRole('checkbox').click();
			await waitForStableView(page);
			await expectWithinViewport(page, 'Empfänger-Auswahl (320 px)', page.getByLabel('Empfänger'));
		} finally {
			const series = (await (await recipientPage.request.get('/api/v1/series')).json()) as { id: number }[];
			for (const entry of series) {
				await recipientPage.request.delete(`/api/v1/series/${entry.id}`);
			}
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
			for (const group of groups) {
				await page.request.delete(`/api/v1/groups/${group.id}`);
			}
			await recipientContext.close();
		}
	});

	/**
	 * #1262 (AK2/AK3, docs/spec/issue-1262.md): Auf der Empfänger-Seite (recipientPage) gilt —
	 * anders als auf der Fixture-Page — KEIN /auth/me-Mock: echter Session-Cookie per test-login,
	 * echte `/auth/me`-Antwort des Backends. Ist dort `id` absent (der Bug), ist die eigene
	 * Vorauswahl der Empfängerauswahl kaputt (`recipientId = "undefined"`) und das Anlegen ohne
	 * Eingriff in die Auswahl scheitert an der userId-Validierung (4xx).
	 */
	test('#1262 — eigene Vorauswahl: Aufgabe und Serie ohne Eingriff anlegbar (AK2/AK3)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { recipientContext, recipientPage } = await setupSharedGroup(page, request, baseURL!);

		try {
			await recipientPage.goto('/');
			await waitForStableView(recipientPage);

			// AK2 — Task-Modus: Anlegen ohne Eingriff in die Empfängerauswahl → POST /tasks mit 2xx.
			await recipientPage.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await expect(recipientPage.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
			await waitForStableView(recipientPage);
			await recipientPage.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(recipientPage);
			// Combobox-Rolle statt getByLabel: Der Anzeigename des eigenen Kontos enthält hier
			// „Empfänger", der Avatar der Vorauswahl (aria-label „Avatar von Ronny Empfänger")
			// matchet getByLabel per Substring mit → strict-mode violation (Test-Pflege #1262).
			await expect(recipientPage.getByRole('combobox', { name: 'Empfänger' })).toBeVisible();

			const taskCreated = recipientPage.waitForResponse(
				(response) => response.url().includes('/api/v1/tasks') && response.request().method() === 'POST',
			);
			await recipientPage.getByRole('textbox', { name: 'Titel' }).fill('E2E Eigen-Anlage Task');
			await recipientPage.getByRole('button', { name: 'Anlegen', exact: true }).click();
			const taskResponse = await taskCreated;
			expect(taskResponse.status(), 'Task-Anlage ohne Eingriff in die Auswahl muss 2xx liefern').toBeLessThan(300);
			expect(taskResponse.status()).toBeGreaterThanOrEqual(200);
			await expect(recipientPage.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

			// AK3 — Serie-Modus: dieselbe Vorauswahl, POST /series mit 2xx.
			await recipientPage.getByRole('button', { name: 'Neuen Task anlegen' }).click();
			await waitForStableView(recipientPage);
			await recipientPage.getByRole('button', { name: 'Überspringen' }).click();
			await waitForStableView(recipientPage);
			await recipientPage.getByTestId('mode-switch').getByRole('checkbox').click();
			await waitForStableView(recipientPage);
			await expect(recipientPage.getByRole('combobox', { name: 'Empfänger' })).toBeVisible();

			await recipientPage.getByRole('textbox', { name: 'Titel' }).fill('E2E Eigen-Anlage Serie');
			await recipientPage.getByLabel('Startdatum').fill('2026-12-07');
			const seriesCreated = recipientPage.waitForResponse(
				(response) => response.url().includes('/api/v1/series') && response.request().method() === 'POST',
			);
			await recipientPage.getByRole('button', { name: 'Anlegen', exact: true }).click();
			const seriesResponse = await seriesCreated;
			expect(seriesResponse.status(), 'Serien-Anlage ohne Eingriff in die Auswahl muss 2xx liefern').toBeLessThan(300);
			expect(seriesResponse.status()).toBeGreaterThanOrEqual(200);
		} finally {
			const series = (await (await recipientPage.request.get('/api/v1/series')).json()) as { id: number }[];
			for (const entry of series) {
				await recipientPage.request.delete(`/api/v1/series/${entry.id}`);
			}
			const tasks = (await (await recipientPage.request.get('/api/v1/tasks')).json()) as { id: number }[];
			for (const entry of tasks) {
				await recipientPage.request.delete(`/api/v1/tasks/${entry.id}`);
			}
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
			for (const group of groups) {
				await page.request.delete(`/api/v1/groups/${group.id}`);
			}
			await recipientContext.close();
		}
	});
});
