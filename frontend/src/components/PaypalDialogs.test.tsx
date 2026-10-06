import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeDialog } from './PaypalDialogs';

/**
 * Rote Spec-Tests für #1913 (Spec docs/spec/issue-1913.md, AK4): der Wechsel-Dialog lädt beim
 * Öffnen die Vorschau (`api.previewBillingChange`, neu) und zeigt Guthaben und fälligen Betrag,
 * bevor „Wechseln bestätigen" aktiv wird. KoliBri, Modal und api sind modulweit gemockt
 * (Muster `DayDoneHint.test.tsx`).
 */

interface Preview {
	creditCents: number;
	dueCents: number;
	immediate: boolean;
	startsAt?: string;
	creditCoversUntil?: string;
}

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label: string; children?: ReactNode }) => (
		<div role="alert" aria-label={_label}>
			{children}
		</div>
	),
	KolSpin: ({ _label }: { _label: string }) => <div role="status">{_label}</div>,
	KolButton: ({ _label, _disabled, _on }: { _label: string; _disabled?: boolean; _on?: { onClick?: () => void } }) => (
		<button type="button" disabled={_disabled} onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const previewBillingChange = vi.fn<(input: { plan: string; period: string }) => Promise<Preview>>();
const changeBillingSubscription = vi.fn();

vi.mock('../api', () => ({
	api: {
		previewBillingChange: (input: { plan: string; period: string }) => previewBillingChange(input),
		changeBillingSubscription: (input: unknown) => changeBillingSubscription(input),
	},
}));

const renderDialog = (plan: 'plus' | 'pro' = 'pro') =>
	render(<ChangeDialog targetPlan={plan} targetPeriod="monthly" onClose={() => {}} onChanged={() => {}} />);

describe('ChangeDialog — Vorschau des fälligen Betrags (#1913)', () => {
	beforeEach(() => {
		previewBillingChange.mockReset();
		changeBillingSubscription.mockReset();
	});
	afterEach(cleanup);

	it('AK4: lädt die Vorschau beim Öffnen und zeigt Guthaben und fälligen Betrag formatiert', async () => {
		previewBillingChange.mockResolvedValue({ creditCents: 249, dueCents: 650, immediate: true });

		renderDialog();

		await waitFor(() => expect(previewBillingChange).toHaveBeenCalledWith({ plan: 'pro', period: 'monthly' }));
		expect(await screen.findByText(/6,50 €/)).toBeTruthy();
		expect(screen.getByText(/2,49 €/)).toBeTruthy();
	});

	it('AK4: „Wechseln bestätigen" ist deaktiviert, solange die Vorschau lädt, und danach aktiv', async () => {
		let resolve: (value: Preview) => void = () => {};
		previewBillingChange.mockReturnValue(new Promise<Preview>((r) => (resolve = r)));

		renderDialog();

		const confirm = screen.getByRole('button', { name: 'Wechseln bestätigen' }) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		expect(screen.getByRole('status')).toBeTruthy();

		resolve({ creditCents: 0, dueCents: 899, immediate: true });
		await waitFor(() => expect(confirm.disabled).toBe(false));
	});

	it('AK4: ohne Guthaben (creditCents 0) entfällt die Guthaben-Zeile, der fällige Betrag bleibt', async () => {
		previewBillingChange.mockResolvedValue({ creditCents: 0, dueCents: 499, immediate: false });

		renderDialog('plus');

		expect(await screen.findByText(/4,99 €/)).toBeTruthy();
		expect(screen.queryByText(/0,00 €/)).toBeNull();
		expect(screen.queryByText(/Guthaben/)).toBeNull();
	});

	it('AK4: schlägt die Vorschau fehl, erscheint ein Fehler und der Wechsel bleibt blockiert', async () => {
		previewBillingChange.mockRejectedValue(new Error('boom'));

		renderDialog();

		expect(await screen.findByRole('alert', { name: 'Vorschau nicht verfügbar' })).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Wechseln bestätigen' }) as HTMLButtonElement).disabled).toBe(true);
		expect(changeBillingSubscription).not.toHaveBeenCalled();
	});

	it('AK4: eine veraltete Vorschau-Antwort überschreibt nicht den Betrag des neuen Ziels', async () => {
		const pending: Record<string, (value: Preview) => void> = {};
		previewBillingChange.mockImplementation(({ plan }) => new Promise<Preview>((r) => (pending[plan] = r)));
		const view = renderDialog('plus');
		await waitFor(() => expect(pending.plus).toBeDefined());
		view.rerender(<ChangeDialog targetPlan="pro" targetPeriod="monthly" onClose={() => {}} onChanged={() => {}} />);
		await waitFor(() => expect(pending.pro).toBeDefined());

		pending.pro({ creditCents: 100, dueCents: 899, immediate: true });
		pending.plus({ creditCents: 0, dueCents: 499, immediate: false });

		expect(await screen.findByText(/8,99 €/)).toBeTruthy();
		await waitFor(() => expect(screen.queryByText(/4,99 €/)).toBeNull());
	});

	// Paketwechsel-Fix (Sandbox-Befund): nur ein Upgrade wartet auf die Plan-Bestätigung; bei
	// Downgrade/Zeitraumwechsel würde ein Plan-Poll garantiert in den Timeout laufen. Der Dialog
	// reicht `immediate` aus der Vorschau an onChanged durch.
	it('confirm reicht die Sofort-Wirksamkeit aus der Vorschau an onChanged durch', async () => {
		previewBillingChange.mockResolvedValue({ creditCents: 0, dueCents: 499, immediate: false });
		changeBillingSubscription.mockResolvedValue({});
		const onChanged = vi.fn();
		render(<ChangeDialog targetPlan="plus" targetPeriod="monthly" onClose={() => {}} onChanged={onChanged} />);

		await screen.findByText(/4,99 €/);
		screen.getByRole('button', { name: 'Wechseln bestätigen' }).click();

		await waitFor(() => expect(onChanged).toHaveBeenCalledWith(undefined, false));
	});

	// #2049 AK6: die Vorschau nennt den Startzeitpunkt — Weiterführen/Downgrade wirken erst ab dem
	// genannten Datum, ein Upgrade sofort.
	it('#2049 AK6: zeigt den Startzeitpunkt aus der Vorschau als Datum, wenn der Wechsel aufschiebt', async () => {
		previewBillingChange.mockResolvedValue({
			creditCents: 0,
			dueCents: 499,
			immediate: false,
			startsAt: '2026-10-15T00:00:00.000Z',
		});

		renderDialog('plus');

		expect(await screen.findByText(/4,99 €/)).toBeTruthy();
		expect(screen.getByText('Wirksam ab')).toBeTruthy();
		// Zeitzone des Runners ist UTC — 15.10.2026 bleibt dort 15.10.2026.
		expect(screen.getByText(/15\.10\.2026/)).toBeTruthy();
	});

	it('#2049 AK6: ein sofort wirksamer Wechsel (Upgrade) zeigt „sofort" als Startzeitpunkt', async () => {
		previewBillingChange.mockResolvedValue({
			creditCents: 249,
			dueCents: 650,
			immediate: true,
			startsAt: new Date().toISOString(),
		});

		renderDialog();

		expect(await screen.findByText(/6,50 €/)).toBeTruthy();
		expect(screen.getByText('Wirksam ab')).toBeTruthy();
		expect(screen.getByText('sofort')).toBeTruthy();
	});

	it('#2241 AK6: nennt das Datum, bis zu dem das Guthaben reicht, und die Gebühr bei Zustimmung', async () => {
		previewBillingChange.mockResolvedValue({
			creditCents: 4330,
			dueCents: 1669,
			immediate: true,
			startsAt: new Date().toISOString(),
			creditCoversUntil: '2027-02-06T00:00:00.000Z',
		});

		renderDialog();

		expect(await screen.findByText('Guthaben reicht bis')).toBeTruthy();
		expect(screen.getByText(/6\.2\.2027/)).toBeTruthy();
		expect(screen.getByText('Fällig bei Zustimmung')).toBeTruthy();
	});
});
