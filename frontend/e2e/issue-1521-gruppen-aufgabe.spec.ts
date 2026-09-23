import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { accordionTrigger, openAccordionSection, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1521 — Aufgabe an eine ganze Gruppe zuweisen (AK6–AK8,
 * Vertrag: docs/spec/issue-1521.md „UI-Vertrag").
 *
 * Gegen das echte Backend (Muster groups-foreign-task.spec.ts): Gruppe wird über die
 * Settings-UI angelegt (Ersteller ist automatisch Admin-Mitglied), die Aufgabe über das
 * normale Anlege-Formular mit der neuen Gruppen-Option in der Empfänger-Auswahl (AK1).
 *
 * Rot, bis (a) die Empfänger-Auswahl eine "Gruppe: <Name>"-Option anbietet, (b) das
 * Gruppendetail einen `data-testid="group-open-tasks"`-Container mit den offenen
 * Gruppen-Aufgaben zeigt, und (c) die Aufgabenliste ein `data-testid="group-task-badge"`
 * mit Text `Für: <Gruppenname>` zeigt.
 *
 * AK8 (375px) wird per Bounding-Box geprüft — NICHT per scrollWidth (App-Shell clippt
 * overflow-x: hidden, Erfahrung 2026-08-24).
 */

const GROUP_NAME = 'Spec-Gruppe #1521';
const TASK_TITLE = 'Gemeinsame Gruppen-Aufgabe #1521';

const openGroupsTab = async (page: Page): Promise<void> => {
	await page.goto('/app/settings/gruppen');
	await waitForStableView(page, 'Gruppen');
	await expect(page.getByRole('tab', { name: 'Gruppen', exact: true })).toBeVisible();
};

const createGroupViaUi = async (page: Page, name: string): Promise<void> => {
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeVisible();
	await page.getByRole('searchbox', { name: 'Name' }).fill(name);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	await waitForStableView(page, 'Gruppen');
};

/** Legt eine Aufgabe an, deren Empfänger die angegebene Gruppe ist (AK1-Option „Gruppe: <Name>"). */
const createGroupTaskViaUi = async (page: Page, title: string, groupName: string): Promise<void> => {
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: /neuen task anlegen/i }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);

	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	await page.getByLabel('Empfänger').click();
	await page.getByRole('option', { name: `Gruppe: ${groupName}` }).click();
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();
};

test.describe('#1521 Gruppen-Aufgabe', () => {
	test.afterEach(async ({ page }) => {
		const groups = (await (await page.request.get('/api/v1/groups')).json()) as { id: number; name: string }[];
		for (const group of groups.filter((candidate) => candidate.name === GROUP_NAME)) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	test('AK6/AK7 — Gruppen-Aufgabe erscheint im Gruppendetail und mit Gruppennamen-Badge, verschwindet nach dem Erledigen', async ({
		page,
	}) => {
		await openGroupsTab(page);
		await createGroupViaUi(page, GROUP_NAME);
		await createGroupTaskViaUi(page, TASK_TITLE, GROUP_NAME);

		// AK7: Aufgabenliste zeigt den Gruppennamen im „Für:"-Kennzeichen statt eines Personennamens.
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		const badge = page.getByTestId('group-task-badge').filter({ hasText: `Für: ${GROUP_NAME}` });
		await expect(badge.first()).toBeVisible();

		// AK6: Gruppendetail listet die offene Gruppen-Aufgabe.
		await openGroupsTab(page);
		await accordionTrigger(page, GROUP_NAME).click();
		await openAccordionSection(page, 'Offene Gruppen-Aufgaben');
		const openTasks = page.getByTestId('group-open-tasks');
		await expect(openTasks.getByText(TASK_TITLE)).toBeVisible();

		// Aufgabe erledigen — Status-Wechsel über die echte API (Toggle-Mechanik ist bereits durch
		// done-toggle.spec.ts abgedeckt, hier geht es nur um die Sichtbarkeits-Konsequenz, AK3/AK6).
		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as { id: number; title: string }[];
		const created = tasks.find((candidate) => candidate.title === TASK_TITLE);
		expect(created, 'Aufgabe muss über die API auffindbar sein').toBeTruthy();
		const doneRes = await page.request.patch(`/api/v1/tasks/${created!.id}`, { data: { status: 'Done' } });
		expect(doneRes.ok(), 'AK3: Erledigen der Gruppen-Aufgabe muss möglich sein').toBeTruthy();

		// AK6: nach dem Erledigen ist die Aufgabe nicht mehr in den offenen Gruppen-Aufgaben.
		await openGroupsTab(page);
		await accordionTrigger(page, GROUP_NAME).click();
		await expect(page.getByTestId('group-open-tasks').getByText(TASK_TITLE)).toHaveCount(0);
	});

	test('AK8 (375px) — Gruppen-Option und Gruppen-Badge ragen nicht über den Viewport hinaus', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await openGroupsTab(page);
		await createGroupViaUi(page, GROUP_NAME);

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('button', { name: /neuen task anlegen/i }).click();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
		await page.getByLabel('Empfänger').click();
		const groupOption = page.getByRole('option', { name: `Gruppe: ${GROUP_NAME}` });
		await expect(groupOption).toBeVisible();
		const optionBox = await groupOption.boundingBox();
		expect(optionBox, 'Gruppen-Option muss eine Bounding-Box haben').not.toBeNull();
		expect(optionBox!.x + optionBox!.width).toBeLessThanOrEqual(375);
		await groupOption.click();
		await page.getByRole('textbox', { name: 'Titel' }).fill(TASK_TITLE);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
		const badge = page.getByTestId('group-task-badge').filter({ hasText: `Für: ${GROUP_NAME}` });
		await expect(badge.first()).toBeVisible();
		const badgeBox = await badge.first().boundingBox();
		expect(badgeBox, 'Gruppen-Badge muss eine Bounding-Box haben').not.toBeNull();
		expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(375);
	});
});
