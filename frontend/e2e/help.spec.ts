import { expect, test } from './fixtures';
import { headerAction, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #256 „Nutzerhandbuch: In-App-Hilfe-Seite mit Markdown-Renderer und
 * Header-Button" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets: Die App bekommt eine In-App-Hilfe. In der Header-Toolbar erscheint ein
 * Icon-Only-Button (kein sichtbares Label, aber sprechender Tooltip/aria-label „Hilfe"). Ein Klick
 * navigiert zur neuen Route `/hilfe`, auf der ein aus Markdown gerenderter Handbuch-Inhalt
 * (Überschriften, Listen) angezeigt wird. Von dort führt ein Zurück-Button zurück in die Haupt-App.
 * Die Seite ist Mobile-First (kein horizontales Scrollen bei 375 px).
 *
 * Diese Tests sind bewusst **rot**, bis der Produktivcode existiert: Der Hilfe-Button in der Toolbar,
 * die Route `/hilfe`, der Markdown-Renderer und der Zurück-Button fehlen aktuell. Die Tests navigieren
 * deshalb über `page.goto('/')` und den Button-Klick — NICHT direkt via `page.goto('/hilfe')`, weil die
 * Route noch nicht existiert.
 *
 * Sie prüfen reines UI-Verhalten gegen das echte Backend (kein API-Mock, wie in `crud.spec.ts`);
 * `/auth/me` wird durch die Fixture authentifiziert, damit die Auth-Gate durchlässig ist.
 */
test.describe('#256 In-App-Hilfe – Seite, Markdown-Renderer und Header-Button', () => {
	/**
	 * AK1 — Icon-Only-Hilfe-Button in der Header-Toolbar: Ein Button mit sprechendem Namen (Tooltip /
	 * aria-label „Hilfe") ist sichtbar. KoliBri stellt Icon-Only-Buttons mit einem `_label` als
	 * zugänglichen Namen bereit, deshalb findet `getByRole('button', { name: /hilfe/i })` ihn auch
	 * ohne sichtbaren Text.
	 */
	test('AK1: Header-Toolbar zeigt einen Icon-Only-Hilfe-Button (Tooltip vorhanden)', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await expect(page.getByRole('button', { name: /hilfe/i })).toBeVisible();
	});

	/**
	 * AK2 — Navigation zur Hilfe-Seite + Markdown-Rendering: Klick auf den Hilfe-Button navigiert zu
	 * `/hilfe`; der aus Markdown gerenderte Inhalt ist sichtbar (mindestens eine Überschrift `h1`/`h2`).
	 */
	test('AK2: Klick auf Hilfe-Button navigiert zu /hilfe und rendert Markdown-Inhalt', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /hilfe/i }).click();

		// URL muss auf die neue Hilfe-Route wechseln.
		await expect(page).toHaveURL(/\/hilfe/);

		// Der Markdown-Renderer muss mindestens eine Überschrift erzeugt haben (h1 oder h2 sichtbar).
		await expect(page.locator('h1, h2').first()).toBeVisible();
		// Und mindestens ein Listen-Element (Markdown-Listen werden gerendert).
		await expect(page.locator('li').first()).toBeVisible();
	});

	/**
	 * AK4 — Mobile-First: Auf einem 375-px-Viewport erzeugt die Hilfe-Seite kein horizontales Scrollen
	 * (`document.body.scrollWidth <= window.innerWidth`).
	 */
	test('AK4: Hilfe-Seite auf 375 px erzeugt kein horizontales Scrollen', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		// Auf 375px liegt „Hilfe" im „⋮"-Menü der Kopf-Aktionen (der Header bleibt dadurch einzeilig);
		// `headerAction` kapselt, wo der Button je nach Breite steht.
		await (await headerAction(page, /hilfe/i)).click();
		await expect(page).toHaveURL(/\/hilfe/);

		// Warten, bis der Markdown-Inhalt gerendert ist, damit die Breite valide gemessen wird.
		await expect(page.locator('h1, h2').first()).toBeVisible();

		const hasNoHorizontalOverflow = await page.evaluate(() => document.body.scrollWidth <= window.innerWidth);
		expect(hasNoHorizontalOverflow).toBe(true);
	});
});

/**
 * ROTE Spec-Tests für #1320 „Einstellungen und Hilfe als normale Seite statt
 * Fullscreen-Overlay mit Zurück-Button" (Spec `docs/spec/issue-1320.md`).
 *
 * Der bisherige AK3-Test oben („Zurück-Button auf der Hilfe-Seite führt zurück zur
 * Haupt-App") wurde entfernt — er widerspricht dem AK3 unten (kein „Zurück"-Button mehr)
 * und ist durch den AK4/AK5-Test in `settings-page.spec.ts` sinngemäß ersetzt
 * (Test-Pflege-Bedarf, PR-Body).
 */
test.describe('#1320 Hilfe als normale Seite mit sichtbarem Header', () => {
	/** AK2 — Header (Banner, Toolbar) bleibt auf /hilfe sichtbar. */
	test('AK2: Header mit Banner und Toolbar ist auf /hilfe sichtbar', async ({ page }) => {
		await page.goto('/hilfe');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('toolbar', { name: /Kopf-Aktionen/ })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Handbuch', exact: true })).toBeVisible();
	});

	/** AK3 — Kein Button mit dem zugänglichen Namen „Zurück" existiert mehr. */
	test('AK3: Kein „Zurück"-Button auf /hilfe', async ({ page }) => {
		await page.goto('/hilfe');
		await waitForStableView(page, 'Priority Pilot');

		await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toHaveCount(0);
	});

	// AK4 (Direktwechsel Hilfe → Einstellungen) ist in header-toolbar.spec.ts abgedeckt (Dedup).

	/** AK8 — Mobile-First (375px): Header und Seiteninhalt liegen vollständig im Viewport. */
	test('AK8: 375px — Header und Seiteninhalt ohne horizontale Überlagerung', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/hilfe');
		await waitForStableView(page, 'Priority Pilot');

		const header = page.getByRole('banner');
		await expect(header).toBeVisible();
		const headerBox = await header.boundingBox();
		expect(headerBox, 'Header rendert messbar').not.toBeNull();
		expect(headerBox!.x + headerBox!.width, 'Header endet im Viewport').toBeLessThanOrEqual(375 + 1);

		const content = page.getByRole('tab', { name: 'Handbuch', exact: true });
		await expect(content).toBeVisible();
		const contentBox = await content.boundingBox();
		expect(contentBox, 'Seiteninhalt rendert messbar').not.toBeNull();
		expect(contentBox!.x + contentBox!.width, 'Seiteninhalt endet im Viewport').toBeLessThanOrEqual(375 + 1);
	});
});
