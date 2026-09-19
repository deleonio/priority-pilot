import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planLabel } from '../lib/planOffers';

/**
 * Unit-Tests für `AdminUsersSection` (Fixup PR #1300, Finding #2) — bislang ungetestetes
 * Frontend-Verhalten des Rollensystems admin/member: Laden der Nutzerliste, Rollenwechsel
 * inkl. Fehlerpfad (409 „letzter Administrator"), Anzeige von Name/E-Mail/Rolle je Eintrag.
 * Muster: GroupsSection.test.tsx (Mock von `@public-ui/react-v19` + `../api`).
 *
 * #1556 (Spec `docs/spec/issue-1556.md`, AK1) + #1565 (Spec `docs/spec/issue-1565.md`, AK2):
 * Paket-Badge je Zeile; die Auswahl zum Selbst-Wechsel ist seit #1565 in die eigene Karte im
 * Tab Pakete gezogen (`OwnPlanCard.test.tsx`) — die Nutzerverwaltung ist rein lesend, keinerlei
 * Combobox mehr (auch nicht in der eigenen Zeile).
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
	// Noch vorhanden, weil der AK2-Test gegen den HEUTIGEN Code rot sein muss (Zeilen-Select
	// existiert); nach der #1565-Implementierung kann der Mock ersatzlos entfallen.
	KolSelect: ({ _label }: { _label?: string }) => <select aria-label={_label} />,
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

type TestUser = {
	id: number;
	email: string;
	displayName: string;
	role: 'admin' | 'member';
	plan: 'free' | 'pro' | 'max' | 'ultimate';
	createdAt: string;
};

const user = (overrides: Partial<TestUser>): TestUser => ({
	id: 1,
	email: 'a@example.com',
	displayName: 'Anna Admin',
	role: 'admin',
	plan: 'free',
	createdAt: '2026-01-01T00:00:00Z',
	...overrides,
});

/** Zeilen-Container zu einem sichtbaren Namen — Assertions je `<li>` scopen, nicht seitenweit. */
const rowOf = (name: string): HTMLElement => {
	const row = screen.getByText(name, { exact: true }).closest('li');
	expect(row, `Zeile von „${name}" muss gerendert sein`).not.toBeNull();
	return row as HTMLElement;
};

/**
 * #1565: `currentUserId` entfällt mit der Zeilen-Auswahl aus der Komponente. Bis dahin wird es
 * weiter übergeben (Cast-Muster wie in #1556, hält tsc in beiden Zuständen grün) — genau SO ist
 * der AK2-Test rot: Der aktuelle Code rendert damit das Zeilen-Select, der Zielzustand keins.
 */
const SectionWithOwnId = AdminUsersSection as unknown as (props: { currentUserId?: number }) => ReactElement;
const renderSection = (currentUserId?: number): ReturnType<typeof render> =>
	render(<SectionWithOwnId currentUserId={currentUserId} />);

/**
 * Badge-spezifischer Zeilen-Match: Text außerhalb von `<option>` — historisch aus #1556 (die
 * Zeilen-Auswahl existiert nicht mehr, #1565), der Filter hält den Query robust gegen künftige
 * Auswahlelemente in der Zeile.
 */
const badgeInRow = (row: HTMLElement, label: string): HTMLElement => {
	const matches = within(row)
		.getAllByText(label)
		.filter((element) => element.tagName !== 'OPTION');
	expect(matches, `Paket-Badge „${label}" muss genau einmal in der Zeile stehen`).toHaveLength(1);
	return matches[0];
};

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

describe('AdminUsersSection — Paket-Badge je Zeile, rein lesend (#1556 AK1, #1565 AK2)', () => {
	it('AK1: zeigt in jeder Zeile ein Paket-Badge mit planLabel-Text — auch bei fremden Konten', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', plan: 'free' }),
			user({ id: 2, displayName: 'Max Member', role: 'member', plan: 'pro' }),
			user({ id: 3, displayName: 'Ute Ultimate', role: 'member', plan: 'ultimate' }),
		]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Ute Ultimate')).toBeInTheDocument());

		expect(badgeInRow(rowOf('Anna Admin'), planLabel('free'))).toBeInTheDocument();
		expect(within(rowOf('Max Member')).getByText(planLabel('pro'))).toBeInTheDocument();
		expect(within(rowOf('Ute Ultimate')).getByText(planLabel('ultimate'))).toBeInTheDocument();
	});

	it('AK2 (#1565): keinerlei Paket-Auswahl mehr — auch die eigene Zeile hat keine Combobox', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', plan: 'free' }),
			user({ id: 2, displayName: 'Max Member', role: 'member', plan: 'pro' }),
		]);

		// Bewusst MIT eigener Id gerendert: Der aktuelle Code zeigt das Select genau dann —
		// der Zielzustand (#1565) zeigt es nirgends, unabhängig vom Prop.
		renderSection(1);
		await waitFor(() => expect(screen.getByText('Max Member')).toBeInTheDocument());

		// Der Selbst-Wechsel ist in die eigene Karte im Tab Pakete gezogen (#1565 AK1,
		// OwnPlanCard.test.tsx) — hier gibt es kein Select/Combobox mehr, in keiner Zeile.
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

		// Die Badges bleiben (lesend): Information weiterhin je Konto sichtbar.
		expect(badgeInRow(rowOf('Anna Admin'), planLabel('free'))).toBeInTheDocument();
		expect(within(rowOf('Max Member')).getByText(planLabel('pro'))).toBeInTheDocument();
	});
});
