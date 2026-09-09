import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit-Tests für `AdminUsersSection` (Fixup PR #1300, Finding #2) — bislang ungetestetes
 * Frontend-Verhalten des Rollensystems admin/member: Laden der Nutzerliste, Rollenwechsel
 * inkl. Fehlerpfad (409 „letzter Administrator"), Anzeige von Name/E-Mail/Rolle je Eintrag.
 * Muster: GroupsSection.test.tsx (Mock von `@public-ui/react-v19` + `../api`).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (event: MouseEvent) => void } }) => (
		<button type="button" onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h4>{_label}</h4>,
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
}));

vi.mock('../api', () => ({
	api: {
		getAdminUsers: vi.fn(),
		updateUserRole: vi.fn(),
	},
}));

import { api } from '../api';
import { AdminUsersSection } from './AdminUsersSection';

const mockGetAdminUsers = api.getAdminUsers as ReturnType<typeof vi.fn>;
const mockUpdateUserRole = api.updateUserRole as ReturnType<typeof vi.fn>;

type TestUser = { id: number; email: string; displayName: string; role: 'admin' | 'member'; createdAt: string };

const user = (overrides: Partial<TestUser>): TestUser => ({
	id: 1,
	email: 'a@example.com',
	displayName: 'Anna Admin',
	role: 'admin',
	createdAt: '2026-01-01T00:00:00Z',
	...overrides,
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('AdminUsersSection — Nutzerverwaltung (Rollensystem admin/member)', () => {
	it('zeigt den Spinner während des Ladens und danach die Nutzerliste mit Rollen-Badge', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', email: 'anna@example.com', role: 'admin' }),
			user({ id: 2, displayName: 'Max Member', email: 'max@example.com', role: 'member' }),
		]);

		render(<AdminUsersSection />);
		expect(screen.getByRole('status')).toBeInTheDocument();

		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		expect(screen.getByText('anna@example.com')).toBeInTheDocument();
		expect(screen.getByText('Admin')).toBeInTheDocument();
		expect(screen.getByText('Max Member')).toBeInTheDocument();
		expect(screen.getByText('Mitglied')).toBeInTheDocument();
	});

	it('Klick auf den Rollen-Button ruft updateUserRole mit der Gegenrolle und lädt neu', async () => {
		mockGetAdminUsers
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'member' })])
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'admin' })]);
		mockUpdateUserRole.mockResolvedValue(user({ id: 2, displayName: 'Max Member', role: 'admin' }));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Max Member')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Max Member zum Administrator machen' }));

		await waitFor(() => expect(mockUpdateUserRole).toHaveBeenCalledWith({ id: 2, role: 'admin' }));
		expect(mockGetAdminUsers).toHaveBeenCalledTimes(2);
	});

	it('zeigt bei 409 (letzter Administrator) die Server-Meldung als KolAlert, ohne die Liste zu verlieren', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin', role: 'admin' })]);
		mockUpdateUserRole.mockRejectedValue(new Error('Es muss mindestens einen Administrator geben.'));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Anna Admin zur Mitgliedschaft zurückstufen' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Es muss mindestens einen Administrator geben.'),
		);
		expect(screen.getByText('Anna Admin')).toBeInTheDocument();
	});

	it('zeigt eine Fehlermeldung, wenn das initiale Laden fehlschlägt (z. B. 403 nach Rückstufung)', async () => {
		mockGetAdminUsers.mockRejectedValue(new Error('Keine Berechtigung.'));

		render(<AdminUsersSection />);

		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Keine Berechtigung.'));
	});
});
