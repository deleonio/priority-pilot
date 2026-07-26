import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { PillarList } from './PillarList';

// Mocke die API, damit die Komponententests deterministisch und ohne Netzwerk auskommen.
vi.mock('../api', () => ({
	api: {
		createPillar: vi.fn(),
		updatePillar: vi.fn(),
		deletePillar: vi.fn(),
		listPillars: vi.fn(),
	},
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
 * AK1: Nutzer kann eine Säule anlegen (Name Pflicht, Beschreibung optional); sie erscheint sofort.
 * AK2: Umbenennen/Beschreibung ändern; Namenskonflikt zeigt verständlichen Feldfehler.
 * AK3: Löschen mit Bestätigung inkl. Hinweis auf betroffene Tasks/Serien; letzte Säule löschbar.
 */

describe('PillarList — Säulen-Verwaltung (Issue #439)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── AK1: Anlegen (Happy Path) ──────────────────────────────────────────────

	describe('AK1 — Säule anlegen', () => {
		it('rendert ein Formular mit Name (required) und Beschreibung (optional)', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
			});

			// Beschreibungsfeld ist optional — kein required-Attribut.
			const descriptionField = screen.getByRole('textbox', { name: /beschreibung/i });
			expect(descriptionField).toBeInTheDocument();
		});

		it('legt eine neue Säule an und zeigt sie in der Liste', async () => {
			const existing: Pillar[] = [pillar(1, 'Körper', 'Gesundheit', 20)];
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			const newPillar: Pillar = pillar(2, 'Beziehungen', 'Freunde & Familie', 0);
			vi.mocked(api.createPillar).mockResolvedValueOnce(newPillar);

			// Nach dem Anlegen: beide Säulen erscheinen.
			vi.mocked(api.listPillars).mockResolvedValueOnce([...existing, newPillar]);

			render(<PillarList />);

			// Name eingeben
			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
				target: { value: 'Beziehungen' },
			});
			// Beschreibung eingeben
			fireEvent.change(screen.getByRole('textbox', { name: /beschreibung/i }), {
				target: { value: 'Freunde & Familie' },
			});
			// Anlegen-Button klicken
			fireEvent.click(screen.getByRole('button', { name: /anlegen/i }));

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

			// Leerer Name + absenden → Fehler
			fireEvent.click(screen.getByRole('button', { name: /anlegen/i }));

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

			const conflictError = {
				response: {
					status: 409,
					clone: () => ({ json: async () => ({ message: 'Eine Säule mit diesem Namen existiert bereits.' }) }),
				},
			};
			vi.mocked(api.createPillar).mockRejectedValueOnce(conflictError);

			render(<PillarList />);

			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
				target: { value: 'Körper' },
			});
			fireEvent.click(screen.getByRole('button', { name: /anlegen/i }));

			await waitFor(() => {
				expect(screen.getByText(/existiert bereits/i)).toBeInTheDocument();
			});
		});

		it('zeigt bei 400 Validierungsfehler einen Feldfehler an', async () => {
			vi.mocked(api.listPillars).mockResolvedValue([]);

			const validationError = {
				response: {
					status: 400,
					clone: () => ({ json: async () => ({ message: 'Name muss zwischen 1 und 100 Zeichen lang sein.' }) }),
				},
			};
			vi.mocked(api.createPillar).mockRejectedValueOnce(validationError);

			render(<PillarList />);

			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
				target: { value: 'A'.repeat(101) },
			});
			fireEvent.click(screen.getByRole('button', { name: /anlegen/i }));

			await waitFor(() => {
				expect(screen.getByText(/1 und 100 zeichen/i)).toBeInTheDocument();
			});
		});
	});

	// ── AK2: Umbenennen / Beschreibung ändern ──────────────────────────────────

	describe('AK2 — Inline-Edit (Umbenennen / Beschreibung ändern)', () => {
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

			// Bearbeiten-Modus aktivieren
			const editButton = screen.getByRole('button', { name: /bearbeiten/i });
			fireEvent.click(editButton);

			// Name ändern
			const nameInput = screen.getByRole('textbox', { name: /name/i });
			fireEvent.change(nameInput, { target: { value: 'Fitness' } });
			fireEvent.click(screen.getByRole('button', { name: /speichern/i }));

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

			const descInput = screen.getByRole('textbox', { name: /beschreibung/i });
			fireEvent.change(descInput, { target: { value: 'Physische Gesundheit' } });
			fireEvent.click(screen.getByRole('button', { name: /speichern/i }));

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

			const nameInput = screen.getByRole('textbox', { name: /name/i });
			fireEvent.change(nameInput, { target: { value: 'Fitness' } });

			const descInput = screen.getByRole('textbox', { name: /beschreibung/i });
			fireEvent.change(descInput, { target: { value: 'Physische Gesundheit' } });

			fireEvent.click(screen.getByRole('button', { name: /speichern/i }));

			await waitFor(() => {
				expect(api.updatePillar).toHaveBeenCalledWith({
					id: 1,
					pillarUpdate: { name: 'Fitness', description: 'Physische Gesundheit' },
				});
			});
		});

		it('zeigt Feldfehler bei Namenskonflikt während des Editierens', async () => {
			vi.mocked(api.listPillars).mockResolvedValueOnce(existing);

			const conflictError = {
				response: {
					status: 409,
					clone: () => ({ json: async () => ({ message: 'Eine Säule mit diesem Namen existiert bereits.' }) }),
				},
			};
			vi.mocked(api.updatePillar).mockRejectedValueOnce(conflictError);

			render(<PillarList />);

			await waitFor(() => {
				expect(screen.getByText('Körper')).toBeInTheDocument();
			});

			fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));
			const nameInput = screen.getByRole('textbox', { name: /name/i });
			fireEvent.change(nameInput, { target: { value: 'Doppelt' } });
			fireEvent.click(screen.getByRole('button', { name: /speichern/i }));

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

			fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
				target: { value: 'Neu' },
			});
			fireEvent.click(screen.getByRole('button', { name: /anlegen/i }));

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
