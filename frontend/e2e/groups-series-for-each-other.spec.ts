import type { APIRequestContext } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1254 (TF4/TF5 für AK5–AK7; docs/spec/issue-1254.md) — Abschnitt
 * „Füreinander angelegte Serien" im Gruppendetail: Einträge mit Titel, Rhythmus,
 * Eigentümer und „von <Ersteller>"; ruhende Serien als „Ruhend"-Badge; Erklär-Hinweis
 * statt leerer Liste; bei 375 px kein horizontaler Überlauf.
 *
 * Muster groups-for-each-other.spec.ts (#1223) — Helfer dort kopiert, Seeding hier über
 * POST /series (unterstützt Empfänger-`userId` seit #1222). Das Serien-Anlege-Formular
 * ist dort abgedeckt (dedup); hier geht es ausschließlich um die Gruppen-Sicht.
 *
 * AK7 wird per Bounding-Box geprüft — NICHT per scrollWidth: die App-Shell clippt
 * overflow-x:hidden, scrollWidth bleibt strukturell ≤ Viewport (Erfahrung 2026-08-24).
 */

const INVITEE_EMAIL = 'series-recipient@example.com';
const INVITEE_NAME = 'Sérienlang Empfängerin Mit Ungewöhnlich Langem Anzeigenamen';
const SECTION_HEADING = 'Füreinander angelegte Serien';
const EMPTY_HINT = 'Noch hat niemand eine Serie für ein anderes Mitglied angelegt.';
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
	await page.getByRole('searchbox').fill('Empfängerin');
	// Nutzersuche läuft datenbankweit — Treffer exakt auf den eigenen Empfänger grenzen, damit
	// ein Namensanteil nicht den „Einladen"-Klick eines anderen Test-Kontexts trifft.
	const hit = page.locator('li.group-search-hit').filter({ hasText: INVITEE_NAME });
	await expect(hit).toBeVisible();
	await hit.getByRole('button', { name: 'Einladen' }).click();
	// #1257: „Ausstehend" steht im Accordion „Offene Einladungen" — erst aufklappen.
	await openAccordionSection(page, 'Offene Einladungen');
	await expect(page.getByText('Ausstehend')).toBeVisible();
};

/** Empfänger-Konto anlegen, Cookie in eigenem Context übernehmen (Muster groups-foreign-task.spec.ts). */
const loginInviteeInOwnContext = async (
	page: Page,
	request: APIRequestContext,
	baseURL: string | undefined,
): Promise<{ inviteePage: Page; close: () => Promise<void> }> => {
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
	return { inviteePage, close: () => inviteeContext.close() };
};

/** Empfänger nimmt die Einladung über die API an (Annahme-UI ist #1212-Thema, hier nur Setup). */
const acceptInvitation = async (inviteePage: Page, groupName: string): Promise<void> => {
	const invitations = (await (await inviteePage.request.get('/api/v1/invitations')).json()) as {
		id: number;
		groupName: string;
	}[];
	const invitation = invitations.find((candidate) => candidate.groupName === groupName);
	expect(invitation, 'Einladung muss beim Empfänger anliegen').toBeTruthy();
	expect((await inviteePage.request.post(`/api/v1/invitations/${invitation!.id}/accept`)).status()).toBe(200);
};

/** Legt über die Serien-API eine Serie für das Empfänger-Konto an (Creator = Session-Nutzer). */
const createForeignSeriesViaApi = async (page: Page, groupId: number, title: string, active = true): Promise<void> => {
	const members = (await (await page.request.get(`/api/v1/groups/${groupId}/members`)).json()) as {
		userId: number;
		displayName: string;
	}[];
	const invitee = members.find((candidate) => candidate.displayName === INVITEE_NAME);
	expect(invitee, 'Empfänger muss Gruppenmitglied sein').toBeTruthy();
	const created = await page.request.post('/api/v1/series', {
		data: {
			title,
			priority: 3,
			estimatedEffort: 0.5,
			startDate: '2026-10-01T00:00:00.000Z',
			rhythm: 'weekly',
			active,
			userId: invitee!.userId,
		},
	});
	expect(created.status()).toBe(201);
};

/** Gruppen-Id der frisch angelegten Gruppe über die API nachsehen. */
const findGroupId = async (page: Page, groupName: string): Promise<number> => {
	const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
	const group = groups.find((candidate) => candidate.name === groupName);
	expect(group).toBeTruthy();
	return group!.id;
};

/** Ruft das Gruppendetail der frisch angelegten Gruppe auf. */
const openGroupDetail = async (page: Page, groupName: string): Promise<void> => {
	await page.getByRole('listitem').filter({ hasText: groupName }).click();
	await expect(page.getByRole('heading', { name: SECTION_HEADING })).toBeVisible();
	// #1257: Der Abschnitt ist ein zugeklapptes Accordion — erst aufklappen.
	await openAccordionSection(page, SECTION_HEADING);
};

test.describe('Gruppenabschnitt „Füreinander angelegte Serien“ (#1254)', () => {
	test.afterEach(async ({ page }) => {
		// Aufräumen über die echte API, damit nachfolgende Tests leer starten (crud.spec.ts-Muster).
		// Der Ersteller sieht Empfänger-Serien über den createdById-Lese-Scope (#1222).
		const series = (await (await page.request.get('/api/v1/series')).json()) as { id: number }[];
		for (const entry of series) {
			await page.request.delete(`/api/v1/series/${entry.id}`);
		}
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	test('Gruppendetail zeigt den Serien-Abschnitt mit Titel, Rhythmus, Eigentümer und „von <Ersteller>“ (AK5, AK6)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Serien Füreinander');
			const groupId = await findGroupId(page, 'E2E Serien Füreinander');
			await acceptInvitation(inviteePage, 'E2E Serien Füreinander');
			await createForeignSeriesViaApi(page, groupId, SERIES_TITLE);

			await openGroupDetail(page, 'E2E Serien Füreinander');
			// Abschnitt scopen statt page-weit: „von …" und die Empfängerin tauchen auch in der
			// Mitgliederliste und in den gemounteten KolTabs-Panels auf (strict mode, 2026-08-29).
			const seriesSection = page.locator('.group-series');
			await expect(seriesSection.getByText(SERIES_TITLE)).toBeVisible();
			await expect(seriesSection.getByText(INVITEE_NAME).first()).toBeVisible();
			await expect(seriesSection.getByText(/von /).first()).toBeVisible();
			// Rhythmus muss sichtbar sein; ob lokalisiert oder roh, ist Implementationsfreiheit.
			await expect(seriesSection.getByText(/weekly|wöchentlich/i).first()).toBeVisible();
		} finally {
			await close();
		}
	});

	test('ohne füreinander angelegte Serien steht ein Erklär-Hinweis statt einer leeren Liste (AK6)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Serien Leer');
			await acceptInvitation(inviteePage, 'E2E Serien Leer');

			// Nur eine Selbst-Serie: bleibt privat, der Abschnitt zeigt weiter den Hinweis.
			const selfCreated = await page.request.post('/api/v1/series', {
				data: { title: 'Nur für mich', priority: 3, estimatedEffort: 0.5, startDate: '2026-10-01T00:00:00.000Z' },
			});
			expect(selfCreated.status()).toBe(201);

			await openGroupDetail(page, 'E2E Serien Leer');
			await expect(page.getByText(EMPTY_HINT)).toBeVisible();
			await expect(page.getByText('Nur für mich')).toBeHidden();
		} finally {
			await close();
		}
	});

	test('ruhende Serie ist als „Ruhend“ gekennzeichnet (AK6)', async ({ page, request, baseURL }) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Serien Ruhend');
			const groupId = await findGroupId(page, 'E2E Serien Ruhend');
			await acceptInvitation(inviteePage, 'E2E Serien Ruhend');
			await createForeignSeriesViaApi(page, groupId, 'E2E Ruhende Serie', false);

			await openGroupDetail(page, 'E2E Serien Ruhend');
			const restingEntry = page.locator('.group-series .group-series-entry').filter({ hasText: 'E2E Ruhende Serie' });
			await expect(restingEntry).toHaveCount(1);
			// Nie nur Farbcodierung (WCAG 1.4.1): der Ruhend-Zustand braucht ein Text-Badge.
			// exact: Der Serien-Titel („E2E Ruhende Serie") enthält „Ruhend" als Substring — ohne
			// exact wären Titel und Badge zwei Treffer → strict-mode violation (Test-Pflege #1254).
			await expect(restingEntry.getByText('Ruhend', { exact: true })).toBeVisible();
		} finally {
			await close();
		}
	});

	test('375 px: Serien-Abschnitt ohne horizontalen Überlauf (AK7)', async ({ page, request, baseURL }) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Serien Schmal');
			const groupId = await findGroupId(page, 'E2E Serien Schmal');
			await acceptInvitation(inviteePage, 'E2E Serien Schmal');
			await createForeignSeriesViaApi(page, groupId, 'E2E Schmale Übergabe-Serie');

			await page.setViewportSize({ width: 375, height: 812 });
			await openGroupDetail(page, 'E2E Serien Schmal');

			// Überschrift und der Abschnitts-Eintrag bleiben im Viewport — der lange Empfängername
			// muss umbrechen (Block-Layout, KI-UX), sonst sprengt genau dieser Fall den 375-px-Check.
			const seriesEntry = page
				.locator('.group-series .group-series-entry')
				.filter({ hasText: /E2E Schmale Übergabe-Serie|Sérienlang Empfängerin/ });
			await expect(seriesEntry).toHaveCount(1);
			const heading = page.getByRole('heading', { name: SECTION_HEADING });
			await expect(heading).toBeVisible();
			const viewport = page.viewportSize();
			for (const [index, element] of [heading, seriesEntry].entries()) {
				const box = await element.boundingBox();
				expect(box, `Element ${index} muss eine Bounding-Box haben`).not.toBeNull();
				expect(box!.x + box!.width, `Element ${index} ragt bei 375 px horizontal aus dem Viewport`).toBeLessThanOrEqual(
					viewport!.width,
				);
			}
		} finally {
			await close();
		}
	});
});
