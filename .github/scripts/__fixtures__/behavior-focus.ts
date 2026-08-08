// Fixture: Fokus-Heuristik — ein echter Fokus-Trap (Initialfokus, ohne Tab-Freiheit)
// MUSS als critical geflaggt werden; reine Autofokus-Tests (toBeFocused ist dort die
// vollständige Assertion) dürfen NICHT geflaggt werden.
// (Regression PR #505: das bare `fokus` im Namens-Match traf auch „Autofokus"/„fokussiert"
//  und flaggte Autofokus-Tests als fehlende Focus-Trap-Abdeckung — severity critical.)
import { test, expect } from '@playwright/test';

test.describe('Fokus', () => {
	// Echter Fokus-Trap: Dialog offen, Fokus liegt auf „Abbrechen", kein Tab-Test.
	test('AK1: Initialfokus auf „Abbrechen", kein Sprung auf „Löschen"', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
	});

	// Reiner Autofokus-Test: toBeFocused ist korrekt und vollständig — kein Trap.
	test('AK2-Autofokus-Desktop: Textarea ist nach dem Öffnen fokussiert', async ({ page }) => {
		await expect(page.locator('textarea')).toBeFocused();
	});

	// Reiner Autofokus-Test (Mobile) — darf ebenso nicht als Trap geflaggt werden.
	test('AK3-Autofokus-Mobile: Textarea fokussiert auf 375-px-Viewport', async ({ page }) => {
		await expect(page.locator('textarea')).toBeFocused();
	});
});
