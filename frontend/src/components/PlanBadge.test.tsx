import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests zu #1458 AK4/AK5/AK7 — Paket-Badge und globaler Angebots-Dialog.
 *
 * `Modal` ist gemockt (KolDialog ist in JSDOM nicht hydrierbar), die KoliBri-Komponenten folgen dem
 * `SessionExpiredDialog.test.tsx`-Muster; geklickt wird über die native `data-testid`-Naht.
 */

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title: string; children?: ReactNode }) =>
		createElement('div', { role: 'dialog', 'aria-label': title }, children),
}));

vi.mock('@public-ui/react-v19', () => ({
	KolBadge: ({ _label }: { _label?: string }) => createElement('span', { 'data-testid': 'badge' }, _label),
	KolButton: ({ _label }: { _label?: string }) => createElement('button', null, _label),
}));

const getPlansCatalog = vi.fn();
vi.mock('../api', () => ({ api: { getPlansCatalog: () => getPlansCatalog() } }));

import { PLAN_REQUIRED_EVENT } from '../lib/apiError';
import type { EntitlementMap, Plan } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';
import { PlanBadge } from './PlanBadge';
import { PlanOfferDialog } from './PlanOfferDialog';

const withPlan = (plan: Plan | null, entitlements: EntitlementMap, children: ReactNode) =>
	createElement(PlanProvider, { value: { plan, entitlements } }, children);

beforeEach(() => {
	getPlansCatalog.mockResolvedValue({
		features: [{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] }],
		prices: { free: { monthly: 0, yearly: 0 }, pro: { monthly: 799, yearly: 7670 } },
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('PlanBadge (#1458 AK4)', () => {
	it('allowed=true → Haken-Badge ohne (i)-Schalter', () => {
		render(
			withPlan(
				'pro',
				{ groups: { allowed: true, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups' }),
			),
		);

		expect(screen.getByTestId('plan-badge-groups')).toBeTruthy();
		expect(screen.queryByTestId('plan-badge-info-groups')).toBeNull();
	});

	it('allowed=false → Paketname aus requiredPlan plus (i)-Schalter', () => {
		render(
			withPlan(
				'free',
				{ groups: { allowed: false, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups' }),
			),
		);

		expect(screen.getByTestId('badge').textContent).toBe('Pro');
		expect(screen.getByTestId('plan-badge-info-groups')).toBeTruthy();
	});

	it('ohne Entitlement rendert das Badge nichts (AK1: kein falscher Zustand vor der Antwort)', () => {
		render(withPlan(null, {}, createElement(PlanBadge, { feature: 'groups' })));

		expect(screen.queryByTestId('plan-badge-groups')).toBeNull();
	});
});

describe('PlanOfferDialog (#1458 AK5/AK7)', () => {
	it('AK5: Klick auf (i) öffnet das Angebot mit Ziel-Paket und Preis', async () => {
		render(
			withPlan('free', { groups: { allowed: false, requiredPlan: 'pro' } }, [
				createElement(PlanBadge, { key: 'badge', feature: 'groups' }),
				createElement(PlanOfferDialog, { key: 'dialog' }),
			]),
		);

		fireEvent.click(screen.getByTestId('plan-badge-info-groups'));

		const dialog = await screen.findByRole('dialog');
		expect(dialog.getAttribute('aria-label')).toContain('Pro');
		expect(await screen.findByText(/7,99 € im Monat/)).toBeTruthy();
	});

	it('AK7: drei Events hintereinander erzeugen genau einen Dialog', () => {
		render(withPlan('free', {}, createElement(PlanOfferDialog, null)));

		for (let i = 0; i < 3; i++) {
			window.dispatchEvent(
				new CustomEvent(PLAN_REQUIRED_EVENT, {
					detail: { feature: 'groups', requiredPlan: 'pro', currentPlan: 'free' },
				}),
			);
		}

		expect(screen.getAllByRole('dialog')).toHaveLength(1);
	});
});
