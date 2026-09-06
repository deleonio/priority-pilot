import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1226 (AK5/AK6) — Beitrittsseite `/gruppen/beitreten?token=…`
 * (Vertrag: docs/spec/issue-1226.md). Gegen das echte Backend, analog
 * `groups-invitations.spec.ts` (#1212).
 *
 * Der Einladungslink wird als Setup über die API erzeugt (`POST /api/v1/groups/{id}/invite-links`,
 * Admin-Kontext); Vertragsprüfung der Endpunkte selbst geschieht in
 * `server/src/express/groups-invite-links.api.test.ts` (AK1–AK4). Hier geht es um die Seite:
 * zweiter Nutzer per `POST /auth/test-login` in eigenem Browser-Context
 * (Muster `groups-invitations.spec.ts`).
 *
 * AK6 (375px ohne horizontales Scrollen) wird per Bounding-Box geprüft — NICHT per
 * scrollWidth (App-Shell clippt overflow-x:hidden, Erfahrung 2026-08-24).
 */

const createGroupViaUi = async (page: Page, name: string): Promise<void> => {
	await page.goto('/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await page.getByRole('textbox', { name: 'Name' }).fill(name);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	await waitForStableView(page, 'Gruppen');
};

/** Legt per API (Admin-Kontext) einen Einladungslink an und liefert den rohen Token. */
const createInviteLink = async (page: Page, groupName: string): Promise<{ groupId: number; token: string }> => {
	await page.goto('/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	const groupsRes = await page.request.get('/api/v1/groups');
	const groups = (await groupsRes.json()) as { id: number; name: string }[];
	const group = groups.find((entry) => entry.name === groupName);
	expect(group, 'Setup: Gruppe muss über die API auffindbar sein').toBeTruthy();
	const linkRes = await page.request.post(`/api/v1/groups/${group!.id}/invite-links`);
	expect(linkRes.status(), 'Setup: Einladungslink muss anlegbar sein').toBe(201);
	const link = (await linkRes.json()) as { id: number; token: string };
	return { groupId: group!.id, token: link.token };
};

test.describe('Gruppe über Einladungslink beitreten (#1226)', () => {
	test.afterEach(async ({ page }) => {
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	// ── AK5: Beitrittsseite angemeldet ────────────────────────────────────────────────

	test('angemeldete Person sieht Gruppenname + Einladenden und tritt mit einem Klick bei (AK5)', async ({
		page,
		baseURL,
	}) => {
		await page.request.post('/auth/test-login', {
			data: { email: 'link-admin@example.com', displayName: 'Lars Link' },
		});
		await createGroupViaUi(page, 'E2E Einladungslink');
		const { groupId, token } = await createInviteLink(page, 'E2E Einladungslink');

		// Beitretende Person: eigener Context mit übernommenem Session-Cookie.
		const login = await page.request.post('/auth/test-login', {
			data: { email: 'link-joiner@example.com', displayName: 'Jana Beitritt' },
		});
		expect(login.status()).toBe(200);
		const setCookie = login
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value)[0];
		expect(setCookie, 'test-login muss einen Session-Cookie setzen').toBeTruthy();
		const [name, value] = setCookie.split(';')[0].split('=');
		const joinerContext = await page.context().browser()!.newContext();
		await joinerContext.addCookies([{ name: name.trim(), value: value.trim(), url: baseURL! }]);
		const joinerPage = await joinerContext.newPage();

		try {
			await joinerPage.goto(`/gruppen/beitreten?token=${token}`);

			// Kontext: Gruppenname und Einladender sichtbar, genau eine Primäraktion.
			await expect(joinerPage.getByText('E2E Einladungslink')).toBeVisible();
			await expect(joinerPage.getByText('Lars Link')).toBeVisible();
			const joinButton = joinerPage.getByRole('button', { name: 'Gruppe beitreten' });
			await expect(joinButton).toBeVisible();

			// Ein Klick genügt: Erfolgsbestätigung (KI-UX: Erfolg als eigener Zustand, kein
			// nackter Statuscode) — die Mitgliedschaft selbst wird per API nachgeprüft.
			await joinButton.click();
			await expect(joinerPage.getByText(/beigetreten/i)).toBeVisible();

			const groupsRes = await joinerPage.request.get('/api/v1/groups');
			const groups = (await groupsRes.json()) as { id: number; name: string; role: string }[];
			expect(
				groups.find((entry) => entry.id === groupId),
				'Beitritt muss die Gruppe in der eigenen Gruppenliste erscheinen lassen',
			).toBeTruthy();
		} finally {
			await joinerContext.close();
		}
	});

	// ── AK6: 375px ohne horizontalen Überlauf (Bounding-Box, nicht scrollWidth) ───────

	test('Beitrittsseite bleibt bei 375px ohne horizontalen Überlauf (AK6)', async ({ page }) => {
		await page.request.post('/auth/test-login', {
			data: { email: 'link-admin@example.com', displayName: 'Lars Link' },
		});
		await createGroupViaUi(page, 'E2E Schmal Beitritt');
		const { token } = await createInviteLink(page, 'E2E Schmal Beitritt');

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(`/gruppen/beitreten?token=${token}`);

		const joinButton = page.getByRole('button', { name: 'Gruppe beitreten' });
		await expect(joinButton).toBeVisible();
		const buttonBox = await joinButton.boundingBox();
		expect(buttonBox).not.toBeNull();
		expect(buttonBox!.x, 'Button beginnt im Viewport').toBeGreaterThanOrEqual(0);
		expect(buttonBox!.x + buttonBox!.width, 'Button ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(375);

		// Karte/Kontextbereich (Gruppenname als Hauptaussage) ebenfalls innerhalb 375px.
		const contextBox = await page.getByText('E2E Schmal Beitritt').first().boundingBox();
		expect(contextBox).not.toBeNull();
		expect(contextBox!.x + contextBox!.width, 'Karteninhalt ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(
			375,
		);
	});
});
