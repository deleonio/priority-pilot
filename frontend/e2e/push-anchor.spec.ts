import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * E2E-Spec für #2848 (docs/spec/issue-2848.md): Push-Ziele mit Dashboard-Anker (`/#karte-…`)
 * springen nach dem ersten Rendern zur Karte, legen den Fokus aufs Anker-Ziel und entfernen den
 * Anker danach (AK1/AK2). Fehlende Karten bleiben still oben (AK3), und alle 11 Anker aus
 * `docs/push-konzept.md` §2.1 sitzen an den Karten (AK6).
 *
 * Bewusst `karte-top-aufgaben` als Sprungziel (AK1/AK2): die Karte ist immer gemountet — die
 * selbstladenden Widgets (Streak, Rückblicke, Meilensteine, Fürsorge) rendern je nach Daten/Tag
 * `null` und würden den Test am Lauftag brechen.
 */

/** Die 11 Karten-Anker aus `docs/push-konzept.md` §2.1. */
const ANCHOR_IDS = [
	'karte-balance',
	'karte-willkommen',
	'karte-fuersorge',
	'karte-freie-zeit',
	'karte-top-aufgaben',
	'karte-streak',
	'karte-wochenrueckblick',
	'karte-monatsrueckblick',
	'karte-jahresrueckblick',
	'karte-meilensteine',
	'karte-deadlines',
] as const;

/** Anker, deren Karte im Seed-Zustand (Säulen + eine offene Aufgabe) garantiert gerendert ist. */
const GUARANTEED_IDS: readonly string[] = ['karte-balance', 'karte-top-aufgaben'];

test.describe('Push-Anker auf Dashboard-Karten (#2848)', () => {
	// Eine offene Aufgabe: ohne sie zeigt die App den Onboarding-Leerzustand statt der
	// Dashboard-Tabs (Muster dashboard-cards.spec.ts).
	test.beforeEach(async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);
		await page.request.post('/api/v1/tasks', { data: { title: 'E2E #2848 Anker-Task', priority: 2 } });
	});

	// AK1 — Sprung zur Karte + Fokus aufs Anker-Ziel (375 px).
	test('AK1: /#karte-top-aufgaben landet mit Fokus auf der Karte im sichtbaren Bereich', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/#karte-top-aufgaben');
		await waitForStableView(page);

		const target = page.locator('#karte-top-aufgaben');
		await expect(target).toBeVisible();
		await expect(target).toBeFocused();

		// „Sichtbarer Bereich": der Kartenanfang liegt im Viewport (nicht unter dem Sticky-Header
		// geclippt, nicht unterhalb) — die Gesamthöhe hoher Karten wird bewusst nicht gefordert.
		const box = (await target.boundingBox()) as { x: number; y: number; width: number; height: number };
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(812);
	});

	// AK2 — Anker nach dem Sprung entfernt; Reload springt nicht erneut.
	test('AK2: Anker ist danach aus der Adresse entfernt, Reload springt nicht erneut', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/app/#karte-top-aufgaben');
		await waitForStableView(page);

		await expect(page).not.toHaveURL(/#karte-/);

		await page.reload();
		await waitForStableView(page);
		await expect(page).not.toHaveURL(/#karte-/);
		await expect(page.locator('#karte-top-aufgaben')).not.toBeFocused();
	});

	// AK3 — Anker auf nicht gerenderte Karte: Dashboard bleibt oben, keine Meldung, kein
	// Leerelement mit der Anker-ID. Die Rückblick-Karten sind datumabhängig — an jedem Lauftag
	// fehlen mindestens zwei der drei, der Test wählt deterministisch eine fehlende.
	test('AK3: Anker auf fehlende Karte lässt das Dashboard still oben', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		const now = new Date();
		const absent: string[] = [];
		if (now.getDay() !== 0) {
			absent.push('karte-wochenrueckblick');
		}
		if (now.getDate() > 7) {
			absent.push('karte-monatsrueckblick', 'karte-jahresrueckblick');
		}
		const missing = absent[0] as string | undefined;
		test.skip(
			missing === undefined,
			'Am 1.–7. Januar (Sonntag) sind alle drei Rückblick-Karten sichtbar — kein fehlender Anker abwählbar',
		);

		await page.goto(`/app/#${missing}`);
		await waitForStableView(page);

		await expect(page.locator(`#${missing}`)).toHaveCount(0);
		await expect(page.getByRole('heading', { name: /Aufgabe bearbeiten/ })).toBeHidden();
		const scrolled = await page.evaluate(() => window.scrollY);
		expect(scrolled).toBe(0);
	});

	// AK6 — alle 11 Anker sitzen (bedingte Karten nur im Sichtbarkeitsfall), keine ID doppelt.
	test('AK6: alle 11 Karten-Anker existieren an den gerenderten Karten, keine doppelt', async ({ page }) => {
		await page.goto('/app/');
		await waitForStableView(page);

		const presentIds = await page.evaluate(() =>
			Array.from(document.querySelectorAll('[id^="karte-"]'), (element) => element.id),
		);
		for (const id of GUARANTEED_IDS) {
			expect(
				presentIds.filter((candidate) => candidate === id),
				`${id} muss vorhanden sein`,
			).toHaveLength(1);
		}
		expect(new Set(presentIds).size, 'Anker-IDs dürfen nicht doppelt vergeben sein').toBe(presentIds.length);
		expect(presentIds.length).toBeLessThanOrEqual(ANCHOR_IDS.length);
		for (const id of presentIds) {
			expect(ANCHOR_IDS).toContain(id);
		}
	});
});
