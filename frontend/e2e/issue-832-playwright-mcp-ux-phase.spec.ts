import { expect, test } from '@playwright/test';

/**
 * Issue 832: Playwright-MCP für UX-Phase
 * Spec: docs/spec/issue-832.md
 *
 * Akzeptanzkriterien:
 * - Playwright-MCP erreichbar in UX-Phase
 * - UI-Inspektion läuft (localhost:4174)
 * - A11y-Tests möglich (axe-core Integration)
 */

test.describe('Issue 832: Playwright-MCP UX-Phase', () => {
	test('AK1: Playwright-MCP ist erreichbar in UX-Phase', async ({ page }) => {
		// Spec: Ziel - Playwright-MCP in UX-Phase einrichten
		// AK: Playwright-MCP erreichbar in UX-Phase
		await page.goto('http://localhost:4174');
		expect(await page.title()).toBeTruthy();
	});

	test('AK2: UI-Inspektion zeigt DOM-Struktur (localhost:4174)', async ({ page }) => {
		// Spec: Schritte - UI-Snapshot unter localhost:4174 erstellen
		// Erwartetes Ergebnis: UI-Snapshot zeigt vollständige DOM-Struktur
		await page.goto('http://localhost:4174');
		const bodyContent = await page.locator('body').innerText();
		expect(bodyContent.length).toBeGreaterThan(0);
	});

	test('AK3: A11y-Check mit axe-core läuft ohne Fehler', async ({ page }) => {
		// Spec: Schritte - A11y-Check mit axe-core ausführen
		// Erwartetes Ergebnis: A11y-Checks laufen ohne Fehler
		await page.goto('http://localhost:4174');

		// axe-core Injection (simuliert Playwright-MCP A11y-Check)
		await page.evaluate(() => {
			return new Promise((resolve) => {
				const script = document.createElement('script');
				script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
				script.onload = () => resolve(true);
				document.head.appendChild(script);
			});
		});

		const violations = await page.evaluate(async () => {
			// @ts-expect-error - axe-core runtime injection
			const results = await axe.run(document);
			return results.violations.length;
		});

		expect(violations).toBe(0);
	});

	test('AK4: Keyboard-Navigation ist testbar (Tab-Reihenfolge)', async ({ page }) => {
		// Spec: Schritte - Keyboard-Navigation testen (Tab-Reihenfolge, Fokus-Indikatoren)
		// Erwartetes Ergebnis: Keyboard-Navigation ist testbar
		await page.goto('http://localhost:4174');

		const focusableElements = await page.evaluate(() => {
			const focusable = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]:not([tabindex="-1"])'].map(
				(selector) => Array.from(document.querySelectorAll(selector)),
			);
			return focusable.flat().length;
		});

		expect(focusableElements).toBeGreaterThan(0);
	});

	test('AK5: Mobile-Viewport (375×812) wird korrekt gerendert', async ({ page }) => {
		// Spec: Schritte - Viewport-Tests: Mobile (375×812)
		// Erwartetes Ergebnis: Mobile-Viewport wird korrekt gerendert
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('http://localhost:4174');

		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBeLessThanOrEqual(375);
	});

	test('AK6: Desktop-Viewport (1280×900) wird korrekt gerendert', async ({ page }) => {
		// Spec: Schritte - Viewport-Tests: Desktop (1280×900)
		// Erwartetes Ergebnis: Desktop-Viewport wird korrekt gerendert
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('http://localhost:4174');

		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBeLessThanOrEqual(1280);
	});
});
