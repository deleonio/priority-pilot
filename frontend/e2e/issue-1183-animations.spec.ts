import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Roter E2E-Vertrag für #1183 — „Animationen zentral in den Einstellungen schaltbar
 * (Konfetti-Default: aus)".
 *
 * Spezifikation: docs/spec/issue-1183.md. Der Schalter existiert noch nicht → RED.
 * Konventionen wie voice-autostart.spec.ts (Settings unter /settings/general) und
 * issue-1169-confetti.spec.ts (API-Seed, „…"-Popover, confetti-overlay-Testid).
 */

/** Storage-Key des Master-Schalters (muss mit frontend/src/lib/animations.ts übereinstimmen). */
const ANIMATIONS_KEY = 'pp-animations-enabled';

const animationsToggle = (page: Page) =>
	page.getByRole('checkbox', { name: /^Animationen$/i }).or(page.getByRole('switch', { name: /^Animationen$/i }));

const openGeneralSettings = async (page: Page): Promise<void> => {
	await page.goto('/settings/general');
	await waitForStableView(page, 'Priority Pilot');
};

/** Legt einen Task über die echte API an und liefert seine ID zurück. */
const createTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: { title, priority: 3, estimatedEffort: 1 },
	});
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { id: number };
	return task.id;
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const task of tasks) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

/** Öffnet die Aufgaben-Liste mit einer frisch seedeten offenen Aufgabe. */
const seedOpenTask = async (page: Page, label: string): Promise<number> => {
	const id = await createTask(page, `Anim ${label}`.slice(0, 28));
	await page.goto('/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await expect(page.getByTestId(`task-list-item-${id}`)).toBeVisible();
	return id;
};

/** Erledigt-Umschalter einer Zeile über das „…"-Popover. */
const toggleDone = async (page: Page, id: number): Promise<void> => {
	await page
		.getByTestId(`task-list-item-${id}`)
		.getByRole('button', { name: /Weitere Aktionen/i })
		.click();
	await page
		.getByTestId(`task-list-item-${id}`)
		.locator('[role="toolbar"]')
		.getByRole('button', { name: /Erledigt|Wieder öffnen/i })
		.click();
};

const fetchStatus = async (page: Page, id: number): Promise<string> => {
	const response = await page.request.get(`/api/v1/tasks/${id}`);
	expect(response.ok()).toBeTruthy();
	const task = (await response.json()) as { status: string };
	return task.status;
};

test.describe('Priority Pilot — Master-Schalter „Animationen" (#1183)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK3: frischer Kontext — Schalter ist aus (Default), kein Key gesetzt', async ({ page }) => {
		await openGeneralSettings(page);
		await expect(animationsToggle(page)).toBeVisible();
		await expect(animationsToggle(page)).not.toBeChecked();
		expect(await page.evaluate((key) => localStorage.getItem(key), ANIMATIONS_KEY)).toBeNull();
	});

	test('AK1: Einschalten persistsiert und übersteht einen Seiten-Reload', async ({ page }) => {
		await openGeneralSettings(page);
		await animationsToggle(page).click();
		await expect(animationsToggle(page)).toBeChecked();
		expect(await page.evaluate((key) => localStorage.getItem(key), ANIMATIONS_KEY)).toBe('true');

		// Reload — der Schalter zeigt weiterhin den zuletzt gespeicherten Zustand.
		await page.reload();
		await waitForStableView(page, 'Priority Pilot');
		await expect(animationsToggle(page)).toBeVisible();
		await expect(animationsToggle(page)).toBeChecked();
	});

	test('AK2: Schalter aus (frischer Kontext) → Erledigt-Toggle ohne Konfetti', async ({ page }) => {
		const id = await seedOpenTask(page, 'Aus');
		await toggleDone(page, id);
		await expect.poll(async () => fetchStatus(page, id)).toBe('Done');
		await page.waitForTimeout(1_000);
		expect(await page.getByTestId('confetti-overlay').count()).toBe(0);
	});

	test('AK2: Schalter an (Key true) → Erledigt-Toggle zeigt Konfetti wie bisher (#1169)', async ({ page }) => {
		await page.addInitScript((key) => localStorage.setItem(key, 'true'), ANIMATIONS_KEY);
		const id = await seedOpenTask(page, 'An');
		await toggleDone(page, id);
		await expect(page.getByTestId('confetti-overlay')).toBeVisible();
	});

	test('AK5: Schalter ist auf 375×667 sichtbar und bedienbar', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await openGeneralSettings(page);
		const toggle = animationsToggle(page);
		await expect(toggle).toBeVisible();
		await toggle.click();
		await expect(toggle).toBeChecked();
	});
});
