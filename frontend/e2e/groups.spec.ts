import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #1211 (AK6/AK7/AK8) — Settings-Tab „Gruppen" unter /settings/gruppen
 * (Vertrag: docs/spec/issue-1211.md). Gegen das echte Backend (wie crud.spec.ts): Gruppe
 * wird über die UI angelegt und muss anschließend in der Liste sichtbar sein.
 *
 * AK8 (375px ohne horizontales Scrollen) wird per Bounding-Box geprüft — NICHT per
 * scrollWidth: die App-Shell clippt overflow-x:hidden, scrollWidth bleibt strukturell
 * ≤ Viewport (Erfahrung 2026-08-24).
 */

/** Öffnet die Einstellungen direkt auf dem Gruppen-Tab. */
const openGroupsTab = async (page: Page): Promise<void> => {
	await page.goto('/settings/gruppen');
	// 'Gruppen' statt des Default-'Dashboard': Auf /settings/* rendert die App-Shell keine
	// Dashboard-Text (Issue-1098/llm-settings-Specs übergeben ebenfalls einen Seiten-Text).
	await waitForStableView(page, 'Gruppen');
	await expect(page.getByRole('tab', { name: 'Gruppen', exact: true })).toBeVisible();
};

/** Legt über die UI eine Gruppe an (Modal: Name Pflicht, Beschreibung optional). */
const createGroupViaUi = async (page: Page, name: string, description?: string): Promise<void> => {
	await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeVisible();
	await page.getByRole('textbox', { name: 'Name' }).fill(name);
	if (description !== undefined) {
		await page.getByRole('textbox', { name: 'Beschreibung' }).fill(description);
	}
	await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
	await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeHidden();
	// 'Gruppen' statt Default-'Dashboard': Nach dem Schließen des Dialogs sind wir weiterhin
	// auf /settings/gruppen (gleiche Begründung wie in openGroupsTab).
	await waitForStableView(page, 'Gruppen');
};

test.describe('Settings-Tab „Gruppen“ (#1211)', () => {
	test.afterEach(async ({ page }) => {
		// Aufräumen über die echte API, damit nachfolgende Tests leer starten (crud.spec.ts-Muster).
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { id: number }[];
		for (const group of groups) {
			await page.request.delete(`/api/v1/groups/${group.id}`);
		}
	});

	// ── AK6: Tab-Route + Anlegen-Dialog ───────────────────────────────────────────────

	test('Tab „Gruppen“ ist unter /settings/gruppen erreichbar (AK6)', async ({ page }) => {
		await openGroupsTab(page);
		// Panel-Scoped via `.settings-groups` statt `getByRole('tabpanel')`-Chaining: KolTabs
		// slotet den Panel-Inhalt ins Shadow-DOM — slottedes Light-DOM ist im A11y-Baum im
		// Tabpanel geschachtelt, DOM-seitig aber KEIN Nachfahre des Tabpanel-Elements (Muster:
		// issue-969.spec.ts locatet Panels via slot-Attribut).
		await expect(page.locator('.settings-groups').getByRole('heading', { name: 'Gruppen', exact: true })).toBeVisible();
	});

	test('Angelegtabelle: Gruppe erscheint mit Rolle und Mitgliederzahl (AK6)', async ({ page }) => {
		await openGroupsTab(page);
		await createGroupViaUi(page, 'E2E Familie', 'E2E Beschreibung');

		const card = page.getByRole('listitem').filter({ hasText: 'E2E Familie' });
		await expect(card).toBeVisible();
		await expect(card.getByText('E2E Beschreibung')).toBeVisible();
		await expect(card.getByText(/admin/i)).toBeVisible(); // Rolle als Text, nie nur Farbe
		await expect(card.getByText(/1 Mitglied/)).toBeVisible();
	});

	test('Leerer Name im Dialog bleibt mit deutscher Meldung abgewiesen (AK6/AK4)', async ({ page }) => {
		await openGroupsTab(page);
		await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
		await page.getByRole('textbox', { name: 'Name' }).fill('');
		await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
		// Inline-Validierung (KI-UX): Dialog bleibt offen, Meldung sichtbar, nichts angelegt.
		await expect(page.getByRole('heading', { name: /Gruppe anlegen/ })).toBeVisible();
		await expect(page.getByText(/Name/).first()).toBeVisible();
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { name: string }[];
		expect(
			groups.some((group) => group.name === ''),
			'leere Gruppe darf nicht entstehen',
		).toBe(false);
	});

	// ── AK6: Bearbeiten — nur geänderte Felder speichern (Review PR #1214, Finding 1) ──

	test('Bearbeiten: nur geänderte Beschreibung speichern hält den Namen (AK6)', async ({ page }) => {
		await openGroupsTab(page);
		await createGroupViaUi(page, 'E2E Edit', 'Alte Beschreibung');

		const card = page.getByRole('listitem').filter({ hasText: 'E2E Edit' });
		await card.getByRole('button', { name: 'Bearbeiten' }).click();
		await expect(page.getByRole('heading', { name: /Gruppe bearbeiten/ })).toBeVisible();
		// Name-Feld unangetastet lassen: Der Dialog sendet nur geänderte Felder — ohne den
		// serverseitigen GroupUpdate-Vertrag (alle Felder optional) schlägt genau das fehl.
		await page.getByRole('textbox', { name: 'Beschreibung' }).fill('Neue Beschreibung');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { name: /Gruppe bearbeiten/ })).toBeHidden();

		// 'Gruppen' statt Default-'Dashboard' (gleiche Begründung wie in openGroupsTab).
		await waitForStableView(page, 'Gruppen');
		const updatedCard = page.getByRole('listitem').filter({ hasText: 'E2E Edit' });
		await expect(updatedCard.getByText('Neue Beschreibung')).toBeVisible();
		await expect(updatedCard.getByText('E2E Edit')).toBeVisible();
	});

	// ── AK7: Löschen mit sequenzieller Bestätigung ───────────────────────────────────

	test('Löschen verlangt sequenzielle Bestätigung und entfernt die Gruppe (AK7)', async ({ page }) => {
		await openGroupsTab(page);
		await createGroupViaUi(page, 'E2E Weg damit');

		const card = page.getByRole('listitem').filter({ hasText: 'E2E Weg damit' });
		await card.getByRole('button', { name: 'Löschen' }).click();

		// Schritt 1: Intentionsprüfung — Bestätigen erst nach dem zweiten Schritt wirksam.
		// Auf den Dialog scopen: Der Karten-Trigger heißt ebenfalls „Löschen“ — `showModal()`
		// macht die Seite hinter dem Dialog zwar inert, Playwright-Lokatoren lösen trotzdem
		// beide auf (strict-mode). Muster: `kol-dialog`-Scoping wie pillar-crud.spec.ts.
		await expect(page.getByText(/wirklich löschen/)).toBeVisible();
		await page.locator('kol-dialog').getByRole('button', { name: 'Löschen', exact: true }).click();

		// Schritt 2: Scope („inkl. aller Mitglieder-Einträge") — Fokus liegt auf der Bestätigung.
		await expect(page.getByText(/Mitglieder-Einträge/)).toBeVisible();
		const confirm = page.getByRole('button', { name: /Endgültig löschen/ });
		await expect(confirm).toBeFocused();
		await confirm.click();

		await expect(card).toBeHidden();
		const response = await page.request.get('/api/v1/groups');
		const groups = (await response.json()) as { name: string }[];
		expect(groups.some((group) => group.name === 'E2E Weg damit')).toBe(false);
	});

	// ── AK8: 375px ohne horizontales Scrollen (Bounding-Box, nicht scrollWidth) ───────

	test('Gruppen-Tab bleibt bei 375px ohne horizontalen Überlauf bedienbar (AK8)', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openGroupsTab(page);
		await createGroupViaUi(
			page,
			'E2E Schmal',
			'Beschreibung die auch auf schmalen Screens nur einzeilig gekappt dargestellt werden sollte',
		);

		const card = page.getByRole('listitem').filter({ hasText: 'E2E Schmal' });
		await expect(card).toBeVisible();
		const box = await card.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.x + box!.width, 'Karte ragt nicht über den Viewport hinaus').toBeLessThanOrEqual(375);
	});
});
