import type { APIRequestContext, Page, Route } from '@playwright/test';
import { expect, test as base } from '@playwright/test';

import { createOwnSession } from './helpers';

// Fester Frontend-Port — identisch zu `PORT` in `playwright.config.ts` (dort bewusst fix).
const E2E_BASE_URL = 'http://localhost:4173';

/**
 * Gemeinsame Test-Basis für die **funktionalen** E2E-Specs (`smoke`, `crud`, `balance`, `series`,
 * `suggestions`, `focus-after-delete`, `header-toolbar`, `api-v1-proxy`).
 *
 * **Hintergrund:** Seit #190 hängt vor der Haupt-App eine Auth-Gate (`Root.tsx`): Nur wenn
 * `GET /auth/me` einen User liefert, rendert die App; sonst erscheint die Login-Seite. Die
 * funktionalen Specs sprechen bewusst das echte Backend an — dieses kennt jedoch **keine**
 * `/auth`-Route, und der Vite-Proxy reicht nur `/api/v1/*` durch. `GET /auth/me` fiele also auf den
 * SPA-Fallback (HTML) zurück → `checkAuth()` wertet das als „nicht authentifiziert" → Login-Seite,
 * und jede Assertion auf die Haupt-App liefe in einen Timeout.
 *
 * Diese Fixture mockt `GET /auth/me` daher **standardmäßig** mit einem authentifizierten User, sodass
 * die Auth-Gate für alle funktionalen Specs durchlässig ist. Nur `/auth/me` wird abgefangen — alle
 * übrigen Requests (`/api/v1/*` etc.) gehen unverändert an das echte Backend.
 *
 * **Eigene Session je Test (#2508):** Standardmäßig registriert die Fixture zusätzlich pro Test einen
 * eigenen Nutzer (`createOwnSession`, Mechanik `registerOwnSession`) — Browser-Kontext und
 * `request`-Kontext laufen unter derselben Session, alle API-Schreibzugriffe bleiben in den eigenen
 * Daten und kollidieren nicht mit dem Bestand anderer Specs desselben Shards. `plan`/`entitlements`
 * des `/auth/me`-Mocks bleiben weiterhin `AUTHENTICATED_USER` (Pro-Pfad, #1525/#1335); nur `id`/`email`
 * sind die realen der Session. Wer bewusst den Pass-Through-Bestand braucht, opted aus per
 * `test.use({ ownSession: false })`.
 *
 * **Vorrang spec-eigener Mocks:** Playwright wertet Route-Handler in umgekehrter Registrierungsreihen-
 * folge aus (zuletzt registriert = zuerst geprüft). Da diese Fixture ihren `/auth/me`-Handler **vor**
 * Übergabe der Page registriert, gewinnt jeder spätere `page.route('**\/auth/me', ...)` aus einem Spec
 * (z. B. `login.spec.ts`, das gezielt 401/200 steuert). `login.spec.ts` importiert daher weiterhin
 * direkt aus `@playwright/test` und braucht diese Fixture nicht.
 */

// #1525: `entitlements` ist optional im Client-Typ (`AuthUser`, `auth.ts:17`), aber ohne sie bleibt
// `ai_assist` dauerhaft `undefined` → das neue KI-Gate sperrt sicherheitshalber (AK5) alle
// KI-Bedienelemente, darunter den Schalter „KI aktivieren" (#1903) in `ai-disable.spec.ts` (#1335).
// Diese Fixture steht für den generischen, voll berechtigten Testnutzer alle funktionalen Specs —
// `ai_assist: allowed:true` hält den Status quo (Pro-Pfad) für Specs, die keine eigene
// Paket-Gegenprobe machen.
const AUTHENTICATED_USER = {
	id: 1,
	displayName: 'Test User',
	email: 'test@example.com',
	plan: 'pro',
	entitlements: { ai_assist: { allowed: true, requiredPlan: 'pro' } },
};

/**
 * `usePlanState` liest den Paket-Spiegel (`pp-plan-<userId>`, `usePlan.ts:36-54`) als SYNCHRONEN
 * Anfangszustand, bevor `/auth/me` überhaupt geantwortet hat — genau dafür gebaut (Kommentar
 * `usePlan.ts:9-12`). Ohne Spiegel startet `entitlementAllowed` in jeder frischen Test-Session als
 * `undefined`, und das KI-Gate hält sich an den sicheren Default `false` (AK5), bis `/auth/me`
 * zurück ist — dieser kurze Sprung false→true verschob in CI das Layout-Timing auch in KI-fernen
 * Specs (Lektorat-Button-Sichtbarkeit im TaskForm, #761/#971). Der vorab gesetzte Spiegel macht
 * `AUTHENTICATED_USER`s Paket von Anfang an synchron verfügbar.
 */
const seedPlanMirror = async (page: Page, user: typeof AUTHENTICATED_USER): Promise<void> => {
	await page.addInitScript(
		(entry: { key: string; value: string }) => {
			try {
				localStorage.setItem(entry.key, entry.value);
			} catch {
				/* ignore */
			}
		},
		{
			key: `pp-plan-${user.id}`,
			value: JSON.stringify({ plan: user.plan, entitlements: user.entitlements }),
		},
	);
};

/**
 * Der Willkommens-Dialog (`App.tsx`, Modal „Willkommen bei Balamentum") öffnet sich bei jedem Start ohne
 * Aufgaben und sperrt als Modal alle Klicks und Tastatur-Navigation dahinter. Ein Init-Skript schließt
 * ihn, sobald er offen ist — `close()` löst `onClose` aus, die App merkt sich „Später" und zeigt den
 * EmptyState. Nur `onboarding-flow.spec.ts` testet den Dialog selbst und schaltet das per
 * `test.use({ dismissOnboarding: false })` ab; Specs mit eigener Basis rufen
 * `dismissOnboardingDialog(page)` selbst auf.
 */
export const dismissOnboardingDialog = async (page: Page): Promise<void> => {
	await page.addInitScript(() => {
		setInterval(() => {
			const host = document.querySelector('kol-dialog[_label="Willkommen bei Balamentum"]') as
				(HTMLElement & { close?: () => void }) | null;
			// eslint-disable-next-line no-restricted-syntax -- Testinfrastruktur: ohne `open`-Prüfung liefe `close()` vor `showModal()` ins Leere
			if (host?.shadowRoot?.querySelector('dialog')?.open) {
				host.close?.();
				// Sequential-Focus-Starting-Point: sonst startet der nächste Tab an der Stelle des
				// entfernten Dialogs statt am Dokumentanfang.
				document.body.tabIndex = -1;
				document.body.focus();
			}
		}, 50);
	});
};

/** Session-Daten des je Test registrierten Eigen-Nutzers (#2508). */
interface OwnSessionUser {
	id: number;
	email: string;
	password: string;
	/** Eigener API-Kontext mit der Session — wird als `request`-Fixture durchgereicht. */
	context: APIRequestContext;
}

export const test = base.extend<{
	dismissOnboarding: boolean;
	ownSession: boolean;
	ownSessionUser: OwnSessionUser | null;
}>({
	dismissOnboarding: [true, { option: true }],
	/** Opt-out (#2508): `false` lässt den Test ohne eigene Session im Pass-Through-Bestand laufen. */
	ownSession: [true, { option: true }],
	// Registriert je Test einen Eigen-Nutzer (Cookie + Plan-Mirror-Basis). Eigener API-Kontext statt
	// des `request`-Fixtures: ein `request`-Override, der an dieser Fixture hängt, würde mit deren
	// eigener `request`-Abhängigkeit einen Fixture-Zyklus spannen.
	ownSessionUser: async ({ playwright, ownSession }, runTest) => {
		if (!ownSession) {
			await runTest(null);
			return;
		}
		const context = await playwright.request.newContext({ baseURL: E2E_BASE_URL });
		const { email, password } = await createOwnSession(context, 'fixture');
		const me = await context.get('/auth/me');
		expect(me.status(), 'register muss eine echte Session mit /auth/me liefern').toBe(200);
		const { id } = (await me.json()) as { id: number };
		await runTest({ id, email, password, context });
		await context.dispose();
	},
	// Durchreich-Override: reine `request`-Tests bekommen so den eigenen Session-Kontext (Lazy-Fixtures
	// zünden nur über Abhängigkeiten — ohne diesen Override liefen sie im Pass-Through-Bestand).
	request: async ({ request, ownSessionUser }, runTest) => {
		await runTest(ownSessionUser?.context ?? request);
	},
	// Zweiter Parameter ist die Playwright-Fixture-Übergabe (`use`); bewusst `runTest` benannt, damit
	// die `react-hooks/rules-of-hooks`-Heuristik den Aufruf nicht als React-Hook fehldeutet.
	page: async ({ page, dismissOnboarding, ownSessionUser }, runTest) => {
		let user = AUTHENTICATED_USER;
		if (ownSessionUser) {
			// Derselbe Nutzer wie im `request`-Kontext — Browser und API-Aufrufe sehen dieselben Daten.
			const login = await page.request.post('/auth/login', {
				data: { email: ownSessionUser.email, password: ownSessionUser.password },
			});
			expect(login.status(), 'Fixture-Login muss eine Session im Browser-Kontext liefern').toBe(200);
			user = { ...AUTHENTICATED_USER, id: ownSessionUser.id, email: ownSessionUser.email };
		}
		// Login VOR der Mock-Registrierung: der echte `/auth/login` darf nicht vom `/auth/me`-Mock
		// abgefangen werden (Route-Handler treffen nur Seiten-Requests, hier defensiv geordnet).
		await page.route('**/auth/me', (route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(user),
			}),
		);
		await seedPlanMirror(page, user);
		if (dismissOnboarding) {
			await dismissOnboardingDialog(page);
		}
		await runTest(page);
	},
});

export { expect, type Locator, type Page } from '@playwright/test';
