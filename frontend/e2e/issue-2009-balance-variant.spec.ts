import type { BrowserContext } from '@playwright/test';
import { baseTest as test, expect, type Locator, type Page } from './fixtures';
import { waitForStableView } from './helpers';

/**
 * Rote Spec-e2e für #2009 (Spec: docs/spec/issue-2009.md) — Zifferblatt-Auswahl am Konto.
 *
 * - AK4: Was Kontext A in den Einstellungen wählt, zeigt Kontext B (frischer Storage, eigene
 *   echte Anmeldung) auf der Startseite — ohne dort erneut zu wählen.
 * - AK5: Nach Ab- und Anmeldung (POST /auth/logout + Login) ist die Wahl weiterhin aktiv.
 * - AK6: Auswahl und Übernahme funktionieren im mobilen Leitfall 375 px; die Radiogruppe selbst
 *   bleibt unangetastet (`balance-variant.spec.ts` prüft sie).
 *
 * Zwei Browser-Kontexte gegen dasselbe echte Backend (Vite-Proxy), Registrierung über
 * `POST /auth/register` (säht die fünf Standard-Säulen, Muster `zifferblatt-shots.spec.ts` —
 * der Fixture-/test-login-Weg legt konten ohne Säulen an). Beobachtet wird die Bühne der
 * Startseite: `.heart-balance-stage[data-variante]` (HeartBalance.tsx).
 *
 * Rot heute: die Wahl ist reine localStorage-Sache — Kontext B zeigt `herz`.
 */

const VIEWPORT = { width: 375, height: 812 };

/** Die Radiogruppe im Allgemein-Tab (Muster balance-variant.spec.ts). */
const variantOption = (page: Page, label: string): Locator =>
	page
		.getByRole('radiogroup', { name: /Bild der Lebensbalance/i })
		.or(page.getByRole('group', { name: /Bild der Lebensbalance/i }))
		.getByRole('radio', { name: label, exact: true });

/** Legt das Konto an, meldet Kontext A an und wählt dort das Bild in den Einstellungen (375 px). */
const waehleInKontextA = async (
	kontextA: BrowserContext,
	email: string,
	password: string,
	bild: string,
): Promise<Page> => {
	const seiteA = await kontextA.newPage();
	seiteA.setViewportSize(VIEWPORT);
	const konto = { email, password };
	const registriert = await seiteA.request.post('/auth/register', { data: konto });
	expect(registriert.ok(), 'Registrierung muss das Konto anlegen (und die Säulen säen)').toBeTruthy();
	const login = await seiteA.request.post('/auth/login', { data: konto });
	expect(login.ok(), 'Login muss eine Session liefern').toBeTruthy();

	await seiteA.goto('/app/settings/general');
	await waitForStableView(seiteA, 'Balamentum');
	const option = variantOption(seiteA, bild);
	await expect(option).toBeEnabled();
	await option.click();
	await expect(option).toBeChecked();
	return seiteA;
};

test.describe('Balamentum — #2009: Zifferblatt-Auswahl auf allen Geräten', () => {
	test('AK4+AK6 — Konto-Wahl erscheint im frischen Geräte-Kontext (375 px) auf der Startseite', async ({ browser }) => {
		const kontextA = await browser.newContext({ viewport: VIEWPORT });
		await waehleInKontextA(kontextA, 'e2e-2009-sync@example.com', 'sync-1234', 'Blasen');

		// Kontext B: frischer Storage, keine Cookies — nur dieselbe Anmeldung am selben Konto.
		const kontextB = await browser.newContext({ viewport: VIEWPORT });
		const seiteB = await kontextB.newPage();
		const login = await seiteB.request.post('/auth/login', {
			data: { email: 'e2e-2009-sync@example.com', password: 'sync-1234' },
		});
		expect(login.ok(), 'zweiter Kontext muss sich am selben Konto anmelden können').toBeTruthy();

		await seiteB.goto('/app/');
		await waitForStableView(seiteB);
		await expect(seiteB.locator('.heart-balance-stage')).toHaveAttribute('data-variante', 'blasen');

		await kontextA.close();
		await kontextB.close();
	});

	test('AK5 — Wahl übersteht Ab- und Anmeldung desselben Kontexts', async ({ browser }) => {
		const kontextA = await browser.newContext({ viewport: VIEWPORT });
		await waehleInKontextA(kontextA, 'e2e-2009-relogin@example.com', 'sync-1234', 'Ringe');

		const kontextB = await browser.newContext({ viewport: VIEWPORT });
		const seiteB = await kontextB.newPage();
		const konto = { email: 'e2e-2009-relogin@example.com', password: 'sync-1234' };
		await seiteB.request.post('/auth/login', { data: konto });
		await seiteB.goto('/app/');
		await waitForStableView(seiteB);
		await expect(seiteB.locator('.heart-balance-stage')).toHaveAttribute('data-variante', 'ringe');

		// Abmelden (Session beenden) und wieder anmelden — das Bild bleibt.
		const logout = await seiteB.request.post('/auth/logout');
		expect(logout.ok(), 'Abmelden muss die Session beenden').toBeTruthy();
		const erneut = await seiteB.request.post('/auth/login', { data: konto });
		expect(erneut.ok(), 'erneute Anmeldung muss gelingen').toBeTruthy();

		await seiteB.goto('/app/');
		await waitForStableView(seiteB);
		await expect(seiteB.locator('.heart-balance-stage')).toHaveAttribute('data-variante', 'ringe');

		await kontextA.close();
		await kontextB.close();
	});
});
