import { expect, test, type Page } from './fixtures';
import { openAccordionSection, registerOwnSession, waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2078 — KI-Vorschlag als übernehmbarer Block (Spec: docs/spec/issue-2078.md).
 *
 * - AK5: „Vorschlag übernehmen“ + Speichern gegen das echte Backend — kein 400 aus der
 *   #2077-Vollverteilungs-Pflicht, gespeicherte Verteilung == KI-`share`-Werte, Feedback
 *   an /tasks/suggest-pillars/feedback.
 * - AK6: bei 375 px sind Block und beide Schaltflächen ohne horizontales Scrollen bedienbar,
 *   Touch-Ziele mindestens 44 px.
 *
 * `/tasks/suggest-pillars` wird per Route-Mock gestellt (LLM-Provider, lt. Issue erlaubt) —
 * Speichern und Feedback laufen gegen das echte Backend. Bounding-Box-Assertions statt
 * scrollWidth — die App-Shell clippt overflow-x.
 */

/**
 * KI-Antwort mit `share`-Werten, bewusst ungleich den Konfidenzen (#2076-Vertrag).
 * Test-Pflege: die Säulen-IDs kommen aus GET /pillars der Session — feste IDs (1–5) gehören
 * zum frisch registrierten Nutzer NICHT zuverlässig, und die #2077-Vollverteilungs-Pflicht
 * lehnt Vorschläge mit fremden IDs beim Speichern zu Recht mit 400 ab.
 */
const kiSharesFor = (pillarIds: number[]): { pillarId: number; confidence: number; share: number }[] => {
	const shares = [40, 30, 15, 10, 5];
	return pillarIds
		.slice(0, 5)
		.map((pillarId, index) => ({ pillarId, confidence: 99 - index * 10, share: shares[index] }));
};

/** Öffnet den Anlege-Dialog, holt per gemocktem Endpunkt den Vorschlag und zeigt den Block. */
const openFormWithSuggestion = async (page: Page): Promise<void> => {
	await registerOwnSession(page, 'ki-vorschlag-2078');
	const pillarIds = ((await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[]).map(
		(pillar) => pillar.id,
	);
	await page.route('**/api/v1/tasks/suggest-pillars', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ suggestions: kiSharesFor(pillarIds) }),
		}),
	);
	await page.goto('/app/');
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Neuen Task anlegen' }).click();
	await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toBeVisible();
	await waitForStableView(page);
	await page.getByRole('button', { name: 'Überspringen' }).click();
	await waitForStableView(page);
	await openAccordionSection(page, 'Optional');
	await page.getByRole('textbox', { name: 'Titel' }).fill('KI-Vorschlag-Task');
	await page.getByRole('button', { name: 'Säulen vorschlagen' }).click();
	await expect(page.getByRole('heading', { name: 'KI-Vorschlag' })).toBeVisible();
};

/** Misst die Bounding-Box mit kurzer Retry-Schleife — ein Re-Render im Messmoment liefert null. */
const measureBox = async (
	page: Page,
	locator: ReturnType<Page['getByRole']>,
): Promise<{ x: number; y: number; width: number; height: number }> => {
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const box = await locator.boundingBox();
		if (box !== null) {
			return box;
		}
		await page.waitForTimeout(100);
	}
	throw new Error('Bounding-Box nach 3 s nicht messbar');
};

test.describe('#2078 — KI-Vorschlag-Block', () => {
	test('AK5 — Übernehmen + Speichern: kein 400, Verteilung == KI-Anteile, Feedback gesendet', async ({ page }) => {
		let taskStatus = 0;
		let feedbackPosted = false;
		const taskBodies: string[] = [];
		page.on('response', (res) => {
			if (
				res.request().method() === 'POST' &&
				res.url().includes('/api/v1/tasks') &&
				!res.url().includes('suggest-pillars')
			) {
				taskStatus = res.status();
			}
		});
		page.on('request', (req) => {
			if (req.method() === 'POST' && req.url().includes('/api/v1/tasks/suggest-pillars/feedback')) {
				feedbackPosted = true;
			}
			if (req.method() === 'POST' && req.url().includes('/api/v1/tasks') && !req.url().includes('suggest')) {
				taskBodies.push(req.postData() ?? '');
			}
		});

		await openFormWithSuggestion(page);
		// Test-Pflege (#2146): der Fürsorge-Hinweis hat ebenfalls „Vorschlag übernehmen“ — auf den KI-Block eingrenzen.
		await page.locator('.pillar-suggestion-block').getByRole('button', { name: 'Vorschlag übernehmen' }).click();
		// Test-Pflege: „Anlegen“ per Substring auch auf dem FAB „Neuen Task anlegen“ —
		// deshalb auf die Dialog-Aktionsleiste eingrenzen (strict mode).
		await page.getByTestId('task-actions').getByRole('button', { name: 'Anlegen' }).click();

		// Speichern akzeptiert die übernommene Vollverteilung (#2077) — kein 400.
		await expect.poll(() => taskStatus).toBeGreaterThan(0);
		expect([200, 201]).toContain(taskStatus);
		// Gespeicherte Verteilung == KI-Anteile (40/30/15/10/5 — nicht die Treppe 50/20/15/10/5).
		const payload = taskBodies.join(' ');
		expect(payload).toContain('"share":40');
		expect(payload).toContain('"share":30');
		expect(payload).not.toContain('"share":50');
		// Feedback-Loop: finale Verteilung samt Anteilen als Korrektur gemeldet.
		await expect.poll(() => feedbackPosted).toBe(true);
		// Dialog geschlossen (Speichern erfolgreich), keine Fehlermeldung.
		await expect(page.getByRole('heading', { name: 'Neuen Task anlegen' })).toHaveCount(0);
	});

	test('AK6 — 375 px: Block und Schaltflächen ohne horizontales Scrollen, Touch-Ziele >= 44 px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await openFormWithSuggestion(page);

		const heading = page.getByRole('heading', { name: 'KI-Vorschlag' });
		const block = page.locator('.pillar-suggestion-block');
		const apply = block.getByRole('button', { name: 'Vorschlag übernehmen' });
		const discard = block.getByRole('button', { name: 'Verwerfen' });

		for (const locator of [heading, apply, discard]) {
			const box = await measureBox(page, locator);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
		}
		for (const locator of [apply, discard]) {
			const box = await measureBox(page, locator);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.width).toBeGreaterThanOrEqual(44);
		}
	});
});
