import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Dunkelmodus-Lesbarkeit der Dashboard-Panels (UX-Audit 2026-08, Finding P1-1).
 *
 * Warum dieser Test existiert: Die Panels „Nächste Aufgabe" und „Was ist jetzt dran?" liegen im
 * Shadow-DOM-Umfeld von KoliBri (KolTabs/KolCard), das seine Textfarbe unabhängig vom
 * `data-theme`-Attribut auf Schwarz setzt. Wer nur den Hintergrund auf ein `--pp-*`-Token zieht,
 * bekommt im Dunkelmodus schwarz auf dunkelgrau — gemessene **1.34:1** statt geforderter 4.5:1
 * (BITV/WCAG 1.4.3). Der Fehler ist rein visuell: kein Test schlug an, die App „funktionierte".
 *
 * Genau der Fall, den die TDD-Strategie als „stiller Ausfall" zum Testen freigibt — deshalb wird
 * hier der **gemessene Kontrast** ausgewertet, nicht ein Farbwert festgeschrieben (eine
 * Palettenänderung darf den Test nicht rot machen, eine Regression der Lesbarkeit schon).
 *
 * Viewport 375×812 nach Mobile-First-Konvention (.ai-knowledge/conventions.md).
 *
 * Pattern: public/docs/e2e-a11y-pattern.md — AxeBuilder mit KoliBri Shadow DOM
 */

test.describe('Dunkelmodus – Lesbarkeit der Dashboard-Panels', () => {
	test('Panels mit Token-Hintergrund halten 4.5:1 im Dunkelmodus (375px)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/');
		await waitForStableView(page);

		// Dunkelmodus ist als App-Feature deaktiviert (P1-2): `data-theme` wird nicht mehr über
		// localStorage gesteuert, sondern fix auf „light” gesetzt. Die `[data-theme='dark']`-Regeln
		// in app.css bleiben als Token-Bestand erhalten — für die Rückkehr des Dunkelmodus. Der Test
		// erzwingt das Attribut deshalb direkt am <html> und misst die Kontrast-Regeln weiter.
		await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

		// Vorbedingung: der Dunkelmodus ist wirklich aktiv, sonst misst der Test den Hellmodus grün.
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		// Das Panel rendert erst, wenn die Task-Daten da sind — sonst misst der Test einen leeren DOM.
		await expect(page.locator('.dashboard-next-task')).toBeVisible();

		// AxeBuilder-Scan für Kontrast-Verstöße (Pattern: public/docs/e2e-a11y-pattern.md)
		const results = await new AxeBuilder({ page })
			.include('.dashboard-next-task')
			.include('.dashboard-suggestions')
			.withTags(['wcag2aa']) // WCAG AA (inkl. 1.4.3 Kontrast)
			.analyze();

		// Nur Kontrast-Verstöße melden (andere A11y-Themen werden separat getestet)
		const contrastViolations = results.violations.filter(
			(v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
		);
		expect(contrastViolations, 'Kontrast-Verstöße in Dashboard-Panels').toEqual([]);

		// Zusatz: Sicherstellen, dass keine anderen A11y-Verstöße in den Panels existieren
		// (optional — bei Bedarf auskommentieren für Fokus auf Kontrast)
		// expect(results.violations).toEqual([]);
	});
});
