import { expect, test } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1190 — „Changelog-Tab neben dem Handbuch" (Spec docs/spec/issue-1190.md, AK6).
 *
 * Vertrag (Mobile-First): Die Hilfe-Seite zeigt die Tabs „Handbuch" (initial aktiv) und
 * „Changelog". Auf einem 375-px-Viewport sind beide Tabs über ihre ARIA-Rollen bedienbar,
 * der Wechsel auf „Changelog" rendert die (gemockten) Releases, und kein sichtbares
 * Element ragt horizontal über den Viewport hinaus.
 *
 * Die GitHub-Releases-API wird per `page.route` mit einer Fixture erfüllt — bewusst OHNE
 * Live-Abruf (Unauth-Rate-Limit 60 req/h/IP und Flakiness in CI, s. KI-ANALYSE TF5). Der
 * Fixture-Body enthält einen langen Code-Span, damit die Bounding-Box-Prüfung überhaupt
 * Zähne hat: Fehlender Wortbruch in der Changelog-Liste würde erst durch ihn sichtbar.
 *
 * Overflow wird per Bounding-Box geprüft (rekursiv inkl. Shadow-DOM), nicht per
 * `scrollWidth`: Die App-Shell clippt `overflow-x: hidden`, `scrollWidth` bliebe
 * strukturell unauffällig (Erfahrung 2026-08-24).
 */

const RELEASES_FIXTURE = [
	{
		tag_name: 'v0.1.695',
		published_at: '2026-09-02T10:00:00Z',
		body: '### 🐛 Bug Fixes\n\n- Behebt Überlauf bei sehr langen Bezeichnern `pfad/zum/sehr-langen-modul-mit-langem-namen-der-umbrechen-muss.ts`',
	},
];

test.describe('#1190 Changelog-Tab auf der Hilfe-Seite', () => {
	test('AK6: Tabs „Handbuch"/„Changelog" sind bei 375 px bedienbar und clippen nichts', async ({ page }) => {
		await page.route('**/api.github.com/**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(RELEASES_FIXTURE),
			}),
		);

		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/hilfe');

		const handbuchTab = page.getByRole('tab', { name: 'Handbuch' });
		const changelogTab = page.getByRole('tab', { name: 'Changelog' });
		// „Handbuch" (Tab-Trigger) dient zugleich als Ready-Marker: Er ist erst nach dem
		// KoliBri-Upgrade von KolTabs sichtbar.
		await waitForStableView(page, 'Handbuch');
		await expect(handbuchTab).toBeVisible();
		await expect(changelogTab).toBeVisible();

		// AK1 (e2e-Seite): initial ist „Handbuch" der gewählte Tab.
		await expect(handbuchTab).toHaveAttribute('aria-selected', 'true');

		await changelogTab.click();

		// Gemocktes Release erscheint im Changelog-Panel (lazy geladen).
		await expect(page.getByText('v0.1.695')).toBeVisible();

		// Kein sichtbares Element (inkl. KoliBri-Shadow-DOM) ragt über den Viewport.
		const clipped = await page.evaluate(() => {
			const viewportWidth = window.innerWidth;
			const offenders: string[] = [];
			const collect = (root: Element | ShadowRoot): void => {
				root.querySelectorAll('*').forEach((el) => {
					// #824-Guard meint Shadow-DOM-INTERNALS (Klassen/Slots) einzelner Komponenten;
					// hier wird nur die öffentliche Geometrie (Bounding-Box) der KoliBri-Trigger
					// gemessen, das Shadow-Root wird nur durchlaufen.
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
			// Scope auf die Hilfe-Seite: App-Header/Randbereiche sind nicht Vertragsgegenstand.
			document.querySelectorAll('main').forEach((main) => collect(main));
			return offenders;
		});
		expect(clipped, 'kein Element clippt aus dem 375-px-Viewport').toEqual([]);
	});
});
