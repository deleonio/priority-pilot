import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1494 AK9 (Spec docs/spec/issue-1494.md) — `PlansSection` formatiert die
 * seit #1494 in Cent gelieferten Preise wieder zu Euro-Beträgen ("9,99 €"), statt die rohe
 * Cent-Zahl zu rendern ("999 €").
 *
 * `@public-ui/react-v19` ist gemockt (KoliBri ist in JSDOM nicht hydrierbar, Muster
 * `PlanBadge.test.tsx`); die API-Fassade ist gemockt, damit der Katalog synchron mit Cent-Werten
 * ankommt.
 */

/**
 * `KolTableStateful`-Mock für #1529 (Spec docs/spec/issue-1529.md AK3): rendert `_data`/`_headers`
 * in eine inspizierbare native Tabelle (Muster `CompletedTasksTable.test.tsx`), statt die Web
 * Component zu hydrieren. Jede Kopfzelle trägt `data-width`; jede Datenzeile trägt `data-row-kind`
 * aus dem privaten Feld `_kind` der Zeile (`'price' | 'action' | 'feature'`, Muster `_task` in
 * `CompletedTasksTable`-Zeilen) — so bleiben Feature-Zeilen von Preis-/Buchen-Zeilen im
 * gemeinsamen Tabellenkörper unterscheidbar, ohne die sichtbaren Spalten zu verändern.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'alert' }, children),
	KolButton: ({ _label }: { _label?: string }) => createElement('button', null, _label),
	KolSpin: () => createElement('div', { 'data-testid': 'spin' }),
	KolTableStateful: ({
		_label,
		_data,
		_headers,
		_fixedCols,
	}: {
		_label?: string;
		_data?: (Record<string, unknown> & { _kind?: string })[];
		_headers?: { horizontal?: { key: string; label: string; width?: number }[][] };
		_fixedCols?: number[];
	}) => {
		const headerCells = (_headers?.horizontal ?? []).flat();
		return createElement(
			'table',
			{
				'data-testid': 'plans-kol-table',
				'data-table-label': _label ?? '',
				'data-fixed-cols': JSON.stringify(_fixedCols ?? null),
			},
			createElement(
				'thead',
				null,
				createElement(
					'tr',
					null,
					headerCells.map((cell, i) => createElement('th', { key: i, 'data-width': cell.width ?? '' }, cell.label)),
				),
			),
			createElement(
				'tbody',
				null,
				(_data ?? []).map((row, i) =>
					createElement(
						'tr',
						{ key: i, ...(typeof row._kind === 'string' ? { 'data-row-kind': row._kind } : {}) },
						// Erste Spalte (Zeilenbezeichnung, `key: 'label'`) als `<th scope="row">` wie im
						// Vorbild `PlansSection.tsx` vor #1529 — nur die Paket-Spalten sind `<td>`.
						headerCells.map((cell, cellIndex) =>
							createElement(
								cellIndex === 0 ? 'th' : 'td',
								{ key: cell.key, ...(cellIndex === 0 ? { scope: 'row' } : {}) },
								String(row[cell.key] ?? ''),
							),
						),
					),
				),
			),
		);
	},
}));

const getPlansCatalog = vi.fn();
vi.mock('../api', () => ({ api: { getPlansCatalog: () => getPlansCatalog() } }));

vi.mock('../lib/usePlan', () => ({ usePlan: () => ({ plan: 'pro', entitlements: {} }) }));
vi.mock('../lib/auth', () => ({ checkAuth: () => Promise.resolve({ playAccountId: 'acc-1' }) }));

import { PlansSection } from './PlansSection';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const CATALOG_CENTS = {
	features: [{ feature: 'groups', allowedPlans: ['plus', 'pro'] }],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		plus: { monthly: 499, quarterly: 1347, yearly: 4790 },
		pro: { monthly: 999, quarterly: 2697, yearly: 9590 },
	},
};

describe('PlansSection (#1494 AK9)', () => {
	it('zeigt den Pro-Monatspreis als "9,99 €" statt der rohen Cent-Zahl', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('9,99 €')).toBeTruthy();
		expect(screen.queryByText('999 €')).toBeNull();
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

	it('zeigt Plus-Monatspreis als "4,99 €"', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('4,99 €')).toBeTruthy();
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
		expect(screen.getByText('26,97 €')).toBeTruthy();
		expect(screen.getByText('95,90 €')).toBeTruthy();
	});

	it('rendert nur Beträge aus dem Katalog — kein fest verdrahteter Fallback-Preis', async () => {
		const sparseCatalog = {
			features: [],
			prices: {
				free: { monthly: 0, quarterly: 0, yearly: 0 },
				plus: { monthly: 111, quarterly: 222, yearly: 333 },
				pro: { monthly: 999, quarterly: 2697, yearly: 9590 },
			},
		};
		getPlansCatalog.mockResolvedValue(sparseCatalog);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('1,11 €')).toBeTruthy();
		expect(screen.getByText('2,22 €')).toBeTruthy();
		expect(screen.getByText('3,33 €')).toBeTruthy();
		expect(screen.queryByText('4,99 €')).toBeNull();
		expect(screen.queryByText('13,47 €')).toBeNull();
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

		// `tbody` enthält Preis-/Buchen-/Feature-Zeilen gemeinsam (#1529 AK3) — auf Feature-Zeilen
		// filtern, in Katalog-Reihenfolge (PlansSection.tsx:348-355) — hier also [mcp_read, mcp_readwrite].
		const featureRows = document.querySelectorAll('tbody tr[data-row-kind="feature"]');
		expect(featureRows).toHaveLength(2);
		const [readTitle, readwriteTitle] = Array.from(featureRows).map(
			(row) => row.querySelector('th[scope="row"]')?.textContent,
		);
		expect(readTitle).toBeTruthy();
		expect(readwriteTitle).toBeTruthy();
		expect(readTitle).not.toBe(readwriteTitle);
		// Bissigkeit: `featureOffer()` fällt für unbekannte Identifier auf den neutralen Titel
		// "Mehr Funktionen" zurück (planOffers.ts) — der wäre zufällig auch von mcp_readwrite
		// unterscheidbar. Erst dieser Check erzwingt einen ECHTEN `FEATURE_OFFERS.mcp_read`-Eintrag.
		expect(readTitle).not.toBe('Mehr Funktionen');

		// mcp_read: plus und pro enthalten, free nicht.
		const readCells = Array.from(featureRows[0]!.querySelectorAll('td')).map((cell) => cell.textContent);
		expect(readCells).toEqual(['—', 'enthalten', 'enthalten']);

		// mcp_readwrite: nur pro enthalten (unverändert).
		const readwriteCells = Array.from(featureRows[1]!.querySelectorAll('td')).map((cell) => cell.textContent);
		expect(readwriteCells).toEqual(['—', '—', 'enthalten']);
	});
});

/**
 * Rote Spec-Tests für #1529 AK3 (Spec docs/spec/issue-1529.md) — die Preis-Matrix wird als
 * `KolTableStateful` gebaut: Preis-/Buchen-Zeilen liegen im Tabellenkörper (`_data`), nicht mehr im
 * `<thead>`, und jede Spalte in `_headers.horizontal[0]` trägt eine gesetzte `width`. Rot, bis
 * `PlansSection.tsx` `KolTableStateful` (statt der handgebauten `<table>`) importiert und verwendet
 * — heute liefert `screen.queryByTestId('plans-kol-table')` `null`, weil die Komponente den Mock
 * nie aufruft.
 */
describe('PlansSection (#1529 AK3: KolTableStateful-Matrix mit gesetzten Spaltenbreiten)', () => {
	it('rendert die Matrix über KolTableStateful mit Preis-, Buchen- und Feature-Zeilen im Körper', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		const table = screen.getByTestId('plans-kol-table');
		// Kein Preis-/Buchen-Kopf mehr: genau EINE Kopfzeile (Paketnamen), keine Preis-/Buchen-Zeile
		// im `<thead>` (die lagen vor #1529 dort, PlansSection.tsx:315-346 vor der Umstellung).
		expect(table.querySelectorAll('thead tr')).toHaveLength(1);

		// 3 Preisperioden + 3 Buchen-Perioden + 1 Feature (`groups`, CATALOG_CENTS) = 7 Körperzeilen.
		const bodyRows = table.querySelectorAll('tbody tr');
		expect(bodyRows).toHaveLength(7);
		expect(table.querySelectorAll('tbody tr[data-row-kind="price"]')).toHaveLength(3);
		expect(table.querySelectorAll('tbody tr[data-row-kind="action"]')).toHaveLength(3);
		expect(table.querySelectorAll('tbody tr[data-row-kind="feature"]')).toHaveLength(1);
	});

	it('setzt an jeder Kopfspalte eine feste Breite', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		const table = screen.getByTestId('plans-kol-table');
		const headerCells = Array.from(table.querySelectorAll('thead th'));
		// Funktion-Spalte + 3 Paket-Spalten (free/plus/pro aus CATALOG_CENTS.prices).
		expect(headerCells).toHaveLength(4);
		for (const cell of headerCells) {
			const width = cell.getAttribute('data-width');
			expect(width, `Kopfspalte "${cell.textContent}" muss eine gesetzte width tragen`).not.toBe('');
			expect(Number.isNaN(Number(width)), `width von "${cell.textContent}" muss eine Zahl sein`).toBe(false);
		}
	});
});

describe('PlansSection je Kanal (#1674)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('web: Buchen-Zeilen des PayPal-Kaufwegs, kein Store-Hinweis', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-kol-table')).toBeTruthy());

		expect(screen.getByTestId('plans-kol-table').querySelectorAll('tbody tr[data-row-kind="action"]')).toHaveLength(3);
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

		expect(screen.queryByText('9,99 €')).toBeNull();
		expect(screen.getByTestId('plans-section').querySelector('a')).toBeNull();
	});
});
