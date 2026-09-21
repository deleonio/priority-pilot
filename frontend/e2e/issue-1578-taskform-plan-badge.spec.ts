import { expect, test, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-E2E für #1578 (docs/spec/issue-1578.md AK1–AK5) — Paket-Hinweis (`PlanBadge`) und
 * Lektorat-Button verengen/schneiden die Titel-/Beschreibungsfelder bei 375px ab, weil der
 * Feld-Wrapper `minWidth: 0` trägt (`TaskForm.tsx:1002`/`1366`) und damit nie umbricht.
 *
 * Läuft gegen das echte Backend (Muster `issue-1484-plan-badges.spec.ts`): eine frische Session
 * liegt auf Paket `free`; ein eigener Custom-LLM-Provider hebt das KI-Gate (`aiEnabled`), ohne die
 * `ai_assist`-Berechtigung selbst zu ändern — der Paket-Hinweis bleibt damit sichtbar (Free ohne
 * `ai_assist`), genau der Zustand, den AK1–AK5 prüfen.
 *
 * Test-Pflege (#1573, siehe PR-Body): `POST /auth/test-login` sät keine Säulen mehr — nur die
 * echte Registrierung tut das, `POST /pillars` ist seit #1573 gesperrt (403). Login/Pillar-Setup
 * folgen daher dem in `ai-disable.spec.ts` etablierten Muster (`registerOwnSession` + lauter Guard).
 */

const login = async (page: Page): Promise<void> => {
	await registerOwnSession(page, 'plan-badge-1578');
	// Muster issue-1484-plan-badges.spec.ts:30-36: der Fixture-/auth/me-Mock liefert kein
	// Entitlement, `PlanBadge` rendert dann bewusst `null` — die echte Serverantwort wird gebraucht.
	await page.unroute('**/auth/me');
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	if (!response.ok()) return;
	for (const task of (await response.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const deleteAllPillars = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/pillars');
	if (!res.ok()) return;
	for (const pillar of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/pillars/${pillar.id}`);
	}
};

/**
 * AK5 braucht eine bestehende Säule, sonst rendert `.pillar-editor-head` gar nicht. Seit #1573 ist
 * `POST /pillars` gesperrt (403) — `registerOwnSession` garantiert die fünf Standard-Säulen bereits,
 * dies bleibt ein lauter Guard (Muster `ai-disable.spec.ts`).
 */
const ensurePillar = async (page: Page): Promise<void> => {
	const existing = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
	expect(existing.length, 'Test-Nutzer braucht Standard-Säulen (register-Seeding)').toBeGreaterThan(0);
};

/** Hebt `aiEnabled` ohne die `ai_assist`-Berechtigung zu ändern (Muster issue-1484). */
const createCustomProvider = async (page: Page): Promise<void> => {
	const response = await page.request.post('/api/v1/llm-providers', {
		data: {
			name: 'Layout-Test-Provider',
			endpoint: 'http://localhost:9/v1',
			apiKey: 'test-key',
			model: 'test-model',
		},
	});
	expect(response.ok(), 'Custom-LLM-Provider muss serverseitig anlegbar sein').toBe(true);
};

const deleteAllCustomProviders = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/llm-providers');
	if (!res.ok()) return;
	for (const provider of (await res.json()) as { id: number; kind: 'custom' | 'builtin' }[]) {
		if (provider.kind === 'custom') {
			await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
		}
	}
};

/** `boundingBox()` misst einmalig ohne Nachwarten — bis zum Layout nachmessen (MEMORY 2026-09-14). */
const boundingBoxWhenLaidOut = async (locator: ReturnType<Page['locator']>) => {
	for (let attempt = 0; attempt < 30; attempt++) {
		const box = await locator.boundingBox();
		if (box !== null) return box;
		await locator.page().waitForTimeout(100);
	}
	return null;
};

const openCreateForm = async (page: Page): Promise<void> => {
	await page.goto('/aufgaben');
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	// Custom-Provider macht aiEnabled true → „Neuen Task anlegen" öffnet den Freitext-Dialog
	// (QuickCaptureModal, #1335) statt direkt das Formular; „Überspringen" führt ins leere Formular.
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
	await waitForStableView(page);
};

const createTaskViaUi = async (page: Page, title: string): Promise<void> => {
	await page.getByRole('textbox', { name: 'Titel' }).fill(title);
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeHidden();
};

/** Öffnet das Bearbeiten-Formular der ersten Aufgabe in der Liste (Muster crud.spec.ts). */
const openEditForm = async (page: Page): Promise<void> => {
	await page.getByRole('tab', { name: 'Aufgaben', exact: true }).click();
	await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
	await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
	await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeVisible();
	await waitForStableView(page);
};

test.describe('Priority Pilot — #1578: Paket-Hinweise verengen/schneiden Formularfelder nicht mehr ab', () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
		await createCustomProvider(page);
		await ensurePillar(page);
	});

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllPillars(page);
		await deleteAllCustomProviders(page);
	});

	// AK1/AK2/AK3/AK5: Anlegen-Formular bei 375px.
	test('AK1/AK2/AK3/AK5 — 375px, Anlegen: Titelfeld ≥ 90 % Zeilenbreite, alles im Viewport, Umbruch unter das Feld', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openCreateForm(page);

		const titleRow = page.locator('[data-testid="task-title"]').locator('xpath=..');
		const titleField = page.getByTestId('task-title');
		const badge = page.getByTestId('plan-badge-ai_assist').first();
		const lektoratButton = page.getByRole('button', { name: 'Titel lektorieren' });

		await expect(titleField).toBeVisible();
		await expect(badge).toBeVisible();

		const rowBox = await boundingBoxWhenLaidOut(titleRow);
		const fieldBox = await boundingBoxWhenLaidOut(titleField);
		const badgeBox = await boundingBoxWhenLaidOut(badge);
		const buttonBox = await boundingBoxWhenLaidOut(lektoratButton);
		expect(rowBox, 'Zeilencontainer muss eine Bounding-Box haben').not.toBeNull();
		expect(fieldBox, 'Titelfeld muss eine Bounding-Box haben').not.toBeNull();
		expect(badgeBox, 'Paket-Hinweis muss eine Bounding-Box haben').not.toBeNull();
		expect(buttonBox, 'Lektorat-Button muss eine Bounding-Box haben').not.toBeNull();

		// AK1: Titelfeld mindestens 90 % der Innenbreite des Zeilencontainers.
		expect(fieldBox!.width).toBeGreaterThanOrEqual(rowBox!.width * 0.9);

		// AK2: alle vier Elemente vollständig im 375px-Viewport.
		for (const box of [fieldBox, badgeBox, buttonBox]) {
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		}

		// AK3: Paket-Hinweis unterhalb der Unterkante des Titelfelds (eigene Zeile).
		expect(badgeBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height);

		// AK5: Säulen-Kopfzeile läuft nicht über.
		await openAccordionSection(page, 'Optional');
		const pillarBadge = page.locator('.pillar-editor-head').getByTestId('plan-badge-ai_assist').first();
		const pillarButton = page.locator('.pillar-editor-head').getByRole('button', { name: /Säulen vorschlagen/ });
		const pillarBadgeBox = await boundingBoxWhenLaidOut(pillarBadge);
		const pillarButtonBox = await boundingBoxWhenLaidOut(pillarButton);
		expect(pillarBadgeBox, 'Säulen-Paket-Hinweis muss eine Bounding-Box haben').not.toBeNull();
		expect(pillarButtonBox, '„Säulen vorschlagen" muss eine Bounding-Box haben').not.toBeNull();
		expect(pillarBadgeBox!.x + pillarBadgeBox!.width).toBeLessThanOrEqual(375 + 1);
		expect(pillarButtonBox!.x + pillarButtonBox!.width).toBeLessThanOrEqual(375 + 1);
	});

	// AK1/AK2/AK3: Beschreibungsfeld bei 375px, Anlegen — dieselben Prüfungen wie oben, andere Feldstelle.
	test('AK1/AK2/AK3 — 375px, Anlegen: Beschreibungsfeld ≥ 90 % Zeilenbreite, alles im Viewport, Umbruch unter das Feld', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openCreateForm(page);
		await openAccordionSection(page, 'Optional');

		const descriptionRow = page.locator('[data-testid="task-description"]').locator('xpath=..');
		const descriptionField = page.getByTestId('task-description');
		// #1604-Fixup: nicht mehr per globalem `nth(1)` — seit der Säulen-Verteilung (#1596) liegt
		// deren eigenes Badge im DOM zwischen Titel- und Beschreibungs-Badge, das globale Zählen bricht.
		// Auf die Beschreibungs-Zeile scopen (Muster: AK5 scoped analog auf `.pillar-editor-head`).
		const badge = descriptionRow.getByTestId('plan-badge-ai_assist');
		const lektoratButton = page.getByRole('button', { name: 'Beschreibung lektorieren' });

		await expect(descriptionField).toBeVisible();
		await expect(badge).toBeVisible();

		const rowBox = await boundingBoxWhenLaidOut(descriptionRow);
		const fieldBox = await boundingBoxWhenLaidOut(descriptionField);
		const badgeBox = await boundingBoxWhenLaidOut(badge);
		const buttonBox = await boundingBoxWhenLaidOut(lektoratButton);
		expect(rowBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		expect(badgeBox).not.toBeNull();
		expect(buttonBox).not.toBeNull();

		expect(fieldBox!.width).toBeGreaterThanOrEqual(rowBox!.width * 0.9);
		for (const box of [fieldBox, badgeBox, buttonBox]) {
			expect(box!.x).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
		}
		expect(badgeBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height);
	});

	// AK1/AK2/AK3: dieselben Prüfungen im Bearbeiten-Formular (Titelfeld genügt, Ursache ist
	// komponentenweit identisch — Wiederholung für Beschreibung wäre keine zusätzliche Naht).
	test('AK1/AK2/AK3 — 375px, Bearbeiten: Titelfeld ≥ 90 % Zeilenbreite, alles im Viewport, Umbruch unter das Feld', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openCreateForm(page);
		await createTaskViaUi(page, 'E2E #1578 Bearbeiten-Task');
		await openEditForm(page);

		await page.setViewportSize({ width: 375, height: 812 });
		await waitForStableView(page);

		const titleRow = page.locator('[data-testid="task-title"]').locator('xpath=..');
		const titleField = page.getByTestId('task-title');
		const badge = page.getByTestId('plan-badge-ai_assist').first();

		await expect(titleField).toBeVisible();
		await expect(badge).toBeVisible();

		const rowBox = await boundingBoxWhenLaidOut(titleRow);
		const fieldBox = await boundingBoxWhenLaidOut(titleField);
		const badgeBox = await boundingBoxWhenLaidOut(badge);
		expect(rowBox).not.toBeNull();
		expect(fieldBox).not.toBeNull();
		expect(badgeBox).not.toBeNull();

		expect(fieldBox!.width).toBeGreaterThanOrEqual(rowBox!.width * 0.9);
		expect(fieldBox!.x).toBeGreaterThanOrEqual(0);
		expect(fieldBox!.x + fieldBox!.width).toBeLessThanOrEqual(375 + 1);
		expect(badgeBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height);
	});

	// AK4: 1280px — Paket-Hinweis und Lektorat-Button bleiben auf derselben Zeile wie das Feld.
	test('AK4 — 1280px: Paket-Hinweis und Lektorat-Button stehen weiterhin einzeilig neben dem Titelfeld', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await openCreateForm(page);

		const titleField = page.getByTestId('task-title');
		const badge = page.getByTestId('plan-badge-ai_assist').first();

		await expect(titleField).toBeVisible();
		await expect(badge).toBeVisible();

		const fieldBox = await boundingBoxWhenLaidOut(titleField);
		const badgeBox = await boundingBoxWhenLaidOut(badge);
		expect(fieldBox).not.toBeNull();
		expect(badgeBox).not.toBeNull();

		// Oberkante des Hinweises oberhalb der Unterkante des Felds → dieselbe Zeile.
		expect(badgeBox!.y).toBeLessThan(fieldBox!.y + fieldBox!.height);
	});
});
