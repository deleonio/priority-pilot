import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1225 (AK4) — Gruppenliste zeigt neben dem Gruppennamen einen
 * KolAvatar: mit `imageUrl` das Gruppenbild (`_src`), ohne Bild die Initialen des Namens
 * (`_src` ungesetzt, `_label` immer der Gruppenname — Muster App.tsx:665). Vertrag:
 * docs/spec/issue-1225.md. Der Avatar ist rein dekorativ, kein fokussierbares Element.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({
		_label,
		_ariaExpanded,
		_ariaControls,
		_on,
	}: {
		_label?: string;
		_ariaExpanded?: boolean;
		_ariaControls?: string;
		_on?: { onClick?: (event: MouseEvent) => void };
	}) => (
		// ARIA-Spiegel: expanded/controls sichtbar machen — für die Toggle-Semantik-Tests.
		<button
			type="button"
			aria-expanded={_ariaExpanded}
			aria-controls={_ariaControls}
			onClick={(e) => _on?.onClick?.(e.nativeEvent)}
		>
			{_label}
		</button>
	),
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<section>
			{_label}
			{children}
		</section>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h3>{_label}</h3>,
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolAvatar: ({
		_label,
		_src,
		'aria-hidden': ariaHidden,
	}: {
		_label: string;
		_src?: string;
		'aria-hidden'?: boolean | 'true' | 'false';
	}) => (
		// `_src`/`aria-hidden` werden als Attribute gespiegelt: gesetzt = Bild/dekorativ.
		<span data-testid="avatar" data-src={_src ?? undefined} aria-hidden={ariaHidden}>
			{_label}
		</span>
	),
}));

vi.mock('./GroupFormDialog', () => ({ GroupFormDialog: () => <div data-testid="form-dialog" /> }));
vi.mock('./GroupDeleteDialog', () => ({ GroupDeleteDialog: () => <div data-testid="delete-dialog" /> }));
vi.mock('./GroupDetail', () => ({ GroupDetail: () => <div data-testid="group-detail" /> }));

vi.mock('../api', () => ({
	api: {
		listGroups: vi.fn(),
		listReceivedInvitations: vi.fn(),
	},
}));

import { api } from '../api';
import { GroupsSection } from './GroupsSection';

const mockListGroups = api.listGroups as ReturnType<typeof vi.fn>;
const mockListReceivedInvitations = api.listReceivedInvitations as ReturnType<typeof vi.fn>;

/** Gruppe nach Client-Typ + das neue (noch nicht typisiertes) imageUrl-Feld. */
type TestGroup = {
	id: number;
	name: string;
	description: string | null;
	role: 'admin' | 'member';
	memberCount: number;
	imageUrl?: string | null;
};

const group = (overrides: Partial<TestGroup>): TestGroup => ({
	id: 1,
	name: 'Familie Müller',
	description: null,
	role: 'admin',
	memberCount: 1,
	...overrides,
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('GroupsSection — Gruppenbild als Avatar (#1225 AK4)', () => {
	it('zeigt bei gesetztem imageUrl den KolAvatar mit _src=Bildadresse und _label=Gruppenname', async () => {
		mockListGroups.mockResolvedValue([group({ id: 1, imageUrl: 'https://example.com/gruppe.png' })]);
		mockListReceivedInvitations.mockResolvedValue([]);

		render(<GroupsSection />);
		await waitFor(() => expect(screen.getByTestId('avatar')).toBeDefined());

		const avatar = screen.getByTestId('avatar');
		expect(avatar.getAttribute('data-src')).toBe('https://example.com/gruppe.png');
		expect(avatar.textContent).toBe('Familie Müller');
	});

	it('zeigt ohne imageUrl den KolAvatar ohne _src (Initialen des Gruppennamens)', async () => {
		mockListGroups.mockResolvedValue([group({ id: 2, imageUrl: null })]);
		mockListReceivedInvitations.mockResolvedValue([]);

		render(<GroupsSection />);
		await waitFor(() => expect(screen.getByTestId('avatar')).toBeDefined());

		const avatar = screen.getByTestId('avatar');
		expect(avatar.getAttribute('data-src')).toBeNull();
		expect(avatar.textContent).toBe('Familie Müller');
	});
});

// Audit #1257: Der Namens-Button ist der echte Auf/Zu-Schalter der Karte — sein Zustand muss im
// ARIA-Baum sichtbar sein (WCAG 4.1.2), und der Avatar darf den Namen nicht doppelt liefern.
describe('GroupsSection — Toggle-Semantik der Gruppenkarte (Audit #1257)', () => {
	it('spiegelt den Auf/Zu-Zustand der aufgeklappten Gruppe am Namens-Button', async () => {
		mockListGroups.mockResolvedValue([group({ id: 7 })]);
		mockListReceivedInvitations.mockResolvedValue([]);

		render(<GroupsSection />);
		await waitFor(() => expect(screen.getByRole('button', { name: 'Familie Müller' })).toBeInTheDocument());

		const toggle = screen.getByRole('button', { name: 'Familie Müller' });
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('group-detail')).toBeNull();

		fireEvent.click(toggle);
		expect(screen.getByTestId('group-detail')).toBeInTheDocument();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(toggle.getAttribute('aria-controls')).toBe('group-detail-7');

		fireEvent.click(toggle);
		expect(screen.queryByTestId('group-detail')).toBeNull();
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
	});

	it('hält den Avatar dekorativ (aria-hidden) — der Namens-Button trägt die Information', async () => {
		mockListGroups.mockResolvedValue([group({ id: 7 })]);
		mockListReceivedInvitations.mockResolvedValue([]);

		render(<GroupsSection />);
		await waitFor(() => expect(screen.getByTestId('avatar')).toBeDefined());

		expect(screen.getByTestId('avatar').getAttribute('aria-hidden')).toBe('true');
	});
});
