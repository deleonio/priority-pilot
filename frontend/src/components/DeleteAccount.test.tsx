import { fireEvent, render, screen } from '@testing-library/react';
import { ResponseError } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * #1676 AK3: Lehnt der Server die Löschung mit 409 ab, erklärt der Dialog den Grund aus dem
 * `code` des Fehler-Bodys in der Sprache des Nutzers, und das Konto bleibt (kein Abmelden).
 * KoliBri und Modal sind gemockt (Muster `DeleteTaskDialog.test.tsx`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
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

vi.mock('../api', () => ({ api: { deleteAccount: vi.fn() } }));

import { api } from '../api';
import { DeleteAccountButton } from './DeleteAccount';

const mockDeleteAccount = api.deleteAccount as ReturnType<typeof vi.fn>;

afterEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
});

const refused = (code: string): ResponseError =>
	new ResponseError({ status: 409 } as Response, { message: 'Server-Text', code });

describe('Konto löschen — Ablehnung durch den Server (#1676)', () => {
	it.each([
		['subscription_active', 'Für dein Konto läuft noch ein Abo.'],
		['last_group_admin', 'Du bist der letzte Admin einer Gruppe mit weiteren Mitgliedern.'],
	])('%s: zeigt die Begründung und meldet nicht ab', async (code, text) => {
		mockDeleteAccount.mockRejectedValue(refused(code));
		render(<DeleteAccountButton userId={1} />);

		fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

		expect(await screen.findByRole('alert')).toHaveTextContent(text);
		expect(screen.getByTestId('modal')).toBeInTheDocument();
		expect(sessionStorage.getItem('pp_just_logged_out')).toBeNull();
	});
});
