import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { MOBILE, openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote End-to-End-Spec für #2771 — Checklisten-Eintrag per Enter-Taste anlegen (AK4, AK5).
 * Vertrag: docs/spec/issue-2771.md. Läuft gegen das echte Backend (In-Memory-DB).
 * Rot, bis TaskForm am Checklisten-Eingabefeld Enter wie den „Hinzufügen"-Button behandelt.
 */
let runId = 0;
const uniqueTitle = (label: string): string => {
	const tail = `#${(runId += 1)}`;
	return `${`E2E #2771 ${label}`.slice(0, 30 - tail.length)}${tail}`;
};

/** Öffnet das TaskForm (QuickCapture übersprungen) und das „Optional"-Akkordeon. */
const openTaskFormChecklist = async (page: Page): Promise<void> => {
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	await openAccordionSection(page, 'Optional');
	await expect(page.getByTestId('checklist-section')).toBeVisible();
};

/** Legt per Enter an: Titel ins Feld, keydown Enter, Eintrag erscheint, Feld ist leer. */
const addViaEnter = async (page: Page, title: string): Promise<void> => {
	const input = page.getByTestId('checklist-section').getByRole('searchbox', { name: 'Checklisten-Eintrag' });
	await input.fill(title);
	await input.press('Enter');
	await expect(page.getByTestId('checklist-item').filter({ hasText: title })).toHaveCount(1);
	await expect(input).toHaveValue('');
};

test('AK4 — Task-Modus: per Enter angelegte Einträge landen im Task-Payload', async ({ page }) => {
	await registerOwnSession(page, 'issue-2771-task');
	await page.goto('/app/');
	await waitForStableView(page);
	await openTaskFormChecklist(page);

	const first = uniqueTitle('Task A');
	const second = uniqueTitle('Task B');
	await addViaEnter(page, first);
	await addViaEnter(page, second);

	const title = uniqueTitle('Speichern');
	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeHidden();

	// Gespeichertes Task-Objekt enthält beide per Enter angelegten Titel.
	await expect
		.poll(async () => {
			const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
				title: string;
				checklist?: { title: string }[];
			}[];
			const saved = tasks.find((entry) => entry.title === title);
			return saved?.checklist?.map((item) => item.title).join('|') ?? '';
		})
		.toBe(`${first}|${second}`);
});

test.describe('Balamentum — Checklisten-Eintrag per Enter, 375 px (#2771)', () => {
	test.use({ viewport: MOBILE });

	test('AK5 — Anlegen per Enter bedienbar, kein horizontaler Scroll', async ({ page }) => {
		await registerOwnSession(page, 'issue-2771-mobile');
		await page.goto('/app/');
		await waitForStableView(page);
		await openTaskFormChecklist(page);

		const section = page.getByTestId('checklist-section');
		await addViaEnter(page, uniqueTitle('Mobil'));

		// Bounding-Box statt scrollWidth — die App-Shell clippt overflow-x.
		const box = await section.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(375.5);
	});
});

test('AK4 — Serie-Modus: per Enter angelegte Checkpunkte landen im Series-Payload', async ({ page }) => {
	await registerOwnSession(page, 'issue-2771-series');

	const response = await page.request.post('/api/v1/series', {
		data: {
			title: uniqueTitle('Serie'),
			rhythm: 'none',
			priority: 3,
			estimatedEffort: 0.5,
			autoCreate: false,
			active: true,
		},
	});
	expect(response.ok()).toBeTruthy();
	const seriesId = ((await response.json()) as { id: number }).id;

	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Serien & Vorlagen', exact: true }).click();
	await expect(page.getByTestId('series-tree')).toBeVisible();
	await page
		.getByTestId(`series-tree-item-${seriesId}`)
		.getByRole('toolbar')
		.getByRole('button', { name: 'Bearbeiten' })
		.click();
	// Checkliste liegt im zugeklappten „Optional"-Akkordeon.
	await openAccordionSection(page, 'Optional');
	await expect(page.getByTestId('checklist-section')).toBeVisible();

	const first = uniqueTitle('Serie A');
	const second = uniqueTitle('Serie B');
	await addViaEnter(page, first);
	await addViaEnter(page, second);

	await page.getByRole('button', { name: 'Bearbeiten', exact: true }).last().click();
	const confirm = page.getByRole('button', { name: 'Ja', exact: true });
	// Test-Pflege: Kaskade-Modal (#553) rendert asynchron — erst abwarten, dann bestätigen.
	if (
		await confirm.waitFor({ state: 'visible', timeout: 3000 }).then(
			() => true,
			() => false,
		)
	) {
		await confirm.click();
	}

	await expect
		.poll(async () => {
			const all = (await (await page.request.get('/api/v1/series')).json()) as {
				id: number;
				checklist?: { title: string }[];
			}[];
			const saved = all.find((entry) => entry.id === seriesId);
			return saved?.checklist?.map((item) => item.title).join('|') ?? '';
		})
		.toBe(`${first}|${second}`);
});
