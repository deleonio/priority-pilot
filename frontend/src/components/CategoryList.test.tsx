import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
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
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) =>
		// #2015 TF3: wörtliches Element statt neutralem div — nur so kann der Leerzustand-Test die
		// Kartenfläche selektieren („kein kol-card im Leerzustand“); Label-Überschrift bleibt erhalten.
		// createElement statt JSX: kol-card ist kein deklariertes Intrinsic-Element.
		createElement('kol-card', { _label }, _label !== undefined ? <h3>{_label}</h3> : null, children),
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

	// Roter Spec-Test für #2015 (TF3/AK2, docs/spec/issue-2015.md): der Leerzustand
	// „Noch keine Kategorien“ verliert seine Kartenfläche — keine Karte in der Karte
	// „Kategorien verwalten“ (Regel 1: keine Karte in Karte).
	it('#2015: im Leerzustand wird keine kol-card gerendert', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([]);

		const { container } = render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByText(/noch keine kategorien/i)).toBeInTheDocument();
		});
		expect(container.querySelector('kol-card'), 'Leerzustand ohne Kartenfläche').toBeNull();
	});

	it('listet vorhandene Kategorien mit Namen und Farbe', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([category(1, 'Hausbau', '#b42318')]);

		render(<CategoryList />);

		await waitFor(() => {
			expect(screen.getByText('Hausbau')).toBeInTheDocument();
		});
		expect(screen.getByText('Hausbau')).toHaveAttribute('data-color', '#b42318');
	});

	// Drei Beispielfarben aus der Kategorie-Palette; irrelevant welche, solange sie je Kategorie
	// unterscheidbar sind (TF1-B prüft die Vorbelegung über Name UND Farbe).
	it('rendert alle Kategorien als Chips einer gemeinsamen Liste ohne Karten-DOM (#2014/AK1)', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([
			category(1, 'Hausbau', '#b42318'),
			category(2, 'Steuer', '#1064d0'),
			category(3, 'Verein', '#6941c6'),
		]);

		const { container } = render(<CategoryList />);

		await waitFor(() => {
			expect(container.querySelectorAll('li[data-category-id]')).toHaveLength(3);
		});

		// EINE gemeinsame Chip-Liste, je Kategorie genau ein Eintrag:
		const lists = container.querySelectorAll('ul.category-items');
		expect(lists).toHaveLength(1);
		expect(lists[0].querySelectorAll(':scope > li[data-category-id]')).toHaveLength(3);

		// Kein Karten-DOM je Kategorie: `.pillar-item` ist der geteilte Kartenvertrag der Säulen und
		// Gruppen (app.css) — Kategorie-Chips tragen eigene Klassen (#2014, Randbedingung der Analyse).
		for (const chip of container.querySelectorAll<HTMLElement>('li[data-category-id]')) {
			expect(chip.className).not.toContain('pillar-item');
			expect(within(chip).getByRole('button', { name: /bearbeiten/i })).toBeInTheDocument();
			expect(within(chip).getByRole('button', { name: /löschen/i })).toBeInTheDocument();
		}
	});

	it('öffnet je Chip die Bearbeitung mit der richtigen Kategorie vorbelegt (#2014/AK2)', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([
			category(1, 'Hausbau', '#b42318'),
			category(2, 'Steuer', '#1064d0'),
			category(3, 'Verein', '#6941c6'),
		]);

		const { container } = render(<CategoryList />);

		await waitFor(() => {
			expect(container.querySelectorAll('li[data-category-id]')).toHaveLength(3);
		});

		fireEvent.click(
			within(container.querySelector('li[data-category-id="2"]')!).getByRole('button', { name: /bearbeiten/i }),
		);

		// Vorbelegt mit GENAU dieser Kategorie — Name und Farbe, nicht die erste der Liste:
		expect(screen.getByLabelText('Name')).toHaveValue('Steuer');
		expect(screen.getByLabelText('Farbe')).toHaveValue('#1064d0');
	});

	it('öffnet je Chip den Lösch-Dialog mit der richtigen Kategorie (#2014/AK2)', async () => {
		vi.mocked(api.listCategories).mockResolvedValue([
			category(1, 'Hausbau', '#b42318'),
			category(2, 'Steuer', '#1064d0'),
			category(3, 'Verein', '#6941c6'),
		]);

		const { container } = render(<CategoryList />);

		await waitFor(() => {
			expect(container.querySelectorAll('li[data-category-id]')).toHaveLength(3);
		});

		fireEvent.click(
			within(container.querySelector('li[data-category-id="3"]')!).getByRole('button', { name: /löschen/i }),
		);

		// Der Bestätigungstext nennt die Kategorie des GEKLICKTEN Chips (typografische Anführung im
		// Dialogkörper — das Badge in der Liste trägt den Namen ohne, bleibt also kein Falsch-Treffer):
		expect(screen.getByText('Verein', { selector: 'strong' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeInTheDocument();
	});

	it('hält den Ladezustand ohne Anlege-Aktion (#2014/AK4)', () => {
		vi.mocked(api.listCategories).mockReturnValue(new Promise(() => {}));

		render(<CategoryList />);

		expect(screen.getByRole('status')).toHaveTextContent('Kategorien werden geladen');
		expect(screen.queryByRole('button', { name: /neue kategorie anlegen/i })).toBeNull();
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
