import { expect, test, type Page } from '@playwright/test';
import { waitForStableView } from './helpers';

/**
 * **Kein Prüf-Spec, sondern ein Bildmacher** (Muster: `zifferblatt-shots.spec.ts`). Er legt einen
 * Nutzer mit glaubwürdigen Beispieldaten an und fotografiert die Ansichten, die die Landingpage
 * zeigt, nach `website/public/shots/<id>.jpg` — die Dateinamen sind die Feature-Ids aus
 * `website/src/i18n/*.json`. Die Bilder werden eingecheckt; neu erzeugen nach sichtbaren UI-Änderungen:
 *
 * ```
 * SHOTS=1 pnpm exec playwright test e2e/landing-shots.spec.ts
 * ```
 *
 * Ohne `SHOTS` überspringt er sich (Begründung im Kopf von `zifferblatt-shots.spec.ts`).
 *
 * **Warum `POST /auth/register` vor dem Test-Login:** Nur die Registrierung legt die fünf Säulen des
 * Nutzers an; der Test-Login allein liefert einen Nutzer ohne Säulen und damit ein leeres Herz. Der
 * Test-Login danach macht ihn zum Admin, damit er sich selbst das größte Paket geben kann — sonst
 * zeigen die Bilder Paket-Sperren statt Funktionen.
 *
 * Nur deutsche Bilder: Die englische App ist noch nicht vollständig übersetzt, gemischte Screenshots
 * wirkten unfertiger als deutsche. Die englische Seite nutzt dieselben Bilder mit englischem Alt-Text.
 */

const OUT = '../website/public/shots';
const DAY = 86_400_000;
const inDays = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

/**
 * Erledigte Aufgaben je Säule (Reihenfolge wie `SEED_PILLARS`). Das Herz misst seit #1638 den
 * Rhythmus im 28-Tage-Fenster (`PILLAR_RHYTHMS`: 5/3/3/5/1 pro Woche) — rund 90 % davon ergeben
 * „In Balance". Der Aufwand je Aufgabe teilt 4 Punkte je Säule, damit die Säulenliste darunter
 * ebenfalls ihr Ziel von 20 % trifft.
 */
const ERLEDIGT = [
	{ count: 18, titles: ['Joggen', 'Radtour', 'Schwimmen', 'Physio-Übungen'] },
	{ count: 11, titles: ['Meditieren', 'Tagebuch schreiben', 'Abend ohne Handy'] },
	{ count: 11, titles: ['Mama anrufen', 'Spieleabend', 'Essen mit Tom'] },
	{ count: 18, titles: ['Steuererklärung abgeben', 'Bewerbung abschicken', 'Fahrrad reparieren'] },
	{ count: 4, titles: ['Nachhilfe im Verein', 'Blut spenden'] },
];

const seed = async (page: Page): Promise<void> => {
	const email = 'landing-shots@example.com';
	await page.request.post('/auth/register', { data: { email, password: 'landing-shots' } });
	const login = await page.request.post('/auth/test-login', { data: { email, displayName: 'Alex', role: 'admin' } });
	expect(login.ok(), 'test-login muss eine Session liefern').toBeTruthy();
	const me = (await (await page.request.get('/api/v1/auth/me')).json()) as { id: number };
	await page.request.patch(`/api/v1/admin/users/${me.id}/plan`, { data: { plan: 'ultimate' } });
	const pillars = (await (await page.request.get('/api/v1/pillars')).json()) as { id: number }[];
	expect(pillars, 'die Registrierung legt fünf Säulen an').toHaveLength(5);

	const task = async (title: string, pillar: number, extra: Record<string, unknown> = {}): Promise<number> => {
		const response = await page.request.post('/api/v1/tasks', {
			data: {
				title,
				estimatedEffort: 0.5,
				priority: 3,
				pillars: [{ pillarId: pillars[pillar].id, share: 100, confidence: 80 }],
				...extra,
			},
		});
		expect(response.ok(), await response.text()).toBeTruthy();
		return ((await response.json()) as { id: number }).id;
	};

	for (const [pillar, { count, titles }] of ERLEDIGT.entries()) {
		for (let index = 0; index < count; index += 1) {
			const id = await task(titles[index % titles.length], pillar, {
				estimatedEffort: Math.round((4 / count) * 100) / 100,
			});
			await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
		}
	}
	// Eine Kette für den Abhängigkeitsgraphen: Der Umzug wartet auf die Küche, die auf die Kartons.
	const kartons = await task('Kartons besorgen', 3, { deadline: inDays(1) });
	const kueche = await task('Küche packen', 3, { deadline: inDays(3) });
	const umzug = await task('Umzug', 2, { priority: 5, deadline: inDays(5) });
	await page.request.post(`/api/v1/tasks/${kueche}/dependencies`, { data: { dependingTaskId: kartons } });
	await page.request.post(`/api/v1/tasks/${umzug}/dependencies`, { data: { dependingTaskId: kueche } });
	await task('Yoga-Kurs buchen', 0, { priority: 4, deadline: inDays(2) });
	await task('Geburtstagsgeschenk für Lea', 2, { priority: 4, deadline: inDays(4) });
};

test.describe('Landingpage — Bilder der Funktionen', () => {
	test.skip(!process.env.SHOTS, 'Bildmacher, kein Prüf-Spec — mit SHOTS=1 starten (siehe Kopfkommentar).');
	test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });

	test('legt je Funktion einen Screenshot ab', async ({ page }) => {
		test.setTimeout(120_000);
		await seed(page);
		// Immer die Blüte als Zifferblatt (`docs/zifferblatt-konzept.md`) — einheitlich auf allen Bildern.
		await page.addInitScript(() => localStorage.setItem('pp-balance-variant', 'bluete'));

		const shoot = async (id: string): Promise<void> => {
			// Kurz stehen lassen: Herz-Füllung und Graph-Layout laufen nach dem Rendern noch an.
			await page.waitForTimeout(1500);
			await page.screenshot({ path: `${OUT}/${id}.jpg`, type: 'jpeg', quality: 80, animations: 'disabled' });
		};
		/** Scrollt so, dass `text` `offset` CSS-Pixel unter der Oberkante steht (Kopfleiste bleibt sichtbar). */
		const scrollTo = async (text: string, offset: number): Promise<void> => {
			const box = await page.getByText(text, { exact: true }).and(page.locator(':visible')).first().boundingBox();
			expect(box, `„${text}" muss sichtbar sein`).not.toBeNull();
			await page.evaluate((top) => window.scrollBy(0, top), (box?.y ?? 0) - offset);
		};

		await page.goto('/app/');
		await waitForStableView(page);
		await shoot('dashboard');
		await scrollTo('Nächste Aufgabe', 100);
		await shoot('next');
		await scrollTo('Meine Lebensbalance', 60);
		await shoot('balance');

		await page.goto('/app/graph');
		await waitForStableView(page, 'Abhängigkeitsgraph');
		await shoot('dependencies');

		await page.goto('/app/');
		await waitForStableView(page);
		await page
			.getByRole('toolbar', { name: /Kopf-Aktionen/ })
			.getByRole('button', { name: 'Neuen Task anlegen' })
			.click();
		await page
			.getByRole('textbox', { name: 'Beschreibe deinen Task' })
			.fill('Morgen Laufschuhe kaufen und am Wochenende Oma besuchen');
		await shoot('ai');
	});
});
