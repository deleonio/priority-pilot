import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1342 AK3 (Spec docs/spec/issue-1342.md) — Einstellungen → Standort,
 * Karte „Gespeicherte Orte": Favoriten anlegen, umbenennen, löschen. Nach dem Löschen darf der
 * Eintrag nicht mehr in der Liste erscheinen (deckt zugleich einen Teil von AK5's
 * Client-Vertrag ab: die Section spiegelt ausschließlich, was `api.listPlaceFavorites` liefert).
 *
 * Muster: `ApiTokensSection.test.tsx` (#1352/#1356) — Proxy-Mock für `../api` (jede Methode wird
 * bei Erstzugriff automatisch zu einem eigenen `vi.fn()`), echtes async-Update über `act`.
 * `@public-ui/react-v19` wird komponentenlokal auf native HTML-Elemente reduziert (analog
 * `AddressAutocomplete.test.tsx`), weil KoliBri-Custom-Elements in jsdom nicht definiert sind.
 *
 * Rot, bis `PlaceFavoritesSection.tsx` existiert und exakt dieses Modul-/Prop-/API-Vertrag erfüllt
 * (Datei existiert heute nicht — legitimer roter Zustand für neue Funktionalität).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<section aria-label={_label}>{children}</section>
	),
	KolButton: ({
		_label,
		_on,
		...rest
	}: {
		_label?: string;
		_on?: { onClick?: () => void };
		'data-testid'?: string;
	}) => (
		<button type="button" onClick={() => _on?.onClick?.()} {...rest}>
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
	KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
}));

const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(undefined)),
		},
	),
}));

import { PlaceFavoritesSection } from './PlaceFavoritesSection';

const FAVORITE = {
	id: 1,
	name: 'Büro',
	address: 'Rathausplatz 1, München',
	latitude: 48.1374,
	longitude: 11.5755,
};

beforeEach(() => {
	for (const key of Object.keys(apiMocks)) delete apiMocks[key];
});

afterEach(cleanup);

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

describe('PlaceFavoritesSection (#1342 AK3)', () => {
	it('zeigt die geladenen Favoriten mit Name und Adresse', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		render(<PlaceFavoritesSection />);
		await flush();

		const row = screen.getByTestId('place-favorite-row');
		expect(row.textContent).toContain('Büro');
		expect(row.textContent).toContain('Rathausplatz 1, München');
	});

	it('Anlegen ruft api.createPlaceFavorite auf und zeigt den neuen Eintrag ohne Neuladen', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([]);
		apiMocks.createPlaceFavorite = vi
			.fn()
			.mockResolvedValue({ id: 2, name: 'Zuhause', address: 'Weg 1', latitude: null, longitude: null });
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Zuhause' } });
		fireEvent.change(screen.getByLabelText(/adresse/i), { target: { value: 'Weg 1' } });
		fireEvent.click(screen.getByText(/anlegen|speichern/i));
		await flush();

		expect(apiMocks.createPlaceFavorite).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Zuhause', address: 'Weg 1' }),
		);
		expect(screen.getAllByTestId('place-favorite-row')).toHaveLength(1);
		expect(screen.getByTestId('place-favorite-row').textContent).toContain('Zuhause');
	});

	it('Umbenennen ruft api.updatePlaceFavorite mit dem neuen Namen auf und aktualisiert die Zeile', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		apiMocks.updatePlaceFavorite = vi.fn().mockResolvedValue({ ...FAVORITE, name: 'Zweitbüro' });
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /favorit umbenennen/i }));
		const nameInput = screen.getByDisplayValue('Büro');
		fireEvent.change(nameInput, { target: { value: 'Zweitbüro' } });
		fireEvent.click(screen.getByText(/^(übernehmen|speichern)$/i));
		await flush();

		expect(apiMocks.updatePlaceFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Zweitbüro' }));
		expect(screen.getByTestId('place-favorite-row').textContent).toContain('Zweitbüro');
	});

	it('Löschen ruft api.deletePlaceFavorite auf; der Eintrag verschwindet danach aus der Liste', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		apiMocks.deletePlaceFavorite = vi.fn().mockResolvedValue(undefined);
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /favorit löschen/i }));
		await flush();
		// Zweistufige Bestätigung (Muster ApiTokensSection/docs/ux-pattern-sequential-confirmation.md)
		const confirmButtons = screen.getAllByRole('button').filter((b) => /löschen|entfernen/i.test(b.textContent ?? ''));
		fireEvent.click(confirmButtons[confirmButtons.length - 1]);
		await flush();

		expect(apiMocks.deletePlaceFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
		expect(screen.queryByTestId('place-favorite-row')).toBeNull();
	});
});
