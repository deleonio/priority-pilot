import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaypalPurchase } from './PaypalPurchase';

/**
 * Tests zum PayPal-Kaufweg (#1505/#1496): Das Warte-Verhalten nach einem Paketwechsel ohne
 * `approvalUrl`. Nur ein Upgrade wartet auf die Plan-Bestätigung (Poll); Downgrade und
 * gleichrangiger Zeitraumwechsel wirken erst zum Periodenende (ADR 0013) — ein Plan-Poll liefe
 * garantiert in den Timeout. KoliBri, Modal und api sind modulweit gemockt (Muster
 * `PaypalDialogs.test.tsx`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label: string; children?: ReactNode }) => (
		<div role="alert" aria-label={_label}>
			{children}
		</div>
	),
	KolSpin: ({ _label }: { _label: string }) => <div role="status">{_label}</div>,
	KolButton: ({
		_label,
		_disabled,
		_on,
		children,
	}: {
		_label: string;
		_disabled?: boolean;
		_on?: { onClick?: () => void };
		children?: ReactNode;
	}) => (
		<button type="button" disabled={_disabled} onClick={() => _on?.onClick?.()}>
			{_label}
			{children}
		</button>
	),
	KolInputCheckbox: ({
		_label,
		_checked,
		_on,
	}: {
		_label: string;
		_checked?: boolean;
		_on?: { onChange?: (event: Event, value: unknown) => void };
	}) => (
		<label>
			<input
				type="checkbox"
				checked={_checked === true}
				onChange={(event) => _on?.onChange?.(event.nativeEvent, event.target.checked)}
			/>
			{_label}
		</label>
	),
	KolLink: ({ _href, _label }: { _href: string; _label: string }) => <a href={_href}>{_label}</a>,
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const previewBillingChange = vi.fn<() => Promise<{ creditCents: number; dueCents: number; immediate: boolean }>>();
const changeBillingSubscription = vi.fn();
const createBillingSubscription = vi.fn();

vi.mock('../api', () => ({
	api: {
		previewBillingChange: () => previewBillingChange(),
		changeBillingSubscription: (input: unknown) => changeBillingSubscription(input),
		createBillingSubscription: (input: unknown) => createBillingSubscription(input),
	},
}));

const subscriptionState = { subscription: { plan: 'pro', period: 'monthly' } as unknown };
const refresh = vi.fn(async () => {});

vi.mock('../lib/usePlan', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../lib/usePlan')>();
	return {
		...actual,
		usePlan: () => ({ plan: 'pro', entitlements: {}, subscription: subscriptionState.subscription, refresh }),
	};
});

/** Wirtskomponente: Aktionzeile + Hinweisfläche des Kaufwegs nebeneinander rendern. */
const Harness = ({ targetPlan = 'plus' }: { targetPlan?: 'plus' | 'pro' }) => {
	const { actionCell, notice, dialog } = usePaypalPurchase();
	const cell = actionCell?.(targetPlan, 'monthly');
	return (
		<div>
			<div>{cell?.node}</div>
			<div>{notice}</div>
			{dialog}
		</div>
	);
};

describe('usePaypalPurchase — Warteverhalten nach dem Wechsel', () => {
	beforeEach(() => {
		previewBillingChange.mockReset();
		changeBillingSubscription.mockReset();
		createBillingSubscription.mockReset();
		refresh.mockClear();
		subscriptionState.subscription = { plan: 'pro', period: 'monthly' };
	});
	afterEach(cleanup);

	it('ein Downgrade ohne approvalUrl zeigt den Periodenende-Hinweis statt auf die Plan-Bestätigung zu warten', async () => {
		previewBillingChange.mockResolvedValue({ creditCents: 0, dueCents: 499, immediate: false });
		changeBillingSubscription.mockResolvedValue({});
		render(<Harness />);

		screen.getByRole('button', { name: /wechseln/i }).click();
		await screen.findByText(/4,99 €/);
		screen.getByRole('button', { name: 'Wechseln bestätigen' }).click();

		expect(await screen.findByRole('alert', { name: 'Wechsel vorgemerkt' })).toBeTruthy();
		expect(screen.queryByRole('alert', { name: 'Zahlung wird bestätigt' })).toBeNull();
		// Ein Refresh holt den serverseitig sofort wirksamen Zeitraumwechsel in die Anzeige
		// (Review #1998) — ohne ihn stünde die alte Periode bis zum nächsten Fokus-Refresh.
		await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
	});

	it('ein Upgrade ohne approvalUrl wartet wie bisher auf die Bestätigung (Poll)', async () => {
		previewBillingChange.mockResolvedValue({ creditCents: 0, dueCents: 899, immediate: true });
		changeBillingSubscription.mockResolvedValue({});
		render(<Harness />);

		screen.getByRole('button', { name: /wechseln/i }).click();
		await screen.findByText(/8,99 €/);
		screen.getByRole('button', { name: 'Wechseln bestätigen' }).click();

		expect(await screen.findByRole('alert', { name: 'Zahlung wird bestätigt' })).toBeTruthy();
		await waitFor(() => expect(refresh).toHaveBeenCalled());
	});

	// #2049 AK3: im gekündigtem Zustand führt die Zeile des eigenen Pakets das Abo fort — der
	// einzige Einstieg für „Abo weiterführen", das Startdatum steht im Label (UX-Beratung).
	it('#2049 AK3: gekündigtes Abo zeigt in der eigenen Paketzeile „Weiterführen" mit Startdatum und bucht darüber', async () => {
		subscriptionState.subscription = {
			plan: 'pro',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: '2027-01-15T00:00:00.000Z',
		};
		createBillingSubscription.mockResolvedValue({});
		render(<Harness targetPlan="pro" />);

		// Der KolButton-Mock reicht kein data-testid durch — Anker ist das Label mit Startdatum.
		const resume = screen.getByRole('button', { name: /weiterführen/i });
		expect(resume).toHaveTextContent(/15\.1\.2027/);
		resume.click();

		await waitFor(() => expect(createBillingSubscription).toHaveBeenCalledWith({ plan: 'pro', period: 'monthly' }));
	});

	// #2235 AK6: das Zielpaket eines offenen Checkouts ist kein „Aktuelles Paket", sondern buchbar.
	it('#2235 AK6: approval_pending im Zielpaket zeigt „Buchen" statt „Aktuelles Paket"', () => {
		subscriptionState.subscription = {
			plan: 'plus',
			period: 'monthly',
			status: 'approval_pending',
			currentPeriodEnd: '2027-01-15T00:00:00.000Z',
		};
		render(<Harness targetPlan="plus" />);

		expect(screen.queryByText('Aktuelles Paket')).toBeNull();
		// Test-Pflege #2307: der Buchen-Knopf heißt jetzt „Zahlungspflichtig bestellen".
		expect(screen.getByRole('button', { name: /Zahlungspflichtig bestellen/ })).toBeTruthy();
	});
});

/**
 * #2307 (Vertrag: `docs/spec/issue-2307.md`) — Erstkauf „Zahlungspflichtig bestellen": eine
 * gemeinsame Zustimmungs-Checkbox im Hinweisbereich schaltet den Buchen-Knopf frei;
 * „Weiterführen" und „Wechseln" bleiben unverändert (AK1, AK2, AK3, AK6).
 */
describe('usePaypalPurchase — Widerrufsbelehrung vor dem Erstkauf (#2307)', () => {
	beforeEach(() => {
		createBillingSubscription.mockReset();
		createBillingSubscription.mockResolvedValue({});
		subscriptionState.subscription = null;
	});
	afterEach(cleanup);

	const bookButton = () => screen.getByRole('button', { name: /Zahlungspflichtig bestellen/ });

	it('AK1: der Buchen-Knopf trägt „Zahlungspflichtig bestellen" statt Paket und Laufzeit', () => {
		render(<Harness />);
		expect(bookButton()).toBeTruthy();
		expect(screen.queryByRole('button', { name: /buchen \(/ })).toBeNull();
	});

	it('AK3: Hinweis verlinkt /widerruf/ und eine Checkbox steht (nicht vorbelegt) vor dem Knopf', () => {
		const { container } = render(<Harness />);
		expect(container.querySelector('a[href="/widerruf/"]')).not.toBeNull();
		const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
		expect(checkbox.checked).toBe(false);
	});

	it('AK2: ohne Checkbox ist der Knopf deaktiviert und löst keinen Checkout aus', () => {
		render(<Harness />);
		const button = bookButton() as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		fireEvent.click(button);
		expect(createBillingSubscription).not.toHaveBeenCalled();
	});

	it('AK2: mit gesetzter Checkbox startet der Klick den bisherigen Checkout', async () => {
		render(<Harness />);
		fireEvent.click(screen.getByRole('checkbox'));
		const button = bookButton() as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		fireEvent.click(button);
		await waitFor(() => expect(createBillingSubscription).toHaveBeenCalledWith({ plan: 'plus', period: 'monthly' }));
	});

	it('AK6: „Wechseln" bleibt ohne Checkbox und mit altem Label', () => {
		subscriptionState.subscription = { plan: 'pro', period: 'monthly', status: 'active' };
		render(<Harness targetPlan="plus" />);
		expect(screen.getByRole('button', { name: 'Plus wechseln (monatlich)' })).toBeTruthy();
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('button', { name: /Zahlungspflichtig bestellen/ })).toBeNull();
	});

	it('AK6: „Weiterführen" bleibt ohne Checkbox und mit altem Label', () => {
		subscriptionState.subscription = {
			plan: 'plus',
			period: 'monthly',
			status: 'cancelled',
			currentPeriodEnd: '2099-01-15T00:00:00.000Z',
		};
		render(<Harness targetPlan="plus" />);
		expect(screen.getByRole('button', { name: /Plus weiterführen ab/ })).toBeTruthy();
		expect(screen.queryByRole('checkbox')).toBeNull();
	});
});
