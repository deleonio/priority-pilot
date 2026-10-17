import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingAddressForm } from './BillingAddressForm';

/**
 * Tests zur Kaufweg-UI der Rechnungsadresse (#2661, Review-Blocker): Laden, Speichern
 * (getrimmte Werte), Validierung (leeres Feld, über 120 Zeichen), Save-Fehlerpfad,
 * Edit-Toggle bei gespeicherter Adresse, Lade-Gate und Ladefehlerhinweis. KoliBri und api
 * modulweit gemockt (Muster `PaypalPurchase.test.tsx`); echte i18n-Texte (de).
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
		...rest
	}: {
		_label: string;
		_disabled?: boolean;
		_on?: { onClick?: () => void };
		'data-testid'?: string;
	}) => (
		<button type="button" disabled={_disabled === true} onClick={() => _on?.onClick?.()} {...rest}>
			{_label}
		</button>
	),
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
}));

const getBillingAddress = vi.fn<
	() => Promise<{
		name: string | null;
		street: string | null;
		zip: string | null;
		city: string | null;
		country: string | null;
	}>
>();
const updateBillingAddress = vi.fn<(input: Record<string, string>) => Promise<unknown>>();

vi.mock('../api', () => ({
	api: {
		getBillingAddress: () => getBillingAddress(),
		updateBillingAddress: (input: unknown) => updateBillingAddress(input as Record<string, string>),
	},
}));

const EMPTY = { name: null, street: null, zip: null, city: null, country: null };
const FULL = {
	name: 'Max Mustermann',
	street: 'Musterstraße 1',
	zip: '12345',
	city: 'Musterstadt',
	country: 'Deutschland',
};

const fillForm = (): void => {
	fireEvent.change(screen.getByLabelText('Name oder Firma'), { target: { value: '  Max Mustermann  ' } });
	fireEvent.change(screen.getByLabelText('Straße und Hausnummer'), { target: { value: 'Musterstraße 1' } });
	fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
	fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
	fireEvent.change(screen.getByLabelText('Land'), { target: { value: 'Deutschland' } });
};

describe('BillingAddressForm (#2661)', () => {
	beforeEach(() => {
		getBillingAddress.mockReset();
		updateBillingAddress.mockReset();
		updateBillingAddress.mockResolvedValue(FULL);
	});
	afterEach(cleanup);

	it('ohne gespeicherte Adresse: füllen und speichern — PUT mit getrimmten Werten und Erfolgsmeldung', async () => {
		getBillingAddress.mockResolvedValue(EMPTY);
		render(<BillingAddressForm />);
		await screen.findByTestId('billing-address-form');
		fillForm();
		fireEvent.click(screen.getByTestId('billing-address-save'));

		await waitFor(() => expect(updateBillingAddress).toHaveBeenCalledTimes(1));
		expect(updateBillingAddress).toHaveBeenCalledWith(FULL);
		expect(await screen.findByRole('alert', { name: 'Rechnungsadresse gespeichert.' })).toBeTruthy();
	});

	it('mit gespeicherter Adresse: kollabiert auf den Ändern-Button, der das Formular vorbelegt öffnet', async () => {
		getBillingAddress.mockResolvedValue(FULL);
		render(<BillingAddressForm />);

		const edit = await screen.findByTestId('billing-address-edit');
		expect(screen.queryByTestId('billing-address-form')).toBeNull();
		fireEvent.click(edit);

		await screen.findByTestId('billing-address-form');
		expect((screen.getByLabelText('Name oder Firma') as HTMLInputElement).value).toBe('Max Mustermann');
		expect((screen.getByLabelText('Ort') as HTMLInputElement).value).toBe('Musterstadt');
	});

	it('Validierung: leeres Feld zeigt den Invalid-Hinweis und ruft kein PUT auf', async () => {
		getBillingAddress.mockResolvedValue(EMPTY);
		render(<BillingAddressForm />);
		await screen.findByTestId('billing-address-form');
		fireEvent.change(screen.getByLabelText('Straße und Hausnummer'), { target: { value: 'Musterstraße 1' } });
		fireEvent.click(screen.getByTestId('billing-address-save'));

		const alert = await screen.findByRole('alert', { name: 'Rechnungsadresse konnte nicht gespeichert werden.' });
		expect(alert.textContent).toContain('Bitte alle Felder der Rechnungsadresse ausfüllen.');
		expect(updateBillingAddress).not.toHaveBeenCalled();
	});

	it('Validierung: über 120 Zeichen zeigt den Invalid-Hinweis und ruft kein PUT auf', async () => {
		getBillingAddress.mockResolvedValue(EMPTY);
		render(<BillingAddressForm />);
		await screen.findByTestId('billing-address-form');
		fireEvent.change(screen.getByLabelText('Name oder Firma'), { target: { value: 'X'.repeat(121) } });
		fireEvent.change(screen.getByLabelText('Straße und Hausnummer'), { target: { value: 'Musterstraße 1' } });
		fireEvent.change(screen.getByLabelText('PLZ'), { target: { value: '12345' } });
		fireEvent.change(screen.getByLabelText('Ort'), { target: { value: 'Musterstadt' } });
		fireEvent.change(screen.getByLabelText('Land'), { target: { value: 'Deutschland' } });
		fireEvent.click(screen.getByTestId('billing-address-save'));

		expect(
			await screen.findByRole('alert', { name: 'Rechnungsadresse konnte nicht gespeichert werden.' }),
		).toBeTruthy();
		expect(updateBillingAddress).not.toHaveBeenCalled();
	});

	it('Save-Fehlerpfad: fehlgeschlagenes PUT zeigt den Fehlerhinweis', async () => {
		getBillingAddress.mockResolvedValue(EMPTY);
		updateBillingAddress.mockRejectedValue(new Error('500'));
		render(<BillingAddressForm />);
		await screen.findByTestId('billing-address-form');
		fillForm();
		fireEvent.click(screen.getByTestId('billing-address-save'));

		expect(
			await screen.findByRole('alert', { name: 'Rechnungsadresse konnte nicht gespeichert werden.' }),
		).toBeTruthy();
		expect(updateBillingAddress).toHaveBeenCalledTimes(1);
	});

	it('Lade-Gate: bis zum GET-Ergebnis rendert weder Formular noch Ändern-Button (kein Mount-Flash)', async () => {
		getBillingAddress.mockReturnValue(new Promise(() => {}));
		render(<BillingAddressForm />);

		expect(screen.queryByTestId('billing-address-form')).toBeNull();
		expect(screen.queryByTestId('billing-address-edit')).toBeNull();
	});

	it('Ladefehler: eigener Hinweis statt leerem Formular', async () => {
		getBillingAddress.mockRejectedValue(new Error('boom'));
		render(<BillingAddressForm />);

		expect(await screen.findByRole('alert', { name: 'Rechnungsadresse konnte nicht geladen werden.' })).toBeTruthy();
		expect(screen.queryByTestId('billing-address-form')).toBeNull();
	});
});
