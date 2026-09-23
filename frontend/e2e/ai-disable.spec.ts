import { expect, test, type Page } from './fixtures';
import { headerAction, openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1335 — „Schnellerfassung und Berater verschmelzen" (AK4, AK5).
 *
 * Spezifikation: docs/spec/issue-1335.md
 *
 * Vertrag (ersetzt #1080/#1085): Im Settings-Tab „KI-Provider" gibt es nur noch EINEN Schalter
 * „KI-Features aktiv". Der bisherige Feinschalter „Schnellerfassung aktiv" und das Accordion
 * „Einzelne KI-Funktionen" existieren nicht mehr; der Storage-Key `pp-quick-capture-enabled` wird
 * nicht mehr gelesen oder geschrieben (AK4). Bei `pp-ai-enabled = false` öffnet „Neuen Task
 * anlegen" direkt das normale Task-Formular, ohne Freitext-Einstieg und ohne „Beraten lassen" (AK5).
 *
 * **Ersetzt:** Diese Datei ersetzt die #1080/#1085-Tests rund um den zweiten Schalter
 * „Schnellerfassung aktiv" (Test-Pflege-Bedarf, siehe PR-Beschreibung) — sie widersprechen AK4.
 */

/** Legacy-Key, der laut AK4 nicht mehr gelesen/geschrieben werden darf. */
const QUICK_CAPTURE_ENABLED_KEY = 'pp-quick-capture-enabled';

/** Schalter-Locator mit Rollen-Fallback: KoliBri exponiert `switch` bzw. `checkbox` je Version. */
const switchControl = (page: Page, name: RegExp) =>
	page.getByRole('switch', { name }).or(page.getByRole('checkbox', { name }));

/** Setzt die KI-Präferenz vor dem Seitenaufbau (Wert wie in localStorage: 'true'/'false'). */
const initAiEnabled = async (page: Page, aiEnabled: boolean): Promise<void> => {
	await page.addInitScript((value: boolean) => {
		try {
			localStorage.setItem('pp-ai-enabled', String(value));
		} catch {
			/* ignore */
		}
	}, aiEnabled);
};

/** Öffnet den KI-Provider-Tab der Einstellungen. */
const openLlmTab = async (page: Page): Promise<void> => {
	await page.goto('/app/settings/llm');
	await waitForStableView(page, 'Balamentum');
};

test.describe('#1335 KI-Features: ein einziger Schalter', () => {
	test('AK4: genau ein Schalter „KI-Features aktiv" — kein „Schnellerfassung aktiv", kein Accordion', async ({
		page,
	}) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await expect(aiSwitch).toBeVisible();
		await expect(aiSwitch).toBeChecked();

		// Der bisherige Feinschalter existiert nirgends mehr im Tab.
		await expect(switchControl(page, /^Schnellerfassung aktiv$/)).toHaveCount(0);
		// Das Accordion, das ausschließlich diesen Feinschalter enthielt, ist mit ihm verschwunden.
		await expect(page.getByRole('button', { name: /Einzelne KI-Funktionen/ })).toHaveCount(0);

		// Genau ein Schalter im gesamten Tab (kein zweiter Checkbox-/Switch-Input mehr im KI-Bereich).
		const switches = page.locator('.settings-llm kol-input-checkbox[_variant="switch"]');
		await expect(switches).toHaveCount(1);
	});

	test('AK4: der Legacy-Key „pp-quick-capture-enabled" wird beim Umschalten nicht mehr geschrieben', async ({
		page,
	}) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();
		await aiSwitch.click();
		await expect(aiSwitch).toBeChecked();

		const legacyValue = await page.evaluate((key: string) => localStorage.getItem(key), QUICK_CAPTURE_ENABLED_KEY);
		expect(legacyValue).toBeNull();
	});

	test('AK5: KI aus — „Neuen Task anlegen" öffnet direkt das Task-Formular, ohne Freitext-Einstieg', async ({
		page,
	}) => {
		await initAiEnabled(page, false);

		await page.goto('/app/');
		await waitForStableView(page);

		// Toolbar: kein „Säulen-Berater"-Button (Vertrag aus AK1, hier als Randbedingung mitgeprüft).
		await expect(
			page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: 'Säulen-Berater' }),
		).toHaveCount(0);

		// #1408-AK2: der KI-aus-Zustand muss vor dem Klick tatsächlich gesetzt sein — sonst prüft
		// dieser Test unbemerkt den KI-an-Pfad (initAiEnabled-Race, siehe docs/spec/issue-1408.md).
		expect(await page.evaluate(() => localStorage.getItem('pp-ai-enabled'))).toBe('false');

		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());

		// Direkt das Task-Formular (Feld „Titel") — kein Freitext-Capture-Schritt.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveCount(0);
		// Und kein „Beraten lassen"-Weg, da bei KI-aus kein KI-Dialog existiert.
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toHaveCount(0);

		// Kein Lektorat-Button im Formular (unverändertes #1080-Verhalten für aiEnabled=false).
		await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
	});

	test('AK5: die KI-Präferenz übersteht das Neuladen unverändert', async ({ page }) => {
		await openLlmTab(page);

		const aiSwitch = switchControl(page, /^KI-Features aktiv$/);
		await aiSwitch.click();
		await expect(aiSwitch).not.toBeChecked();

		await page.reload();
		await waitForStableView(page, 'Balamentum');

		await expect(switchControl(page, /^KI-Features aktiv$/)).not.toBeChecked();
	});
});

// ── #1525 (TF4, Spec docs/spec/issue-1525.md AK3) ───────────────────────────────────────────────

/**
 * Rote Spec-e2e für #1525 AK3 — Free-Konto (keine `ai_assist`-Berechtigung, kein eigener Provider):
 * `pp-ai-enabled = 'true'` allein darf kein KI-Bedienelement mehr erreichbar machen — weder den
 * KI-Anlege-Dialog noch die Lektorat-Buttons. Läuft gegen das echte Backend (Muster
 * `issue-1484-plan-badges.spec.ts`): `POST /auth/test-login` liefert standardmäßig Paket `free`.
 *
 * Heute rot: `App.tsx`/`TaskForm.tsx` blenden die KI-Elemente ausschließlich anhand von
 * `readAiPreferences().aiEnabled` ein — ohne Rücksicht auf die fehlende `ai_assist`-Berechtigung.
 */
test.describe('#1525 KI-Gate: Free-Konto ohne Berechtigung', () => {
	const TEST_EMAIL = 'ai-gate-1525@example.com';

	const loginAsFree = async (page: Page): Promise<void> => {
		const res = await page.request.post('/auth/test-login', {
			data: { email: TEST_EMAIL, displayName: 'AI Gate Tester' },
		});
		expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
		// Echte Serverantwort (Paket + Entitlement-Map) statt des Fixture-Mocks — wie in
		// issue-1484-plan-badges.spec.ts (der Fixture-Mock liefert keine Entitlements).
		await page.unroute('**/auth/me');
	};

	test('AK3: pp-ai-enabled=true, Free-Konto → kein KI-Anlege-Dialog, keine Lektorat-Buttons', async ({ page }) => {
		await initAiEnabled(page, true);
		await loginAsFree(page);

		await page.goto('/app/');
		await waitForStableView(page);

		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());

		// Direkt das Task-Formular — kein Freitext-Capture-Schritt, obwohl `pp-ai-enabled=true`.
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /Beschreibe/ })).toHaveCount(0);
		// Kein Lektorat-Button im Formular, obwohl die Präferenz an ist.
		await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
	});
});

// ── #1527 (Spec docs/spec/issue-1527.md AK5/AK6) ────────────────────────────────────────────────

/**
 * Rote Spec-e2e für #1527 AK5/AK6 — letzter ungegateter KI-Einstieg: der Säulen-Berater im
 * Aufgabenformular (`.pillar-editor-head` in den Basisangaben, seit #1596). Ein Free-Konto ohne
 * `ai_assist`-Berechtigung darf im gesamten Anlege-Weg kein KI-Bedienelement mehr finden und keinen
 * KI-Endpunkt aufrufen — auch nicht `/tasks/suggest-pillars`. `.pillar-editor-head` rendert nur,
 * wenn mindestens eine Säule existiert — das Seeding kommt seit #1573 aus der Registrierung
 * (loginAsFree unten), ein CRUD-Fallback ist serverseitig gesperrt.
 */
test.describe('#1527 KI-Gate: Säulen-Berater ohne Berechtigung', () => {
	// #1573-Test-Pflege: `/auth/test-login` säht KEINE Säulen (findOrCreate ohne Seeding — nur
	// register legt die fünf Standard-Säulen an, auth.ts). `.pillar-editor-head` rendert aber erst
	// ab einer Säule, daher wird hier ein frischer Nutzer per register angemeldet
	// (`registerOwnSession`). Danach `unroute`, damit `/auth/me` die echte Session spiegelt.
	const loginAsFree = async (page: Page): Promise<void> => {
		await registerOwnSession(page, 'ai-gate-1527');
		await page.unroute('**/auth/me');
	};

	// Früher POST /pillars als Fallback — seit #1573 serverseitig gesperrt (403). register
	// garantiert die Standard-Säulen, daher bleibt dies ein lauter Guard: ohne Säule rendert
	// `.pillar-editor-head` nicht und AK5/AK6 würden aus dem falschen Grund rot.
	const ensurePillar = async (page: Page): Promise<void> => {
		const existing = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
		expect(existing.length, 'Test-Nutzer braucht Standard-Säulen (register-Seeding)').toBeGreaterThan(0);
	};

	/** `boundingBox()` bis zum Layout nachmessen — Muster `issue-1484-plan-badges.spec.ts:80-87`. */
	const boundingBoxWhenLaidOut = async (locator: ReturnType<Page['locator']>) => {
		for (let attempt = 0; attempt < 30; attempt++) {
			const box = await locator.boundingBox();
			if (box !== null) return box;
			await locator.page().waitForTimeout(100);
		}
		return null;
	};

	test.beforeEach(async ({ page }) => {
		await initAiEnabled(page, true);
		await loginAsFree(page);
		await ensurePillar(page);
	});

	test('AK5: kein Säulen-Vorschlag-Bedienelement und kein Request an /tasks/suggest-pillars', async ({ page }) => {
		const requestedUrls: string[] = [];
		page.on('request', (req) => requestedUrls.push(req.url()));

		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		await openAccordionSection(page, 'Optional');

		await expect(page.getByRole('button', { name: /Säulen vorschlagen/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /lektorieren/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Verarbeiten und weiter' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Beraten lassen' })).toHaveCount(0);
		await expect(page.getByTestId('plan-badge-ai_assist')).toHaveCount(0);

		expect(requestedUrls.some((url) => url.includes('/pillars/advisor'))).toBe(false);
		expect(requestedUrls.some((url) => url.includes('/tasks/parse-text'))).toBe(false);
		expect(requestedUrls.some((url) => url.includes('/tasks/suggest-pillars'))).toBe(false);
	});

	test('AK6 (375px): .pillar-editor-head enthält nur die Überschrift und bleibt im Viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });

		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await headerAction(page, 'Neuen Task anlegen').then((button) => button.click());
		await expect(page.getByRole('textbox', { name: 'Titel' })).toBeVisible();

		// #1596: Die Säulen-Verteilung liegt in den Basisangaben (immer offen) — kein Aufklappen nötig.
		const head = page.locator('.pillar-editor-head');
		const box = await boundingBoxWhenLaidOut(head);
		expect(box, '.pillar-editor-head muss eine Bounding-Box haben').not.toBeNull();
		expect(box!.height).toBeLessThan(48); // eine Textzeile, kein Badge/Button erzeugt eine zweite
		expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);

		await expect(head.getByText('Säulen-Verteilung')).toBeVisible();
		await expect(head.getByRole('button', { name: /Säulen vorschlagen/ })).toHaveCount(0);
		await expect(head.getByTestId('plan-badge-ai_assist')).toHaveCount(0);
	});
});
