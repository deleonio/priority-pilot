import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Category } from 'client';
import { ResponseError } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { CategoryList } from './CategoryList';

/** Erzeugt einen echten ResponseError (wie der API-Client ihn wirft) mit JSON-Body `{ message }`. */
const apiError = (status: number, message: string): ResponseError =>
	new ResponseError(new Response(JSON.stringify({ message }), { status }));

vi.mock('../api', () => ({
	api: {
		createCategory: vi.fn(),
		updateCategory: vi.fn(),
		deleteCategory: vi.fn(),
		listCategories: vi.fn(),
	},
}));

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), in jsdom nicht lauffähig — Passthrough
// wie in PillarList.test.tsx, damit die Dialog-Logik isoliert prüfbar bleibt.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// KoliBri-Komponenten auf native HTML-Elemente reduzieren (Custom Elements/Shadow DOM sind nicht
// jsdom-kompatibel) — dieselbe Reduktion wie in PillarList.test.tsx.
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolBadge: ({ _label, _color }: { _label?: string; _color?: string }) => <span data-color={_color}>{_label}</span>,
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div>
			{_label !== undefined && <h3>{_label}</h3>}
			{children}
		</div>
	),
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input aria-label={_label} value={_value ?? ''} onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)} />
	),
	KolSingleSelect: ({
		_label,
		_value,
		_options,
		_on,
	}: {
		_label?: string;
		_value?: string | number;
		_options?: { label: string; value: string | number }[];
		_on?: { onChange?: (_e: unknown, v: unknown) => void };
	}) => (
		<select
			aria-label={_label}
			value={String(_value ?? '')}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		>
			{(_options ?? []).map((option) => (
				<option key={String(option.value)} value={String(option.value)}>
					{option.label}
				</option>
			))}
		</select>
	),
}));

afterEach(cleanup);

const category = (id: number, name: string, color: Category['color']): Category => ({ id, name, color });

/**
 * Tests der Kategorie-Verwaltung. Geprüft wird, was still brechen kann: die vier gestalteten
 * Zustände, die Abgrenzung zur Säule im Einleitungstext (der fachliche Kern des Features) und die
 * Dialog-Logik für Anlegen und Löschen.
 */
describe('CategoryList — Kategorie-Verwaltung', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('erklärt den Unterschied zwischen Kategorie und Lebenssäule', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([]);

		render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByText(/Lebenssäule/)).toBeInTheDocument();
		});
		expect(screen.getByText(/wirkt sie nicht auf die Priorisierung/i)).toBeInTheDocument();
	});

	it('zeigt im Leerzustand genau eine Anlege-Aktion', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([]);

		render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByText(/noch keine kategorien/i)).toBeInTheDocument();
		});
		expect(screen.getAllByRole('button', { name: /neue kategorie anlegen/i })).toHaveLength(1);
	});

	it('listet vorhandene Kategorien mit Namen und Farbe', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([category(1, 'Hausbau', '#b42318')]);

		render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByText('Hausbau')).toBeInTheDocument();
		});
		expect(screen.getByText('Hausbau')).toHaveAttribute('data-color', '#b42318');
	});

	it('legt eine Kategorie mit Name und Farbe an und lädt die Liste neu', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([]);
		vi.mocked(api.createCategory).mockResolvedValue(category(1, 'Hausbau', '#1064d0'));
		const onCategoryChanged = vi.fn();

		render(<CategoryList onCategoryChanged={onCategoryChanged} />);

		await waitFor(() => screen.getByRole('button', { name: /neue kategorie anlegen/i }));
		fireEvent.click(screen.getByRole('button', { name: /neue kategorie anlegen/i }));

		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hausbau' } });
		fireEvent.change(screen.getByLabelText('Farbe'), { target: { value: '#1064d0' } });
		fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));

		await waitFor(() => {
			expect(api.createCategory).toHaveBeenCalledWith({ categoryCreate: { name: 'Hausbau', color: '#1064d0' } });
		});
		expect(onCategoryChanged).toHaveBeenCalled();
	});

	it('zeigt den Serverfehler bei doppeltem Namen im Dialog', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([]);
		vi.mocked(api.createCategory).mockRejectedValue(
			apiError(409, 'Eine Kategorie mit diesem Namen existiert bereits.'),
		);

		render(<CategoryList />);

		await waitFor(() => screen.getByRole('button', { name: /neue kategorie anlegen/i }));
		fireEvent.click(screen.getByRole('button', { name: /neue kategorie anlegen/i }));
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hausbau' } });
		fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Eine Kategorie mit diesem Namen existiert bereits.');
		});
	});

	it('nennt beim Löschen, dass die Aufgaben erhalten bleiben', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([category(1, 'Hausbau', '#b42318')]);

		render(<CategoryList />);

		await waitFor(() => screen.getByRole('button', { name: 'Löschen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

		expect(screen.getByText(/bleiben erhalten und verlieren nur ihre Zuordnung/i)).toBeInTheDocument();
	});

	it('bietet nach einem Ladefehler einen erneuten Versuch an, ohne einen Leerzustand zu behaupten', async () => {
		vi.mocked(api.listCategories).mockRejectedValue(apiError(500, 'Interner Serverfehler.'));

		render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Interner Serverfehler.');
		});
		expect(screen.queryByText(/noch keine kategorien/i)).not.toBeInTheDocument();
	});
});
