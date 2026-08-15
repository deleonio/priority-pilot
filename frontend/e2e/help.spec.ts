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
	 * AK3 — Zurück-Button: Auf der Hilfe-Seite gibt es einen Zurück-Button; ein Klick führt zurück in
	 * die Haupt-App, die URL ist danach nicht mehr `/hilfe`.
	 */
	test('AK3: Zurück-Button auf der Hilfe-Seite führt zurück zur Haupt-App', async ({ page }) => {
		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /hilfe/i }).click();
		await expect(page).toHaveURL(/\/hilfe/);

		// Zurück-Button (Link/Button mit sprechendem Namen) klicken.
		await page.getByRole('button', { name: /zurück/i }).click();

		// Die URL darf danach nicht mehr auf der Hilfe-Route liegen.
		await expect(page).not.toHaveURL(/\/hilfe/);
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
