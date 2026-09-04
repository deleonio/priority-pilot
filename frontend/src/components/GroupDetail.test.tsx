import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Roter Spec-Test für #1212 (AK11) — `GroupDetail` (neu) zeigt die Mitgliederliste
 * (Anzeigename + Rolle) und darunter offene Einladungen mit dem Hinweis „Ausstehend".
 * Die Komponente existiert noch nicht (docs/spec/issue-1212.md, Frontend-Vertrag) —
 * der Import schlägt fehl, bis sie gebaut ist.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (_e: MouseEvent) => void } }) => (
		<button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h3>{_label}</h3>,
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolInputText: () => <input type="search" />,
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children?: ReactNode }) => <div data-testid="modal">{children}</div>,
}));

vi.mock('../api', () => ({
	api: {
		getGroupMembers: vi.fn(),
		getGroupInvitations: vi.fn(),
		removeGroupMember: vi.fn(),
	},
}));

import { api } from '../api';
import { GroupDetail } from './GroupDetail';

const mockGetGroupMembers = api.getGroupMembers as ReturnType<typeof vi.fn>;
const mockGetGroupInvitations = api.getGroupInvitations as ReturnType<typeof vi.fn>;
const mockRemoveGroupMember = api.removeGroupMember as ReturnType<typeof vi.fn>;

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('GroupDetail — Mitgliederliste und offene Einladungen (#1212 AK11)', () => {
	it('zeigt jedes Mitglied mit Anzeigename und Rolle', async () => {
		mockGetGroupMembers.mockResolvedValue([
			{ userId: 1, displayName: 'Alice Admin', role: 'admin' },
			{ userId: 2, displayName: 'Bob Baumeister', role: 'member' },
		]);
		mockGetGroupInvitations.mockResolvedValue([]);

		render(<GroupDetail groupId={1} ownRole="admin" />);

		await waitFor(() => {
			expect(screen.getByText('Alice Admin')).toBeInTheDocument();
		});
		expect(screen.getByText('Bob Baumeister')).toBeInTheDocument();
		expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
		expect(screen.getAllByText(/mitglied/i).length).toBeGreaterThan(0);
	});

	it('zeigt offene Einladungen unterhalb der Mitgliederliste mit dem Hinweis „Ausstehend"', async () => {
		mockGetGroupMembers.mockResolvedValue([{ userId: 1, displayName: 'Alice Admin', role: 'admin' }]);
		mockGetGroupInvitations.mockResolvedValue([{ id: 10, userId: 2, displayName: 'Carol Chef', status: 'pending' }]);

		render(<GroupDetail groupId={1} ownRole="admin" />);

		await waitFor(() => {
			expect(screen.getByText('Carol Chef')).toBeInTheDocument();
		});
		expect(screen.getByText('Ausstehend')).toBeInTheDocument();
	});

	it('offene Einladungen werden NICHT als Mitgliederliste dargestellt (kein Doppel-Eintrag)', async () => {
		mockGetGroupMembers.mockResolvedValue([{ userId: 1, displayName: 'Alice Admin', role: 'admin' }]);
		mockGetGroupInvitations.mockResolvedValue([{ id: 10, userId: 2, displayName: 'Carol Chef', status: 'pending' }]);

		render(<GroupDetail groupId={1} ownRole="admin" />);

		await waitFor(() => {
			expect(screen.getByText('Carol Chef')).toBeInTheDocument();
		});
		// Carol ist eingeladen, aber kein Mitglied — daher darf sie keine Rollen-Badge
		// (admin/member) tragen, nur den Ausstehend-Hinweis.
		const carolRow = screen.getByText('Carol Chef').closest('li');
		expect(carolRow).not.toBeNull();
		expect(carolRow?.textContent).not.toMatch(/\badmin\b/i);
	});
});

describe('GroupDetail — Entfernen erst nach Bestätigung (#1212 AK9)', () => {
	/** Rendert die Detailansicht mit zwei Mitgliedern und gibt Bobs Mitgliederzeile zurück. */
	const renderWithTwoMembers = async (): Promise<HTMLElement> => {
		mockGetGroupMembers.mockResolvedValue([
			{ userId: 1, displayName: 'Alice Admin', role: 'admin' },
			{ userId: 2, displayName: 'Bob Baumeister', role: 'member' },
		]);
		mockGetGroupInvitations.mockResolvedValue([]);

		render(<GroupDetail groupId={1} ownRole="admin" />);

		await waitFor(() => {
			expect(screen.getByText('Bob Baumeister')).toBeInTheDocument();
		});
		const row = screen.getByText('Bob Baumeister').closest('li');
		expect(row).not.toBeNull();
		return row as HTMLElement;
	};

	it('öffnet den Bestätigungsdialog, statt sofort zu entfernen', async () => {
		const row = await renderWithTwoMembers();

		fireEvent.click(within(row).getByRole('button', { name: 'Entfernen' }));

		expect(screen.getByTestId('modal')).toBeInTheDocument();
		expect(screen.getByText(/wirklich aus der Gruppe entfernen/)).toBeInTheDocument();
		expect(mockRemoveGroupMember).not.toHaveBeenCalled();
	});

	it('entfernt das Mitglied erst nach Klick auf „Entfernen" im Dialog', async () => {
		const row = await renderWithTwoMembers();
		mockRemoveGroupMember.mockResolvedValue(undefined);

		fireEvent.click(within(row).getByRole('button', { name: 'Entfernen' }));
		fireEvent.click(within(screen.getByTestId('modal')).getByRole('button', { name: 'Entfernen' }));

		await waitFor(() => {
			expect(mockRemoveGroupMember).toHaveBeenCalledWith({ id: 1, userId: 2 });
		});
		// Nach dem Entfernen wird die Liste neu geladen und der Dialog ist zu.
		await waitFor(() => {
			expect(screen.queryByTestId('modal')).toBeNull();
		});
		expect(mockGetGroupMembers).toHaveBeenCalledTimes(2);
	});

	it('bricht ohne Request ab, wenn im Dialog „Abbrechen" gewählt wird', async () => {
		const row = await renderWithTwoMembers();

		fireEvent.click(within(row).getByRole('button', { name: 'Entfernen' }));
		fireEvent.click(within(screen.getByTestId('modal')).getByRole('button', { name: 'Abbrechen' }));

		await waitFor(() => {
			expect(screen.queryByTestId('modal')).toBeNull();
		});
		expect(mockRemoveGroupMember).not.toHaveBeenCalled();
	});
});
