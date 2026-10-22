import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #2852 (docs/spec/issue-2852.md, AK7): `/settings/pakete#rechnungen` aktiviert den
 * Pakete-Tab, klappt das Rechnungen-`KolDetails` auf und springt zur Sektion — Fokus aufs
 * Anker-Ziel, EIN `scrollIntoView` ohne Animation, danach entfernt `history.replaceState` den
 * Anker (Muster `push-anchor.spec.ts` #2848). Geprüft bei 375 px (Mobile-First).
 *
 * Rot-Zustand: `id="rechnungen"` existiert noch nicht — der Sprung versackt (KolDetails bleibt zu,
 * Fokus fehlt). Kein Seed nötig: die Rechnungen-Sektion rendert auch im abo-losen Zustand
 * (`invoices-empty`, `SubscriptionSection.tsx`).
 */

test.describe('Rechnungen-Anker auf dem Pakete-Tab (#2852 AK7)', () => {
	test('AK7: /settings/pakete#rechnungen öffnet Pakete-Tab + Rechnungen und springt hin (375 px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		// Eine offene Aufgabe hält die App im Normalzustand statt im Onboarding (Muster push-anchor).
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #2852 Anker-Task', priority: 2 } });

		await page.goto('/app/settings/pakete#rechnungen');
		// Ready-Text „Pakete" (Artikel-Heading des Pakete-Tabs) — das Default „Dashboard" steht nur
		// auf der Hauptansicht, nicht in den Einstellungen.
		await waitForStableView(page, 'Pakete');

		// Anker-Sektion existiert, ist sichtbar (KolDetails aufgeklappt) und trägt den Fokus.
		const ziel = page.locator('#rechnungen');
		await expect(ziel).toBeVisible();
		await expect(ziel).toBeFocused();

		// Rechnungen-Inhalte sind aufgeklappt sichtbar (KolDetails._open durch den Anker).
		await expect(page.getByTestId('billing-invoices')).toBeVisible();

		// Sektionenanfang im sichtbaren Bereich (nicht unter dem Sticky-Header geclippt).
		const box = (await ziel.boundingBox()) as { x: number; y: number; width: number; height: number };
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(812);

		// Anker danach aus der Adresse entfernt (history.replaceState).
		await expect(page).not.toHaveURL(/#rechnungen/);
	});
});
