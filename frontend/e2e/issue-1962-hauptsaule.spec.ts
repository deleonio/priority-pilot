import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1962 — Hauptsäulen-Modus (Spec: docs/spec/issue-1962.md).
 *
 * - AK2: Der Aufgaben-Dialog ist mit nur gewählter Hauptsäule absendbar — kein erzwungenes
 *   Vorbelegen aller fünf Säulen; das Payload enthält genau einen Beitrag (share 100).
 * - AK3: Die Restverteilung erscheint als Vorschlags-Block (Regel-Fallback: Hauptsäule 80 %,
 *   Rest je 5 %) und ist übernehmbar; ohne Übernahme speichert nur die Hauptsäule.
 * - AK6: Mobile-first (375 px): Hauptsäulen-Auswahl und Vorschlags-Übernahme liegen vollständig
 *   im Viewport (Bounding-Box-Assertion, nicht scrollWidth — App-Shell clippt overflow-x).
 *
 * Der Vorschlags-Block und die Hauptsäulen-Auswahl existieren noch nicht — diese Specs sind rot,
 * solange die Implementierung fehlt (die heutige UI belegt alle fünf Säulen vor).
 */

test.describe('#1962 — Hauptsäulen-Modus', () => {
	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		const head = `E2E 1962 ${label}`.slice(0, 30 - tail.length);
		return `${head}${tail}`;
	};

	const deleteAllTasks = async (page: Page): Promise<void> => {
		const response = await page.request.get('/api/v1/tasks');
		const tasks = (await response.json()) as { id: number }[];
		for (const task of tasks) {
			await page.request.delete(`/api/v1/tasks/${task.id}`);
		}
	};

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	/** Öffnet den Anlege-Dialog bis zum eigentlichen Formular (Modus-Auswahl überspringen). */
	const openNewTaskForm = async (page: Page): Promise<void> => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await waitForStableView(page);
	};

	const chooseMainPillar = async (page: Page, label: string): Promise<void> => {
		await page.getByRole('combobox', { name: 'Hauptsäule' }).selectOption({ label });
	};

	test('AK2 — nur Hauptsäule: genau ein Regler, Speichern legt genau eine Säulen-Zeile an', async ({ page }) => {
		await openNewTaskForm(page);
		const title = uniqueTitle('Einzel');

		await chooseMainPillar(page, 'Körper');

		// Kein erzwungenes Vorbelegen: genau eine Beitragszeile statt fünf.
		await expect(page.locator('.pillar-row')).toHaveCount(1);
		await expect(page.locator('kol-input-range[_label="Körper: 100 %"]')).toHaveCount(1);

		// Der Vorschlags-Block wird angezeigt, bleibt aber eine Entscheidung (AK3) — hier wird
		// bewusst NICHT übernommen.
		await expect(page.getByRole('button', { name: 'Vorschlag übernehmen' })).toBeVisible();

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe anlegen|Neuen Task anlegen/ })).toBeHidden();

		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
			title: string;
			pillars: { pillarId: number; share: number; confidence: number }[];
		}[];
		const created = tasks.find((entry) => entry.title === title);
		expect(created).toBeDefined();
		expect(created?.pillars).toEqual([{ pillarId: 1, share: 100, confidence: 100 }]);
	});

	test('AK3 — Vorschlag übernehmen: fünf Zeilen, Hauptsäule 80 %, Rest je 5 %', async ({ page }) => {
		await openNewTaskForm(page);
		const title = uniqueTitle('Uebernommen');

		await chooseMainPillar(page, 'Körper');
		await page.getByRole('button', { name: 'Vorschlag übernehmen' }).click();

		await expect(page.locator('.pillar-row')).toHaveCount(5);
		await expect(page.locator('kol-input-range[_label="Körper: 80 %"]')).toHaveCount(1);
		await expect(page.locator('kol-input-range[_label="Mentale Gesundheit: 5 %"]')).toHaveCount(1);

		await page.getByRole('textbox', { name: 'Titel' }).fill(title);
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Aufgabe anlegen|Neuen Task anlegen/ })).toBeHidden();

		const tasks = (await (await page.request.get('/api/v1/tasks')).json()) as {
			title: string;
			pillars: { pillarId: number; share: number }[];
		}[];
		const created = tasks.find((entry) => entry.title === title);
		expect(created?.pillars.map((entry) => entry.share).reduce((acc, share) => acc + share, 0)).toBe(100);
		expect(created?.pillars.find((entry) => entry.pillarId === 1)?.share).toBe(80);
		expect(created?.pillars.filter((entry) => entry.pillarId !== 1).every((entry) => entry.share === 5)).toBe(true);
	});

	test('AK6 — 375 px: Hauptsäulen-Auswahl und Vorschlags-Übernahme bleiben im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openNewTaskForm(page);

		await chooseMainPillar(page, 'Körper');
		const overnehmen = page.getByRole('button', { name: 'Vorschlag übernehmen' });
		await expect(overnehmen).toBeVisible();

		const selectBox = await page.getByRole('combobox', { name: 'Hauptsäule' }).boundingBox();
		const buttonBox = await overnehmen.boundingBox();
		expect(selectBox).not.toBeNull();
		expect(buttonBox).not.toBeNull();
		expect(selectBox!.x).toBeGreaterThanOrEqual(0);
		expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(375 + 1);
		expect(buttonBox!.x).toBeGreaterThanOrEqual(0);
		expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(375 + 1);
	});
});
