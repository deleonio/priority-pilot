import { expect, test, type Page } from './fixtures';
import { registerOwnSession } from './helpers';

/**
 * Rote End-to-End-Spec für #2938 (Leseseite) und #2939 (Handeln in der Ansicht):
 * Aufgaben-Ansicht `/aufgaben/<id>` (Schnitt-Teile 1+2).
 * Vertrag: docs/spec/issue-2938.md und docs/spec/issue-2939.md. Läuft gegen das echte
 * Backend (In-Memory-DB). #2938-Tests rot, bis App.tsx die Route auf TaskView schaltet;
 * #2939-Tests zusätzlich rot, bis Checkliste/Primäraktion/Aktionen umgesetzt sind.
 */

const createViewTask = async (page: Page, title: string): Promise<number> => {
	const response = await page.request.post('/api/v1/tasks', {
		data: {
			title,
			description: 'Erste Zeile\nZweite Zeile',
			priority: 4,
			estimatedEffort: 0.75,
			// Voll ISO (toRawDeadline): formatDeadline zeigt UTC → fest „15.01.2030".
			deadline: '2030-01-15T12:00:00.000Z',
		},
	});
	expect(response.ok(), 'Setup: Task-Anlage muss 2xx liefern').toBeTruthy();
	return ((await response.json()) as { id: number }).id;
};

test.describe('Balamentum — Aufgaben-Ansicht #2938/#2939', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	let runId = 0;
	const uniqueTitle = (label: string): string => {
		const tail = `#${(runId += 1)}`;
		return `${`E2E #2938 ${label}`.slice(0, 30 - tail.length)}${tail}`;
	};

	// AK1/TF1: Leseseite mit Kopf (h1 + Prioritäts-Badge), Kernzeile (Fälligkeit relativ und
	// absolut, Aufwand) und Beschreibung — Mobile-First 375×812. Der Aufgaben-Tab bleibt
	// markiert (Präfix-Match, Randbedingung).
	test('AK1: Route rendert Kopf, Kernzeile und Beschreibung bei 375×812', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938');
		const title = uniqueTitle('Leseseite');
		const id = await createViewTask(page, title);

		await page.goto(`/app/aufgaben/${id}`);

		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
		await expect(page.getByText('P4', { exact: true })).toBeVisible();
		await expect(page.getByText(/in \d+ Tagen/)).toBeVisible();
		await expect(page.getByText('15.01.2030')).toBeVisible();
		await expect(page.getByText('0,75')).toBeVisible();
		await expect(page.getByText('Erste Zeile')).toBeVisible();
		await expect(page.getByText('Zweite Zeile')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Aufgaben' })).toHaveAttribute('aria-selected', 'true');
	});

	// AK2/TF2: Unbekannte ID → Zustand „nicht gefunden" an Ort und Stelle (kein Redirect, kein
	// Formular), mit Link zurück zu den Aufgaben.
	test('AK2: unbekannte ID zeigt „nicht gefunden" ohne Weiterleitung', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-gone');
		await createViewTask(page, uniqueTitle('Hintergrund'));
		await page.goto('/app/aufgaben/999999');

		await expect(page.getByText('Diese Aufgabe gibt es nicht mehr.')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Zu den Aufgaben' })).toBeVisible();
		await expect(page).toHaveURL(/\/app\/aufgaben\/999999$/);
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
	});

	// AK3/TF3: „Bearbeiten" öffnet das vorhandene TaskFormModal mit der Aufgabe; „Zurück" führt
	// zur vorherigen Hauptansicht — ohne Vorgänger (Kaltstart) auf den Fallback `/`.
	test('AK3: Bearbeiten öffnet TaskFormModal, Zurück fällt auf / zurück', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-edit');
		const title = uniqueTitle('Bearbeiten');
		const id = await createViewTask(page, title);

		await page.goto(`/app/aufgaben/${id}`);
		await page.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: `Aufgabe bearbeiten: ${title}` })).toBeVisible();

		// Test-Pflege #2938: Der native TaskForm-Dialog liegt im Top-Layer und fängt Pointer-Events
		// ab — ein Klick auf "Zurück" hinter dem offenen Dialog ist browserseitig unmöglich
		// (document.elementsFromPoint an der Button-Position liefert kol-dialog). Der Nutzer
		// schließt den Dialog zuerst (Escape, Modal-Vertrag), dann erst geht es zurück.
		await page.keyboard.press('Escape');
		await expect(page.getByRole('heading', { name: `Aufgabe bearbeiten: ${title}` })).toBeHidden();

		await page.getByRole('button', { name: 'Zurück' }).click();
		await expect(page).toHaveURL(/\/app\/?$/);
	});

	// AK5/TF5: Ab 48rem zwei Spalten (Inhalt links, Faktenspalte rechts — x-Versatz), darunter
	// eine Spalte (untereinander, y-Versatz).
	test('AK5: zwei Spalten ab 48rem, eine Spalte bei 375 px', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2938-cols');
		const id = await createViewTask(page, uniqueTitle('Spalten'));

		await page.setViewportSize({ width: 1024, height: 800 });
		await page.goto(`/app/aufgaben/${id}`);
		const contentBox = await page.locator('.task-view-content').boundingBox();
		const factsBox = await page.locator('.task-view-facts').boundingBox();
		expect(contentBox).not.toBeNull();
		expect(factsBox).not.toBeNull();
		expect(factsBox!.x).toBeGreaterThanOrEqual(contentBox!.x + contentBox!.width);

		await page.setViewportSize({ width: 375, height: 812 });
		const stackedContent = await page.locator('.task-view-content').boundingBox();
		const stackedFacts = await page.locator('.task-view-facts').boundingBox();
		expect(stackedContent).not.toBeNull();
		expect(stackedFacts).not.toBeNull();
		expect(stackedFacts!.y).toBeGreaterThanOrEqual(stackedContent!.y + stackedContent!.height);
	});

	// ── #2939: Handeln in der Ansicht ──────────────────────────────────────────────

	// Aufgabe mit Checkliste anlegen (Ids als UUIDs — validateChecklist lehnt anderes still
	// mit 400 ab, Memory 2026-10-13).
	const createChecklistTask = async (page: Page, title: string): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				priority: 4,
				checklist: [
					{ id: crypto.randomUUID(), title: 'Quellen sichten', completed: true },
					{ id: crypto.randomUUID(), title: 'Entwurf schreiben', completed: false },
					{ id: crypto.randomUUID(), title: 'Freigabe holen', completed: false },
				],
			},
		});
		expect(response.ok(), 'Setup: Task-Anlage muss 2xx liefern').toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	// AK1 (#2939): Punkt abhaken → Zähler „1 von 3“ → „2 von 3“; nach Reload bleiben Haken
	// und Zähler (PATCH mit kompletter Checkliste persistiert, GET /tasks/:id spiegelt sie).
	test('AK1: Checklistenpunkt abhaken persistiert über Reload', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2939-checklist');
		const id = await createChecklistTask(page, uniqueTitle('Checkliste'));

		await page.goto(`/app/aufgaben/${id}`);
		await expect(page.getByText('1 von 3')).toBeVisible();
		await page.getByRole('checkbox', { name: 'Entwurf schreiben' }).click();
		await expect(page.getByText('2 von 3')).toBeVisible();

		await page.reload();
		await expect(page.getByText('2 von 3')).toBeVisible();
		await expect(page.getByRole('checkbox', { name: 'Entwurf schreiben' })).toBeChecked();
		const task = (await (await page.request.get(`/api/v1/tasks/${id}`)).json()) as {
			checklist: { title: string; completed: boolean }[];
		};
		expect(task.checklist.find((item) => item.title === 'Entwurf schreiben')?.completed).toBe(true);
		expect(task.checklist.find((item) => item.title === 'Freigabe holen')?.completed).toBe(false);
	});

	// AK2 (#2939): offene direkte Unteraufgabe (per API als Abhängigkeit verdrahtet) sperrt
	// „Erledigt“ und zeigt den Grund dauerhaft als Text.
	test('AK2: offene Unteraufgabe sperrt „Erledigt“ mit sichtbarem Grund', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2939-block');
		const parentId = await createViewTask(page, uniqueTitle('Elternaufgabe'));
		const childId = await createViewTask(page, uniqueTitle('Offene Sub'));
		const linked = await page.request.post(`/api/v1/tasks/${parentId}/dependencies`, {
			data: { dependingTaskId: childId },
		});
		expect(linked.ok(), 'Setup: Unteraufgaben-Verdrahtung muss 2xx liefern').toBeTruthy();

		await page.goto(`/app/aufgaben/${parentId}`);
		const done = page.getByRole('button', { name: 'Erledigt' });
		await expect(done).toBeVisible();
		await expect(done).toBeDisabled();
		await expect(page.getByText(/offene Unteraufgabe/)).toBeVisible();
	});

	// AK3 (#2939): „Erledigt“ → erledigt-Zustand (Status-Badge + „Wieder öffnen“), „Wieder
	// öffnen“ → offen mit `completedAt null`; Primäraktion sticky unten bei 375×812 ohne
	// Scroll sichtbar (Unterkante im Viewport).
	test('AK3: Erledigt/Wieder öffnen wechselt den Status, Primäraktion bleibt sticky sichtbar', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2939-done');
		const id = await createViewTask(page, uniqueTitle('Zyklus'));

		await page.goto(`/app/aufgaben/${id}`);
		const done = page.getByRole('button', { name: 'Erledigt' });
		await expect(done).toBeVisible();
		// boundingBox misst einmalig und kann nach Re-Render null liefern (Memory 2026-09-14)
		// → kurz nachmessen, bevor die Sticky-Assertion fällt.
		let box = await done.boundingBox();
		for (let i = 0; i < 30 && !box; i += 1) {
			await page.waitForTimeout(100);
			box = await done.boundingBox();
		}
		expect(box).not.toBeNull();
		expect(box!.y + box!.height).toBeLessThanOrEqual(812);

		await done.click();
		await expect(page.getByText('Erledigt', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Erledigt' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Wieder öffnen' }).click();
		await expect(page.getByText('Offen', { exact: true })).toBeVisible();

		const task = (await (await page.request.get(`/api/v1/tasks/${id}`)).json()) as {
			status: string;
			completedAt: string | null;
		};
		expect(task.status).toBe('Open');
		expect(task.completedAt).toBeNull();
	});

	// AK3 (#2939): archivierte Aufgabe (per API archiviert) zeigt „Archiviert“-Banner plus
	// „Wiederherstellen“; der Klick stellt die Aufgabe wieder her (archivedAt null).
	test('AK3: archivierte Aufgabe zeigt Banner, Wiederherstellen stellt sie wieder her', async ({ page }) => {
		await registerOwnSession(page, 'taskview-2939-archive');
		const id = await createViewTask(page, uniqueTitle('Archiv'));
		const archived = await page.request.post(`/api/v1/tasks/${id}/archive`);
		expect(archived.ok(), 'Setup: Archivierung muss 2xx liefern').toBeTruthy();

		await page.goto(`/app/aufgaben/${id}`);
		await expect(page.getByText('Archiviert')).toBeVisible();
		const restore = page.getByRole('button', { name: 'Wiederherstellen' });
		await expect(restore).toBeVisible();
		await restore.click();
		await expect(page.getByText('Archiviert')).toBeHidden();

		const task = (await (await page.request.get(`/api/v1/tasks/${id}`)).json()) as {
			archivedAt: string | null;
		};
		expect(task.archivedAt).toBeNull();
	});
});
