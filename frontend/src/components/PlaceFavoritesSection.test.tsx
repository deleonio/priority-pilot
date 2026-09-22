import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
		_disabled,
		...rest
	}: {
		_label?: string;
		_on?: { onClick?: () => void };
		_disabled?: boolean;
		'data-testid'?: string;
	}) => (
		<button type="button" disabled={_disabled} onClick={() => _on?.onClick?.()} {...rest}>
			{_label}
		</button>
	),
	// TEST-PFLEGE #1595 (AK5): Das Anlege-Formular nutzt jetzt `AddressAutocomplete` — der Mock muss
	// deshalb `_type` und die ARIA-Combobox-Props durchreichen (Muster `AddressAutocomplete.test.tsx`).
	KolInputText: ({
		_label,
		_value,
		_type,
		_on,
		...rest
	}: {
		_label?: string;
		_value?: string;
		_type?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			type={_type ?? 'text'}
			value={_value ?? ''}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
			{...(rest as Record<string, unknown>)}
		/>
	),
	KolSpin: ({ _label }: { _label?: string }) => <span role="status">{_label ?? 'wird geladen'}</span>,
	KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	// #1484: `PlanBadge` (T3a, unverändert) nutzt KolBadge zusätzlich zu KolButton (bereits oben).
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
}));

// TEST-PFLEGE #1595 (AK6): Gelöscht wird über `ConfirmDeleteDialog`, der auf `Modal`/`KolDialog`
// sitzt — wie in `ConfirmDeleteDialog.test.tsx` wird `Modal` auf ein schlichtes `div` reduziert.
vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
		<div data-testid="modal" aria-label={title}>
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
import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';

// Test-Pflege (#1528 AK3): das nicht-enthaltene Badge ist außerhalb von Modalen ein Router-Link
// (`<a href="/settings/pakete">` + useNavigate). Diese Suite rendert die Host-Komponente ohne
// Router — der Hook wird deshalb auf einen Stub geleitet; das Klick-Verhalten deckt PlanBadge.test.
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// TEST-PFLEGE #1595 (AK3): Ein gespeicherter Ort hat nur noch eine Adresse — `name` ist aus Modell,
// DTO und UI entfallen.
const FAVORITE = {
	id: 1,
	address: 'Rathausplatz 1, München',
	latitude: 48.1374,
	longitude: 11.5755,
};

beforeEach(() => {
	for (const key of Object.keys(apiMocks)) delete apiMocks[key];
	// `AddressAutocomplete` im Anlege-Formular (AK5) fragt die Adresssuche an — ohne Treffer.
	apiMocks.geocodeSearch = vi.fn().mockResolvedValue([]);
});

afterEach(cleanup);

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

describe('PlaceFavoritesSection (#1342 AK3, #1595)', () => {
	it('zeigt die geladenen Favoriten mit der Adresse', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		render(<PlaceFavoritesSection />);
		await flush();

		const row = screen.getByTestId('place-favorite-row');
		expect(row.textContent).toContain('Rathausplatz 1, München');
	});

	it('Anlegen ruft api.createPlaceFavorite mit der Adresse auf und zeigt den neuen Eintrag ohne Neuladen', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([]);
		apiMocks.createPlaceFavorite = vi
			.fn()
			.mockResolvedValue({ id: 2, address: 'Weg 1', latitude: null, longitude: null });
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.change(screen.getByLabelText(/adresse/i), { target: { value: 'Weg 1' } });
		fireEvent.click(screen.getByText(/anlegen|speichern/i));
		await flush();

		expect(apiMocks.createPlaceFavorite).toHaveBeenCalledWith(expect.objectContaining({ address: 'Weg 1' }));
		expect(apiMocks.createPlaceFavorite.mock.calls[0]?.[0]).not.toHaveProperty('name');
		expect(screen.getAllByTestId('place-favorite-row')).toHaveLength(1);
		expect(screen.getByTestId('place-favorite-row').textContent).toContain('Weg 1');
	});

	// #1595 AK3 — Ersatz für den entfallenen Umbenennen-Test: Name und Umbenennen sind weg.
	it('AK3 — die Karte hat weder ein Namensfeld noch einen Umbenennen-Knopf', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		render(<PlaceFavoritesSection />);
		await flush();

		expect(screen.queryByLabelText(/^name$/i)).toBeNull();
		expect(screen.queryByRole('button', { name: /umbenennen/i })).toBeNull();
		expect(screen.getByTestId('place-favorite-row').textContent).not.toContain('Büro');
	});

	// #1595 AK5 — dieselbe Adressvervollständigung wie im Aufgabenformular; die Auswahl übernimmt
	// Adresse UND Koordinaten in den anschließenden `createPlaceFavorite`-Aufruf.
	it('AK5 — das Anlege-Formular vervollständigt Adressen und übernimmt die Koordinaten des Treffers', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([]);
		apiMocks.geocodeSearch = vi
			.fn()
			.mockResolvedValue([
				{ address: 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München', lat: 48.1402, lon: 11.56 },
			]);
		apiMocks.createPlaceFavorite = vi.fn().mockResolvedValue({
			id: 3,
			address: 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München',
			latitude: 48.1402,
			longitude: 11.56,
		});
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.change(screen.getByLabelText(/adresse/i), { target: { value: 'munchen' } });
		const listbox = await screen.findByRole('listbox', {}, { timeout: 3000 });
		await act(async () => {
			fireEvent.mouseDown(within(listbox).getByRole('option', { name: /Bahnhofplatz 1/ }));
		});
		fireEvent.click(screen.getByText(/anlegen|speichern/i));
		await flush();

		expect(apiMocks.createPlaceFavorite).toHaveBeenCalledWith({
			address: 'München Hauptbahnhof, Bahnhofplatz 1, 80331 München',
			latitude: 48.1402,
			longitude: 11.56,
		});
	});

	// #1595 AK6 — gelöscht wird über den gemeinsamen Bestätigungsdialog
	// (docs/ux-pattern-sequential-confirmation.md), nicht mehr über eine Inline-Bestätigung.
	it('AK6 — Löschen läuft über den Bestätigungsdialog; der Eintrag verschwindet danach aus der Liste', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		apiMocks.deletePlaceFavorite = vi.fn().mockResolvedValue(undefined);
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /favorit löschen/i }));
		await flush();

		const dialog = screen.getByTestId('modal');
		expect(dialog).toHaveAttribute('aria-label', 'Ort löschen');
		fireEvent.click(within(dialog).getByRole('button', { name: /endgültig löschen/i }));
		await flush();

		expect(apiMocks.deletePlaceFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
		expect(screen.queryByTestId('place-favorite-row')).toBeNull();
	});

	it('AK6 — „Abbrechen" im Dialog lässt den Ort stehen', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([FAVORITE]);
		apiMocks.deletePlaceFavorite = vi.fn().mockResolvedValue(undefined);
		render(<PlaceFavoritesSection />);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /favorit löschen/i }));
		await flush();
		fireEvent.click(within(screen.getByTestId('modal')).getByRole('button', { name: /abbrechen/i }));
		await flush();

		expect(apiMocks.deletePlaceFavorite).not.toHaveBeenCalled();
		expect(screen.getByTestId('place-favorite-row')).toBeInTheDocument();
	});
});

// ── #1484 (T3b AK3): Paket-Badge auf der Karte „Gespeicherte Orte" ─────────────────────────────

/**
 * AK3: `PlaceFavoritesSection` rendert `<PlanBadge feature="location_reminders" />` auf der Karte
 * „Gespeicherte Orte" (`PlaceFavoritesSection.tsx:113`). Heute kein Badge — rot, bis `PlanBadge`
 * eingebunden ist (docs/spec/issue-1484.md AK3).
 */
describe('PlaceFavoritesSection — Paket-Badge auf der Karte (#1484 AK3)', () => {
	it('zeigt das location_reminders-Badge auf der Karte', async () => {
		apiMocks.listPlaceFavorites = vi.fn().mockResolvedValue([]);
		const entitlements: EntitlementMap = {
			location_reminders: { allowed: false, requiredPlan: 'max' } as EntitlementMap['location_reminders'],
		};
		render(
			<PlanProvider value={{ plan: 'free', entitlements }}>
				<PlaceFavoritesSection />
			</PlanProvider>,
		);
		await flush();

		expect(screen.getByTestId('plan-badge-location_reminders')).toBeInTheDocument();
	});
});
