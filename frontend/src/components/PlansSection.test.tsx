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
		expect(screen.getByText('0,00 €')).toBeTruthy();
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
