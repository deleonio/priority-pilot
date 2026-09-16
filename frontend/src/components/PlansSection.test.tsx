import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1494 AK9 (Spec docs/spec/issue-1494.md) — `PlansSection` formatiert die
 * seit #1494 in Cent gelieferten Preise wieder zu Euro-Beträgen ("7,99 €"), statt die rohe
 * Cent-Zahl zu rendern ("799 €").
 *
 * `@public-ui/react-v19` ist gemockt (KoliBri ist in JSDOM nicht hydrierbar, Muster
 * `PlanBadge.test.tsx`); die API-Fassade ist gemockt, damit der Katalog synchron mit Cent-Werten
 * ankommt.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'alert' }, children),
	KolSpin: () => createElement('div', { 'data-testid': 'spin' }),
}));

const getPlansCatalog = vi.fn();
vi.mock('../api', () => ({ api: { getPlansCatalog: () => getPlansCatalog() } }));

vi.mock('../lib/usePlan', () => ({ usePlan: () => ({ plan: 'pro', entitlements: {} }) }));

import { PlansSection } from './PlansSection';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const CATALOG_CENTS = {
	features: [{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] }],
	prices: {
		free: { monthly: 0, quarterly: 0, yearly: 0 },
		pro: { monthly: 799, quarterly: 2157, yearly: 7670 },
		max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
		ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
	},
};

describe('PlansSection (#1494 AK9)', () => {
	it('zeigt den Pro-Monatspreis als "7,99 €" statt der rohen Cent-Zahl', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('7,99 €')).toBeTruthy();
		expect(screen.queryByText('799 €')).toBeNull();
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

	it('zeigt Ultimate-Monatspreis als "24,99 €"', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_CENTS);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('24,99 €')).toBeTruthy();
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
		expect(screen.getByText('21,57 €')).toBeTruthy();
		expect(screen.getByText('76,70 €')).toBeTruthy();
	});

	it('rendert nur Beträge aus dem Katalog — kein fest verdrahteter Fallback-Preis', async () => {
		const sparseCatalog = {
			features: [],
			prices: {
				free: { monthly: 0, quarterly: 0, yearly: 0 },
				pro: { monthly: 111, quarterly: 222, yearly: 333 },
				max: { monthly: 1499, quarterly: 4047, yearly: 14390 },
				ultimate: { monthly: 2499, quarterly: 6747, yearly: 23990 },
			},
		};
		getPlansCatalog.mockResolvedValue(sparseCatalog);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());
		expect(screen.getByText('1,11 €')).toBeTruthy();
		expect(screen.getByText('2,22 €')).toBeTruthy();
		expect(screen.getByText('3,33 €')).toBeTruthy();
		expect(screen.queryByText('7,99 €')).toBeNull();
		expect(screen.queryByText('21,57 €')).toBeNull();
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
 */
describe('PlansSection (#1524 AK7: getrennte Zeilen für lesenden und schreibenden MCP-Zugriff)', () => {
	const CATALOG_MCP = {
		features: [
			{ feature: 'mcp_read', allowedPlans: ['max', 'ultimate'] },
			{ feature: 'mcp_readwrite', allowedPlans: ['ultimate'] },
		],
		prices: CATALOG_CENTS.prices,
	};

	it('zeigt zwei unterscheidbare Zeilen mit korrekter Paket-Zuordnung', async () => {
		getPlansCatalog.mockResolvedValue(CATALOG_MCP);
		render(createElement(PlansSection));

		await waitFor(() => expect(screen.getByTestId('plans-section')).toBeTruthy());

		// `tbody` enthält genau eine Zeile je `catalog.features`-Eintrag, in Katalog-Reihenfolge
		// (PlansSection.tsx:348-355) — hier also [mcp_read, mcp_readwrite].
		const featureRows = document.querySelectorAll('tbody tr');
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

		// mcp_read: max enthalten, ultimate enthalten, free/pro nicht.
		const readCells = Array.from(featureRows[0]!.querySelectorAll('td')).map((cell) => cell.textContent);
		expect(readCells).toEqual(['—', '—', 'enthalten', 'enthalten']);

		// mcp_readwrite: nur ultimate enthalten (unverändert).
		const readwriteCells = Array.from(featureRows[1]!.querySelectorAll('td')).map((cell) => cell.textContent);
		expect(readwriteCells).toEqual(['—', '—', '—', 'enthalten']);
	});
});
