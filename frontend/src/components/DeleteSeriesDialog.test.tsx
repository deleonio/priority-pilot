import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Series } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #553 — Kaskade-Auswahl im Lösch-Dialog der Serie (Ja/Nein).
 *
 * AK3/AK4/AK6: `DeleteSeriesDialog` (#472) wird um die Kaskade-Option erweitert (kein neuer
 * Dialog). Statt einer einzelnen „Endgültig löschen"-Aktion fragt der Dialog vor dem Löschen,
 * ob „alle N Instanzen mitgelöscht" werden sollen — mit eindeutig beschrifteten Ja-/Nein-Buttons
 * (sicherer Default = Nein = nur Serie, Instanzen unangetastet). Das gewählte Flag (`cascade`)
 * wird an `api.deleteSeries` durchgereicht.
 *
 * Testebene: Vitest-Komponententest mit gemockter API + KoliBri (native HTML-Elemente).
 * Diese Specs sind rot, solange der Dialog nur „Abbrechen"/„Endgültig löschen" bietet und
 * `deleteSeries` ohne `cascade`-Flag aufruft.
 */

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
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
}));

vi.mock('../lib/useCtrlEnter', () => ({ useCtrlEnter: () => undefined }));
vi.mock('../lib/apiError', () => ({ toApiError: async () => ({ message: 'Fehler' }) }));

vi.mock('../api', () => ({
	api: { deleteSeries: vi.fn() },
}));

import { api } from '../api';
import { DeleteSeriesDialog } from './DeleteSeriesDialog';

const mockDeleteSeries = api.deleteSeries as ReturnType<typeof vi.fn>;

const sampleSeries = (): Series => ({
	id: 7,
	title: 'Wöchentlicher Sport',
	rhythm: 'weekly',
	priority: 3,
	estimatedEffort: 0.5,
	active: true,
	startDate: new Date('2026-09-07T00:00:00.000Z'),
	pillars: [],
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('DeleteSeriesDialog — Kaskade-Auswahl Ja/Nein (#553)', () => {
	// AK6: genau ein Bestätigungs-Modal mit eindeutigen Ja-/Nein-Buttons (Default = keine Kaskade).
	it('bietet eindeutig beschriftete Ja-/Nein-Buttons für die Kaskade-Entscheidung', async () => {
		await act(async () => {
			render(<DeleteSeriesDialog series={sampleSeries()} onClose={vi.fn()} onDeleted={vi.fn()} />);
		});

		expect(screen.getByRole('button', { name: /^Ja/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^Nein/i })).toBeInTheDocument();
	});

	// AK3: „Ja" löscht Serie + alle Instanzen → deleteSeries mit cascade=true.
	it('"Ja" ruft deleteSeries mit cascade=true auf (Serie + alle Instanzen)', async () => {
		mockDeleteSeries.mockResolvedValue(undefined);
		const onDeleted = vi.fn();

		await act(async () => {
			render(<DeleteSeriesDialog series={sampleSeries()} onClose={vi.fn()} onDeleted={onDeleted} />);
		});

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /^Ja/i }));
		});

		expect(mockDeleteSeries).toHaveBeenCalledWith(expect.objectContaining({ id: sampleSeries().id, cascade: true }));
		expect(onDeleted).toHaveBeenCalledTimes(1);
	});

	// AK4 + AK6 (Default): „Nein" löscht nur die Serie, Instanzen unangetastet → cascade=false.
	it('"Nein" ruft deleteSeries mit cascade=false auf (nur Serie, sicherer Default)', async () => {
		mockDeleteSeries.mockResolvedValue(undefined);
		const onDeleted = vi.fn();

		await act(async () => {
			render(<DeleteSeriesDialog series={sampleSeries()} onClose={vi.fn()} onDeleted={onDeleted} />);
		});

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /^Nein/i }));
		});

		expect(mockDeleteSeries).toHaveBeenCalledWith(expect.objectContaining({ id: sampleSeries().id, cascade: false }));
		expect(onDeleted).toHaveBeenCalledTimes(1);
	});
});
