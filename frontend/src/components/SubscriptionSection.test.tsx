import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionSection } from './SubscriptionSection';

/**
 * Rote Spec-Tests für #2048 (Spec docs/spec/issue-2048.md) — AK1–AK3. Der Gekündigt-Zustand
 * (Test-ID `subscription-cancelled`) existiert noch nicht und `canCancel` hängt nicht am
 * Abo-Status: AK1/AK3 scheitern an der fehlenden/nachgewiesenen Stelle, AK2 sichert die
 * Regression. KEIN Produktivcode.
 *
 * KoliBri wird wie in `UpdatePrompt.test.tsx` durch native Ersatzelemente gemockt; `usePlan`,
 * `api` und der Kanal kommen als Mocks, damit der Status die einzige Stellschraube bleibt.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: (props: { _label: string; children?: React.ReactNode }) => (
		<div role="alert">
			{props._label}
			{props.children}
		</div>
	),
	// Modal (CancelDialog) rendert auf KolDialog — ohne Export scheitert AK3 am fehlenden Mock, nicht am Verhalten.
	KolDialog: (props: { _label: string; children?: React.ReactNode } & Record<string, unknown>) => {
		const { _label, children, ...rest } = props;
		return (
			<div role="dialog" aria-label={_label} {...rest}>
				{children}
			</div>
		);
	},
	// data-testid u. a. Rest-Props durchreichen (Analyse setzt auf `cancel-subscription` ab).
	KolButton: (props: { _label: string; _on?: { onClick?: (e: unknown) => void } } & Record<string, unknown>) => {
		const { _label, _on, ...rest } = props;
		return (
			<button type="button" {...rest} onClick={_on?.onClick}>
				{_label}
			</button>
		);
	},
	KolDetails: (props: { _label: string; children?: React.ReactNode }) => (
		<details open>
			<summary>{props._label}</summary>
			{props.children}
		</details>
	),
	KolSpin: () => <div />,
}));

vi.mock('../api', () => ({
	api: {
		listBillingInvoices: vi.fn(async () => []),
		cancelBillingSubscription: vi.fn(async () => {}),
	},
}));

const subscriptionState = { subscription: null as unknown };
vi.mock('../lib/usePlan', () => ({
	usePlan: () => subscriptionState,
}));

vi.mock('../lib/platform', () => ({
	getChannel: () => 'web',
}));

const baseSubscription = {
	provider: 'paypal',
	plan: 'pro',
	period: 'monthly',
	status: 'active',
	currentPeriodEnd: '2027-01-15T00:00:00.000Z',
	pendingPlan: null,
	pendingPlanEffectiveAt: null,
	graceUntil: null,
};

describe('SubscriptionSection (#2048)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('AK1: cancelled mit zukünftigem currentPeriodEnd zeigt Gekündigt-Hinweis mit Enddatum, keinen Kündigen-Schalter', () => {
		subscriptionState.subscription = { ...baseSubscription, status: 'cancelled' };
		render(<SubscriptionSection />);

		const hint = screen.getByTestId('subscription-cancelled');
		expect(hint).toBeInTheDocument();
		expect(hint).toHaveTextContent(/Gekündigt/);
		expect(hint).toHaveTextContent(/15\.1?\.2027/);
		expect(hint).toHaveTextContent(/Free/);
		expect(screen.queryByTestId('cancel-subscription')).not.toBeInTheDocument();
	});

	it('AK2: active Abo zeigt den Schalter „Abo kündigen" wie bisher, keinen Gekündigt-Hinweis (Regression)', () => {
		subscriptionState.subscription = { ...baseSubscription, status: 'active' };
		render(<SubscriptionSection />);

		expect(screen.getByTestId('cancel-subscription')).toBeInTheDocument();
		expect(screen.queryByTestId('subscription-cancelled')).not.toBeInTheDocument();
	});

	it('AK3: nach bestätigter Kündigung im Dialog verschwindet der Schalter sofort, Gekündigt-Hinweis erscheint', async () => {
		subscriptionState.subscription = { ...baseSubscription, status: 'active' };
		const { api } = (await import('../api')) as typeof import('../api');
		render(<SubscriptionSection />);

		fireEvent.click(screen.getByTestId('cancel-subscription'));
		fireEvent.click(screen.getByRole('button', { name: 'Kündigen' }));

		await waitFor(() => {
			expect(api.cancelBillingSubscription).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(screen.queryByTestId('cancel-subscription')).not.toBeInTheDocument();
		});
		const hint = screen.getByTestId('subscription-cancelled');
		expect(hint).toHaveTextContent(/Gekündigt/);
		expect(hint).toHaveTextContent(/15\.1?\.2027/);
	});
});
