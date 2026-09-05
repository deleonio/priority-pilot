import type { APIRequestContext } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1223 (AK7, AK8; docs/spec/issue-1223.md) — Abschnitt
 * „Füreinander angelegt" im Gruppendetail: Einträge mit Titel, Empfänger und
 * „von <Ersteller>"; Erklär-Hinweis statt leerer Liste; bei 375 px kein horizontaler
 * Überlauf.
 *
 * Gegen das echte Backend (Muster groups-foreign-task.spec.ts, #1213). Empfänger-Konto per
 * `POST /auth/test-login` in eigenem Browser-Context; Gruppe über die Settings-UI, Einladung
 * über die Nutzersuche, Annahme über die Empfänger-API. Die Übergabe-Aufgabe entsteht direkt
 * über die Tasks-API — das Anlege-Formular ist bereits durch #1213 abgedeckt (dedup); hier
 * geht es ausschließlich um die Gruppen-Sicht.
 *
 * AK8 wird per Bounding-Box geprüft — NICHT per scrollWidth: die App-Shell clippt
 * overflow-x:hidden, scrollWidth bleibt strukturell ≤ Viewport (Erfahrung 2026-08-24).
 */

const INVITEE_EMAIL = 'for-each-other@example.com';
const INVITEE_NAME = 'Lángename Empfängerin Mit Ungewöhnlich Langem Anzeigenamen';
const SECTION_HEADING = 'Füreinander angelegt';
const EMPTY_HINT = 'Noch hat niemand eine Aufgabe für ein anderes Mitglied angelegt.';

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
	// Nutzersuche läuft datenbankweit — Treffer exakt auf den eigenen Empfänger grenzen, damit
	// ein Namensanteil nicht den „Einladen"-Klick eines anderen Test-Kontexts trifft.
	const hit = page.locator('li.group-search-hit').filter({ hasText: INVITEE_NAME });
	await expect(hit).toBeVisible();
	await hit.getByRole('button', { name: 'Einladen' }).click();
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

/** Legt über die Tasks-API eine Aufgabe für das Empfänger-Konto an (groupId für Empfänger-Lookup). */
const createForeignTaskViaApi = async (page: Page, groupId: number, title: string): Promise<void> => {
	const members = (await (await page.request.get(`/api/v1/groups/${groupId}/members`)).json()) as {
		userId: number;
		displayName: string;
	}[];
	const invitee = members.find((candidate) => candidate.displayName === INVITEE_NAME);
	expect(invitee, 'Empfänger muss Gruppenmitglied sein').toBeTruthy();
	const created = await page.request.post('/api/v1/tasks', {
		data: { title, userId: invitee!.userId },
	});
	expect(created.status()).toBe(201);
};

test.describe('Gruppenabschnitt „Füreinander angelegt“ (#1223)', () => {
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

	test('Gruppendetail zeigt den Abschnitt mit Titel, Empfänger und „von <Ersteller>“ (AK7)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Füreinander');
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
			const group = groups.find((candidate) => candidate.name === 'E2E Füreinander');
			expect(group).toBeTruthy();
			await acceptInvitation(inviteePage, 'E2E Füreinander');
			await createForeignTaskViaApi(page, group!.id, 'E2E Übergabe-Aufgabe');

			await page.getByRole('listitem').filter({ hasText: 'E2E Füreinander' }).click();
			// Abschnitt scopen statt page-weit: „von …" und die Empfängerin tauchen auch in der
			// Mitgliederliste und in den gemounteten KolTabs-Panels auf (Strict Mode, 2026-08-29).
			const taskSection = page.locator('.group-tasks');
			await expect(page.getByRole('heading', { name: SECTION_HEADING })).toBeVisible();
			await expect(taskSection.getByText('E2E Übergabe-Aufgabe')).toBeVisible();
			await expect(taskSection.getByText(INVITEE_NAME).first()).toBeVisible();
			await expect(taskSection.getByText(/von /).first()).toBeVisible();
		} finally {
			await close();
		}
	});

	test('ohne füreinander angelegte Aufgaben steht ein Erklär-Hinweis statt einer leeren Liste (AK7)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Füreinander Leer');
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
			const group = groups.find((candidate) => candidate.name === 'E2E Füreinander Leer');
			expect(group).toBeTruthy();
			await acceptInvitation(inviteePage, 'E2E Füreinander Leer');

			// Nur eine Selbst-Aufgabe: bleibt privat, der Abschnitt zeigt weiter den Hinweis (AK2/AK7).
			const selfCreated = await page.request.post('/api/v1/tasks', { data: { title: 'Nur für mich' } });
			expect(selfCreated.status()).toBe(201);

			await page.getByRole('listitem').filter({ hasText: 'E2E Füreinander Leer' }).click();
			await expect(page.getByRole('heading', { name: SECTION_HEADING })).toBeVisible();
			await expect(page.getByText(EMPTY_HINT)).toBeVisible();
			await expect(page.getByText('Nur für mich')).toBeHidden();
		} finally {
			await close();
		}
	});

	test('375 px: Abschnitt „Füreinander angelegt“ ohne horizontalen Überlauf (AK8)', async ({
		page,
		request,
		baseURL,
	}) => {
		const { inviteePage, close } = await loginInviteeInOwnContext(page, request, baseURL);
		try {
			await openGroupsTab(page);
			await createGroupAndInvite(page, 'E2E Füreinander Schmal');
			const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
			const group = groups.find((candidate) => candidate.name === 'E2E Füreinander Schmal');
			expect(group).toBeTruthy();
			await acceptInvitation(inviteePage, 'E2E Füreinander Schmal');
			await createForeignTaskViaApi(page, group!.id, 'E2E Schmale Übergabe-Aufgabe');

			await page.setViewportSize({ width: 375, height: 812 });
			await page.getByRole('listitem').filter({ hasText: 'E2E Füreinander Schmal' }).click();

			// Überschrift und der Abschnitts-Eintrag bleiben im Viewport — der lange Empfängername muss
			// umbrechen (overflow-wrap), sonst sprengt genau dieser Fall den 375-px-Check. Locator auf
			// den Abschnitt scopen (page-weite Texte treffen auch gemountete KolTabs-Panels) und per
			// toHaveCount auf das Rendern warten, statt einmalig count() zu lesen (Race).
			const taskEntry = page
				.locator('.group-tasks .group-task')
				.filter({ hasText: /E2E Schmale Übergabe-Aufgabe|Lángename Empfängerin/ });
			await expect(taskEntry).toHaveCount(1);
			const heading = page.getByRole('heading', { name: SECTION_HEADING });
			await expect(heading).toBeVisible();
			const viewport = page.viewportSize();
			for (const [index, element] of [heading, taskEntry].entries()) {
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
