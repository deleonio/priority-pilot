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
 * #1556 (Spec `docs/spec/issue-1556.md`, AK1–AK3): Paket-Badge je Zeile + Paket-Wechsel
 * (nur eigene Zeile) über `api.updateUserPlan`. Auswahl-Mock bewusst komponentenagnostisch:
 * `KolSelect` UND `KolDropdown` rendern als native Combobox, damit die Implementierung die
 * KoliBri-Komponente frei wählen kann (KI-UX-Block lässt beide zu).
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
	// #1556: Auswahl als native Combobox — `_options` akzeptiert Strings wie Objekte
	// (`SelectOption`-Form), `_value` die Vorauswahl, Change reicht den Wert durch.
	KolSelect: ({
		_label,
		_options,
		_value,
		_disabled,
		_on,
	}: {
		_label?: string;
		_options?: Array<string | { label?: string; value?: string }>;
		_value?: string;
		_disabled?: boolean;
		_on?: { onChange?: (event: Event, value: string) => void };
	}) => (
		<select
			aria-label={_label}
			value={_value ?? ''}
			disabled={_disabled}
			onChange={(event) => _on?.onChange?.(event as unknown as Event, event.currentTarget.value)}
		>
			{_options?.map((option, index) => {
				const label = typeof option === 'string' ? option : (option.label ?? String(option.value));
				const value = typeof option === 'string' ? option : String(option.value);
				return (
					<option key={index} value={value}>
						{label}
					</option>
				);
			})}
		</select>
	),
	KolDropdown: ({
		_label,
		_options,
		_value,
		_disabled,
		_on,
	}: {
		_label?: string;
		_options?: Array<string | { label?: string; value?: string }>;
		_value?: string;
		_disabled?: boolean;
		_on?: { onChange?: (event: Event, value: string) => void };
	}) => (
		<select
			aria-label={_label}
			value={_value ?? ''}
			disabled={_disabled}
			onChange={(event) => _on?.onChange?.(event as unknown as Event, event.currentTarget.value)}
		>
			{_options?.map((option, index) => {
				const label = typeof option === 'string' ? option : (option.label ?? String(option.value));
				const value = typeof option === 'string' ? option : String(option.value);
				return (
					<option key={index} value={value}>
						{label}
					</option>
				);
			})}
		</select>
	),
}));

vi.mock('../api', () => ({
	api: {
		getAdminUsers: vi.fn(),
		updateUserRole: vi.fn(),
		updateUserPlan: vi.fn(),
	},
}));

import { api } from '../api';
import { AdminUsersSection } from './AdminUsersSection';

const mockGetAdminUsers = api.getAdminUsers as ReturnType<typeof vi.fn>;
const mockUpdateUserRole = api.updateUserRole as ReturnType<typeof vi.fn>;
// #1556: `updateUserPlan` existiert noch nicht auf dem echten `api`-Objekt (roter Zustand) —
// der Mock oben stellt es bereit, der Cast hält tsc grün, bis die Implementierung es anlegt.
const mockUpdateUserPlan = (api as unknown as { updateUserPlan: ReturnType<typeof vi.fn> }).updateUserPlan;

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
 * Test-Pflege #1556 (Impl-Phase): In der EIGENEN Zeile matchet `getByText(planLabel(…))` neben
 * dem Badge auch die Option der Paket-Auswahl (gleicher planLabel-Text, AK1+AK2 zusammen) —
 * der Query war damit mehrdeutig („Found multiple elements"). Badge-spezifisch = Text-Match
 * außerhalb von `<option>`; Fremdzeilen ohne Auswahl bleiben über `getByText` eindeutig.
 */
const badgeInRow = (row: HTMLElement, label: string): HTMLElement => {
	const matches = within(row)
		.getAllByText(label)
		.filter((element) => element.tagName !== 'OPTION');
	expect(matches, `Paket-Badge „${label}" muss genau einmal in der Zeile stehen`).toHaveLength(1);
	return matches[0];
};

/**
 * #1556: Die Sektion erhält die eigene Nutzer-Id als (noch nicht existierendes, rotes) Prop
 * `currentUserId` — nur deren Zeile bekommt die Paket-Auswahl (Spec AK2). Der Cast hält tsc
 * grün, bis die Implementierung das Prop offiziell trägt.
 */
const SectionWithOwnId = AdminUsersSection as unknown as (props: { currentUserId?: number }) => ReactElement;
const renderSection = (currentUserId?: number): ReturnType<typeof render> =>
	render(<SectionWithOwnId currentUserId={currentUserId} />);

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

describe('AdminUsersSection — Paket-Badge und Selbst-Wechsel (#1556, Spec AK1–AK3)', () => {
	it('AK1: zeigt in jeder Zeile ein Paket-Badge mit planLabel-Text — auch bei fremden Konten', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', plan: 'free' }),
			user({ id: 2, displayName: 'Max Member', role: 'member', plan: 'pro' }),
			user({ id: 3, displayName: 'Ute Ultimate', role: 'member', plan: 'ultimate' }),
		]);

		renderSection(1);
		await waitFor(() => expect(screen.getByText('Ute Ultimate')).toBeInTheDocument());

		// Eigene Zeile: badge-spezifisch prüfen (s. badgeInRow) — die Auswahl-Option matchet mit.
		expect(badgeInRow(rowOf('Anna Admin'), planLabel('free'))).toBeInTheDocument();
		expect(within(rowOf('Max Member')).getByText(planLabel('pro'))).toBeInTheDocument();
		expect(within(rowOf('Ute Ultimate')).getByText(planLabel('ultimate'))).toBeInTheDocument();
	});

	it('AK2: eigene Zeile hat eine Combobox mit genau den vier Paketen (aktuelles vorausgewählt), fremde Zeilen keine', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', plan: 'free' }),
			user({ id: 2, displayName: 'Max Member', role: 'member', plan: 'pro' }),
		]);

		renderSection(1);
		await waitFor(() => expect(screen.getByText('Max Member')).toBeInTheDocument());

		const ownRow = rowOf('Anna Admin');
		const ownSelect = within(ownRow).getByRole('combobox');
		const options = within(ownSelect).getAllByRole('option');
		expect(options.map((option) => option.textContent)).toEqual([
			planLabel('free'),
			planLabel('pro'),
			planLabel('max'),
			planLabel('ultimate'),
		]);
		expect(ownSelect, 'aktuelles Paket ist vorausgewählt').toHaveValue('free');

		expect(within(rowOf('Max Member')).queryByRole('combobox')).not.toBeInTheDocument();
	});

	it('AK3: Wechsel ruft updateUserPlan mit der eigenen Id und dem Paket und lädt die Liste neu (Badge ohne Reload)', async () => {
		mockGetAdminUsers
			.mockResolvedValueOnce([user({ id: 1, displayName: 'Anna Admin', plan: 'free' })])
			.mockResolvedValueOnce([user({ id: 1, displayName: 'Anna Admin', plan: 'pro' })]);
		mockUpdateUserPlan.mockResolvedValue(user({ id: 1, plan: 'pro' }));

		renderSection(1);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.change(within(rowOf('Anna Admin')).getByRole('combobox'), { target: { value: 'pro' } });

		await waitFor(() => expect(mockUpdateUserPlan).toHaveBeenCalledWith({ id: 1, plan: 'pro' }));
		await waitFor(() => expect(mockGetAdminUsers).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(badgeInRow(rowOf('Anna Admin'), planLabel('pro'))).toBeInTheDocument());
	});

	it('AK3 (Fehlerpfad): Server-Fehler des Paket-Wechsels landet als KolAlert, die Liste bleibt stehen', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin', plan: 'free' })]);
		mockUpdateUserPlan.mockRejectedValue(new Error('Das Paket muss eines von free, pro, max, ultimate sein.'));

		renderSection(1);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.change(within(rowOf('Anna Admin')).getByRole('combobox'), { target: { value: 'max' } });

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Das Paket muss eines von free, pro, max, ultimate sein.'),
		);
		expect(screen.getByText('Anna Admin')).toBeInTheDocument();
	});
});
