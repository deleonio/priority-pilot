import { expect, test } from './fixtures';
import { MOBILE, openAvatarMenu, waitForStableView } from './helpers';
import { onboardingDismissKey } from '../src/lib/onboardingPreferences';

/**
 * ROTE Spec-Tests für #2723 „Hilfe und Abmelden in ein Avatar-Popover-Menü verschieben"
 * (Stufe 1 TDD, der einklagbare Vertrag; Spec: docs/spec/issue-2723.md).
 *
 * Die Toolbar „Kopf-Aktionen" zeigt nur noch die vier Navigations-Aktionen („Zum Dashboard",
 * „Suche", „Neuen Task anlegen", „Einstellungen"); „Hilfe" und „Abmelden" liegen hinter einem
 * Avatar-Trigger (KolPopoverButton mit zugänglichem Namen „Benutzermenü"), der Escape,
 * Klick-außerhalb und Fokus-Führung an KoliBri abgibt (#361-Muster, TaskTree).
 *
 * Diese Tests sind rot, bis App.tsx den Trigger samt Popover umsetzt. Sie prüfen reines
 * UI-Verhalten gegen das echte Backend (Muster header-toolbar.spec.ts).
 */
test.describe('#2723 Avatar-Popover (Benutzermenü)', () => {
	test.beforeEach(async ({ page, ownSessionUser }) => {
		// Test-Pflege (#2580-Muster, issue-1622): Onboarding vorab als beendet markieren. Der
		// Fixture-Dismiss des Willkommens-Dialogs klaut sonst über `body.focus()` plus modale
		// Inert-Phase genau im Tastatur-Test (AK5) den Fokus vom Trigger — Rennsituation der
		// Dialog-Fokuskette, kein App-Verhalten.
		if (ownSessionUser) {
			await page.addInitScript(
				(entry: { key: string; value: string }) => {
					try {
						localStorage.setItem(entry.key, entry.value);
					} catch {
						/* ignore */
					}
				},
				{ key: onboardingDismissKey(ownSessionUser.id), value: 'true' },
			);
		}
	});
	test('AK1: Klick auf den Avatar-Trigger öffnet ein Popover mit „Hilfe" und „Abmelden"', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const trigger = await openAvatarMenu(page);
		await expect(trigger, 'Trigger zeigt Öffnungszustand über aria-expanded').toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('button', { name: 'Hilfe' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
	});

	test('AK2: Toolbar „Kopf-Aktionen" enthält „Hilfe"/„Abmelden" nicht mehr; vier Buttons unversehrt', async ({
		page,
	}) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar.getByRole('button', { name: 'Hilfe' })).toHaveCount(0);
		await expect(toolbar.getByRole('button', { name: 'Abmelden' })).toHaveCount(0);

		// Die vier verbleibenden Toolbar-Buttons bleiben sichtbar und bedienbar.
		for (const label of ['Zum Dashboard', 'Suche', 'Neuen Task anlegen', 'Einstellungen'] as const) {
			const button = toolbar.getByRole('button', { name: label });
			await expect(button, `„${label}" bleibt in der Toolbar`).toBeVisible();
			await expect(button).toBeEnabled();
		}
	});

	test('AK3: Toolbar ist bei 375px schlanker — genau vier Items, kein horizontaler Overflow', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await page.goto('/app/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		// Item-Anzahl-Regression: vier statt bisher sechs Toolbar-Buttons.
		await expect(toolbar.getByRole('button')).toHaveCount(4);

		// Messbare Schmalheit: die Toolbar bleibt innerhalb des 375px-Viewports.
		const box = await toolbar.boundingBox();
		expect(box, 'Toolbar muss messbar sein').not.toBeNull();
		expect(box!.width, 'Toolbar bleibt innerhalb des 375px-Viewports').toBeLessThanOrEqual(page.viewportSize()!.width);
	});

	test('AK5: Tastatur — Enter öffnet, Hilfe vor Abmelden (vertikale Toolbar, Pfeiltasten), Escape schließt mit Fokus-Rückkehr, Klick außerhalb schließt', async ({
		page,
	}) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const trigger = page.locator('.app-header__user button').first();
		await expect(trigger, 'Trigger trägt zugänglichen Namen („Benutzermenü")').toHaveAccessibleName(/menü|menu/i);

		await trigger.focus();
		await page.keyboard.press('Enter');
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');

		// Reihenfolge im Popover: erst „Hilfe", dann „Abmelden" (UX-Block #2723). Die Einträge bilden
		// eine vertikale Toolbar — Tab springt hinein, Pfeil runter wechselt (Roving Tabindex).
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Hilfe' })).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(page.getByRole('button', { name: 'Abmelden' })).toBeFocused();

		// Escape schließt und gibt den Fokus an den Trigger zurück (#361-Muster).
		await page.keyboard.press('Escape');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(trigger, 'Fokus-Rückkehr auf den Trigger').toBeFocused();

		// Klick außerhalb schließt ebenfalls.
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		await page.mouse.click(10, 400);
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});

	test('AK6: Bei 375px bleibt der Avatar-Trigger erreichbar und misst mindestens 44×44px', async ({ page }) => {
		await page.setViewportSize(MOBILE);
		await page.goto('/app/');
		await waitForStableView(page);

		const trigger = page.locator('.app-header__user button').first();
		await expect(trigger).toBeVisible();

		const box = await trigger.boundingBox();
		expect(box, 'Trigger muss messbar sein').not.toBeNull();
		expect(box!.width, 'Trigger-Breite (Touch-Target)').toBeGreaterThanOrEqual(44);
		expect(box!.height, 'Trigger-Höhe (Touch-Target)').toBeGreaterThanOrEqual(44);
	});
});
