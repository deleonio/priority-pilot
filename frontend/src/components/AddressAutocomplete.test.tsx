import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1083 — eigene Vorschlagsliste ohne Substring-Gate (`AddressAutocomplete`).
 *
 * Die KolCombobox filtert Server-Treffer intern per `includes` (kein Abschalt-Prop in
 * @public-ui 4.3.0) — deshalb ersetzt der Adress-Block im Task-/Serie-Formular sie durch eine
 * eigene Liste, die ALLE Server-Treffer zeigt (AK5). Zusätzlich genagelt: ARIA-Combobox-Muster
 * (der #1061-E2E sucht `getByRole('option')`), Tastaturbedienung und die vier asynchronen
 * Zustände Laden/Leer/Fehler/Erfolg (Fehler und „keine Treffer" waren bisher ununterscheidbar).
 *
 * Testebene: Vitest-Komponententest mit gemockter API — die echte `useAddressSearch`-Kette
 * (Debounce 400 ms, Abort) läuft mit, damit das Substring-Gate nicht durch einen Stub
 * vorgetäuscht wird. KoliBri-Komponenten sind nicht jsdom-kompatibel (Custom Elements) und
 * werden wie in `TaskForm.test.tsx` durch native HTML-Elemente ersetzt; der `KolInputText`-Mock
 * reicht ARIA-/Keyboard-Props durch (der Mock-Kontrakt für Combobox-Semantik auf dem Feld).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolInputText: ({
		_label,
		_value,
		_type,
		_on,
		...rest
	}: {
		_label?: string;
		_value?: string;
		/** #1111: `_type` ist der native Input-Typ ("search" | "tel" | "text" | "url", spec/input-text). */
		_type?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void; onInput?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			type={_type ?? 'text'}
			value={_value ?? ''}
			onChange={(e) => {
				_on?.onChange?.(e.nativeEvent, e.target.value);
				_on?.onInput?.(e.nativeEvent, e.target.value);
			}}
			{...(rest as Record<string, unknown>)}
		/>
	),
	KolSpin: ({ _label }: { _label?: string }) => <span role="status">{_label ?? 'wird geladen'}</span>,
	KolAlert: ({ _label, _type, children }: { _label?: string; _type?: string; children?: React.ReactNode }) => (
		<div role="alert" data-type={_type}>
			{_label}
			{children}
		</div>
	),
}));

const MUNICH_HITS = [
	{ address: 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München', lat: 48.1402, lon: 11.56 },
	{ address: 'München Ost, Orleanstraße 3, 81667 München', lat: 48.1286, lon: 11.6012 },
];

vi.mock('../api', () => ({
	api: {
		geocodeSearch: vi.fn(),
	},
}));

import { api } from '../api';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { AddressSuggestion } from '../lib/useAddressSearch';

const mockGeocodeSearch = api.geocodeSearch as ReturnType<typeof vi.fn>;

/** Harness: hält Freitext und Auswahl getrennt, damit beide Verträge einzeln behauptbar sind. */
const Harness = ({
	onSelect,
	onSubmit,
}: {
	onSelect?: (suggestion: AddressSuggestion) => void;
	onSubmit?: () => void;
}) => {
	const [value, setValue] = useState('');
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit?.();
			}}
		>
			<AddressAutocomplete label="Adresse (optional)" value={value} onValueChange={setValue} onSelect={onSelect} />
		</form>
	);
};

const typeQuery = async (query: string) => {
	fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
	// Debounce 400 ms (useAddressSearch) — der API-Aufruf und die Liste folgen danach.
	await waitFor(() => expect(mockGeocodeSearch).toHaveBeenCalled(), { timeout: 1500 });
};

afterEach(() => {
	mockGeocodeSearch.mockReset();
	mockGeocodeSearch.mockResolvedValue([]);
});

describe('AddressAutocomplete (#1083)', () => {
	it('#1111 AK6 — das Adressfeld ist ein input type="search" (wie das Kopfzeilen-Suchfeld)', () => {
		mockGeocodeSearch.mockResolvedValue([]);
		render(<Harness />);

		// Der Mock spiegelt `_type` auf den nativen Typ (KolInputText-Prop, spec/input-text) —
		// rot solange `AddressAutocomplete` die Prop nicht an `KolInputText` durchreicht.
		expect(screen.getByRole('searchbox')).toHaveAttribute('type', 'search');
	});

	it('AK5 — zeigt alle Server-Treffer ohne Substring-Gate („munchen" → München-Treffer)', async () => {
		mockGeocodeSearch.mockResolvedValue(MUNICH_HITS);
		render(<Harness />);

		// „munchen" kommt in keinem der Treffer-Strings vor — KolCombobox hätte hier leer gefiltert.
		await typeQuery('munchen');

		const listbox = await screen.findByRole('listbox', {}, { timeout: 2000 });
		const options = within(listbox).getAllByRole('option');
		expect(options).toHaveLength(MUNICH_HITS.length);
		expect(options.map((option) => option.textContent)).toEqual(MUNICH_HITS.map((hit) => hit.address));
		for (const option of options) {
			await expect(option).toBeVisible();
		}
	});

	it('AK5 — ARIA-Combobox-Muster: Feld ohne Combobox-Rolle, State am Container, Listbox als Nachfahre', async () => {
		mockGeocodeSearch.mockResolvedValue(MUNICH_HITS);
		render(<Harness />);

		// Fix F2: `role="combobox"` liegt NICHT auf dem Eingabefeld/KoliBri-Host, sondern auf einem
		// Container, der Feld UND Listbox besitzt — sonst zeigt `aria-activedescendant` ins Leere.
		const combobox = screen.getByRole('combobox');
		const textbox = screen.getByRole('searchbox');
		expect(combobox).not.toBe(textbox);
		expect(combobox).toHaveAttribute('aria-autocomplete', 'list');
		expect(combobox).toContainElement(textbox);
		expect(combobox).toHaveAttribute('aria-expanded', 'false');

		await typeQuery('munchen');
		const listbox = await screen.findByRole('listbox', {}, { timeout: 2000 });

		expect(combobox).toHaveAttribute('aria-expanded', 'true');
		const controls = combobox.getAttribute('aria-controls');
		expect(controls).toBeTruthy();
		expect(within(document.getElementById(controls as string) as HTMLElement).getByRole('listbox')).toBe(listbox);
		// `aria-activedescendant` braucht einen NACHFAHREN des Combobox-Elements.
		expect(listbox).toBeVisible();
		expect(combobox).toContainElement(listbox);

		// Tastatur kommt vom Feld und delegiert zum Combobox-Container (Shadow-DOM-Bubbling).
		fireEvent.keyDown(textbox, { key: 'ArrowDown' });
		expect(combobox).toHaveAttribute('aria-activedescendant');
		const activeId = combobox.getAttribute('aria-activedescendant') as string;
		expect(document.getElementById(activeId)).not.toBeNull();
		expect(
			within(listbox)
				.getAllByRole('option')
				.some((option) => option.id === activeId),
		).toBe(true);
	});

	it('AK5 — Tab/Blurfokus schließt die Liste ohne Auswahl', async () => {
		mockGeocodeSearch.mockResolvedValue(MUNICH_HITS);
		const onSelect = vi.fn();
		render(<Harness onSelect={onSelect} />);

		await typeQuery('munchen');
		await screen.findByRole('listbox', {}, { timeout: 2000 });

		fireEvent.focusOut(screen.getByRole('searchbox'));
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('AK5 — Tastatur: Enter wählt den markierten Treffer (inkl. lat/lon), ohne das Formular abzuschicken; Escape schließt', async () => {
		mockGeocodeSearch.mockResolvedValue(MUNICH_HITS);
		const onSelect = vi.fn();
		const onSubmit = vi.fn();
		render(<Harness onSelect={onSelect} onSubmit={onSubmit} />);

		const textbox = screen.getByRole('searchbox');
		await typeQuery('munchen');
		await screen.findByRole('listbox', {}, { timeout: 2000 });

		fireEvent.keyDown(textbox, { key: 'ArrowDown' });
		fireEvent.keyDown(textbox, { key: 'Enter' });

		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(MUNICH_HITS[0]);
		expect(onSubmit).not.toHaveBeenCalled();

		// Nach der Auswahl ist die Liste zu; sie öffnet sich erst wieder mit neuer Eingabe.
		expect(screen.queryByRole('listbox')).toBeNull();
		fireEvent.change(textbox, { target: { value: 'munchen haupt' } });
		await screen.findByRole('listbox', {}, { timeout: 2000 });
		fireEvent.keyDown(textbox, { key: 'Escape' });
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('AK5 — Zustände: Laden (Status) wird von Erfolg abgelöst, Fehler wird sichtbar (nicht still leer)', async () => {
		let resolveSearch: (results: { address: string; lat: number; lon: number }[]) => void = () => {};
		mockGeocodeSearch.mockReturnValue(
			new Promise((resolve) => {
				resolveSearch = resolve;
			}),
		);
		render(<Harness />);

		const input = screen.getByRole('searchbox');
		fireEvent.change(input, { target: { value: 'munchen' } });
		await waitFor(() => expect(mockGeocodeSearch).toHaveBeenCalled(), { timeout: 1500 });

		// Laden: erreichbarer Status (Spinner mit Label), solange die Anfrage läuft.
		expect(screen.getByRole('status')).toBeInTheDocument();

		resolveSearch(MUNICH_HITS);
		const listbox = await screen.findByRole('listbox', {}, { timeout: 2000 });
		expect(within(listbox).getAllByRole('option')).toHaveLength(2);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('AK5 — Fehler und „keine Treffer" sind unterscheidbar: Fehler zeigt Warnung, Leer zeigt neutralen Hinweis', async () => {
		mockGeocodeSearch.mockRejectedValue(new Error('Suche nicht erreichbar'));
		render(<Harness />);

		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'munchen' } });
		await waitFor(() => expect(mockGeocodeSearch).toHaveBeenCalled(), { timeout: 1500 });

		const alert = await screen.findByRole('alert', {}, { timeout: 2000 });
		expect(alert).toBeVisible();
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('AK5 — Fehlerzustand räumt sich ab: nach einem Fehlschlag zeigt eine erfolgreiche Suche wieder Treffer ohne Warnung', async () => {
		// Regression F1/N1: `setError(false)` beim Start einer neuen Anfrage — ohne die Zeile klebt
		// die Warnung neben allen späteren Trefferlisten desselben Mounts.
		mockGeocodeSearch.mockRejectedValueOnce(new Error('Suche nicht erreichbar'));
		render(<Harness />);

		await typeQuery('munchen');
		await screen.findByRole('alert', {}, { timeout: 2000 });

		mockGeocodeSearch.mockResolvedValue(MUNICH_HITS);
		await typeQuery('munchen haupt');
		await screen.findByRole('listbox', {}, { timeout: 2000 });
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('AK5 — Leer-Zustand: 0 Server-Treffer zeigt neutralen Hinweis statt Warnung', async () => {
		mockGeocodeSearch.mockResolvedValue([]);
		render(<Harness />);

		fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyznichtstreffer' } });
		await waitFor(() => expect(mockGeocodeSearch).toHaveBeenCalled(), { timeout: 1500 });

		// Leer ist legitim (Photon 200 mit 0 Treffern) — keine Warnung, sondern Einladung zur Freitext-Übernahme.
		await waitFor(
			() => {
				expect(screen.queryByRole('status')).toBeNull();
			},
			{ timeout: 2000 },
		);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByText(/keine treffer/i)).toBeInTheDocument();
	});
});
