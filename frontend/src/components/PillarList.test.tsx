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
		createPillar: vi.fn(),
		updatePillar: vi.fn(),
		deletePillar: vi.fn(),
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
}));

afterEach(cleanup);

const pillar = (id: number, name: string, description: string, weight: number): Pillar => ({
	id,
	name,
	description,
	weight,
});

/**
 * Tests für die Säulen-Verwaltungs-Komponente (PillarList) — Issue #439.
 *
 * Die Komponente nutzt eigene Modal-Dialoge für Anlegen/Bearbeiten/Löschen (KoliBri-basiert).
 * In diesen Tests wird das `Modal` als Passthrough gemockt und KoliBri-Komponenten durch native
 * HTML-Elemente ersetzt, sodass die Formular-Logik der Dialog-Komponenten (PillarFormDialog,
 * PillarDeleteDialog) direkt geprüft wird.
 *
 * AK1: Nutzer kann eine Säule anlegen (Name Pflicht, Beschreibung optional); sie erscheint sofort.
 * AK2: Bearbeiten (Name/Beschreibung ändern); Namenskonflikt zeigt verständlichen Feldfehler.
 * AK3: Löschen mit Bestätigung inkl. Hinweis auf betroffene Tasks/Serien; letzte Säule löschbar.
 */

describe('PillarList — Säulen-Verwaltung (Issue #439)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── AK1: Anlegen (Happy Path) ──────────────────────────────────────────────

	describe('AK1 — Säule anlegen', () => {
		it('zeigt einen „Neue Säule anlegen"-Button an', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
		});

		it('öffnet das Anlegen-Formular (Name required, Beschreibung optional) nach Button-Klick', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			// Formularfelder sichtbar.
			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			expect(screen.getByRole('textbox', { name: /beschreibung/i })).toBeInTheDocument();
		});

		it('legt eine neue Säule an und zeigt sie in der Liste', async () => {
			const existing: Pillar[] = [pillar(1, 'Körper', 'Gesundheit', 20)];
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			const newPillar: Pillar = pillar(2, 'Beziehungen', 'Freunde & Familie', 0);
			vi.mocked(api.createPillar).mockResolvedValueOnce(newPillar);

			// Nach dem Anlegen: beide Säulen erscheinen.
			vi.mocked(api.listPillars).mockResolvedValueOnce([...existing, newPillar]);

			render(<PillarList />);

			// Anlegen-Dialog öffnen
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			// Im Modal: Name + Beschreibung eingeben
			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Beziehungen' } });
			fireEvent.change(screen.getByRole('textbox', { name: /beschreibung/i }), {
				target: { value: 'Freunde & Familie' },
			});
			// Anlegen-Button im Modal klicken
			fireEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

			await waitFor(() => {
				expect(api.createPillar).toHaveBeenCalledWith({
					pillarCreate: { name: 'Beziehungen', description: 'Freunde & Familie' },
				});
			});

			// Nach dem Anlegen: Liste enthält beide Säulen.
			await waitFor(() => {
				expect(screen.getByText('Beziehungen')).toBeInTheDocument();
			});
		});

		it('zeigt Fehler, wenn Name leer ist (Validierung clientseitig)', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			// Anlegen im Modal OHNE Namenseingabe → Fehler
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /^anlegen$/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

			await waitFor(() => {
				expect(screen.getByText(/name.*darf nicht leer/i)).toBeInTheDocument();
			});

			// API darf NICHT aufgerufen worden sein.
			expect(api.createPillar).not.toHaveBeenCalled();
		});
	});

	// ── AK1: Fehlerbehandlung (409 Namenskonflikt, 400 Validierung) ────────────

	describe('AK2 — Fehlerbehandlung beim Anlegen', () => {
		it('zeigt bei 409 Namenskonflikt einen Feldfehler an', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			const conflictError = apiError(409, 'Eine Säule mit diesem Namen existiert bereits.');
			vi.mocked(api.createPillar).mockRejectedValueOnce(conflictError);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Körper' } });
			fireEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

			await waitFor(() => {
				expect(screen.getByText(/existiert bereits/i)).toBeInTheDocument();
			});
		});

		it('zeigt bei 400 Validierungsfehler einen Feldfehler an', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			const validationError = apiError(400, 'Name muss zwischen 1 und 100 Zeichen lang sein.');
			vi.mocked(api.createPillar).mockRejectedValueOnce(validationError);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'A'.repeat(101) } });
			fireEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

			await waitFor(() => {
				expect(screen.getByText(/1 und 100 zeichen/i)).toBeInTheDocument();
			});
		});
	});

	// ── AK2: Bearbeiten (Name / Beschreibung ändern) ──────────────────────────

	describe('AK2 — Bearbeiten (Umbenennen / Beschreibung ändern)', () => {
		const existing: Pillar[] = [pillar(1, 'Körper', 'Gesundheit', 20)];

		it('benennt eine Säule um (nur Name)', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);
			const updated: Pillar = pillar(1, 'Fitness', 'Gesundheit', 20);
			vi.mocked(api.updatePillar).mockResolvedValueOnce(updated);
			vi.mocked(api.listPillars).mockResolvedValueOnce([updated]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			// Bearbeiten-Button klicken → Modal öffnet sich
			fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));

			// Name im Modal ändern
			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Fitness' } });
			fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));

			await waitFor(() => {
				expect(api.updatePillar).toHaveBeenCalledWith({
					id: 1,
					pillarUpdate: { name: 'Fitness' },
				});
			});

			await waitFor(() => {
				expect(screen.getByText('Fitness')).toBeInTheDocument();
			});
		});

		it('ändert nur die Beschreibung', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);
			const updated: Pillar = pillar(1, 'Körper', 'Physische Gesundheit', 20);
			vi.mocked(api.updatePillar).mockResolvedValueOnce(updated);
			vi.mocked(api.listPillars).mockResolvedValueOnce([updated]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /beschreibung/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /beschreibung/i }), {
				target: { value: 'Physische Gesundheit' },
			});
			fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));

			await waitFor(() => {
				expect(api.updatePillar).toHaveBeenCalledWith({
					id: 1,
					pillarUpdate: { description: 'Physische Gesundheit' },
				});
			});
		});

		it('ändert Name und Beschreibung gleichzeitig', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);
			const updated: Pillar = pillar(1, 'Fitness', 'Physische Gesundheit', 20);
			vi.mocked(api.updatePillar).mockResolvedValueOnce(updated);
			vi.mocked(api.listPillars).mockResolvedValueOnce([updated]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Fitness' } });
			fireEvent.change(screen.getByRole('textbox', { name: /beschreibung/i }), {
				target: { value: 'Physische Gesundheit' },
			});
			fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));

			await waitFor(() => {
				expect(api.updatePillar).toHaveBeenCalledWith({
					id: 1,
					pillarUpdate: { name: 'Fitness', description: 'Physische Gesundheit' },
				});
			});
		});

		it('zeigt Feldfehler bei Namenskonflikt während des Bearbeitens', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			const conflictError = apiError(409, 'Eine Säule mit diesem Namen existiert bereits.');
			vi.mocked(api.updatePillar).mockRejectedValueOnce(conflictError);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Doppelt' } });
			fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));

			await waitFor(() => {
				expect(screen.getByText(/existiert bereits/i)).toBeInTheDocument();
			});
		});
	});

	// ── AK3: Löschen mit Bestätigung ──────────────────────────────────────────

	describe('AK3 — Löschen mit Bestätigung', () => {
		const existing: Pillar[] = [pillar(1, 'Körper', 'Gesundheit', 100)];

		it('zeigt Bestätigungsdialog mit Hinweis auf betroffene Tasks/Serien', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			// Löschen-Button klicken → Bestätigungsdialog öffnet sich.
			fireEvent.click(screen.getByRole('button', { name: /löschen/i }));

			await waitFor(() => {
				// Der Dialog muss den Hinweistext enthalten.
				expect(screen.getByText(/tasks.*serien.*zuordnung/i)).toBeInTheDocument();
			});
		});

		it('löscht eine Säule nach Bestätigung', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);
			vi.mocked(api.deletePillar).mockResolvedValueOnce(undefined);
			vi.mocked(api.listPillars).mockResolvedValueOnce([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /löschen/i }));

			// Bestätigen
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /endgültig löschen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /endgültig löschen/i }));

			await waitFor(() => {
				expect(api.deletePillar).toHaveBeenCalledWith({ id: 1 });
			});

			await waitFor(() => {
				expect(screen.getByText(/keine säulen/i)).toBeInTheDocument();
			});
		});

		it('erlaubt das Löschen der letzten Säule', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);
			vi.mocked(api.deletePillar).mockResolvedValueOnce(undefined);
			vi.mocked(api.listPillars).mockResolvedValueOnce([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			// Der Löschen-Button muss auch für die letzte (einzige) Säule aktiv sein.
			const deleteButton = screen.getByRole('button', { name: /löschen/i });
			expect(deleteButton).not.toBeDisabled();

			fireEvent.click(deleteButton);
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /endgültig löschen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /endgültig löschen/i }));

			await waitFor(() => {
				expect(api.deletePillar).toHaveBeenCalledWith({ id: 1 });
			});
		});

		it('bricht Löschvorgang ab, wenn Abbrechen geklickt wird', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /löschen/i }));

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /abbrechen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));

			// Kein API-Aufruf.
			expect(api.deletePillar).not.toHaveBeenCalled();

			// Säule ist immer noch sichtbar.
			expect(screen.getByText('Körper')).toBeInTheDocument();
		});
	});

	// ── Neu laden nach Mutation ───────────────────────────────────────────────

	describe('Neu laden nach Mutation', () => {
		it('lädt Säulen nach dem Anlegen neu', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce([]);
			const newPillar: Pillar = pillar(1, 'Neu', '', 0);
			vi.mocked(api.createPillar).mockResolvedValueOnce(newPillar);
			// Zweiter listPillars-Call (nach Anlegen)
			vi.mocked(api.listPillars).mockResolvedValueOnce([newPillar]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /neue säule anlegen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /neue säule anlegen/i }));

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Neu' } });
			fireEvent.click(screen.getByRole('button', { name: /^anlegen$/i }));

			await waitFor(() => {
				// listPillars muss mindestens zweimal aufgerufen worden sein
				// (Mount + nach Anlegen).
				expect(api.listPillars).toHaveBeenCalledTimes(2);
			});
		});

		it('lädt Säulen nach dem Löschen neu', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce([pillar(1, 'Körper', '', 100)]);
			vi.mocked(api.deletePillar).mockResolvedValueOnce(undefined);
			vi.mocked(api.listPillars).mockResolvedValueOnce([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /löschen/i }));
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /endgültig löschen/i })).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole('button', { name: /endgültig löschen/i }));

			await waitFor(() => {
				expect(api.listPillars).toHaveBeenCalledTimes(2);
			});
		});
	});
});
