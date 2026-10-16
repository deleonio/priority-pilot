import { expect, test, type Page } from './fixtures';
import { MOBILE, waitForStableView } from './helpers';

/**
 * Rote Spec-Tests für #2625 (docs/spec/issue-2625.md): Selbstladende Dashboard-Karten reservieren
 * künftig ab dem ersten Render eine feste Höhe — der Übergang Laden→Geladen wird hoehenneutral
 * (AK1, Toleranz ≤ 8 px), die letzte Kartenreihe (.dashboard-last-row) rutscht nicht mehr nach
 * (AK2), und kein Platzhalter erzeugt bei 375 px horizontalen Überlauf (AK4, Bounding-Box statt
 * scrollWidth — die App-Shell clippt).
 *
 * Messmethode: Die Selbstlader-Endpunkte werden per page.route zurückgehalten (Antwort erst nach
 * Freigabe) — das macht den Ladezustand deterministisch messbar; page.route dient ausschließlich
 * dieser Timing-Kontrolle, die Antworten bleiben echt. Je Phase (Laden/Geladen) wird EIN atomarer
 * page.evaluate-Snapshot genommen (Muster #2578), nicht sequenzielle boundingBox()-Aufrufe.
 * AK3 (fensterlose Karten erscheinen nicht nachträglich) ist bewusst kein neuer Test — Abdeckung
 * dedupliziert über die bestehenden Dashboard-Specs (siehe Spec).
 */

type Box = { top: number; height: number; left: number; right: number };
type Snapshot = { karten: Record<string, Box | null>; letzteReiheTop: number | null };

/** Karten mit Reservierungs-Vertrag (AK1): Testid-Anker + Marker-Selektor für „geladen“. */
const KARTEN: { testid: string; geladen: string }[] = [
	{ testid: 'streak-card', geladen: '[data-testid="streak-best"], [data-testid="streak-zero"]' },
	{
		testid: 'balance-history-card',
		geladen:
			'[data-testid="balance-history-trend"], [data-testid="balance-history-empty"], [data-testid="balance-history-error"]',
	},
	{ testid: 'milestone-badges-card', geladen: '.dashboard-milestones-group' },
	{ testid: 'missed-tasks-card', geladen: '[data-testid="missed-tasks-count"], [data-testid="missed-tasks-zero"]' },
	{ testid: 'care-hint', geladen: '[data-testid="care-hint"]' },
];

/** Fensterkarten: nur gemessen, wenn ihr Fenster heute offen ist (Host in beiden Snapshots). */
const FENSTERKARTEN = ['weekly-balance-card', 'monthly-balance-card', 'yearly-recap-card'];

/** AK1-Toleranz: „wenige Pixel“ konkretisiert (Triage-Randbedingung). */
const TOLERANZ_PX = 8;

/** Selbstlader-Endpunkte: echte Antworten werden bis zur Freigabe zurückgehalten. */
const SELBSTLADER = [
	'**/api/v1/scores/streak*',
	'**/api/v1/scores/balance/history*',
	'**/api/v1/scores/milestones*',
	'**/api/v1/scores/missed*',
	'**/api/v1/scores/care-suggestions*',
	'**/api/v1/scores/monthly-recap*',
	'**/api/v1/scores/yearly-recap*',
];

/** Alle Karten-Boxen + Oberkante der letzten Reihe in EINEM atomaren Layout-Snapshot. */
const snapshot = (page: Page, testids: string[]): Promise<Snapshot> =>
	page.evaluate((ids) => {
		const box = (testid: string): Box | null => {
			const el = document.querySelector(`[data-testid="${testid}"]`);
			if (!el) {
				return null;
			}
			const r = el.getBoundingClientRect();
			return { top: r.top, height: r.height, left: r.left, right: r.right };
		};
		const reihe = document.querySelector('.dashboard-last-row');
		return {
			karten: Object.fromEntries(ids.map((id) => [id, box(id)])) as Snapshot['karten'],
			letzteReiheTop: reihe ? reihe.getBoundingClientRect().top : null,
		};
	}, testids);

test.describe('Dashboard — kein Layout-Sprung beim Nachladen (#2625)', () => {
	test('AK1/AK2/AK4: Kartenhöhen, letzte Reihe und Ränder stabil zwischen Laden und Geladen', async ({ page }) => {
		await page.setViewportSize(MOBILE);

		// Selbstlader-Antworten zurückhalten → Ladezustand deterministisch (echte Antworten).
		let oeffnen!: () => void;
		const tor = new Promise<void>((resolve) => {
			oeffnen = resolve;
		});
		for (const glob of SELBSTLADER) {
			await page.route(glob, async (route) => {
				await tor;
				await route.continue();
			});
		}

		// Eine verpasste Aufgabe → MissedTasksCard zeigt geladen Inhalt statt Leerzustand.
		await page.request.post('/api/v1/tasks', {
			data: { title: 'E2E #2625 verpasst', deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
		});

		await page.goto('/app/');
		await waitForStableView(page);
		await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();

		const alleTestids = [...KARTEN.map((karte) => karte.testid), ...FENSTERKARTEN];
		try {
			// Ladezustand belegt: Streak-Hint sichtbar, Selbstlader-Antworten noch gehalten.
			await expect(page.locator('.dashboard-streak-hint')).toBeVisible();
			const laden = await snapshot(page, alleTestids);

			// Freigeben → geladener Zustand.
			oeffnen();
			for (const karte of KARTEN) {
				await expect(page.locator(karte.geladen).first(), `${karte.testid}: geladener Inhalt`).toBeVisible();
			}
			for (const testid of FENSTERKARTEN) {
				// Nur wenn das Fenster offen ist (Host vorhanden): Ladetext muss verschwunden sein.
				if ((await page.getByTestId(testid).count()) > 0) {
					await expect(page.getByTestId(testid)).not.toContainText('wird geladen');
				}
			}
			const geladen = await snapshot(page, alleTestids);

			// Testid-Anker-Vertrag: alle Always-on-Karten müssen nach dem Laden messbar sein.
			for (const karte of KARTEN) {
				expect(geladen.karten[karte.testid], `${karte.testid}: Host nach dem Laden messbar`).not.toBeNull();
			}

			// AK1 — Reservierung ab dem ersten Render + Höhendifferenz ≤ 8 px je Karte.
			for (const karte of KARTEN) {
				expect(laden.karten[karte.testid], `${karte.testid}: reservierte Höhe im Ladezustand fehlt`).not.toBeNull();
			}
			for (const testid of alleTestids) {
				const vor = laden.karten[testid];
				const nach = geladen.karten[testid];
				if (!vor || !nach) {
					continue; // Fenster geschlossen (in beiden Phasen abwesend) — AK3-Fall.
				}
				expect(
					Math.abs(vor.height - nach.height),
					`${testid}: Höhensprung Laden(${Math.round(vor.height)}px)→Geladen(${Math.round(nach.height)}px)`,
				).toBeLessThanOrEqual(TOLERANZ_PX);
			}

			// AK2 — Oberkante der letzten Reihe wandert ≤ 8 px (je Moment ein atomarer Snapshot).
			expect(laden.letzteReiheTop, 'letzte Reihe im Lade-Snapshot messbar').not.toBeNull();
			expect(geladen.letzteReiheTop, 'letzte Reihe im Geladen-Snapshot messbar').not.toBeNull();
			expect(
				Math.abs(laden.letzteReiheTop! - geladen.letzteReiheTop!),
				`letzte Reihe verschoben: ${Math.round(laden.letzteReiheTop!)}px → ${Math.round(geladen.letzteReiheTop!)}px`,
			).toBeLessThanOrEqual(TOLERANZ_PX);

			// AK4 — keine Karte ragt bei 375 px aus dem Viewport (beide Phasen, Bounding-Box).
			for (const [phase, snap] of [
				['Laden', laden],
				['Geladen', geladen],
			] as const) {
				for (const [testid, box] of Object.entries(snap.karten)) {
					if (!box) {
						continue;
					}
					expect(box.left, `${testid} (${phase}): linke Kante`).toBeGreaterThanOrEqual(-1);
					expect(box.right, `${testid} (${phase}): rechte Kante`).toBeLessThanOrEqual(MOBILE.width + 1);
				}
			}
		} finally {
			oeffnen();
		}
	});
});
