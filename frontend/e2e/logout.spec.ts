import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #191 „feat: Logout-Button in Navigation" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets (siehe Triage-Analyse): Der Header/die Navigation erhält einen **Logout-Button**.
 * Er ist nur für authentifizierte Benutzer sichtbar (aktueller Auth-State = `localStorage`-Eintrag
 * `displayName`, vgl. `App.tsx`). Ein Klick sendet `POST /auth/logout` (zerstört die Session), räumt
 * den lokalen Auth-State auf und leitet anschließend auf die Login-Seite (`/login`) um. Schlägt der
 * Logout fehl, bleibt der Nutzer eingeloggt und der Button wieder bedienbar (AK-5, siehe
 * `src/App.test.tsx`).
 *
 * Diese Tests sind **rot**, bis die Umsetzung den Logout-Button samt Verdrahtung
 * (`api.logout` → `POST /auth/logout` → State-Cleanup → Redirect `/login`) in `App.tsx` ergänzt.
 *
 * Anders als die funktionalen CRUD-Specs mocken diese Tests die Auth-Endpunkte bewusst über
 * `page.route`: Das echte Test-Backend (In-Memory-DB) kennt weder `/auth/logout` noch eine
 * Login-Seite. Die fachlichen Lade-Endpunkte (`/tasks` …) liefern wir ebenfalls per `route`, damit die
 * App unabhängig vom Seed-Zustand in die eingeloggte Dashboard-Ansicht rendert.
 *
 * Seit #190 hängt vor der Haupt-App ein Auth-Gate (`Root.tsx`): Nur wenn `GET /auth/me` einen User
 * liefert, wird die App gerendert. `stubBackend` mockt `/auth/me` daher standardmäßig als
 * authentifiziert, damit das Gate durchlässig ist. Die Button-Sichtbarkeit wird weiterhin über den
 * `displayName`-Eintrag in `localStorage` (vgl. `App.tsx`) gesteuert — `setAuth` bleibt unverändert.
 */

const DISPLAY_NAME = 'Peter';

const SAMPLE_TASK = {
	id: 1,
	title: 'T1',
	status: 'open',
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

/** Erfüllt eine Route mit JSON-Body und Status 200. */
const fulfillJson = (body: unknown) => ({
	status: 200,
	contentType: 'application/json',
	body: JSON.stringify(body),
});

/**
 * Verdrahtet die fachlichen Lade-Endpunkte so, dass die App in die eingeloggte Dashboard-Ansicht
 * rendert (mind. ein Task ⇒ kein EmptyState). Mockt außerdem `GET /auth/me` als authentifiziert,
 * damit das Auth-Gate aus #190 (`Root.tsx`) für alle Tests durchlässig ist. Auth-spezifische Routen
 * (`/auth/logout`) setzt jeder Test selbst, da er ihr Verhalten (Erfolg/Fehler) und die
 * Aufruf-Erwartung individuell prüft.
 */
const stubBackend = async (page: Page): Promise<void> => {
	await page.route('**/auth/me', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ id: 1, name: DISPLAY_NAME, email: 'peter@example.com' }),
		}),
	);
	await page.route('**/api/v1/tasks', (route) =>
		route.request().method() === 'GET' ? route.fulfill(fulfillJson([SAMPLE_TASK])) : route.continue(),
	);
	await page.route('**/api/v1/forest', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/next', (route) => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/v1/suggestions', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/pillars', (route) => route.fulfill(fulfillJson([])));
};

/** Setzt VOR dem Laden den Auth-State (eingeloggt) bzw. löscht ihn (ausgeloggt). */
const setAuth = async (page: Page, loggedIn: boolean): Promise<void> => {
	const name: string | null = loggedIn ? DISPLAY_NAME : null;
	await page.addInitScript((value: string | null) => {
		if (value === null) {
			localStorage.removeItem('displayName');
		} else {
			localStorage.setItem('displayName', value);
		}
	}, name);
};

/**
 * ROTE Spec-Tests für #209 „Logout-Button im Toolbar rechts oben" (Stufe 1 TDD, einklagbarer Vertrag).
 *
 * Ziel: Der Logout-Button soll als echtes `_items`-Element **innerhalb** der `KolToolbar`
 * („Kopf-Aktionen") platziert sein — nicht als freistehender `<button>` neben der Toolbar.
 * Die Toolbar-Semantik (role="toolbar", Pfeiltasten-Navigation) gilt damit auch für den Logout.
 *
 * Derzeit ist der Logout-Button in App.tsx ein eigenständiger `<button class="logout-button">`
 * außerhalb der `<KolToolbar>`. Diese Tests sind ROT, bis die Umsetzung ihn als letztes
 * `_items`-Element der KolToolbar einbindet.
 *
 * Die funktionale Logout-Logik (POST /auth/logout, Redirect, Session-Cleanup) ist durch die
 * Tests für #191 (unten) abgedeckt — hier wird ausschließlich die Platzierung geprüft.
 */
test.describe('#209 Logout-Button im Toolbar (rechts oben)', () => {
	/**
	 * AK-1: Der Logout-Button ist ein Nachkomme der KolToolbar (role="toolbar", label „Kopf-Aktionen").
	 * Aktuell ist er ein Geschwister-Element der Toolbar — dieser Test ist ROT.
	 */
	test('AK-1: Logout-Button liegt innerhalb der benannten Toolbar „Kopf-Aktionen"', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, true);
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		// Der Logout-Button muss innerhalb der Toolbar erreichbar sein.
		await expect(toolbar.getByRole('button', { name: /Abmelden|Logout/i })).toBeVisible();
	});

	/**
	 * AK-2: Nicht authentifizierte Benutzer sehen KEINEN Logout-Button in der Toolbar.
	 * (Konsistenz: das Toolbar-Inventar bleibt ohne gültigen Auth-State unverändert.)
	 */
	test('AK-2: Ohne Authentifizierung kein Logout-Button in der Toolbar', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, false);
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		await expect(toolbar).toBeVisible();

		await expect(toolbar.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);
	});

	/**
	 * AK-3: Der Logout-Button ist das letzte (rechteste) Toolbar-Element.
	 * „rechts oben" bedeutet: kein weiterer Toolbar-Button folgt danach.
	 */
	test('AK-3: Logout-Button ist das letzte Element in der Toolbar', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, true);
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		const buttons = toolbar.getByRole('button');
		const count = await buttons.count();
		expect(count).toBeGreaterThan(0);

		const lastButton = buttons.nth(count - 1);
		await expect(lastButton).toHaveAccessibleName(/Abmelden|Logout/i);
	});

	/**
	 * AK-4: Klick auf den Toolbar-Logout-Button löst POST /auth/logout aus (Verdrahtung erhalten).
	 * Stellt sicher, dass die Umplatzierung in die Toolbar die Funktionalität nicht bricht.
	 */
	test('AK-4: Klick auf Toolbar-Logout-Button sendet POST /auth/logout', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, true);

		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);

		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		const logoutRequest = page.waitForRequest((req) => /\/auth\/logout$/.test(req.url()));

		await toolbar.getByRole('button', { name: /Abmelden|Logout/i }).click();
		const request = await logoutRequest;

		expect(request.method()).toBe('POST');
	});
});

test.describe('#191 Logout-Button in Navigation', () => {
	/**
	 * AK-1 — Sichtbarkeit nur für authentifizierte Benutzer: Ohne `displayName` (nicht eingeloggt)
	 * existiert KEIN Logout-Button; mit gesetztem `displayName` (eingeloggt) ist er sichtbar.
	 */
	test('AK-1: Logout-Button nur für authentifizierte Benutzer sichtbar', async ({ page }) => {
		await stubBackend(page);

		// Nicht eingeloggt: kein Logout-Button.
		await setAuth(page, false);
		await page.goto('/');
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);

		// Eingeloggt: Logout-Button ist sichtbar.
		await setAuth(page, true);
		await page.goto('/');
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toBeVisible();
	});

	/**
	 * AK-2 — Klick sendet `POST /auth/logout`: Der Button-Klick löst genau eine POST-Anfrage an den
	 * Logout-Endpunkt aus (Beweis, dass der Button die Session-Zerstörung anstößt).
	 */
	test('AK-2: Button-Klick sendet POST /auth/logout', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, true);

		let logoutMethod: string | null = null;
		await page.route('**/auth/logout', async (route) => {
			logoutMethod = route.request().method();
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.goto('/');
		await waitForStableView(page);

		const logoutRequest = page.waitForRequest((request) => /\/auth\/logout$/.test(request.url()));
		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();
		const request = await logoutRequest;

		expect(request.method()).toBe('POST');
		expect(logoutMethod).toBe('POST');
	});

	/**
	 * AK-3 — Nach erfolgreichem Logout → Redirect zur Login-Seite: Nach erfolgreichem `POST /auth/logout`
	 * landet der Nutzer auf der Login-Route (`/login`).
	 */
	test('AK-3: nach Logout Redirect zur Login-Seite', async ({ page }) => {
		await stubBackend(page);
		await setAuth(page, true);

		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		await expect(page).toHaveURL(/\/login(\b|\/|$)/);
	});

	/**
	 * AK-4 — Session zerstört: Nach dem Logout ist der lokale Auth-State (`displayName`) entfernt; ein
	 * (hypothetischer) erneuter API-Aufruf würde mangels Session mit 401 abgelehnt. Geprüft wird der
	 * beobachtbare Vertrag: der Auth-State ist bereinigt und ein bewusst auf 401 gemockter API-Endpunkt
	 * gewährt keinen Zugriff mehr auf die eingeloggte Ansicht.
	 */
	test('AK-4: nach Logout ist die Session zerstört (Auth-State bereinigt, neue Anfragen abgelehnt)', async ({
		page,
	}) => {
		await stubBackend(page);
		await setAuth(page, true);

		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();
		await expect(page).toHaveURL(/\/login(\b|\/|$)/);

		// Der lokale Auth-State ist nach dem Logout entfernt (Session beendet).
		const displayName = await page.evaluate(() => localStorage.getItem('displayName'));
		expect(displayName).toBeNull();

		// Ab jetzt antwortet das Backend ohne gültige Session mit 401: ein direkter erneuter Aufruf der
		// geschützten App-Ansicht führt NICHT zurück in den eingeloggten Zustand.
		await page.route('**/api/v1/**', (route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unauthorized' }),
			}),
		);

		await page.goto('/');
		await waitForStableView(page).catch(() => undefined);
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);
	});
});
