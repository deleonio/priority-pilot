import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingReturnNotice } from './BillingReturnNotice';

/**
 * Tests zur Abbruch-Rückkehr von PayPal (#2235): `?billing=cancelled` räumt die ausstehende
 * Buchung über die Kündigungs-Route auf, zeigt einen Hinweis und entfernt den Parameter aus der
 * URL, damit ein Reload nicht erneut räumt. `usePlan` und `api` sind gemockt (Muster
 * `SubscriptionSection.test.tsx`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label: string; children?: ReactNode }) => (
		<div role="alert" aria-label={_label}>
			{_label}
			{children}
		</div>
	),
}));

const cancelBillingSubscription = vi.fn(async () => {});
const refresh = vi.fn(async () => {});

vi.mock('../api', () => ({
	api: {
		cancelBillingSubscription: () => cancelBillingSubscription(),
	},
}));

vi.mock('../lib/usePlan', () => ({
	usePlan: () => ({ plan: 'free', entitlements: {}, refresh }),
}));

/** Zeigt die aktuelle Query — Anker für die URL-Bereinigung. */
const QueryProbe = () => <span data-testid="query">{useLocation().search}</span>;

const renderNotice = (search: string, children?: ReactNode): void => {
	render(
		<MemoryRouter initialEntries={[`/settings/pakete${search}`]}>
			<BillingReturnNotice />
			{children}
		</MemoryRouter>,
	);
};

describe('BillingReturnNotice (#2235)', () => {
	beforeEach(() => {
		cancelBillingSubscription.mockClear();
		refresh.mockClear();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('?billing=cancelled ruft die Kündigungs-Route, zeigt den Abbruch-Hinweis und räumt die URL auf', async () => {
		renderNotice('?billing=cancelled', <QueryProbe />);

		await waitFor(() => expect(cancelBillingSubscription).toHaveBeenCalledTimes(1));
		expect(await screen.findByText(/Buchung abgebrochen/)).toBeTruthy();
		expect(refresh).toHaveBeenCalled();
		await waitFor(() => expect(screen.getByTestId('query')).toHaveTextContent(/^$/));
	});

	it('ohne billing-Parameter passiert nichts', () => {
		renderNotice('', <QueryProbe />);

		expect(cancelBillingSubscription).not.toHaveBeenCalled();
		expect(screen.queryByText(/Buchung abgebrochen/)).toBeNull();
		expect(screen.getByTestId('query')).toHaveTextContent(/^$/);
	});
});
