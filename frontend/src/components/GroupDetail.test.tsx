import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../api', () => ({
	api: {
		getGroupMembers: vi.fn(),
		getGroupInvitations: vi.fn(),
	},
}));

import { api } from '../api';
import { GroupDetail } from './GroupDetail';

const mockGetGroupMembers = api.getGroupMembers as ReturnType<typeof vi.fn>;
const mockGetGroupInvitations = api.getGroupInvitations as ReturnType<typeof vi.fn>;

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
