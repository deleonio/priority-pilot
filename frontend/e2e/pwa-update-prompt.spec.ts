import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * E2E-Smoke-Test (#353) für den PWA-Update-Prompt — Mobile-First (375px).
 *
 * **Warum kein echter SW-Update-Zyklus getestet wird:** Der Update-Fluss (registerType: 'prompt')
 * hängt an einem echten Service-Worker-Lebenszyklus: Ein neuer SW muss gebaut, installiert und in
 * den `waiting`-Zustand versetzt werden, damit `needRefresh` true wird. In Playwright ist das weder
 * deterministisch noch stabil reproduzierbar (Build-Hash-Wechsel, Registrierungs-Timing, Caching).
 * Der reale Update-Zyklus wird daher in den Vitest-Unit-Tests (UpdatePrompt.test.tsx) über den
 * gemockten `useRegisterSW`-Hook abgedeckt. Hier verifizieren wir stattdessen die Mobile-First-
 * Anforderung visuell: Die App lädt bei 375px ohne horizontalen Overflow.
 */

/** Antwortet auf `GET /auth/me` mit 200 + User → die App zeigt die Haupt-App. */
const mockAuthenticated = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route: Route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, displayName: 'Test User', email: 'test@example.com' }),
		}),
	);
};

test.describe('Priority Pilot — PWA Update-Prompt Mobile-First (#353)', () => {
	// AK6 — Mobile-First (375px): kein horizontaler Overflow.
	test('AK6: App lädt bei 375px ohne horizontalen Overflow', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		// Sicherstellen, dass die Haupt-App gerendert ist, bevor wir die Layout-Breite prüfen.
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

		// Bei 375px darf das Dokument nicht breiter als der Viewport sein (kein horizontaler Scroll).
		const { scrollWidth, clientWidth } = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));

		expect(clientWidth).toBeLessThanOrEqual(375);
		// Kleine Toleranz (1px) gegen Sub-Pixel-Rundung; echter Overflow wäre deutlich größer.
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
	});
});

/**
 * CSS-Kontrakt-Tests (#373) für die Fixierung der Update-/Offline-Card am unteren Bildschirmrand.
 *
 * Der echte Update-Fluss (needRefresh via SW-Lebenszyklus) ist in Playwright nicht deterministisch
 * reproduzierbar (siehe #353-Block oben). Deshalb prüfen wir hier den reinen CSS-Kontrakt der Klasse
 * `.update-prompt`, indem wir ein Stellvertreter-Element mit dieser Klasse in das geladene Dokument
 * einfügen und die berechneten Styles auslesen. So wird verifiziert, dass die App das globale CSS
 * für `.update-prompt` (position: fixed, am unteren Rand) ausliefert.
 */
test.describe('Priority Pilot — UpdatePrompt KoliBri-Card Fixierung (#373)', () => {
	// AK1 — Am unteren Rand fixiert: .update-prompt trägt position: fixed.
	test('AK1: .update-prompt-Klasse hat position:fixed', async ({ page }) => {
		await mockAuthenticated(page);
		await page.goto('/');

		const position = await page.evaluate(() => {
			const el = document.createElement('div');
			el.className = 'update-prompt';
			document.body.appendChild(el);
			const pos = getComputedStyle(el).position;
			el.remove();
			return pos;
		});

		expect(position).toBe('fixed');
	});

	// AK4 — Mobile-First (375×812): die fixierte Card sitzt am unteren Rand (bottom: 0).
	test('AK4: .update-prompt ist am unteren Rand fixiert (bottom:0) bei 375×812', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');

		const bottom = await page.evaluate(() => {
			const el = document.createElement('div');
			el.className = 'update-prompt';
			document.body.appendChild(el);
			const b = getComputedStyle(el).bottom;
			el.remove();
			return b;
		});

		// Ohne CSS-Klasse ist bottom 'auto' → RED; mit `.update-prompt { bottom: 0 }` → GREEN.
		expect(bottom).toBe('0px');
	});
});

/**
 * Mobile-Bedienbarkeit + Overflow-Schutz (#1034, docs/spec/issue-1034.md AK1-AK3).
 *
 * Der reale Update-/Offline-Zustand ist in Playwright nicht deterministisch reproduzierbar
 * (siehe #353-Block oben), deshalb wird die tatsächliche `UpdatePrompt`-Markup-Struktur
 * (`.update-prompt` > `kol-card` > Klick-Wrapper-`span[data-testid]` > `kol-button`) als
 * Stellvertreter injiziert und der CSS-Kontrakt gemessen.
 */
test.describe('Priority Pilot — UpdatePrompt Mobile-Bedienbarkeit (#1034)', () => {
	/** WCAG 2.5.8: Mindest-Tap-Target. */
	const MIN_TARGET_PX = 44;
	/** Sub-Pixel-Rundungstoleranz. */
	const TOLERANCE_PX = 1;

	const CARDS = [
		{ card: 'update', testId: 'pwa-update-reload' },
		{ card: 'offline', testId: 'pwa-offline-close' },
	];

	/** Injiziert die reale UpdatePrompt-Struktur als Stellvertreter für eine Card. */
	const injectCardProxy = (testId: string) => `
		const container = document.createElement('div');
		container.className = 'update-prompt';
		container.innerHTML = \`
			<kol-card>
				<p>Fließtext</p>
				<span data-testid="${testId}"><kol-button></kol-button></span>
			</kol-card>
		\`;
		document.body.appendChild(container);
	`;

	for (const { card, testId } of CARDS) {
		// AK1 — Tap-Target ≥ 44x44px und ≥ 90% der Card-Innenbreite bei 375px.
		test(`AK1: ${card}-Card-Button ist bei 375px ≥44x44px und füllt ≥90% der Card-Innenbreite`, async ({ page }) => {
			await mockAuthenticated(page);
			await page.setViewportSize({ width: 375, height: 812 });
			await page.goto('/');

			await page.evaluate(injectCardProxy(testId));

			const card_ = page.locator('.update-prompt kol-card');
			const button = page.locator(`[data-testid="${testId}"]`);

			const cardBox = await card_.boundingBox();
			const buttonBox = await button.boundingBox();
			expect(cardBox, 'Card-Bounding-Box muss messbar sein').not.toBeNull();
			expect(buttonBox, 'Button-Bounding-Box muss messbar sein').not.toBeNull();

			expect(buttonBox!.height).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);
			expect(buttonBox!.width).toBeGreaterThanOrEqual(MIN_TARGET_PX - TOLERANCE_PX);
			expect(buttonBox!.width).toBeGreaterThanOrEqual(cardBox!.width * 0.9 - TOLERANCE_PX);

			await page.evaluate(() => document.querySelector('.update-prompt')?.remove());
		});
	}

	// AK2 — kein Kind-Element läuft bei 320px horizontal aus dem Viewport.
	test('AK2: kein Kind-Element von .update-prompt überragt den Viewport bei 320px', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 320, height: 812 });
		await page.goto('/');

		await page.evaluate(injectCardProxy('pwa-update-reload'));

		const overflow = await page.evaluate(() => {
			const els = Array.from(document.querySelectorAll('.update-prompt, .update-prompt *'));
			return els.map((el) => {
				const box = el.getBoundingClientRect();
				return box.x + box.width;
			});
		});

		expect(overflow.length).toBeGreaterThan(0);
		for (const rightEdge of overflow) {
			expect(rightEdge).toBeLessThanOrEqual(321);
		}

		await page.evaluate(() => document.querySelector('.update-prompt')?.remove());
	});

	// AK3 — Desktop-Regression-Schutz: .update-prompt bleibt bei ≥768px fixiert am unteren Rand.
	test('AK3: .update-prompt bleibt bei 1280px position:fixed; bottom:0px (keine Desktop-Regression)', async ({
		page,
	}) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');

		const style = await page.evaluate(() => {
			const el = document.createElement('div');
			el.className = 'update-prompt';
			document.body.appendChild(el);
			const computed = getComputedStyle(el);
			const result = { position: computed.position, bottom: computed.bottom };
			el.remove();
			return result;
		});

		expect(style.position).toBe('fixed');
		expect(style.bottom).toBe('0px');
	});
});
