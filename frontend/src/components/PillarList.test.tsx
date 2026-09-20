import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Pillar } from 'client';
import { ResponseError } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { PillarList } from './PillarList';

/** Erzeugt einen echten ResponseError (wie der API-Client ihn wirft) mit JSON-Body `{ message }`. */
const apiError = (status: number, message: string): ResponseError =>
	new ResponseError(new Response(JSON.stringify({ message }), { status }));

// Mocke die API, damit die Komponententests deterministisch und ohne Netzwerk auskommen.
vi.mock('../api', () => ({
	api: {
		listPillars: vi.fn(),
	},
}));

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), das in jsdom nicht lauffähig ist
// (`dialog.close is not a function`). Reduktion auf einen reinen Passthrough — die
// Formular-Logik der Dialoge wird damit isoliert und deterministisch prüfbar.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// KoliBri-Komponenten: nicht jsdom-kompatibel (Custom Elements, Shadow DOM). Alle für die
// Pillar-Dialoge relevanten Teile durch native HTML-Elemente ersetzen, damit Testing Library
// Queries (getByRole, getByText) funktionieren und Interaktionen simulierbar sind.
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
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
	// Leer- und Ladezustand der Liste (Karte mit CTA bzw. Spinner) — dieselbe Reduktion auf
	// natives HTML wie bei den übrigen KoliBri-Komponenten.
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div>
			{_label !== undefined && <h3>{_label}</h3>}
			{children}
		</div>
	),
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolHeading: ({ _label, _level = 2 }: { _label?: string; _level?: number }) => {
		// Nur h2/h3 werden in den PillarList-Dialogen verwendet. Zur Sicherheit auf h2 fallbacken.
		if (_level === 3) return <h3>{_label}</h3>;
		return <h2>{_label}</h2>;
	},
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: {
			onInput?: (_e: unknown, v: string) => void;
			onChange?: (_e: unknown, v: string) => void;
		};
	}) => (
		<input aria-label={_label} value={_value ?? ''} onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)} />
	),
	KolTextarea: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: {
			onInput?: (_e: unknown, v: string) => void;
			onChange?: (_e: unknown, v: string) => void;
		};
	}) => (
		<textarea
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		/>
	),
}));

afterEach(cleanup);

const pillar = (id: number, name: string, description: string, weight: number): Pillar => ({
	id,
	name,
	description,
	weight,
});

/**
 * Tests für die Säulen-Ansicht (PillarList).
 *
 * #1573: Die fünf Säulen sind fest — PillarList ist eine reine Leseansicht. Anlegen, Bearbeiten
 * und Löschen (einst #439, eigene Modal-Dialoge) sind entfallen; die früheren CRUD-Tests wurden
 * ersatzlos entfernt (Spec: docs/spec/issue-1573.md, Test-Pflege-Bedarf). Übrig bleiben und
 * unverändert gültig: Fehlerbehandlung beim Laden (inkl. „Erneut versuchen") und die je Säule
 * angezeigte Kurzbeschreibung (#934).
 */

describe('PillarList — Säulen-Ansicht (#439 Fehlerbehandlung, #1573 feste Säulen)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Fehlerbehandlung beim Laden', () => {
		it('zeigt bei fehlgeschlagenem Laden den Fehler-Alert und NICHT die Leerzustands-Karte', async () => {
			vi.mocked(api.listPillars).mockRejectedValueOnce(apiError(500, 'Serverfehler'));

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent(/serverfehler/i);
			});
			expect(screen.queryByText(/noch keine säulen/i)).not.toBeInTheDocument();
		});

		it('lädt nach Klick auf „Erneut versuchen" neu und blendet den Fehler nach Erfolg aus', async () => {
			vi.mocked(api.listPillars).mockRejectedValueOnce(apiError(500, 'Serverfehler'));
			vi.mocked(api.listPillars).mockResolvedValueOnce([pillar(1, 'Körper', 'Gesundheit', 100)]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('alert')).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));

			await waitFor(() => {
				expect(screen.queryByRole('alert')).not.toBeInTheDocument();
			});
			expect(screen.getByText('Körper')).toBeInTheDocument();
		});
	});

	// ── #1573: feste Säulen — keine CRUD-Kontrollen, Hinweis statt Verwaltung ─────────────

	describe('#1573 — feste Säulen: keine CRUD-Kontrollen, kein Hinweis-Duplikat', () => {
		it('rendert die Liste ohne Anlegen-/Bearbeiten-/Löschen-Buttons', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([
				pillar(1, 'Körper', 'Leiblichkeit', 20),
				pillar(2, 'Sinn', 'Transzendenz & Werte', 20),
			]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});
			expect(screen.queryByRole('button', { name: /neue säule anlegen/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /bearbeiten/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument();
		});

		it('kennt im Leerzustand keinen Info-Alert-Duplikat und keinen Anlege-CTA — nur einen schlichten Marker', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			render(<PillarList />);

			// Der Hinweis zu den festen Säulen sitzt einmalig in der SettingsPage (Spiegel dort,
			// SettingsPage.test.tsx) — hier steht kein zweiter `KolAlert` im Leerzustand.
			await waitFor(() => {
				expect(screen.getByText(/derzeit sind keine säulen vorhanden/i)).toBeInTheDocument();
			});
			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
			// Leerzustand ohne Anlege-CTA (die Karte wäre eine Sackgasse, KI-UX-Block).
			expect(screen.queryByRole('button', { name: /neue säule anlegen/i })).not.toBeInTheDocument();
		});
	});
});
/**
 * #934 AK3 (Spiegel) — Während die Säulen-Gewichtung die je-Säule-Beschreibung entfernt
 * (PillarWeightsModal.test.tsx), bleiben die Kurzbeschreibungen in der Säulenliste die einzige
 * Stelle, an der `pillar.description` angezeigt wird. Dieser Test sichert, dass die Liste sie
 * je Säule weiterhin unverändert rendert — der Solltext kommt dabei aus dem API-Fixture, nicht
 * aus dem Test-Literal (Spiegel gegen stillen Verlust der Stammdaten-Anzeige).
 */
describe('PillarList — Kurzbeschreibung je Säule bleibt (#934 AK3)', () => {
	it('rendert .pillar-list-description je Säule mit dem API-Beschreibungstext', async () => {
		const pillars = [
			pillar(1, 'Körper', 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.', 40),
			pillar(2, 'Sinn', 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.', 60),
		];
		vi.mocked(api.listPillars).mockResolvedValueOnce(pillars);

		const { container } = render(<PillarList />);

		// Warten, bis die Liste tatsächlich steht (sonst läuft die Assertion über eine leere Menge).
		await waitFor(() => {
			expect(container.querySelectorAll('.pillar-item')).toHaveLength(pillars.length);
		});

		const descriptions = container.querySelectorAll('.pillar-list-description');
		expect(descriptions).toHaveLength(pillars.length);
		expect(descriptions[0]?.textContent).toBe(pillars[0].description);
		expect(descriptions[1]?.textContent).toBe(pillars[1].description);
	});
});
