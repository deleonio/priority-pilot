import { expect, test, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * ROTE Spec-Tests für #1118 „Dashboard-Sektionen als Kolibri-Cards mit Gleichhöhe".
 *
 * Spec-Bezug: docs/spec/issue-1118.md — AK1–AK8 (AK9 = Gate, ohne eigenen Test).
 *
 * Rot-Solange: alle sechs Dashboard-Sektionen rendern heute bare `<section>` mit eigenem
 * `<h3>`; die Tests greifen daher ins Leere (0 Cards, fehlende Labels, keine Gleichhöhe)
 * und werden grün, sobald `KolCard` mit `_label`/`_level` eingezogen ist und das Grid
 * (`@media (min-width: 48rem)`) auf `align-items: stretch` mit Host-Höhen-Passthrough umstellt.
 *
 * Messkonventionen (KI-UX-Block + Memory 2026-08-24):
 *  - `document.documentElement.scrollWidth` taugt hier nicht (App-Shell clippt mit
 *    `overflow-x: hidden`) → horizontale Enthaltung über Bounding-Boxen messen.
 *  - KoliBri-Cards rendern in den Shadow-DOM → Label/Level am Host lesen, Höhen über den Host
 *    (`kol-card`) messen. `_label` reflektiert KoliBri als Attribut, `_level` NICHT: React weist
 *    `_level` am aufgewerteten Custom Element als DOM-Property zu (die Property existiert), das
 *    Attribut bleibt `null`. Gemessen wird deshalb Attribut ODER Property — beide beschreiben
 *    denselben Vertrag „dritte Überschriftenebene", und das Shadow-DOM rendert daraufhin `<h3>`.
 *  - Die Signalfläche lebt wegen der globalen #930-Regel (`kol-card` transparent) im
 *    Shadow-DOM bzw. Card-Inhalt → effektiv gemalten Hintergrund über Light-DOM UND
 *    Shadow-DOM einsammeln, nicht die Host-Property lesen.
 */

type SectionClass =
	| 'dashboard-next-task'
	| 'dashboard-suggestions'
	| 'dashboard-top-tasks'
	| 'dashboard-pillars'
	| 'dashboard-balance'
	| 'dashboard-deadlines';

const SECTION_CLASSES: SectionClass[] = [
	'dashboard-next-task',
	'dashboard-suggestions',
	'dashboard-top-tasks',
	'dashboard-pillars',
	'dashboard-balance',
	'dashboard-deadlines',
];

const SECTION_LABELS: Record<SectionClass, string> = {
	'dashboard-next-task': 'Nächste Aufgabe',
	'dashboard-suggestions': 'Was ist jetzt dran?',
	'dashboard-top-tasks': 'Wichtigste Tasks',
	'dashboard-pillars': 'Meine Themen',
	'dashboard-balance': 'Gesamtguthaben',
	'dashboard-deadlines': 'Anstehende Deadlines',
};

const deleteAllTasks = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/tasks');
	const tasks = (await response.json()) as { id: number }[];
	for (const t of tasks) {
		await page.request.delete(`/api/v1/tasks/${t.id}`);
	}
};

/** Legt `count` offene Tasks mit künftiger Deadline an (füllt Deadlines- und Top-Tasks-Liste). */
const seedTasks = async (page: Page, count: number, prefix: string): Promise<void> => {
	const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
	for (let i = 0; i < count; i++) {
		await page.request.post('/api/v1/tasks', { data: { title: `${prefix} ${i + 1}`, priority: 3, deadline: future } });
	}
};

/** Öffnet das Dashboard mit gefüllten Listen (1280 px = Desktop-Layout). */
const openDashboard = async (page: Page, width: number, height: number): Promise<void> => {
	await page.setViewportSize({ width, height });
	await page.goto('/');
	await waitForStableView(page);
	await page.reload();
	await waitForStableView(page);
	await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
	await waitForStableView(page);
};

/** Liest pro Sektion den Card-Host (`kol-card`) — auch wenn die Sektion selbst die Card ist. */
const sectionCards = (page: Page) =>
	page.evaluate(
		(classes: string[]) =>
			classes.map((cls) => {
				const section = document.querySelector<HTMLElement>(`.${cls}`);
				if (section === null) return null;
				const card = section.matches('kol-card') ? section : (section.querySelector<HTMLElement>('kol-card') ?? null);
				if (card === null) return null;
				const rect = card.getBoundingClientRect();
				const levelProperty = (card as HTMLElement & { _level?: number | string })._level;
				return {
					cls,
					label: card.getAttribute('_label'),
					level: card.getAttribute('_level') ?? (levelProperty === undefined ? null : String(levelProperty)),
					top: rect.top,
					left: rect.left,
					right: rect.right,
					width: rect.width,
					height: rect.height,
				};
			}),
		SECTION_CLASSES,
	);

test.describe('Dashboard — Sektionen als Kolibri-Cards (#1118)', () => {
	test.afterEach(async ({ page }) => {
		await deleteAllTasks(page);
	});

	test('AK1/AK4: je Sektion genau eine kol-card, kein kol-card in kol-card', async ({ page }) => {
		await seedTasks(page, 3, 'E2E #1118 Card');
		await openDashboard(page, 1280, 900);

		for (const cls of SECTION_CLASSES) {
			const section = page.locator(`.${cls}`);
			await expect(section, `Sektion .${cls} fehlt`).toHaveCount(1);
			// AK1: genau EIN Card-Host pro Sektion.
			await expect(section.locator('kol-card'), `.${cls} erwartet genau eine Card`).toHaveCount(1);
		}

		// AK4: nirgendwo im Dashboard eine verschachtelte Card (NearbyCard/„Keine Säulen vorhanden").
		const nested = await page.evaluate(
			() => document.querySelectorAll('.dashboard kol-card kol-card, .dashboard kol-card .dashboard-pillars').length,
		);
		expect(nested).toBe(0);
	});

	test('AK2: Sektionslabel am Card-Host, dritte Überschriftenebene, kein separates <h3>', async ({ page }) => {
		await seedTasks(page, 3, 'E2E #1118 Label');
		await openDashboard(page, 1280, 900);

		const cards = await sectionCards(page);
		for (const cls of SECTION_CLASSES) {
			const card = cards.find((c) => c !== null && c.cls === cls);
			expect(card, `kein Card-Host in .${cls}`).not.toBeNull();
			// AK2: Überschrift als Card-Label …
			expect(card!.label, `._label von .${cls}`).toBe(SECTION_LABELS[cls]);
			// … als dritte Ebene (KoliBri-Default _level=0 wäre KEINE Überschrift).
			expect(card!.level, `._level von .${cls}`).toBe('3');
			// … und kein separates <h3> mehr im Light-DOM der Sektion (keine doppelte Überschrift).
			// Bewusst `querySelectorAll` statt `page.locator`: Playwright-Selektoren durchdringen den
			// offenen Shadow-DOM und träfen damit die Card-Überschrift selbst (`h3.kol-card__header`) —
			// genau die Überschrift, die AK2 fordert. Gemeint ist das eigene Markup der Sektion.
			const h3Count = await page.evaluate(
				(selector: string) => document.querySelectorAll(`${selector} h3`).length,
				`.${cls}`,
			);
			expect(h3Count, `.${cls} rendert noch ein separates <h3>`).toBe(0);
		}

		// AK2: die Region „Nächste Aufgabe" bleibt benannt.
		const regionName = await page.locator('.dashboard-next-task').evaluate((el) => {
			const labelledby = el.getAttribute('aria-labelledby');
			return (
				el.getAttribute('aria-label') ?? (labelledby ? (document.getElementById(labelledby)?.textContent ?? '') : '')
			);
		});
		expect(regionName).toMatch(/Nächste Aufgabe/);
	});

	test('AK3: Leerzustand der Deadlines-Sektion steht innerhalb der Card', async ({ page }) => {
		// Kein Task mit Deadline → Deadlines-Sektion im Leerzustand.
		await openDashboard(page, 1280, 900);

		const emptyInsideCard = await page.evaluate(() => {
			const section = document.querySelector('.dashboard-deadlines');
			const card = section === null ? null : section.querySelector('kol-card');
			if (card === null) return null;
			return card.textContent?.includes('Keine anstehenden Deadlines') ?? false;
		});
		expect(emptyInsideCard, 'Leerzustand nicht innerhalb der Deadlines-Card').toBe(true);
	});

	test('AK5: bei 1280px haben Karten derselben Grid-Zeile identische Höhe', async ({ page }) => {
		// 8 Deadline-Einträge in der Deadlines-Card gegen wenige Einträge in den Nachbar-Karten.
		await seedTasks(page, 8, 'E2E #1118 Höhe');
		await openDashboard(page, 1280, 900);

		const rows = await page.evaluate(() => {
			const classes = [
				'dashboard-next-task',
				'dashboard-suggestions',
				'dashboard-top-tasks',
				'dashboard-pillars',
				'dashboard-balance',
				'dashboard-deadlines',
			];
			const entries: Array<{ cls: string; top: number; height: number }> = [];
			for (const cls of classes) {
				const section = document.querySelector<HTMLElement>(`.${cls}`);
				if (section === null) continue;
				const card = section.matches('kol-card') ? section : section.querySelector<HTMLElement>('kol-card');
				if (card === null) continue;
				const rect = card.getBoundingClientRect();
				entries.push({ cls, top: Math.round(rect.top), height: Math.round(rect.height) });
			}
			// Gruppierung nach Oberkante (±2 px Toleranz für Sub-Pixel-Rounding).
			const grouped: Record<string, { members: string[]; heights: number[] }> = {};
			for (const entry of entries) {
				const key = String(entries.find((e) => Math.abs(e.top - entry.top) <= 2)!.top);
				grouped[key] ??= { members: [], heights: [] };
				grouped[key].members.push(entry.cls);
				grouped[key].heights.push(entry.height);
			}
			return Object.values(grouped);
		});

		// Zwei Spalten müssen tatsächlich belegt sein — sonst sagt der Test nichts über Gleichhöhe.
		const twoCardRows = rows.filter((r) => r.members.length >= 2);
		expect(twoCardRows.length, 'erwartet mindestens eine zweispaltige Grid-Zeile').toBeGreaterThanOrEqual(1);

		for (const row of twoCardRows) {
			const [reference, ...rest] = row.heights;
			for (const height of rest) {
				expect(height, `Gleichhöhe in Zeile [${row.members.join(', ')}]`).toBe(reference);
			}
		}
	});

	test('AK6: bei 375px einspaltig in unveränderter Reihenfolge, ohne horizontale Ausdehnung', async ({ page }) => {
		await seedTasks(page, 4, 'E2E #1118 Mobil');
		await openDashboard(page, 375, 812);

		const cards = (await sectionCards(page)).filter((c) => c !== null);
		expect(cards.length, 'alle sechs Sektions-Cards müssen existieren').toBe(SECTION_CLASSES.length);

		// Einspaltig: aufeinanderfolgende Cards liegen untereinander (steigende Oberkante).
		for (let i = 1; i < cards.length; i++) {
			expect(cards[i]!.top, `Reihenfolge ${cards[i]!.cls} nach ${cards[i - 1]!.cls}`).toBeGreaterThanOrEqual(
				cards[i - 1]!.top,
			);
		}
		// Unveränderte Reihenfolge (Issue-Reihenfolge der Sektionen).
		expect(cards.map((c) => c.cls)).toEqual(SECTION_CLASSES);

		// Keine Karte ragt horizontal aus den 375 px heraus (Bounding-Box, nicht scrollWidth).
		for (const card of cards) {
			expect(card.left, `linker Rand von ${card.cls}`).toBeGreaterThanOrEqual(0);
			expect(card.right, `rechter Rand von ${card.cls}`).toBeLessThanOrEqual(375);
		}
	});

	test('AK7: Nächste Aufgabe, Vorschläge, Kacheln und Begrüßung bleiben volle Breite', async ({ page }) => {
		await seedTasks(page, 2, 'E2E #1118 Breite');
		await openDashboard(page, 1280, 900);

		const gridWidth = await page.locator('.dashboard').evaluate((el) => el.clientWidth);
		expect(gridWidth).toBeGreaterThan(600);

		// Volle Breite: Card/Bereich spannt über die Grid-Innenbreite.
		for (const selector of [
			'.dashboard-next-task',
			'.dashboard-suggestions',
			'.dashboard-cards',
			'.dashboard-greeting',
		]) {
			const box = await page.locator(selector).first().boundingBox();
			expect(box, `${selector} vorhanden`).not.toBeNull();
			expect(box!.width, `volle Breite von ${selector}`).toBeGreaterThanOrEqual(gridWidth * 0.95);
		}
	});

	test('AK8: Signalfäche der „Nächste Aufgabe" bleibt sichtbar, Button per Tastatur auslösbar', async ({ page }) => {
		await seedTasks(page, 1, 'E2E #1118 Signal');
		await openDashboard(page, 1280, 900);

		// Signalfläche: mindestens ein Element in der Region malt den aufgelösten
		// `--pp-signal-wash`-Wert (Light-DOM oder Shadow-DOM — #930 macht den Host transparent).
		const washPainted = await page.evaluate(() => {
			const region = document.querySelector('.dashboard-next-task');
			if (region === null) return null;
			const probe = document.createElement('span');
			probe.style.backgroundColor = 'var(--pp-signal-wash)';
			document.body.appendChild(probe);
			const wash = getComputedStyle(probe).backgroundColor;
			probe.remove();
			if (wash === '' || wash === 'rgba(0, 0, 0, 0)') return null;

			// Schatten-DOM nicht intern anfassen (Lint-Vertrag): den effektiv gemalten Hintergrund
			// rasterförmig über `elementFromPoint` abtasten — das liefert auch Shadow-DOM-Elemente.
			const rect = region.getBoundingClientRect();
			for (let x = rect.left + 4; x < rect.right - 4; x += 24) {
				for (let y = rect.top + 4; y < rect.bottom - 4; y += 24) {
					const el = document.elementFromPoint(x, y);
					if (el !== null && getComputedStyle(el).backgroundColor === wash) return true;
				}
			}
			return false;
		});
		expect(washPainted, 'Signal-Wash (--pp-signal-wash) nicht sichtbar gemalt').toBe(true);

		// Tastatur: „Jetzt starten" ist fokussierbar und Enter öffnet den Task-Dialog.
		const startButton = page.locator('.dashboard-next-task kol-button');
		await expect(startButton).toBeVisible();
		await page.keyboard.press('Tab');
		let focused = false;
		for (let i = 0; i < 40 && !focused; i++) {
			focused = await startButton.evaluate(
				(el) => el === document.activeElement || el.contains(document.activeElement),
			);
			if (!focused) await page.keyboard.press('Tab');
		}
		expect(focused, '„Jetzt starten" per Tab erreichbar').toBe(true);

		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog').first()).toBeVisible();
	});
});
