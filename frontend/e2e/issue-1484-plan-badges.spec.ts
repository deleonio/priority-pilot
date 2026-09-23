import { expect, test, type Page } from './fixtures';
import { openAccordionSection, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #1484 (T3b, Spec docs/spec/issue-1484.md AK8/AK9) — Paket-Badges an den
 * übrigen Grenzstellen bei 375×812.
 *
 * Läuft gegen das echte Backend (Muster `issue-1352-api-tokens.spec.ts`): eine frische Session
 * über `POST /auth/test-login` liegt standardmäßig auf Paket `free` — Free hat weder `ai_assist`
 * noch `voice_input` (seit #1484 A1) noch `mcp_readwrite`, jede Grenzstelle zeigt also den
 * Paket-Badge-Zweig (seit #1528: Beschriftung + Link, kein (i)-Schalter mehr), nicht den Haken.
 *
 * AK8: Badge und umgebende Zeile bleiben innerhalb des 375px-Viewports (Bounding-Box, keine
 * `scrollWidth`-Prüfung, MEMORY 2026-08-24 — die App-Shell clippt mit `overflow-x: hidden`).
 * AK9: außerhalb des geöffneten Angebots-Dialogs erscheint kein Preis-/Werbetext.
 *
 * #1524 (Spec docs/spec/issue-1524.md) macht die voice_input-Grenzstelle aus #1484 rückgängig
 * (AK2: kein Badge, keine Sperre mehr, auch nicht für Free) und ergänzt am Ende der Datei einen
 * eigenen Test für die um `mcp_read` erweiterte Paket-Tabelle (AK9 von #1524, nicht zu verwechseln
 * mit dem gleichnamigen AK9 von #1484 oben).
 */

const TEST_EMAIL = 'plan-badges-1484@example.com';

const login = async (page: Page): Promise<void> => {
	const res = await page.request.post('/auth/test-login', {
		data: { email: TEST_EMAIL, displayName: 'Badge Tester' },
	});
	expect(res.status(), 'test-login muss eine Session liefern').toBe(200);
	// Der `/auth/me`-Mock der Fixture (`fixtures.ts`) liefert nur `{id, displayName, email}` — ohne
	// `plan`/`entitlements`. `PlanBadge` rendert ohne Entitlement bewusst `null` (`PlanBadge.tsx:22`),
	// damit kein falsches Badge erscheint; mit dem Mock wäre hier also KEIN Badge im DOM. Diese Spec
	// braucht die echte Serverantwort (Paket `free` + Entitlement-Map, `auth.ts:339`), deshalb wird der
	// Fixture-Handler abgeräumt — die Session aus `test-login` trägt den Cookie bereits.
	await page.unroute('**/auth/me');
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	if (!response.ok()) return;
	for (const task of (await response.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/tasks/${task.id}`);
	}
};

const deleteAllTokens = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/api-tokens');
	if (!res.ok()) return;
	for (const token of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/api-tokens/${token.id}`);
	}
};

// Test-Pflege (#1525): mit KI-Gate ausgeblendetem Lektorat-Block (Titel/Beschreibung, `aiEnabled`
// jetzt false für Free) ist der Säulen-Vorschlag (`TaskForm.tsx:1473`, nicht `aiEnabled`-gegated)
// die einzige verbliebene `ai_assist`-Grenzstelle im Aufgabenformular — die aber nur rendert, wenn
// mindestens eine Säule existiert. `test-login` legt (anders als der echte Google-Signup-Pfad) KEINE
// Standard-Säulen an, daher hier selbst eine anlegen.
const ensurePillar = async (page: Page): Promise<void> => {
	const existing = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
	if (existing.length > 0) return;
	await page.request.post('/api/v1/pillars', { data: { name: 'Badge-Test-Säule', description: 'Dummy' } });
};

const deleteAllPillars = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/pillars');
	if (!res.ok()) return;
	for (const pillar of (await res.json()) as { id: number }[]) {
		await page.request.delete(`/api/v1/pillars/${pillar.id}`);
	}
};

// Test-Pflege (#1527): der Säulen-Vorschlag (`TaskForm.tsx:1473`) rendert Badge und Button jetzt
// nur noch, wenn `useAiFeaturesGate()` true ist — für Free (kein `ai_assist`) ist das nur über
// einen eigenen LLM-Provider der Fall (`computeAiFeaturesEnabled`: `entitlementAllowed ||
// hasCustomProvider`). Mit Custom-Provider bleibt die `ai_assist`-Berechtigung selbst weiterhin
// `false`, `PlanBadge` zeigt also unverändert den Angebots-Zweig (mit (i)-Schalter) — genau der
// Zustand, den AK3/AK5/AK8 prüfen. Payload-Vorbild: `issue-1037-llm-action-buttons.spec.ts`.
const createCustomProvider = async (page: Page): Promise<void> => {
	const response = await page.request.post('/api/v1/llm-providers', {
		data: {
			name: 'Badge-Test-Provider',
			endpoint: 'http://localhost:9/v1',
			apiKey: 'test-key',
			model: 'test-model',
		},
	});
	expect(response.ok(), 'Custom-LLM-Provider muss serverseitig anlegbar sein').toBe(true);
};

const deleteAllCustomProviders = async (page: Page): Promise<void> => {
	const res = await page.request.get('/api/v1/llm-providers');
	if (!res.ok()) return;
	for (const provider of (await res.json()) as { id: number; kind: 'custom' | 'builtin' }[]) {
		if (provider.kind === 'custom') {
			await page.request.delete(`/api/v1/llm-providers/${provider.id}`);
		}
	}
};

/**
 * `boundingBox()` misst EINMALIG und wartet — anders als `toBeVisible()` — nicht nach: Fällt die
 * Messung in einen Re-Render des Formulars (das Lektorat-/Säulen-Umfeld der Badges rendert nach
 * dem Schließen des Vorlagen-Schritts noch nach), liefert sie `null`, obwohl das Element eine
 * Zeile später wieder Layout hat. Genau daran scheiterte `e2e (4)` in CI, während dieselbe Stelle
 * lokal grün war. Deshalb bis zum Playwright-Timeout nachmessen statt einmal zu greifen.
 */
const boundingBoxWhenLaidOut = async (locator: ReturnType<Page['locator']>) => {
	for (let attempt = 0; attempt < 30; attempt++) {
		const box = await locator.boundingBox();
		if (box !== null) return box;
		await locator.page().waitForTimeout(100);
	}
	return null;
};

/** Bounding-Box darf den 375px-Viewport nicht überragen (kein horizontales Scrollen). */
const expectWithinViewport = async (locator: ReturnType<Page['locator']>): Promise<void> => {
	const box = await boundingBoxWhenLaidOut(locator);
	expect(box, 'Element muss eine Bounding-Box haben').not.toBeNull();
	expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
};

test.describe('Balamentum — #1484: Paket-Badges an den übrigen Grenzstellen (375px)', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await login(page);
		await ensurePillar(page);
	});

	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
		await deleteAllTokens(page);
		await deleteAllPillars(page);
		await deleteAllCustomProviders(page);
	});

	// Test-Pflege (#1525/#1527): Free ohne `ai_assist` öffnet über das neue KI-Gate direkt das
	// Task-Formular („Aufgabe anlegen") — kein Freitext-Einstieg mit „Überspringen" mehr. Die
	// Lektorat-Badges bei Titel/Beschreibung sind mit dem Lektorat-Button selbst ausgeblendet
	// (`{aiEnabled && …}`, `TaskForm.tsx:1042/1401`); die zweite KI-Grenzstelle beim
	// Säulen-Vorschlag (`TaskForm.tsx:1473`) liegt seit #1527 ebenfalls hinter `aiEnabled` — ohne
	// eigenen LLM-Provider bliebe sie für Free ganz unsichtbar. Ein Custom-Provider hebt das Gate,
	// ohne die `ai_assist`-Berechtigung selbst zu ändern, sodass der Angebots-Badge weiter erscheint.
	test('AK3/AK8: Aufgabenformular zeigt das ai_assist-Badge ohne horizontalen Overflow', async ({ page }) => {
		await createCustomProvider(page);
		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		// Mit Custom-Provider ist `aiEnabled` (App.tsx) jetzt true — „Neuen Task anlegen" öffnet daher
		// den verschmolzenen Freitext-Dialog (QuickCaptureModal, #1335) statt direkt das Task-Formular.
		// „Überspringen" führt ohne LLM-Aufruf ins leere Formular, das AK3/AK8 hier prüfen sollen.
		await page.getByRole('button', { name: 'Überspringen' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
		await waitForStableView(page);
		await openAccordionSection(page, 'Optional');

		const aiAssistBadge = page.getByTestId('plan-badge-ai_assist').first();
		await expect(aiAssistBadge).toBeVisible();
		await expectWithinViewport(aiAssistBadge);
	});

	// #1524 AK2 (Spec docs/spec/issue-1524.md) macht die #1484-Grenzstelle rückgängig: voice_input
	// ist wieder für jedes Paket erlaubt, `VoiceField` rendert daher kein Badge mehr — auch nicht für
	// Free. Ersetzt den voice_input-Teil des Tests oben (Test-Pflege: der alte Test erwartete ein
	// sichtbares `plan-badge-voice_input`, das AK2 explizit entfernt).
	test('#1524 AK2: kein voice_input-Badge mehr im Aufgabenformular, auch nicht für Free', async ({ page }) => {
		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
		await waitForStableView(page);

		await expect(page.getByTestId('plan-badge-voice_input').first()).not.toBeVisible();
	});

	// Test-Pflege (#1528 AK1/AK3): der (i)-Schalter und der globale Angebots-Dialog sind entfallen —
	// außerhalb von Modalen ist das Badge selbst der Link auf den Pakete-Reiter (Entscheidung B des
	// Autors). Grenzstelle hier: `GroupsSection` auf /settings/gruppen (kein Modal, kein KI-Gate).
	test('#1528 AK1/AK3: Badge-Klick außerhalb eines Modals öffnet den Pakete-Reiter, kein Dialog', async ({ page }) => {
		await page.goto('/app/settings/gruppen');
		await waitForStableView(page, 'Allgemein');

		const badge = page.getByTestId('plan-badge-groups');
		await expect(badge).toBeVisible();
		await badge.click();

		await expect(page.getByTestId('plans-section')).toBeVisible();
		await expect(page.getByRole('dialog').filter({ hasText: /Pro|Max|Ultimate/ })).toHaveCount(0);
	});

	// #1528 AK3/TF5: innerhalb der Schnellerfassung hat das Badge kein Klickziel (`inModal`) — ein
	// Klick schließt nichts und der eingetippte Text bleibt im Feld, bei 375px und 1280px.
	test('#1528 AK3: Schnellerfassungs-Text bleibt nach Badge-Klick im Modal erhalten (375px und 1280px)', async ({
		page,
	}) => {
		await createCustomProvider(page);
		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		const capture = page.getByRole('textbox', { name: /Beschreibe/ });
		await expect(capture).toBeVisible();
		const badge = page.getByTestId('plan-badge-ai_assist');
		await expect(badge).toBeVisible();

		await capture.fill('Laufen gehen am Sonntag');
		await badge.click();
		await expect(capture).toHaveValue('Laufen gehen am Sonntag');
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();

		await page.setViewportSize({ width: 1280, height: 800 });
		await capture.fill('Zweiter Entwurf');
		await badge.click();
		await expect(capture).toHaveValue('Zweiter Entwurf');
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	});

	// Test-Pflege #1526 AK6 (Spec docs/spec/issue-1526.md): das mcp_readwrite-Badge an der
	// Rechte-Zeile entfällt — die Paket-Erklärung steht jetzt ausschließlich im Gating-Alert unter
	// dem Regler (#1526 AK4). Ersetzt den vorigen Test „zeigt das mcp_readwrite-Badge …", der genau
	// das Gegenteil erwartete.
	test('#1526 AK4/AK6: Zugriff-Einstellungen zeigen keinen Badge, aber einen Ultimate-Alert ohne Overflow', async ({
		page,
	}) => {
		// #1526 AK2 sperrt „Token erzeugen" auf Paket `free` (kein `mcp_read`) — ein Klick durch die
		// UI liefe hier ins Leere (Button `_disabled`). Seed direkt per API, wie in
		// `issue-1526-access-token-gating.spec.ts` (`seedApiToken`): der Server-Guard bleibt ohne
		// `MONETIZATION_ENFORCED` inaktiv, das Anlegen gelingt trotz `mcp_read.allowed === false`.
		const created = await page.request.post('/api/v1/api-tokens', {
			data: { name: 'mcp-badge-1484', expiresInDays: 30 },
		});
		expect(created.status(), 'API-Token muss serverseitig anlegbar sein (Guard bleibt unverändert)').toBe(201);

		await page.goto('/app/settings/zugriff');
		await waitForStableView(page, 'Allgemein');

		await expect(page.getByTestId('plan-badge-mcp_readwrite')).toHaveCount(0);

		const alert = page.locator('kol-alert[_type="info"]').filter({ hasText: 'Ultimate' }).first();
		await expect(alert).toBeVisible();
		await expectWithinViewport(alert);
	});

	test('AK9: außerhalb des Angebots-Dialogs erscheint kein Preis-/Werbetext', async ({ page }) => {
		await page.goto('/app/aufgaben');
		await waitForStableView(page);
		await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
		await expect(page.getByRole('heading', { name: 'Aufgabe anlegen' })).toBeVisible();
		await waitForStableView(page);

		// Kein offener Angebots-Dialog in diesem Zustand — daher darf kein Preistext (€) im
		// sichtbaren Formular stehen, außer innerhalb eines `PlanBadge`/`PlanOfferDialog`.
		await expect(page.getByRole('dialog').filter({ hasText: '€' })).toHaveCount(0);
		const priceOutsideBadge = page
			.locator('body >> text=/\\d+\\s?€/')
			.filter({ hasNot: page.locator('[data-testid^="plan-badge"]') });
		await expect(priceOutsideBadge).toHaveCount(0);
	});

	/**
	 * #1524 AK9 (Spec docs/spec/issue-1524.md) — die um `mcp_read` erweiterte Paket-Tabelle
	 * (`PlansSection.tsx`, Einstellungen → Pakete) bleibt bei 375px vollständig lesbar. Prüft
	 * bewusst die ZEILENANZAHL (sieben Feature-Zeilen statt sechs) statt eines fest verdrahteten
	 * Zeilentitels — der genaue Wortlaut von `FEATURE_OFFERS.mcp_read` ist Implementierungsdetail.
	 * Rot, bis der Katalog um `mcp_read` wächst (heute: sechs Zeilen in `tbody`).
	 *
	 * Test-Pflege (#1529, Spec docs/spec/issue-1529.md AK1/AK2/AK3): die Pakete-Sektion zieht vom
	 * Allgemein-Tab auf den eigenen `/settings/pakete`-Reiter um. Die Matrix ist außerdem keine
	 * native `<table>` mehr, sondern ein `<kol-table-stateful>`-Host mit eigenem Shadow-DOM (rohe
	 * CSS-Selektoren wie `table`/`tbody tr` finden dort nichts, Rollen-Locators piercen aber nativ
	 * durch — Vorbild `completed-tasks.spec.ts`). Und: seit AK3 liegen zusätzlich die 3 Preis- und
	 * 3 Buchen-Zeilen mit im Körper (vorher nur Feature-Zeilen) — Datenzeilen werden deshalb über
	 * „Zeile ohne `columnheader`-Zelle" von der Kopfzeile abgegrenzt, die erwartete Feature-
	 * Zeilenanzahl ergibt sich als Gesamtzahl der Datenzeilen minus dieser 6 konstanten Zeilen.
	 */
	test('#1524 AK9: die erweiterte Paket-Tabelle (7 Feature-Zeilen) bleibt ohne horizontalen Overflow', async ({
		page,
	}) => {
		await page.goto('/app/settings/pakete');
		await waitForStableView(page, 'Allgemein');

		const host = page.getByTestId('plans-section').locator('kol-table-stateful');
		await expect(host).toBeVisible();

		const PRICE_AND_ACTION_ROWS = 3 + 3;
		const bodyRows = host.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
		await expect(bodyRows).toHaveCount(PRICE_AND_ACTION_ROWS + 7);

		// Geprüft wird „kein Seitenüberlauf", nicht „jede Zeile passt in den Viewport": seit #1529
		// (AK4, ADR 0014 Entscheidung 6) scrollt die Matrix bewusst seitlich IM Tabellen-Host. Die
		// Zeilen sind deshalb breiter als 375px — der Host selbst darf den Viewport nicht überragen.
		await expectWithinViewport(host);
	});
});
