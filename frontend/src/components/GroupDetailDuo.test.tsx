import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ROTE Spec-Tests für #1991 (AK2/AK3, docs/spec/issue-1991.md) — `GroupDetail` mit `kind="duo"`:
 * Duo-Karte statt Aufgabenbereich, keine Aufgabenabfragen, Einladen nur solange das Duo nicht voll ist.
 * Mock-Muster wie `GroupDetail.test.tsx`.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolAccordion: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<details>
			<summary>{_label}</summary>
			{children}
		</details>
	),
	KolCard: ({ children }: { children?: ReactNode }) => <div data-comp="kol-card">{children}</div>,
	KolDetails: ({ _label, children }: { _label?: string; children?: ReactNode }) => {
		const [open, setOpen] = useState(false);
		return createElement(
			'kol-details',
			{
				onClick: (event: MouseEvent) => {
					if (event.target === event.currentTarget) setOpen((current) => !current);
				},
			},
			_label,
			open ? children : null,
		);
	},
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (_e: MouseEvent) => void } }) => (
		<button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h3>{_label}</h3>,
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolInputText: () => <input type="search" />,
}));

vi.mock('./Modal', () => ({ Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

vi.mock('../api', () => ({
	api: {
		getGroupMembers: vi.fn(),
		getGroupInvitations: vi.fn(),
		getGroupTasks: vi.fn(),
		getGroupSeries: vi.fn(),
		listTasks: vi.fn(),
		searchUsers: vi.fn(),
		removeGroupMember: vi.fn(),
		updateGroupMemberRole: vi.fn(),
		createGroupInviteLink: vi.fn(),
		getGroupDuo: vi.fn(),
	},
}));

import { api } from '../api';
import { GroupDetail } from './GroupDetail';

type Mocks = Record<string, ReturnType<typeof vi.fn>>;
const mocks = api as unknown as Mocks;

const member = (userId: number, displayName: string, role: 'admin' | 'member') => ({ userId, displayName, role });

const setup = (members: ReturnType<typeof member>[]) => {
	mocks.getGroupMembers.mockResolvedValue(members);
	mocks.getGroupInvitations.mockResolvedValue([]);
	mocks.getGroupTasks.mockResolvedValue([]);
	mocks.getGroupSeries.mockResolvedValue([]);
	mocks.listTasks.mockResolvedValue([]);
	mocks.getGroupDuo.mockResolvedValue({
		streak: { aktuell: 2, best: 4 },
		members: members.map((entry) => ({ userId: entry.userId, name: entry.displayName, saeulen: [] })),
	});
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('GroupDetail kind="duo" (#1991)', () => {
	it('AK2: ruft den Duo-Endpunkt, aber weder Gruppen-Aufgaben noch -Serien noch die Aufgabenliste ab', async () => {
		setup([member(1, 'Alice', 'admin'), member(2, 'Bob', 'member')]);
		render(<GroupDetail groupId={7} ownRole="admin" kind="duo" />);

		await waitFor(() => expect(mocks.getGroupDuo).toHaveBeenCalledWith(expect.objectContaining({ id: 7 })));
		await screen.findByTestId('duo-streak-shared');
		expect(mocks.getGroupTasks).not.toHaveBeenCalled();
		expect(mocks.getGroupSeries).not.toHaveBeenCalled();
		expect(mocks.listTasks).not.toHaveBeenCalled();
	});

	it('AK3: Einladungslink-Aktion ist bei einem Mitglied erreichbar, bei vollem Duo (2) nicht mehr sichtbar', async () => {
		setup([member(1, 'Alice', 'admin')]);
		const { unmount } = render(<GroupDetail groupId={7} ownRole="admin" kind="duo" />);
		await screen.findByText(/Noch niemand dabei/);
		fireEvent.click(screen.getByText('Einladungslinks'));
		expect(await screen.findByRole('button', { name: 'Link erzeugen' })).toBeInTheDocument();
		unmount();

		setup([member(1, 'Alice', 'admin'), member(2, 'Bob', 'member')]);
		render(<GroupDetail groupId={7} ownRole="admin" kind="duo" />);
		await screen.findByTestId('duo-streak-shared');
		expect(screen.queryByText('Einladungslinks')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Link erzeugen' })).toBeNull();
	});
});
