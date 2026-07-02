import type { Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { waitForStableView } from './helpers';

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
 * ROTE Spec-Tests für #214 „Nach dem Abmelden zur Login-Seite weiterleiten".
 *
 * Problem: `handleLogout` in App.tsx nutzt `window.history.pushState({}, '', '/login')`, das
 * ausschließlich die Browser-URL ändert — ohne Seiten-Reload. `Root.tsx` bleibt eingehängt
 * (authState === 'authenticated'), `<LoginPage>` wird nie gerendert. Der Nutzer sieht weiterhin
 * die App-Ansicht, obwohl die URL /login zeigt.
 *
 * Diese Tests werden grün, sobald handleLogout eine echte Navigation ausführt
 * (`window.location.href = '/login'` oder `window.location.assign('/login')`), die einen Reload
 * auslöst: Root.tsx remountet → checkAuth() → /auth/me 401 → <LoginPage> wird angezeigt.
 *
 * Testdesign: `/auth/me` gibt beim ersten Aufruf 200 zurück (App lädt), nach dem Logout 401
 * (Session zerstört). Mit pushState wird /auth/me nach dem Klick gar nicht erneut aufgerufen
 * (kein Reload), sodass die LoginPage nie erscheint → Tests schlagen fehl (ROT). Mit echter
 * Navigation folgt ein Reload, /auth/me antwortet 401, LoginPage rendert → Tests grün.
 */

const stubBackend214 = async (
	page: Page,
	{ authMeResponse }: { authMeResponse: () => { status: number; body: object } },
): Promise<void> => {
	await page.route('**/auth/me', (route) => {
		const { status, body } = authMeResponse();
		route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
	});
	await page.route('**/api/v1/tasks', (route) =>
		route.request().method() === 'GET' ? route.fulfill(fulfillJson([SAMPLE_TASK])) : route.continue(),
	);
	await page.route('**/api/v1/forest', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/next', (route) => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/v1/suggestions', (route) => route.fulfill(fulfillJson([])));
	await page.route('**/api/v1/pillars', (route) => route.fulfill(fulfillJson([])));
};

test.describe('#214 Nach Logout zur Login-Seite weiterleiten', () => {
	/**
	 * AK-1: Nach erfolgreichem Logout wird die Login-Seite gerendert (echte Navigation).
	 *
	 * pushState ändert nur die URL; Root.tsx bleibt eingehängt → LoginPage erscheint nie.
	 * Dieser Test ist ROT bis handleLogout window.location.href (oder assign) statt pushState nutzt.
	 */
	test('AK-1: Nach Logout wird die Login-Seite gerendert (nicht nur URL geändert)', async ({ page }) => {
		let sessionActive = true;
		await stubBackend214(page, {
			authMeResponse: () =>
				sessionActive
					? { status: 200, body: { id: 1, name: DISPLAY_NAME, email: 'peter@example.com' } }
					: { status: 401, body: { message: 'Unauthorized' } },
		});
		await page.route('**/auth/logout', (route) => {
			sessionActive = false;
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.goto('/');
		await waitForStableView(page);
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toBeVisible();

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		// Echte Navigation → Root.tsx remountet → /auth/me → 401 → LoginPage erscheint.
		// Mit pushState bleibt Root.tsx eingehängt, LoginPage wird nie gerendert → Timeout → ROT.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
	});

	/**
	 * AK-2: Nach dem Redirect ist der Logout-Button nicht mehr im DOM (App-Baum abgebaut).
	 *
	 * Mit pushState bleibt der React-Baum eingehängt; der Logout-Button ist weiterhin vorhanden
	 * (ggf. im Loading-Zustand). Erst eine echte Navigation baut den App-Baum ab.
	 */
	test('AK-2: Nach Logout ist der Logout-Button nicht mehr vorhanden (App abgebaut)', async ({ page }) => {
		let sessionActive = true;
		await stubBackend214(page, {
			authMeResponse: () =>
				sessionActive
					? { status: 200, body: { id: 1, name: DISPLAY_NAME, email: 'peter@example.com' } }
					: { status: 401, body: { message: 'Unauthorized' } },
		});
		await page.route('**/auth/logout', (route) => {
			sessionActive = false;
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		// LoginPage muss sichtbar sein (stellt sicher, dass die Prüfung nach echter Navigation gilt).
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		// Kein Logout-Button auf der Login-Seite.
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);
	});

	/**
	 * AK-3: Das Redirect-Ziel nach dem Logout ist /login (korrekte Route).
	 *
	 * Stellt sicher, dass nicht auf / oder /home umgeleitet wird. Die URL-Prüfung allein unterscheidet
	 * nicht zwischen pushState und echter Navigation — sie ist daher mit der LoginPage-Prüfung (AK-1)
	 * kombiniert: beide müssen zutreffen.
	 */
	test('AK-3: Redirect-Ziel nach Logout ist /login (korrekte Route, LoginPage gerendert)', async ({ page }) => {
		let sessionActive = true;
		await stubBackend214(page, {
			authMeResponse: () =>
				sessionActive
					? { status: 200, body: { id: 1, name: DISPLAY_NAME, email: 'peter@example.com' } }
					: { status: 401, body: { message: 'Unauthorized' } },
		});
		await page.route('**/auth/logout', (route) => {
			sessionActive = false;
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
		});

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		// Echte Navigation ist Pflicht: LoginPage muss rendern (ROT mit pushState).
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		// Und die URL muss /login lauten (kein Redirect auf / oder /home).
		await expect(page).toHaveURL(/\/login(\b|\/|$)/);
	});
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
		// Auth-Gate schließen: /auth/me antwortet mit 401 (nicht authentifiziert). Der zuletzt
		// registrierte Handler gewinnt und überschreibt den 200-Mock aus stubBackend.
		await page.route('**/auth/me', (route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unauthorized' }),
			}),
		);
		await page.goto('/');

		// Ohne Authentifizierung zeigt die App die LoginPage — also keine Toolbar und kein Logout-Button.
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);
	});

	/**
	 * AK-3: Der Logout-Button ist das letzte (rechteste) Toolbar-Element.
	 * „rechts oben" bedeutet: kein weiterer Toolbar-Button folgt danach.
	 */
	test('AK-3: Logout-Button ist das letzte Element in der Toolbar', async ({ page }) => {
		await stubBackend(page);
		await page.goto('/');
		await waitForStableView(page);

		const toolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ });
		const buttons = toolbar.getByRole('button');
		// KolToolbar rendert seine Buttons asynchron im Shadow-DOM; erst warten, bevor gezählt wird.
		await expect(buttons.first()).toBeVisible();
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

/**
 * ROTE Spec-Tests für #191 „feat: Logout-Button in Navigation" (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Ziel des Tickets (siehe Triage-Analyse): Der Header/die Navigation erhält einen **Logout-Button**.
 * Er ist nur für authentifizierte Benutzer sichtbar (Server-Side-Session via GET /auth/me;
 * vgl. `Root.tsx`). Ein Klick sendet `POST /auth/logout` (zerstört die Session) und leitet
 * anschließend auf die Login-Seite (`/login`) um. Schlägt der Logout fehl, bleibt der Nutzer
 * eingeloggt und der Button wieder bedienbar (AK-5, siehe `src/App.test.tsx`).
 *
 * Diese Tests sind **rot**, bis die Umsetzung den Logout-Button samt Verdrahtung
 * (`api.logout` → `POST /auth/logout` → Redirect `/login`) in `App.tsx` ergänzt.
 *
 * Anders als die funktionalen CRUD-Specs mocken diese Tests die Auth-Endpunkte bewusst über
 * `page.route`: Das echte Test-Backend (In-Memory-DB) kennt weder `/auth/logout` noch eine
 * Login-Seite. Die fachlichen Lade-Endpunkte (`/tasks` …) liefern wir ebenfalls per `route`, damit die
 * App unabhängig vom Seed-Zustand in die eingeloggte Dashboard-Ansicht rendert.
 *
 * Seit #190 hängt vor der Haupt-App ein Auth-Gate (`Root.tsx`): Nur wenn `GET /auth/me` einen User
 * liefert, wird die App gerendert. `stubBackend` mockt `/auth/me` daher standardmäßig als
 * authentifiziert, damit das Gate durchlässig ist.
 */
test.describe('#191 Logout-Button in Navigation', () => {
	/**
	 * AK-1 — Sichtbarkeit nur für authentifizierte Benutzer: Ohne gültige Session (/auth/me = 401)
	 * existiert KEIN Logout-Button; mit gültiger Session (/auth/me = 200) ist er sichtbar.
	 */
	test('AK-1: Logout-Button nur für authentifizierte Benutzer sichtbar', async ({ page }) => {
		await stubBackend(page);

		// Nicht eingeloggt: /auth/me = 401 → LoginPage → kein Logout-Button.
		const unauthenticated = (route: Route) =>
			route.fulfill({
				status: 401,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unauthorized' }),
			});
		await page.route('**/auth/me', unauthenticated);
		await page.goto('/');
		await expect(page.getByRole('button', { name: /Login with Google/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).toHaveCount(0);

		// Eingeloggt: /auth/me = 200 → App mit Toolbar → Logout-Button ist sichtbar.
		await page.unroute('**/auth/me', unauthenticated);
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

		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		await expect(page).toHaveURL(/\/login(\b|\/|$)/);
	});

	/**
	 * AK-4 — Session zerstört: Nach dem Logout ist die Session serverseitig beendet; ein erneuter
	 * API-Aufruf wird mangels Session mit 401 abgelehnt. Geprüft wird der beobachtbare Vertrag:
	 * ein bewusst auf 401 gemockter API-Endpunkt gewährt keinen Zugriff mehr auf die eingeloggte Ansicht.
	 */
	test('AK-4: nach Logout ist die Session zerstört (Auth-State bereinigt, neue Anfragen abgelehnt)', async ({
		page,
	}) => {
		await stubBackend(page);

		await page.route('**/auth/logout', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();
		await expect(page).toHaveURL(/\/login(\b|\/|$)/);

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

	/**
	 * AK-5 — Logout schlägt fehl: Fehlermeldung erscheint, Button wird wieder aktiviert,
	 * der Nutzer bleibt eingeloggt (kein Redirect auf /login, Auth-State erhalten).
	 * E2E-Ersatz für die in App.test.tsx mit it.skip markierten Unit-Tests (KolBX-Items
	 * nicht per findByRole in JSDOM erreichbar).
	 */
	test('AK-5: bei fehlgeschlagenem Logout bleibt Nutzer eingeloggt, Fehler wird angezeigt, Button wieder aktiv', async ({
		page,
	}) => {
		await stubBackend(page);

		await page.route('**/auth/logout', (route) =>
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Logout fehlgeschlagen' }),
			}),
		);

		await page.goto('/');
		await waitForStableView(page);

		await page.getByRole('button', { name: /Abmelden|Logout/i }).click();

		// Fehlermeldung ist sichtbar.
		await expect(page.getByRole('alert')).toBeVisible();

		// Kein Redirect auf /login — Nutzer bleibt auf der App-Seite.
		await expect(page).not.toHaveURL(/\/login/);

		// Button ist nach dem Fehlschlag wieder bedienbar (nicht dauerhaft disabled).
		await expect(page.getByRole('button', { name: /Abmelden|Logout/i })).not.toBeDisabled();
	});
});
