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
	// #2086: Status-Badge je Rechnung (Muster AdminUsersSection) — als Text-Span, damit die
	// Label-Assertions gegen den Anzeigenamen laufen.
	KolBadge: ({ _label }: { _label: string }) => <span>{_label}</span>,
	KolSpin: () => <div />,
	// #2308: Felder des Kündigungsdialogs (KI-UX-Block: KolInputRadio, KolTextarea, KolInputEmail) als native Ersatzelemente.
	KolInputRadio: (props: {
		_label: string;
		_options: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (e: unknown, v: string) => void };
	}) => (
		<fieldset>
			<legend>{props._label}</legend>
			{props._options.map((option) => (
				<label key={option.value}>
					<input
						type="radio"
						name="kind"
						checked={props._value === option.value}
						onChange={() => props._on?.onChange?.(new Event('change'), option.value)}
					/>
					{option.label}
				</label>
			))}
		</fieldset>
	),
	KolTextarea: (props: { _label: string; _value?: string; _on?: { onInput?: (e: unknown, v: string) => void } }) => (
		<label>
			{props._label}
			<textarea value={props._value ?? ''} onChange={(e) => props._on?.onInput?.(e, e.target.value)} />
		</label>
	),
	KolInputEmail: (props: { _label: string; _value?: string; _on?: { onInput?: (e: unknown, v: string) => void } }) => (
		<label>
			{props._label}
			<input type="email" value={props._value ?? ''} onChange={(e) => props._on?.onInput?.(e, e.target.value)} />
		</label>
	),
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
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kunde@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));

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

	// #2049 AK7: bestätigt das Nutzer ein neues Abo (z. B. Weiterführen), liefert /auth/me wieder
	// einen nicht gekündigten Status — der lokale Merker verfällt im selben Seitenkontext, der
	// Gekündigt-Hinweis verschwindet ohne Remount. Ohne den Reset hielte `locallyCancelled` den
	// Hinweis künstlich am Leben.
	it('#2049 AK7: nach bestätigtem neuem Abo verschwindet der Gekündigt-Hinweis ohne Remount', async () => {
		subscriptionState.subscription = { ...baseSubscription, status: 'active' };
		const { api } = (await import('../api')) as typeof import('../api');
		const view = render(<SubscriptionSection />);

		// Lokal kündigen: der Merker zeigt den Hinweis, obwohl /auth/me weiter „active" liefert.
		fireEvent.click(screen.getByTestId('cancel-subscription'));
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kunde@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));
		await waitFor(() => {
			expect(api.cancelBillingSubscription).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(screen.getByTestId('subscription-cancelled')).toBeInTheDocument();
		});

		// Neues Abo bestätigt: /auth/me liefert einen nicht gekündigten Status.
		subscriptionState.subscription = { ...baseSubscription, status: 'approval_pending' };
		view.rerender(<SubscriptionSection />);

		await waitFor(() => {
			expect(screen.queryByTestId('subscription-cancelled')).not.toBeInTheDocument();
		});
	});

	// #2031 AK2 — der zugängliche Name jedes Download-Buttons nennt die eigene Rechnungsnummer,
	// damit sich die Zeilen für Screenreader/Nutzer unterscheiden (heute überall „PDF herunterladen“).
	it('#2031 AK2: Download-Button führt die Rechnungsnummer im zugänglichen Namen, je Zeile unterschiedlich', async () => {
		subscriptionState.subscription = null;
		const { api } = (await import('../api')) as typeof import('../api');
		vi.mocked(api.listBillingInvoices).mockResolvedValue([
			{
				id: 1,
				number: 'INV-2026-000001',
				periodStart: '2026-02-01T00:00:00.000Z',
				periodEnd: '2026-03-01T00:00:00.000Z',
				amountCents: 499,
			},
			{
				id: 2,
				number: 'INV-2026-000002',
				periodStart: '2026-03-01T00:00:00.000Z',
				periodEnd: '2026-04-01T00:00:00.000Z',
				amountCents: 899,
			},
		] as never);
		render(<SubscriptionSection />);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'PDF INV-2026-000001 herunterladen' })).toBeInTheDocument();
		});
		expect(screen.getByRole('button', { name: 'PDF INV-2026-000002 herunterladen' })).toBeInTheDocument();
	});

	// #2086 (Spec docs/spec/issue-2086.md, AK5) — die Eigentümer-Liste zeigt heute keinen Status;
	// der DTO-Wert muss als Text-Badge („Bezahlt“/„Erstattet“) je Zeile sichtbar sein (KI-UX:
	// dasselbe Wörterbuch wie die Admin-Sicht). Bis zur Impl-Phase fehlen die Badges — der Test
	// scheitert an den fehlenden Texten (legitimer Erst-Zustand). KEIN Produktivcode.
	it('#2086 AK5: zeigt je Rechnung den Zahlungsstatus als „Bezahlt“/„Erstattet“', async () => {
		subscriptionState.subscription = null;
		const { api } = (await import('../api')) as typeof import('../api');
		vi.mocked(api.listBillingInvoices).mockResolvedValue([
			{
				id: 1,
				number: 'INV-2026-000011',
				periodStart: '2026-02-01T00:00:00.000Z',
				periodEnd: '2026-03-01T00:00:00.000Z',
				amountCents: 499,
				paymentStatus: 'paid',
			},
			{
				id: 2,
				number: 'INV-2026-000012',
				periodStart: '2026-03-01T00:00:00.000Z',
				periodEnd: '2026-04-01T00:00:00.000Z',
				amountCents: 899,
				paymentStatus: 'refunded',
			},
		] as never);
		render(<SubscriptionSection />);

		const paidEntry = await waitFor(() => screen.getByText('INV-2026-000011').closest('li') as HTMLElement);
		expect(paidEntry).toBeInTheDocument();
		expect(paidEntry, 'Die bezahlte Rechnung zeigt das Badge „Bezahlt“').toHaveTextContent('Bezahlt');
		const refundedEntry = screen.getByText('INV-2026-000012').closest('li') as HTMLElement;
		expect(refundedEntry, 'Die erstattete Rechnung zeigt das Badge „Erstattet“').toHaveTextContent('Erstattet');
	});

	// #2140 AK8: ein zahlungsgebundener Wechsel hat keinen Zeitpunkt (`pendingPlanEffectiveAt: null`) —
	// die Anzeige nennt den Grund statt eines Wechsels ohne Zeitangabe; das aktuelle Paket bleibt das alte.
	it('#2140 AK8: Vormerkung ohne Zeitpunkt zeigt „aktiv mit Zahlungseingang", das aktuelle Paket bleibt das alte', () => {
		subscriptionState.subscription = {
			...baseSubscription,
			plan: 'plus',
			status: 'active',
			pendingPlan: 'pro',
			pendingPlanEffectiveAt: null,
		};
		render(<SubscriptionSection />);

		expect(screen.getByTestId('subscription-pending-plan')).toHaveTextContent(
			/Wechsel zu Pro, aktiv mit Zahlungseingang/,
		);
		expect(screen.getByTestId('subscription-status')).toHaveTextContent(/Aktuelles Paket:\s*Plus/);
	});

	// #2235 AK6 (Spec docs/spec/issue-2235.md): ein offener Checkout ist kein aktuelles Paket.
	it('#2235 AK6: approval_pending zeigt nicht „Aktuelles Paket: <Zielpaket>"', () => {
		subscriptionState.subscription = { ...baseSubscription, status: 'approval_pending' };
		render(<SubscriptionSection />);

		expect(screen.getByTestId('subscription-section')).not.toHaveTextContent(/Aktuelles Paket/);
	});

	it.each(['past_due', 'suspended'])(
		'#2240 AK6: PayPal-Abo mit Status %s zeigt den Schalter „Abo kündigen"',
		(status) => {
			subscriptionState.subscription = { ...baseSubscription, status };
			render(<SubscriptionSection />);

			expect(screen.getByTestId('cancel-subscription')).toBeInTheDocument();
		},
	);
});

describe('SubscriptionSection — Kündigungsbutton und Bestätigungsschritt (#2308)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		subscriptionState.subscription = { ...baseSubscription, status: 'active' };
	});

	it('AK1: „Verträge hier kündigen" ist bei kündbarem Abo ohne Aufklappen sichtbar, bei gekündigtem fehlt er', () => {
		const { unmount } = render(<SubscriptionSection />);
		expect(screen.getByRole('button', { name: 'Verträge hier kündigen' })).toBeInTheDocument();
		unmount();

		subscriptionState.subscription = { ...baseSubscription, status: 'cancelled' };
		render(<SubscriptionSection />);
		expect(screen.queryByRole('button', { name: 'Verträge hier kündigen' })).not.toBeInTheDocument();
	});

	it('AK2: Dialog zeigt Paket, Laufzeitende, Art (Default ordentlich) und E-Mail-Feld, noch ohne Grund', () => {
		render(<SubscriptionSection />);
		fireEvent.click(screen.getByRole('button', { name: 'Verträge hier kündigen' }));

		const dialog = screen.getByRole('dialog');
		expect(dialog).toHaveTextContent(/Pro/);
		expect(dialog).toHaveTextContent(/monatlich/);
		expect(dialog).toHaveTextContent(/zum Ende der Laufzeit/);
		expect(dialog).toHaveTextContent(/15\.1?\.2027/);
		expect(screen.getByLabelText('Ordentlich')).toBeChecked();
		expect(screen.getByLabelText('Außerordentlich')).not.toBeChecked();
		expect(screen.getByLabelText(/E-Mail/)).toBeInTheDocument();
		expect(screen.queryByLabelText(/Grund/)).not.toBeInTheDocument();
	});

	it('AK3: außerordentlich verlangt einen Grund, ungültige E-Mail blockiert — kein Aufruf', async () => {
		const { api } = (await import('../api')) as typeof import('../api');
		render(<SubscriptionSection />);
		fireEvent.click(screen.getByRole('button', { name: 'Verträge hier kündigen' }));
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kunde@example.com' } });
		fireEvent.click(screen.getByLabelText('Außerordentlich'));
		expect(screen.getByLabelText(/Grund/)).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));
		expect(api.cancelBillingSubscription).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText(/Grund/), { target: { value: 'Preiserhöhung' } });
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kein-email' } });
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));
		expect(api.cancelBillingSubscription).not.toHaveBeenCalled();
	});

	it('AK4: Bestätigen sendet Art, Grund und E-Mail; danach Gekündigt-Zustand', async () => {
		const { api } = (await import('../api')) as typeof import('../api');
		render(<SubscriptionSection />);
		fireEvent.click(screen.getByRole('button', { name: 'Verträge hier kündigen' }));
		fireEvent.click(screen.getByLabelText('Außerordentlich'));
		fireEvent.change(screen.getByLabelText(/Grund/), { target: { value: 'Preiserhöhung' } });
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kunde@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));

		await waitFor(() => {
			expect(api.cancelBillingSubscription).toHaveBeenCalledWith({
				kind: 'extraordinary',
				reason: 'Preiserhöhung',
				email: 'kunde@example.com',
			});
		});
		await waitFor(() => {
			expect(screen.getByTestId('subscription-cancelled')).toBeInTheDocument();
		});
	});

	it('AK4: ordentliche Kündigung sendet keinen Grund', async () => {
		const { api } = (await import('../api')) as typeof import('../api');
		render(<SubscriptionSection />);
		fireEvent.click(screen.getByRole('button', { name: 'Verträge hier kündigen' }));
		fireEvent.change(screen.getByLabelText(/E-Mail/), { target: { value: 'kunde@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt kündigen' }));

		await waitFor(() => {
			expect(api.cancelBillingSubscription).toHaveBeenCalledWith({ kind: 'ordinary', email: 'kunde@example.com' });
		});
	});
});
