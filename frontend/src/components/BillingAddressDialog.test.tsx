import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingAddressDialog } from './BillingAddressDialog';

/**
 * Dialog „Rechnungsadresse" in der Abrechnungs-Sektion: Felder laden aus GET /billing/address,
 * Speichern sendet die Werte und schließt den Dialog, ein Speicherfehler zeigt den Alert und
 * lässt den Dialog offen, Abbrechen schließt ohne zu speichern. KoliBri, Modal und api sind
 * modulweit gemockt (Muster `PaypalDialogs.test.tsx`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label: string; children?: ReactNode }) => (
		<div role="alert" aria-label={_label}>
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
		'data-testid': testId,
	}: {
		_label: string;
		_disabled?: boolean;
		_on?: { onClick?: () => void };
		'data-testid'?: string;
	}) => (
		<button type="button" disabled={_disabled} data-testid={testId} onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
	KolInputText: ({
		_label,
		_value,
		_on,
		'data-testid': testId,
	}: {
		_label: string;
		_value?: string;
		_on?: { onInput?: (event: Event, value: string) => void; onChange?: (event: Event, value: string) => void };
		'data-testid'?: string;
	}) => (
		<label>
			{_label}
			<input
				type="text"
				data-testid={testId}
				value={_value ?? ''}
				onChange={(event) => _on?.onInput?.(event.nativeEvent, event.target.value)}
			/>
		</label>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title: string; children?: ReactNode }) => (
		<div role="dialog" aria-label={title}>
			{children}
		</div>
	),
}));

const getBillingAddress = vi.fn();
const updateBillingAddress = vi.fn();

vi.mock('../api', () => ({
	api: {
		getBillingAddress: () => getBillingAddress(),
		updateBillingAddress: (input: unknown) => updateBillingAddress(input),
	},
}));

const EMPTY_ADDRESS = { name: null, street: null, zip: null, city: null, country: null };

describe('BillingAddressDialog', () => {
	beforeEach(() => {
		getBillingAddress.mockReset();
		updateBillingAddress.mockReset();
		updateBillingAddress.mockResolvedValue({});
	});
	afterEach(cleanup);

	it('lädt die Adresse und zeigt die fünf Felder', async () => {
		getBillingAddress.mockResolvedValue({ ...EMPTY_ADDRESS, name: 'Erika Musterfrau' });
		render(<BillingAddressDialog onClose={() => {}} />);

		expect(await screen.findByLabelText('Name oder Firma')).toHaveValue('Erika Musterfrau');
		expect(screen.getByLabelText('Straße und Hausnummer')).toBeTruthy();
		expect(screen.getByLabelText('PLZ')).toBeTruthy();
		expect(screen.getByLabelText('Ort')).toBeTruthy();
		expect(screen.getByLabelText('Land')).toBeTruthy();
	});

	it('Speichern sendet die Werte und schließt den Dialog', async () => {
		const onClose = vi.fn();
		getBillingAddress.mockResolvedValue(EMPTY_ADDRESS);
		render(<BillingAddressDialog onClose={onClose} />);
		await screen.findByLabelText('Name oder Firma');
		fireEvent.change(screen.getByLabelText('Name oder Firma'), { target: { value: '  Erika Musterfrau  ' } });
		fireEvent.change(screen.getByLabelText('Straße und Hausnummer'), { target: { value: 'Musterweg 2' } });
		fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '98765' } });
		fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterhausen' } });
		fireEvent.change(screen.getByLabelText('Land'), { target: { value: 'Deutschland' } });

		fireEvent.click(screen.getByTestId('billing-address-save'));

		await waitFor(() =>
			expect(updateBillingAddress).toHaveBeenCalledWith({
				name: 'Erika Musterfrau',
				street: 'Musterweg 2',
				zip: '98765',
				city: 'Musterhausen',
				country: 'Deutschland',
			}),
		);
		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('unvollständige Adresse blockiert das Speichern mit Validierungs-Hinweis', async () => {
		const onClose = vi.fn();
		getBillingAddress.mockResolvedValue(EMPTY_ADDRESS);
		render(<BillingAddressDialog onClose={onClose} />);
		await screen.findByLabelText('Name oder Firma');
		fireEvent.change(screen.getByLabelText('Name oder Firma'), { target: { value: 'Erika Musterfrau' } });

		fireEvent.click(screen.getByTestId('billing-address-save'));

		expect(await screen.findByText('Bitte alle Felder der Rechnungsadresse ausfüllen.')).toBeTruthy();
		expect(updateBillingAddress).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('Fehler beim Speichern zeigt den Alert und lässt den Dialog offen', async () => {
		const onClose = vi.fn();
		getBillingAddress.mockResolvedValue(EMPTY_ADDRESS);
		updateBillingAddress.mockRejectedValue(new Error('Speichern fehlgeschlagen'));
		render(<BillingAddressDialog onClose={onClose} />);
		await screen.findByLabelText('Name oder Firma');
		for (const [label, value] of [
			['Name oder Firma', 'Erika Musterfrau'],
			['Straße und Hausnummer', 'Musterweg 2'],
			['PLZ', '98765'],
			['Ort', 'Musterhausen'],
			['Land', 'Deutschland'],
		] as const) {
			fireEvent.change(screen.getByLabelText(label), { target: { value } });
		}

		fireEvent.click(screen.getByTestId('billing-address-save'));

		expect(
			await screen.findByRole('alert', { name: 'Rechnungsadresse konnte nicht gespeichert werden.' }),
		).toBeTruthy();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('Abbrechen schließt ohne zu speichern', async () => {
		const onClose = vi.fn();
		getBillingAddress.mockResolvedValue(EMPTY_ADDRESS);
		render(<BillingAddressDialog onClose={onClose} />);
		await screen.findByLabelText('Name oder Firma');

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		expect(onClose).toHaveBeenCalled();
		expect(updateBillingAddress).not.toHaveBeenCalled();
	});
});
