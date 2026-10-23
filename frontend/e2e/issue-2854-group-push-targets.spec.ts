import { expect, test } from './fixtures';
import { accordionTrigger, isAccordionOpen, waitForStableView } from './helpers';

/**
 * E2E-Spec für #2854 (docs/spec/issue-2854.md, AK7): `/settings/gruppen#gruppe-<id>` klappt die
 * Gruppe auf und springt zu ihrem Listen-Element — Fokus aufs Anker-Ziel, EIN `scrollIntoView`
 * ohne Animation, danach entfernt `history.replaceState` den Anker (Muster
 * `abo-rechnungen-anchor.spec.ts` #2852). Geprüft bei 375 px (Mobile-First).
 *
 * Rot-Zustand: `id="gruppe-<id>"` existiert noch nicht — der Sprung versackt (Gruppe bleibt zu,
 * Fokus fehlt).
 */

test.describe('Gruppen-Anker für Push-Ziele (#2854 AK7)', () => {
	test('AK7: /settings/gruppen#gruppe-<id> öffnet die Gruppe aufgeklappt und springt hin (375 px)', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		// Eine offene Aufgabe hält die App im Normalzustand statt im Onboarding (Muster #2852).
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #2854 Anker-Task', priority: 2 } });

		const created = await page.request.post('/api/v1/groups', { data: { name: 'E2E 2854 Ankergruppe' } });
		expect(created.ok(), 'Setup: Gruppe muss anlegbar sein').toBe(true);
		const group = (await created.json()) as { id: number };

		try {
			await page.goto(`/app/settings/gruppen#gruppe-${group.id}`);
			await waitForStableView(page, 'Gruppen');

			// Anker-Element existiert, ist sichtbar und trägt den Fokus.
			const ziel = page.locator(`li#gruppe-${group.id}`);
			await expect(ziel).toBeVisible();
			await expect(ziel).toBeFocused();

			// Der Anker klappt die Gruppe auf (Inhalte sichtbar, #2848-Muster).
			const trigger = accordionTrigger(page, 'E2E 2854 Ankergruppe');
			await expect(trigger).toBeVisible();
			expect(await isAccordionOpen(trigger), 'Anker muss die Gruppe aufklappen').toBe(true);

			// Sektionsanfang im sichtbaren Bereich (nicht unter dem Sticky-Header geclippt).
			const box = (await ziel.boundingBox()) as { x: number; y: number; width: number; height: number };
			expect(box.y).toBeGreaterThanOrEqual(0);
			expect(box.y).toBeLessThan(812);

			// Anker danach aus der Adresse entfernt (history.replaceState).
			await expect(page).not.toHaveURL(/#gruppe-/);
		} finally {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});
});
