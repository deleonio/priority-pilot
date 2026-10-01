import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1494 AK9 (Spec docs/spec/issue-1494.md) — `PlansSection` formatiert die
 * seit #1494 in Cent gelieferten Preise wieder zu Euro-Beträgen ("8,99 €"), statt die rohe
 * Cent-Zahl zu rendern ("899 €").
 *
 * `@public-ui/react-v19` ist gemockt (KoliBri ist in JSDOM nicht hydrierbar, Muster
 * `PlanBadge.test.tsx`); die API-Fassade ist gemockt, damit der Katalog synchron mit Cent-Werten
 * ankommt.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'alert' }, children),
	KolBadge: ({ _label }: { _label?: string }) => createElement('span', null, _label),
	KolButton: ({ _label }: { _label?: string }) => createElement('button', null, _label),
	KolDetails: ({ _label, children }: { _label?: string; children?: ReactNode }) =>
		createElement('div', { 'data-details-label': _label }, children),
	KolSpin: () => createElement('div', { 'data-testid': 'spin' }),
}));

const getPlansCatalog = vi.fn();
vi.mock('../api', () => ({ api: { getPlansCatalog: () => getPlansCatalog() } }));

// `subscription: null` (kein Abo): erst dann liefert der Kaufweg Buchen-Aktionen (undefined = noch nicht geladen).
vi.mock('../lib/usePlan', () => ({ usePlan: () => ({ plan: 'pro', entitlements: {}, subscription: null }) }));
vi.mock('../lib/auth', () => ({ checkAuth: () => Promise.resolve({ playAccountId: 'acc-1' }) }));

import { featureOffer } from '../lib/planOffers';
import { PlansSection } from './PlansSection';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const CATALOG_CENTS = {
	features: [{ feature: 'groups', allowedPlans: ['plus', 'pro'] }],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		plus: { monthly: 399, quarterly: 1077, yearly: 3830 },
		pro: { monthly: 899, quarterly: 2427, yearly: 8630 },
	},
};

describe('PlansSection (#1494 AK9)', () => {
	it('zeigt den Pro-Monatspreis als "8,99 €" statt der rohen Cent-Zahl', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText(/^8,99 €/)).toBeTruthy();
		expect(screen.queryByText('899 €')).toBeNull();
	});

	it('zeigt free als "0,00 €"', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		// Test-Pflege (#1496 AK2): seit der Drei-Zeiträume-Matrix steht "0,00 €" für free in allen
		// drei Preiszeilen (monatlich/quartalsweise/jährlich) — `getByText` fände hier drei Treffer
		// und schlüge fehl, `getAllByText` prüft die neue, weiterhin korrekte Erwartung.
		expect(screen.getAllByText('0,00 €')).toHaveLength(3);
	});

	it('zeigt Plus-Monatspreis als "3,99 €"', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText(/^3,99 €/)).toBeTruthy();
	});
});

/**
 * Rote Spec-Tests für #1496 AK2 (Spec docs/spec/issue-1496.md) — alle drei Zeiträume (monatlich,
 * quartalsweise, jährlich) sind sichtbar, jeder Betrag kommt aus `GET /plans`; kein Betrag ist im
 * Quelltext fest verdrahtet.
 */
describe('PlansSection (#1496 AK2: drei Zeiträume, keine festen Beträge)', () => {
	it('zeigt monatlichen, quartalsweisen und jährlichen Preis nebeneinander', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('24,27 €')).toBeTruthy();
		expect(screen.getByText('86,30 €')).toBeTruthy();
	});

	it('rendert nur Beträge aus dem Katalog — kein fest verdrahteter Fallback-Preis', async () => {
		const sparseCatalog = {
			features: [],
			prices: {
				free: { monthly: 0, quarterly: 0, yearly: 0 },
				plus: { monthly: 111, quarterly: 222, yearly: 333 },
				pro: { monthly: 899, quarterly: 2427, yearly: 8630 },
			},
		};
		getPlansCatalog.mockResolvedValue(sparseCatalog);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText(/^1,11 €/)).toBeTruthy();
		expect(screen.getByText('2,22 €')).toBeTruthy();
		expect(screen.getByText('3,33 €')).toBeTruthy();
		expect(screen.queryByText('3,99 €')).toBeNull();
		expect(screen.queryByText('10,77 €')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #1524 AK7 (Spec docs/spec/issue-1524.md) — die Paket-Tabelle zeigt lesenden
 * und schreibenden MCP-Zugriff als ZWEI unterscheidbare Zeilen. Die Tabelle rendert datengetrieben
 * aus `catalog.features` (`PlansSection.tsx:348-355`) über `featureOffer(entry.feature).title`
 * (`frontend/src/lib/planOffers.ts`) — heute kennt `FEATURE_OFFERS` nur `mcp_readwrite`, für
 * `mcp_read` fällt `featureOffer()` auf den neutralen Fallback-Titel "Mehr Funktionen" zurück. Rot,
 * bis `FEATURE_OFFERS.mcp_read` einen eigenen, von `mcp_readwrite` sprachlich unterscheidbaren
 * Titel trägt.
 *
 * Test-Pflege (#1529, Spec docs/spec/issue-1529.md AK3): seit der `KolTableStateful`-Matrix liegen
 * Preis-, Buchen- UND Feature-Zeilen gemeinsam in `_data`/`tbody` (vorher nur Feature-Zeilen). Die
 * Zeilenauswahl selektiert deshalb gezielt `tr[data-row-kind="feature"]` (vom Mock aus dem privaten
 * `_kind`-Feld gesetzt) statt aller `tbody tr` — die eigentliche Prüfung (zwei unterscheidbare
 * Zeilen, korrekte Paket-Zuordnung) bleibt unverändert.
 */
describe('PlansSection (#1524 AK7: getrennte Zeilen für lesenden und schreibenden MCP-Zugriff)', () => {
	const CATALOG_MCP = {
		features: [
			{ feature: 'mcp_read', allowedPlans: ['plus', 'pro'] },
			{ feature: 'mcp_readwrite', allowedPlans: ['pro'] },
		],
		prices: CATALOG_CENTS.prices,
	};

	it('zeigt zwei unterscheidbare Zeilen mit korrekter Paket-Zuordnung', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_MCP);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		// Seit #1902 stehen die Funktionen je Paket in einem `KolDetails` (Katalog-Reihenfolge).
		const titles = (key: string): string[] =>
			Array.from(screen.getByTestId(`plan-item-${key}`).querySelectorAll('[data-details-label] li')).map(
				(li) => li.textContent ?? '',
			);
		const readTitle = featureOffer('mcp_read').title;
		const readwriteTitle = featureOffer('mcp_readwrite').title;
		expect(readTitle).not.toBe(readwriteTitle);
		// Bissigkeit: `featureOffer()` fällt für unbekannte Identifier auf den neutralen Titel
		// "Mehr Funktionen" zurück — erst dieser Check erzwingt einen ECHTEN `FEATURE_OFFERS.mcp_read`-Eintrag.
		expect(readTitle).not.toBe('Mehr Funktionen');

		expect(titles('free')).toEqual([]);
		expect(titles('plus')).toEqual([readTitle]);
		expect(titles('pro')).toEqual([readTitle, readwriteTitle]);
	});
});

/**
 * Test-Pflege #1902 (Spec docs/spec/issue-1902.md AK4): die `KolTableStateful`-Matrix (#1529 AK3)
 * ist einer Paketliste gewichen — eine Zeile je Paket mit den drei Zeiträumen samt Aktion, die
 * Funktionen in einem `KolDetails`. Die Katalog-Werte (Preise, Funktionen) bleiben dieselben.
 */
describe('PlansSection (#1902 AK4: Paketliste statt Tabelle)', () => {
	it('rendert je Paket eine Listenzeile mit drei Zeiträumen, ohne Tabelle', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		expect(document.querySelector('table')).toBeNull();
		for (const key of ['free', 'plus', 'pro']) {
			expect(screen.getByTestId(`plan-item-${key}`).querySelectorAll('.plans-list__period')).toHaveLength(3);
		}
	});

	it('markiert das aktuelle Paket mit „Aktuell“', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plan-item-pro')).toBeTruthy());

		expect(screen.getByTestId('plan-item-pro').textContent).toContain('Aktuell');
		expect(screen.getByTestId('plan-item-plus').textContent).not.toContain('Aktuell');
	});
});

describe('PlansSection je Kanal (#1674)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('web: Buchen-Zeilen des PayPal-Kaufwegs, kein Store-Hinweis', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		// Zwei bezahlte Pakete × drei Zeiträume; der Name steht im Label (eindeutig für Screenreader).
		expect(screen.getAllByRole('button', { name: /buchen/i })).toHaveLength(6);
		expect(screen.getByRole('button', { name: 'Pro buchen (monatlich)' })).toBeTruthy();
		expect(screen.queryByText('Die Pakete lassen sich bald direkt in der App buchen.')).toBeNull();
	});

	it('play: Preise aus Google Play statt aus dem Katalog, kein Link auf den Web-Kauf (#1692)', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		vi.stubGlobal('CdvPurchase', {
			store: {
				register: vi.fn(),
				when: () => ({ approved: vi.fn() }),
				initialize: vi.fn(() => Promise.resolve()),
				get: (id: string) => ({
					offers: [{ id: `${id}@monthly`, pricingPhases: [{ price: `${id} 9,49 €` }], order: vi.fn() }],
				}),
			},
		});
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByText('pro 9,49 €')).toBeTruthy());

		expect(screen.queryByText('8,99 €')).toBeNull();
		expect(screen.getByTestId('plans-section').querySelector('a')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #1898 (Spec docs/spec/issue-1898.md) — Monatsäquivalent der Jahreszahlung
 * (Plus 3,19 €, Pro 7,19 €) steht in der Monatszelle; Free bleibt „0,00 €"; Jahresbetrag bleibt.
 */
describe('PlansSection (#1898: Monatsäquivalent bei Jahreszahlung)', () => {
	it('zeigt 3,19 € bei Plus und 7,19 € bei Pro, Jahresbeträge bleiben sichtbar', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getAllByText(/3,19 €/)).toHaveLength(1);
		expect(screen.getAllByText(/7,19 €/)).toHaveLength(1);
		expect(screen.getByText('38,30 €')).toBeTruthy();
		expect(screen.getByText('86,30 €')).toBeTruthy();
	});

	it('Free-Spalte zeigt in allen Preiszeilen nur „0,00 €"', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		// Test-Pflege #1902: Liste statt Matrix — die Preiszeilen des Free-Eintrags statt der Free-Spalte.
		const priceRows = screen.getByTestId('plan-item-free').querySelectorAll('.plans-list__period');
		expect(priceRows).toHaveLength(3);
		for (const row of priceRows) expect(row.textContent).toMatch(/: 0,00 €$/);
	});
});
