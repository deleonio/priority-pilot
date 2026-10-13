import { expect, test, type Locator, type Page } from './fixtures';
import { avoidSunday, headerAction, waitForStableView } from './helpers';
import { onboardingDismissKey } from '../src/lib/onboardingPreferences';

/**
 * E2E-Vertrag für die sichtbare Fokus-Outline der äußeren Header-Buttons (#1622,
 * Spec `docs/spec/issue-1622.md`).
 *
 * Seit #1587 hängt `.app-header` `fixed` an der Viewport-Kante; mobil (< 48rem) ist
 * `--pp-bar-pad-block: 0px` (`app.css:303`) — der Fokus-Ring des äußeren Buttons (Hilfe)
 * liegt dadurch außerhalb der Button-Box und fällt hinter die Viewport-Kante. Kein
 * Vorfahr clippt, der Bildschirmrand selbst schneidet ab.
 *
 *  - AK1: 375px, Kopfzeile Oben — Ring-Oberkante bleibt im Viewport.
 *  - AK2: 375px, Kopfzeile Unten — Ring-Unterkante bleibt im Viewport.
 *  - AK3: Ring bleibt auch inline (links/rechts) im Viewport.
 *  - AK4/AK5: Bestandsverträge (Randbündigkeit, Höhendeckel) bleiben unberührt —
 *    dort keine neuen Tests, siehe issue-1587-header-fullwidth.spec.ts und
 *    mobile-shell.spec.ts.
 *  - AK6: Bei 1024px (>= 48rem) gelten AK1-AK3 ebenfalls.
 *
 * Ringgeometrie-Messung analog issue-1336-tabs-focus-outline.spec.ts, Box-Nachmessung
 * (CI-Umrender) analog stableBox() aus issue-1587-header-fullwidth.spec.ts.
 */

/** localStorage-Schlüssel der Kopfzeilen-Position (#1428), Muster mobile-shell.spec.ts. */
const HEADER_POSITION_KEY = 'pp-header-position';

/**
 * Subpixel-Toleranz an der Viewport-Kante: Outline- und Boxkanten rastet der Browser auf
 * Device-Pixel — ein rein rechnerischer −1px aus fractionalen Werten im Headless-Run ist
 * Rundungsrauschen, kein sichtbarer Abschnitt (CI-Run 37233994408: „Ring-Oberkante −1px“).
 */
const SUBPIXEL_TOLERANCE_PX = 1;

const gotoApp = async (page: Page, viewport: { width: number; height: number }, position?: 'bottom'): Promise<void> => {
	await page.setViewportSize(viewport);
	if (position === 'bottom') {
		await page.addInitScript((key) => localStorage.setItem(key, 'bottom'), HEADER_POSITION_KEY);
	}
	await page.goto('/app/');
	await waitForStableView(page);
};

/** boundingBox kurz nachmessen — CI-Runner rendern zwischendurch um (helpers.ts-Muster). */
const stableBox = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
	await expect(locator).toBeVisible();
	let box = await locator.boundingBox();
	for (let attempt = 0; attempt < 10 && box !== null; attempt += 1) {
		const recheck = await locator.boundingBox();
		if (recheck !== null && recheck.x === box.x && recheck.y === box.y) break;
		box = recheck;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	expect(box, 'Button muss messbar sein').not.toBeNull();
	return box!;
};

const outlineGeometry = async (button: Locator): Promise<{ width: number; offset: number }> =>
	button.evaluate((el) => {
		const styles = window.getComputedStyle(el);
		return { width: parseFloat(styles.outlineWidth), offset: parseFloat(styles.outlineOffset) };
	});

test.describe('Balamentum — Fokus-Outline der äußeren Header-Buttons bleibt im Viewport (#1622)', () => {
	test.beforeEach(async ({ page, ownSessionUser }) => {
		// #2186: Die sonntags nachladende Wochenkarte verschiebt sonst das Layout.
		await avoidSunday(page);
		// #2580 (Option B): Onboarding je Eigen-Nutzer vorab als beendet markieren (Muster
		// HEADER_POSITION_KEY, Schlüssel aus `onboardingPreferences.ts`). Die App liest den Merker
		// synchron beim Mount (App.tsx, `useState(() => isOnboardingDismissed(user.id))`) — der
		// Willkommens-Dialog öffnet nie und kann dem programmatisch fokussierten Hilfe-Button den
		// Fokus nicht mehr nachträglich rauben (Rennsituation Dialog-Fokuskette vs. Test-Fokus).
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

	const cases: Array<{
		label: string;
		viewport: { width: number; height: number };
		position?: 'bottom';
	}> = [
		{ label: '375px, Kopfzeile Oben', viewport: { width: 375, height: 812 } },
		{ label: '375px, Kopfzeile Unten', viewport: { width: 375, height: 812 }, position: 'bottom' },
		{ label: '1024px, Kopfzeile Oben', viewport: { width: 1024, height: 800 } },
	];

	for (const { label, viewport, position } of cases) {
		test(`AK1/AK2/AK3/AK6: Ring des Hilfe-Buttons bleibt vollständig im Viewport (${label})`, async ({ page }) => {
			await gotoApp(page, viewport, position);

			const button = await headerAction(page, 'Hilfe');
			await button.focus();
			await expect(button).toBeFocused();

			const box = await stableBox(button);
			const { width: outlineWidth, offset: outlineOffset } = await outlineGeometry(button);
			const ring = outlineWidth + outlineOffset;

			if (position === 'bottom') {
				expect(
					box.y + box.height + ring,
					'AK2: Ring-Unterkante darf nicht unter die Viewport-Kante fallen',
				).toBeLessThanOrEqual(viewport.height + SUBPIXEL_TOLERANCE_PX);
			} else {
				expect(box.y - ring, 'AK1: Ring-Oberkante darf nicht über die Viewport-Kante ragen').toBeGreaterThanOrEqual(
					-SUBPIXEL_TOLERANCE_PX,
				);
			}

			expect(box.x - ring, 'AK3: Ring-Linke darf nicht über die Viewport-Kante ragen').toBeGreaterThanOrEqual(
				-SUBPIXEL_TOLERANCE_PX,
			);
			expect(box.x + box.width + ring, 'AK3: Ring-Rechte darf nicht über die Viewport-Kante ragen').toBeLessThanOrEqual(
				viewport.width + SUBPIXEL_TOLERANCE_PX,
			);
		});
	}
	// TF2 (#2580): der Tasks-Fetch wird künstlich verzögert, sodass die Willkommens-Dialog-Montage
	// (Bedingung `tasks !== null && tasks.length === 0`, App.tsx) nachweislich NACH dem
	// programmatischen `button.focus()` landet — exakt die Rennsituation, die in CI sporadisch den
	// Fokus raubte. Der Beweis läuft mit `dismissOnboarding: false` (Fixture-Option, Muster
	// `onboarding-flow.spec.ts`), damit er deterministisch ist: Ohne den im beforeEach gesetzten
	// Merker bleibt der spät mountende Dialog offen und HÄLT den Fokus auf seiner Schritt-Überschrift
	// (rot, im Impl-Lauf nachgewiesen); mit Merker öffnet er gar nicht erst (grün). Erwartungen
	// unverändert — insbesondere `toBeFocused` (AK2).
	test.describe('TF2 — verzögerter Tasks-Fetch (#2580)', () => {
		test.use({ dismissOnboarding: false });

		test('TF2/AK2: verzögerter Tasks-Fetch — Dialog-Montage nach dem Teststart entzieht den Fokus nicht', async ({
			page,
		}) => {
			await page.route('**/api/v1/tasks*', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await route.continue();
			});

			await gotoApp(page, { width: 375, height: 812 });

			const button = await headerAction(page, 'Hilfe');
			await button.focus();
			await expect(button).toBeFocused();

			// Fokus über die (verzögerte) Dialog-Montage hinaus halten: mit Merker bleibt der Dialog
			// aus (EmptyState setzt keinen Fokus), ohne Merker öffnete er genau in diesem Fenster und
			// zöge den Fokus auf seine Schritt-Überschrift.
			await page.waitForTimeout(3500);
			await expect(button).toBeFocused();
		});
	});
});
