import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResponseError, TaskStatus } from 'client';
import type { Task } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #948 — AK4: DeleteTaskDialog zeigt bei Session-401 die neue
 * Session-Meldung im bestehenden Fehler-Alert (KolAlert „Löschen fehlgeschlagen"),
 * ohne Strukturänderung am Dialog.
 *
 * Spezifikation: `docs/spec/issue-948.md`. Bewusst NICHT `../lib/apiError` gemockt — der Test
 * sichert die Integration `api.deleteTask`-Reject (ResponseError 401, Server-Message
 * „Nicht eingeloggt." aus `requireAuth`) → echtes `toApiError` → Alert-Text. Rot, solange
 * `toApiError` jedes 401 pauschal in den KI-Konfigurationstext übersetzt.
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

vi.mock('../api', () => ({
	api: { deleteTask: vi.fn() },
}));

import { api } from '../api';
import { DeleteTaskDialog } from './DeleteTaskDialog';

const mockDeleteTask = api.deleteTask as ReturnType<typeof vi.fn>;

const sampleTask = (): Task => ({
	id: 42,
	title: 'Kundenbericht fertigstellen',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	isException: false,
	pillars: [],
});

/** Session-401, wie ihn `requireAuth` liefert: `res.status(401).json({ message: 'Nicht eingeloggt.' })`. */
const session401 = (): ResponseError => {
	const response = {
		status: 401,
		clone: () => ({ json: async () => ({ message: 'Nicht eingeloggt.' }) }),
	} as unknown as Response;
	return new ResponseError(response);
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('DeleteTaskDialog — Session-401 statt KI-Meldung (#948, AK4)', () => {
	it('zeigt bei Session-401 die Session-Meldung im Fehler-Alert (keine KI-Meldung)', async () => {
		mockDeleteTask.mockRejectedValueOnce(session401());
		const onDeleted = vi.fn();

		await act(async () => {
			render(<DeleteTaskDialog task={sampleTask()} onClose={vi.fn()} onDeleted={onDeleted} />);
		});

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /^Endgültig löschen/i }));
		});

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Löschen fehlgeschlagen');
		expect(alert).toHaveTextContent('Nicht eingeloggt. Bitte melde dich erneut an.');
		expect(alert).not.toHaveTextContent('KI-Konfiguration');
		// Dialog bleibt bei Fehler geöffnet; onClose/onDeleted werden nicht ausgelöst.
		expect(onDeleted).not.toHaveBeenCalled();
	});
});
