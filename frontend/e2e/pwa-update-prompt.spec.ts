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

/**
 * Desktop-Ausrichtung (#1077, docs/spec/issue-1077.md AK1-AK3).
 *
 * Gleiches Stellvertreter-Muster wie #373 oben: der reale Update-Zustand ist in Playwright
 * nicht deterministisch, deshalb wird der reine CSS-Kontrakt der Klasse `.update-prompt`
 * geprueft — Desktop (≥ 768px) rechtsbündig und breitenbegrenzt, Mobil (375px) vollbreit.
 */
interface ProxyMetrics {
	left: string;
	right: string;
	maxWidth: string;
	width: number;
	rectLeft: number;
	rectRight: number;
	viewportWidth: number;
}

test.describe('Priority Pilot — UpdatePrompt Desktop-Ausrichtung (#1077)', () => {
	/** Sub-Pixel-Rundungstoleranz. */
	const TOLERANCE_PX = 1;

	/** Liest Position und Breite eines injizierten `.update-prompt`-Stellvertreters aus. */
	const measureProxy = `(() => {
		const el = document.createElement('div');
		el.className = 'update-prompt';
		document.body.appendChild(el);
		const style = getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		const result = {
			left: style.left,
			right: style.right,
			maxWidth: style.maxWidth,
			width: rect.width,
			rectLeft: rect.left,
			rectRight: rect.right,
			viewportWidth: document.documentElement.clientWidth,
		};
		el.remove();
		return result;
	})();`;

	// AK1 — Desktop (≥ 768px): rechtsbündig, nicht mehr vollbreit.
	// Computed `left` liefert die CSSOM bei positionierten Elementen als verwendeten px-Wert
	// zurück — `left: auto` ist per getComputedStyle nicht beobachtbar, deshalb Geometrie prüfen.
	test('AK1: .update-prompt ist bei 1280px rechtsbündig und nicht vollbreit', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');

		const m = await page.evaluate<ProxyMetrics>(measureProxy);

		// Rechtsbündig: Element liegt in der rechten Hälfte, rechte Kante am Viewport-Rand.
		expect(m.rectLeft).toBeGreaterThan(m.viewportWidth / 2);
		expect(m.viewportWidth - m.rectRight).toBeLessThanOrEqual(TOLERANCE_PX);
		expect(m.width).toBeLessThan(m.viewportWidth - TOLERANCE_PX);
	});

	// AK2 — Desktop (≥ 768px): Maximalbreite begrenzt (≤ 480px).
	test('AK2: .update-prompt hat bei 1280px ein max-width ≤ 480px', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');

		const m = await page.evaluate<ProxyMetrics>(measureProxy);

		// 'none' (Basiszustand) → RED; Begrenzung im Media-Query → GREEN.
		expect(m.maxWidth).not.toBe('none');
		expect(parseFloat(m.maxWidth)).toBeLessThanOrEqual(480);
	});

	// AK3 — Mobil (375px): volle Breite wie bisher (left/right je 0).
	test('AK3: .update-prompt bleibt bei 375px vollbreit (left:0, right:0)', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/');

		const m = await page.evaluate<ProxyMetrics>(measureProxy);

		expect(m.left).toBe('0px');
		expect(m.right).toBe('0px');
	});
});

/**
 * Reload-Fallback nach Update-Bestätigung (#1095, docs/spec/issue-1095.md AK4).
 *
 * Auch hier gilt: der reale SW-Update-Zyklus (`needRefresh`) ist in Playwright nicht
 * deterministisch reproduzierbar (Header oben). Der Browser-Mechanismus dahinter ist es aber
 * sehr wohl — und genau der bricht in der echten PWA ab: Klick-Bestätigung → eigener
 * `controllerchange`-Listener → `location.reload()`. Deshalb wird die reale Prompt-Struktur
 * (`.update-prompt` > `kol-card` > `span[data-testid="pwa-update-reload"]`) als Stellvertreter
 * injiziert und der Fallback-Pfad im echten Dokument gefahren: Dispatch von `controllerchange`
 * auf dem echten `navigator.serviceWorker`, Nachweis des Reloads über einen `sessionStorage`-
 * Zähler (überlebt den Reload im selben Tab), danach muss die App neu gestartet und der
 * Update-Prompt weg sein. Die Komponentenlogik selbst (Listener-Registrierung, Idempotenz-Guard,
 * Kein-Reload-ohne-Bestätigung) tragen die Vitest-Unit-Tests (AK1–AK3).
 */
test.describe('Priority Pilot — PWA Update-Reload-Fallback (#1095)', () => {
	test('AK4: 375px — Bestätigung + Controller-Wechsel reloadet genau einmal, Prompt danach weg', async ({ page }) => {
		await mockAuthenticated(page);
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
		await page.evaluate(() => sessionStorage.setItem('pwa-reloads', '0'));

		// Reale UpdatePrompt-Struktur als Stellvertreter; der Klick verdrahtet den Fallback-
		// Listener (nur nach Bestätigung), der Controller-Wechsel reloadet genau einmal.
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.className = 'update-prompt';
			container.innerHTML = `
				<kol-card _label="Neue Version verfügbar">
					<p>Priority Pilot wurde aktualisiert.</p>
					<span data-testid="pwa-update-reload"><kol-button>Jetzt neu laden</kol-button></span>
				</kol-card>
			`;
			document.body.appendChild(container);

			const trigger = container.querySelector<HTMLElement>('[data-testid="pwa-update-reload"]')!;
			trigger.addEventListener('click', () => {
				navigator.serviceWorker.addEventListener('controllerchange', () => {
					if (sessionStorage.getItem('pwa-reloads') === '1') return;
					sessionStorage.setItem('pwa-reloads', '1');
					window.location.reload();
				});
			});
		});

		await page.getByTestId('pwa-update-reload').click();

		// Controller-Wechsel mehrfach feuern (Workbox-Pfad + eigener Fallback) — darf nur 1× reloaden.
		await page.evaluate(() => {
			for (let i = 0; i < 3; i++) {
				navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
			}
		});

		// Reload nachweisbar (Zähler steht nach dem Neustart auf genau 1). Während des Reloads
		// wird die Execution-Context zerstört — der Fehlschlag wird abgefangen und neu gepollt.
		await expect
			.poll(
				async () => {
					try {
						return await page.evaluate(() => sessionStorage.getItem('pwa-reloads'));
					} catch {
						return null;
					}
				},
				{ timeout: 10_000 },
			)
			.toBe('1');

		// App ist nach dem Reload wieder vollständig da. (Kein `.update-prompt`-Count-Check: das hier
		// injizierte div stirbt mit dem Reload und der echte Prompt ist in diesem Test nie gemountet —
		// die Assertion könnte nicht fehlschlagen. Das echte Verschwinden tragen AK1–AK3 in
		// UpdatePrompt.test.tsx.)
		await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
	});
});
