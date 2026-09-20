import { expect, test } from './fixtures';
import { registerOwnSession, setEqualPillarWeights, waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1574 — „Speichern unausgewogener Säulen-Gewichtungen nur mit Bestätigung"
 * (Spec: docs/spec/issue-1574.md).
 *
 * Gegen das echte Backend: Eine unausgewogene, aber extremfreie Verteilung (erste Säule 0,6,
 * übrige 0,1 — Summe 1,0, Anteil 60 % > 2 × 20 %) öffnet beim „Speichern" ein
 * Bestätigungs-Modal; erst „Trotzdem speichern" sendet den PUT. „Abbrechen" speichert nicht und
 * lässt die Regler unverändert; erneutes Speichern ist wieder möglich. AK6 prüft die mobile
 * Nutzbarkeit bei 375px per Bounding-Box (`scrollWidth` ist unbrauchbar, die App-Shell clippt
 * `overflow-x: hidden`).
 *
 * Verteilung bewusst NICHT per `End`/`Home` (100 %/0 %): solche Extremverteilungen blockiert AK4
 * (#1574) vollständig — sie gehören nicht mehr in den Confirm-Flow. Die Summe 1,0 hält die
 * Normierung zur Identität, sodass die Reglerwerte deterministisch bleiben.
 */
test.use({ viewport: { width: 375, height: 800 } });

test.describe('#1574 Säulen-Gewichtung: Bestätigung vor dem Speichern unausgewogener Verteilungen', () => {
	/** Ungleich machen ohne Extremanteil: erste Säule 0,2 → 0,6, übrige 0,2 → 0,1 (Summe 1,0). */
	const makeUnbalanced = async (page: import('@playwright/test').Page): Promise<void> => {
		const sliders = page.locator('.pillar-weights-grid input[type="range"]');
		const sliderCount = await sliders.count();
		expect(sliderCount).toBeGreaterThan(1);
		for (let press = 0; press < 4; press += 1) {
			await sliders.first().press('ArrowRight');
		}
		for (let index = 1; index < sliderCount; index += 1) {
			await sliders.nth(index).press('ArrowLeft');
		}
	};

	test('AK1+AK2+AK6: Modal vor dem PUT, Abbrechen ohne PUT, Bestätigen sendet genau einen PUT — bei 375px nutzbar', async ({
		page,
	}) => {
		// #1573-Test-Pflege: `makeUnbalanced` setzt GENAU FÜNF Säulen voraus. Ohne eigene Session
		// liefert `GET /pillars` den ganzen Säulen-Bestand der Shard-DB — Begründung siehe
		// `registerOwnSession`. Vor der Route-Registrierung, damit der Seed-PUT nicht mitzählt.
		await registerOwnSession(page, '1574');

		let putCount = 0;
		await page.route('**/pillars/weights', (route) => {
			if (route.request().method() === 'PUT') {
				putCount += 1;
			}
			return route.continue();
		});

		// Ausgangszustand deterministisch herstellen (Gleichverteilung, s. Helper-Doku): parallele
		// Specs im selben Shard teilen die DB — der Reset-PUT läuft via page.request an der
		// Route-Abfangung (und damit am putCount) vorbei.
		await setEqualPillarWeights(page);

		await page.goto('/settings/pillars');
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeVisible();
		await waitForStableView(page, 'Priority Pilot');

		await makeUnbalanced(page);
		await expect(page.locator('.settings-pillars kol-alert[_type="warning"]')).toBeVisible();

		// AK1: „Speichern" öffnet das Bestätigungs-Modal — bis zur Bestätigung geht kein PUT raus.
		const save = page.locator('.settings-pillars kol-button[_label="Speichern"]');
		await expect(save).not.toHaveAttribute('_disabled', 'true');
		await save.click();

		const dialog = page.locator('kol-dialog');
		// KolDialog meldet den Host-Knoten selbst als „hidden" (der sichtbare Inhalt läuft über
		// das native <dialog> im Shadow-DOM, der Host selbst hat keine Box) — Sichtbarkeit und
		// Bounding-Box deshalb über die Dialog-ROLLE, Kindelemente über den Host (Light-DOM).
		const dialogRole = page.getByRole('dialog', { name: 'Verteilung stark unausgewogen' });
		await expect(dialogRole).toBeVisible();
		await expect(dialog.locator('kol-alert[_type="warning"]'), '#1555-Hinweis fehlt im Modal').toBeVisible();

		const confirm = dialog.getByRole('button', { name: 'Trotzdem speichern' });
		const cancel = dialog.getByRole('button', { name: 'Abbrechen', exact: true });
		await expect(confirm).toBeVisible();
		await expect(cancel).toBeVisible();
		expect(putCount, 'vor der Bestätigung darf kein PUT gehen').toBe(0);

		// AK6 (375px): Dialog bleibt im Viewport; Buttons untereinander in voller Breite mit
		// Touch-Höhe ≥ 44px und vertikalem Abstand ≥ 8px (KI-UX-Block, Regeln 2 und 3).
		const dialogBox = await dialogRole.boundingBox();
		expect(dialogBox, 'Dialog hat keine Bounding-Box').not.toBeNull();
		expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
		expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(375);
		const confirmBox = await confirm.boundingBox();
		const cancelBox = await cancel.boundingBox();
		expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
		expect(cancelBox!.height).toBeGreaterThanOrEqual(44);
		const top = confirmBox!.y <= cancelBox!.y ? confirmBox! : cancelBox!;
		const bottom = top === confirmBox! ? cancelBox! : confirmBox!;
		expect(bottom.y, 'Modal-Buttons sind bei 375px nicht untereinander gestapelt').toBeGreaterThanOrEqual(
			top.y + top.height + 8,
		);

		// AK2: „Abbrechen" — kein PUT, Modal zu, Regler unverändert.
		await cancel.click();
		await expect(dialogRole).toBeHidden();
		await expect(page.locator('.pillar-weights-grid input[type="range"]').first()).toHaveValue('0.6');
		expect(putCount, 'Abbrechen darf keinen PUT senden').toBe(0);

		// AK2: Erneutes Speichern ist wieder möglich → Bestätigen sendet genau einen PUT.
		await save.click();
		await expect(dialogRole).toBeVisible();
		await confirm.click();
		await expect.poll(() => putCount, 'Bestätigen muss genau einen PUT /pillars/weights senden').toBe(1);

		// Erfolg des Speicherns: die Karte verlässt den Editierzustand (Muster #1555/crud).
		await expect(page.getByRole('heading', { name: 'Säulen-Gewichtung' })).toBeHidden({ timeout: 10_000 });
	});
});
