import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1206 — „Changelog: Kategorien-Aggregation + Links" (Spec
 * docs/spec/issue-1206.md, AK4).
 *
 * Vertrag (Mobile-First): Der Changelog-Tab aggregiert Release-Bodys nach Kategorien.
 * Auf einem 375-px-Viewport bleiben die Kategorie-Blöcke lesbar — kein sichtbares Element
 * clippt horizontal aus dem Viewport. Die GitHub-Releases-API wird per `page.route` mit
 * einer Fixture erfüllt (kein Live-Abruf: Unauth-Rate-Limit + Flakiness, s. #1190).
 *
 * Der Fixture-Body enthält eine LANGE NACKTE URL — der wahrscheinlichste mobile
 * Stolperstein (KI-UX): Ohne Wortbruch (`overflow-wrap`) auf Links reißt das Autolink-`<a>`
 * das Layout, obwohl die Kategorie-Struktur selbst korrekt ist. Die Bounding-Box-Prüfung
 * bekommt dadurch Zähne.
 *
 * Overflow wird per Bounding-Box geprüft (rekursiv inkl. Shadow-DOM), nicht per
 * `scrollWidth`: Die App-Shell clippt `overflow-x: hidden` (Erfahrung 2026-08-24).
 */

const LONG_URL = `https://github.com/deleonio/priority-pilot/pull/${'1234'.repeat(8)}/files#diff-sehr-langer-anchor`;

const RELEASES_FIXTURE = [
	{
		tag_name: 'v0.1.695',
		published_at: '2026-09-02T10:00:00Z',
		body: [
			'### 💥 Breaking Changes\n\n- Export entfernt',
			`### 🐞 Bug Fixes\n\n- Absturz beim Speichern behoben, siehe ${LONG_URL}`,
			'### Other Changes\n\n- Aufräumarbeiten',
		].join('\n\n'),
	},
];

test.describe('#1206 Changelog-Aggregation auf der Hilfe-Seite', () => {
	test('AK4: Kategorie-Blöcke bei 375 px lesbar, lange Autolinks clippen nicht aus dem Viewport', async ({ page }) => {
		await page.route('**/api.github.com/**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(RELEASES_FIXTURE),
			}),
		);

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/hilfe');

		await waitForStableView(page, 'Handbuch');
		await page.getByRole('tab', { name: 'Changelog' }).click();

		// Aggregierte Kategorien erscheinen (Ready-Marker für den Lazy-Load).
		await expect(page.getByText('Breaking Changes')).toBeVisible();
		await expect(page.getByText('Bug Fixes')).toBeVisible();
		// Autolink wurde gerendert (AK1-Seite des Vertrags im echten Browser).
		await expect(page.locator('a[href*="priority-pilot/pull/"]').first()).toBeVisible();

		// Kein sichtbares Element (inkl. KoliBri-Shadow-DOM) ragt über den Viewport.
		const clipped = await page.evaluate(() => {
			const viewportWidth = window.innerWidth;
			const offenders: string[] = [];
			const collect = (root: Element | ShadowRoot): void => {
				root.querySelectorAll('*').forEach((el) => {
					// eslint-disable-next-line no-restricted-syntax
					if (el.shadowRoot) {
						// eslint-disable-next-line no-restricted-syntax
						collect(el.shadowRoot);
					}
					const rect = el.getBoundingClientRect();
					if (rect.width > 0 && rect.height > 0 && rect.right > viewportWidth + 1) {
						offenders.push(`${el.tagName.toLowerCase()}@${Math.round(rect.right)}px`);
					}
				});
			};
			document.querySelectorAll('main').forEach((main) => collect(main));
			return offenders;
		});
		expect(clipped, 'kein Element clippt aus dem 375-px-Viewport').toEqual([]);
	});
});
