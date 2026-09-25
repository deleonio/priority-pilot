import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planLabel } from '../lib/planOffers';

/**
 * Unit-Tests für `AdminUsersSection` (Fixup PR #1300, Finding #2) — bislang ungetestetes
 * Frontend-Verhalten des Rollensystems admin/member/tester: Laden der Nutzerliste, Rollenwechsel
 * über die Rollen-Radiogruppe je Zeile (#1566) inkl. Fehlerpfad (409 „letzter Administrator"),
 * Anzeige von Name/E-Mail/Rolle je Eintrag. Muster: GroupsSection.test.tsx (Mock von
 * `@public-ui/react-v19` + `../api`).
 *
 * #1556 (Spec `docs/spec/issue-1556.md`, AK1) + #1565 (Spec `docs/spec/issue-1565.md`, AK2):
 * Paket-Badge je Zeile; die Auswahl zum Selbst-Wechsel ist seit #1565 in die eigene Karte im
 * Tab Pakete gezogen (`OwnPlanCard.test.tsx`) — die Nutzerverwaltung zeigt das Paket nur noch
 * lesend an (die Rollen-Radiogruppe daneben bleibt davon unberührt).
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
	KolInputRadio: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (event: Event, value: string) => void };
	}) => (
		<fieldset>
			<legend>{_label}</legend>
			{_options?.map((option) => (
				<label key={option.value}>
					<input
						type="radio"
						name={_label}
						value={option.value}
						checked={option.value === _value}
						onChange={(e) => _on?.onChange?.(e.nativeEvent, option.value)}
					/>
					{option.label}
				</label>
			))}
		</fieldset>
	),
	KolProgress: ({ _label, _max, _value }: { _label?: string; _max?: number; _value?: number }) => (
		<div role="progressbar" aria-label={_label} aria-valuemin={0} aria-valuemax={_max} aria-valuenow={_value} />
	),
}));

vi.mock('../api', () => ({
	api: {
		getAdminUsers: vi.fn(),
		updateUserRole: vi.fn(),
		reassignTaskPillars: vi.fn(),
		getReassignPillarsStatus: vi.fn(),
	},
}));

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), das in jsdom nicht lauffähig ist —
// Muster `PillarWeightsModal.test.tsx`: auf einen reinen Passthrough reduzieren, damit die
// Bestätigungslogik isoliert und deterministisch prüfbar bleibt.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { api } from '../api';
import { AdminUsersSection } from './AdminUsersSection';

const mockGetAdminUsers = api.getAdminUsers as ReturnType<typeof vi.fn>;
const mockUpdateUserRole = api.updateUserRole as ReturnType<typeof vi.fn>;
const mockReassignTaskPillars = api.reassignTaskPillars as ReturnType<typeof vi.fn>;
const mockGetReassignPillarsStatus = api.getReassignPillarsStatus as ReturnType<typeof vi.fn>;
/** Noch nie gelaufen — dann gibt es kein „Fortsetzen“. */
const NO_RUN = { startedAt: null, total: 0, pending: 0 };

/**
 * Test-Pflege #1642: POST startet nur noch den Hintergrund-Batch, das Ergebnis kommt aus dem Status.
 * Liefert den Stand ab der zweiten Abfrage (die erste ist der Mount) als abgeschlossenen Lauf.
 */
const finishBatchWith = (result: {
	updated: number;
	failed: number;
	skipped: number;
	failureReasons?: Record<string, number>;
}) => {
	let calls = 0;
	mockGetReassignPillarsStatus.mockImplementation(() => {
		calls += 1;
		return Promise.resolve(
			calls === 1
				? NO_RUN
				: {
						startedAt: '2026-09-23T08:00:00.000Z',
						total: result.updated + result.failed + result.skipped,
						pending: result.failed,
						running: false,
						processed: result.updated + result.failed + result.skipped,
						result: { quotaExhausted: false, ...result },
					},
		);
	});
	mockReassignTaskPillars.mockResolvedValue({ running: true, processed: 0 });
};
mockGetReassignPillarsStatus.mockImplementation(() => Promise.resolve(NO_RUN));

type TestUser = {
	id: number;
	email: string;
	displayName: string;
	// #1566: lokale Union um 'tester' erweitert — der Client-Typ (AdminUser['role']) zieht in
	// der Impl-Phase nach (openapi-Regeneration); der Mock umgeht ihn hier bewusst.
	role: 'admin' | 'member' | 'tester';
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
 * Badge-spezifischer Zeilen-Match: Text außerhalb von `<option>` bzw. der Rollen-Radiogruppe
 * (`<label>` je Option, #1566) — historisch aus #1556 (die Zeilen-Auswahl existiert nicht mehr,
 * #1565), der Filter hält den Query robust gegen künftige Auswahlelemente in der Zeile.
 */
const badgeInRow = (row: HTMLElement, label: string): HTMLElement => {
	const matches = within(row)
		.getAllByText(label)
		.filter((element) => element.tagName !== 'OPTION' && element.closest('label') === null);
	expect(matches, `Badge „${label}" muss genau einmal in der Zeile stehen`).toHaveLength(1);
	return matches[0];
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	mockGetReassignPillarsStatus.mockImplementation(() => Promise.resolve(NO_RUN));
});

describe('AdminUsersSection — Nutzerverwaltung (Rollensystem admin/member/tester)', () => {
	it('zeigt den Spinner während des Ladens und danach die Nutzerliste mit Rollen-Badge', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', email: 'anna@example.com', role: 'admin' }),
			user({ id: 2, displayName: 'Max Member', email: 'max@example.com', role: 'member' }),
		]);

		render(<AdminUsersSection />);
		expect(screen.getByRole('status')).toBeInTheDocument();

		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		expect(screen.getByText('anna@example.com')).toBeInTheDocument();
		expect(badgeInRow(rowOf('Anna Admin'), 'Admin')).toBeInTheDocument();
		expect(screen.getByText('Max Member')).toBeInTheDocument();
		expect(badgeInRow(rowOf('Max Member'), 'Mitglied')).toBeInTheDocument();
	});

	it('Auswahl von „Admin" in der Rollen-Radiogruppe ruft updateUserRole auf und lädt neu', async () => {
		mockGetAdminUsers
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'member' })])
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'admin' })]);
		mockUpdateUserRole.mockResolvedValue(user({ id: 2, displayName: 'Max Member', role: 'admin' }));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Max Member')).toBeInTheDocument());

		fireEvent.click(within(rowOf('Max Member')).getByRole('radio', { name: 'Admin' }));

		await waitFor(() => expect(mockUpdateUserRole).toHaveBeenCalledWith({ id: 2, role: 'admin' }));
		expect(mockGetAdminUsers).toHaveBeenCalledTimes(2);
	});

	it('Auswahl von „Tester" in der Rollen-Radiogruppe ruft updateUserRole mit role tester auf', async () => {
		mockGetAdminUsers
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'member' })])
			.mockResolvedValueOnce([user({ id: 2, displayName: 'Max Member', role: 'tester' })]);
		mockUpdateUserRole.mockResolvedValue(user({ id: 2, displayName: 'Max Member', role: 'tester' }));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Max Member')).toBeInTheDocument());

		fireEvent.click(within(rowOf('Max Member')).getByRole('radio', { name: 'Tester' }));

		await waitFor(() => expect(mockUpdateUserRole).toHaveBeenCalledWith({ id: 2, role: 'tester' }));
		expect(mockGetAdminUsers).toHaveBeenCalledTimes(2);
	});

	it('zeigt bei 409 (letzter Administrator) die Server-Meldung als KolAlert, ohne die Liste zu verlieren', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin', role: 'admin' })]);
		mockUpdateUserRole.mockRejectedValue(new Error('Es muss mindestens einen Administrator geben.'));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(within(rowOf('Anna Admin')).getByRole('radio', { name: 'Mitglied' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Es muss mindestens einen Administrator geben.'),
		);
		expect(screen.getByText('Anna Admin')).toBeInTheDocument();
	});

	// PR #1616 Finding #1: `kol-input-radio` hält den angeklickten Wert als eigenen Zustand — anders
	// als beim alten `KolButton` (kein eigener Zustand) bleibt die Radiogruppe nach einer abgelehnten
	// Rollenänderung sonst auf der (falschen) angeklickten Rolle stehen, während Badge/Server die alte
	// zeigen. `handleRoleChange` muss darum auch im Fehlerfall neu laden.
	it('lädt die Nutzerliste auch nach einer abgelehnten Rollenänderung neu (Radiogruppe bleibt synchron)', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin', role: 'admin' })]);
		mockUpdateUserRole.mockRejectedValue(new Error('Es muss mindestens einen Administrator geben.'));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(within(rowOf('Anna Admin')).getByRole('radio', { name: 'Mitglied' }));

		await waitFor(() => expect(mockGetAdminUsers).toHaveBeenCalledTimes(2));
		expect(screen.getByRole('alert')).toHaveTextContent('Es muss mindestens einen Administrator geben.');
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

/**
 * Rote Spec-Tests für #1566 (Spec docs/spec/issue-1566.md, AK1): Die Rolle `tester` erscheint
 * in der Nutzerverwaltung als Badge „Tester" — Text, nie nur Farbe (WCAG 1.4.1). Rot: heute
 * fällt `roleLabel` für jeden unbekannten Wert auf „Mitglied" zurück.
 */
describe('AdminUsersSection — Rollen-Badge „Tester" (#1566 AK1)', () => {
	it('AK1: Zeile mit Rolle tester zeigt das Rollen-Badge „Tester"', async () => {
		mockGetAdminUsers.mockResolvedValue([
			user({ id: 1, displayName: 'Anna Admin', role: 'admin' }),
			user({ id: 2, displayName: 'Tina Tester', role: 'tester' }),
		]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Tina Tester')).toBeInTheDocument());

		expect(badgeInRow(rowOf('Tina Tester'), 'Tester')).toBeInTheDocument();
		// Schwestertexte bleiben unberührt — kein globales „Mitglied"-Badge als Fallback für tester
		// (die Radiogruppe zeigt „Mitglied" als Option trotzdem an — das ist kein Badge).
		expect(
			within(rowOf('Tina Tester'))
				.getAllByText('Mitglied')
				.filter((element) => element.tagName !== 'OPTION' && element.closest('label') === null),
		).toHaveLength(0);
		expect(badgeInRow(rowOf('Anna Admin'), 'Admin')).toBeInTheDocument();
	});
});

/**
 * Fixup PR #1602, Finding #3: die Säulenverteilungs-Neuberechnung (zweistufige Bestätigung,
 * `commit 24505348`) kam ohne einen einzigen Test. Deckt genau die Pfade ab, die teuer sind,
 * wenn sie brechen: kein Start ohne beide Bestätigungsstufen, „Abbrechen" löst in keiner Stufe
 * etwas aus, ein Fehler schließt die Modals statt sie mit laufendem `running` hängen zu lassen.
 */
describe('AdminUsersSection — Säulenverteilung neu berechnen (Fixup #1602, Finding #3)', () => {
	const openBothConfirmSteps = async (): Promise<void> => {
		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		await waitFor(() => expect(screen.getByText(/Sollen die Säulen-Beiträge/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
		await waitFor(() => expect(screen.getByText(/wird einzeln per KI klassifiziert/)).toBeInTheDocument());
	};

	it('der Button allein löst noch keinen Batch-Lauf aus', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		await waitFor(() => expect(screen.getByText(/Sollen die Säulen-Beiträge/)).toBeInTheDocument());

		expect(mockReassignTaskPillars).not.toHaveBeenCalled();
	});

	it('„Abbrechen" in der ersten Stufe schließt den Dialog ohne API-Aufruf', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		await waitFor(() => expect(screen.getByText(/Sollen die Säulen-Beiträge/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		await waitFor(() => expect(screen.queryByText(/Sollen die Säulen-Beiträge/)).not.toBeInTheDocument());
		expect(mockReassignTaskPillars).not.toHaveBeenCalled();
	});

	it('„Abbrechen" in der Kosten-Stufe schließt den Dialog ohne API-Aufruf', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		await openBothConfirmSteps();

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		await waitFor(() => expect(screen.queryByText(/wird einzeln per KI klassifiziert/)).not.toBeInTheDocument());
		expect(mockReassignTaskPillars).not.toHaveBeenCalled();
	});

	it('erst nach beiden Bestätigungsstufen startet der Batch und das Ergebnis erscheint als Alert', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		finishBatchWith({ updated: 3, failed: 1, skipped: 2 });

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		await openBothConfirmSteps();

		fireEvent.click(screen.getByRole('button', { name: 'Jetzt neu berechnen' }));

		await waitFor(() => expect(mockReassignTaskPillars).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('3 Aufgaben neu zugeordnet, 2 unverändert gelassen, 1'),
		);
		expect(screen.queryByText(/wird einzeln per KI klassifiziert/)).not.toBeInTheDocument();
	});

	it('ein fehlgeschlagener Aufruf zeigt die Fehlermeldung und schließt beide Modals', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		mockReassignTaskPillars.mockRejectedValue(new Error('Interner Serverfehler.'));

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		await openBothConfirmSteps();

		fireEvent.click(screen.getByRole('button', { name: 'Jetzt neu berechnen' }));

		await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Interner Serverfehler.'));
		expect(screen.queryByText(/wird einzeln per KI klassifiziert/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Sollen die Säulen-Beiträge/)).not.toBeInTheDocument();
		// Nicht mehr `running` hängengeblieben — der Auslöse-Button ist wieder aktiv nutzbar.
		expect(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' })).toBeEnabled();
	});
});

/**
 * Rote Spec-Tests für #1729 (Spec `docs/spec/issue-1729.md`, AK1/AK2): Die zweistufige Bestätigung
 * hängt heute an zwei parallelen bedingten Modals (`AdminUsersSection.tsx:185`/`:222`) — der
 * Schrittwechsel intent → costs unmountet die erste und mountet die zweite Dialog-Instanz, deren
 * Öffnen-Effekt (`showModal()` nach Promise-Auflösung) vor dem Document-Einhängen laufen kann
 * (InvalidStateError). Ziel: EIN persistentes Modal (Muster `GroupDeleteDialog`), das beim
 * Schrittwechsel nur die Kinder tauscht. Rot: Der Modal-Wrapper ist nach „Weiter“ ein NEUER
 * DOM-Knoten statt derselbe.
 */
describe('AdminUsersSection — persistenter Bestätigungs-Dialog (#1729 AK1/AK2)', () => {
	it('AK1: „Weiter“ tauscht nur den Inhalt des Modals — gleiche Dialog-Instanz, kein Remount', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		// Der Mock-Wrapper des Modals (`vi.mock('./Modal')` rendert `<div>{children}</div>`) ist der
		// DOM-Knoten, dessen Identität über den Schrittwechsel hinweg stabil bleiben muss.
		const intentModalNode = screen.getByText(/Sollen die Säulen-Beiträge/).parentElement;
		expect(intentModalNode).not.toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

		await waitFor(() => expect(screen.getByText(/wird einzeln per KI klassifiziert/)).toBeInTheDocument());
		expect(screen.queryByText(/Sollen die Säulen-Beiträge/)).not.toBeInTheDocument();
		expect(screen.getByText(/wird einzeln per KI klassifiziert/).parentElement).toBe(intentModalNode);
	});
});

/**
 * #1614: Der bestehende Trigger bekommt die Statusauswahl und die Fortschrittsanzeige aus dem
 * Ticket. Der Lauf setzt sich außerdem selbst fort, statt den Admin „Fortsetzen" klicken zu
 * lassen — genau daran scheiterte die Neuberechnung bisher: ohne mitgezählten Offset traf jeder
 * Folgeaufruf wieder dieselbe erste Portion, und der Rest blieb liegen.
 */
describe('AdminUsersSection — Statusauswahl und Fortschritt (#1614)', () => {
	const startRun = async (): Promise<void> => {
		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		await waitFor(() => expect(screen.getByText(/Sollen die Säulen-Beiträge/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
		await waitFor(() => expect(screen.getByText(/wird einzeln per KI klassifiziert/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt neu berechnen' }));
	};

	it.each([
		['Nur offene Aufgaben', 'open'],
		['Nur erledigte Aufgaben', 'done'],
	])('reicht „%s" als status=%s an den Server durch', async (label, expected) => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		finishBatchWith({ updated: 1, failed: 0, skipped: 0 });

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());

		fireEvent.click(screen.getByRole('button', { name: 'Säulenverteilung aller Aufgaben neu berechnen' }));
		await waitFor(() => expect(screen.getByText(/Sollen die Säulen-Beiträge/)).toBeInTheDocument());
		fireEvent.click(screen.getByRole('radio', { name: label }));
		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
		fireEvent.click(screen.getByRole('button', { name: 'Jetzt neu berechnen' }));

		await waitFor(() => expect(mockReassignTaskPillars).toHaveBeenCalled());
		expect(mockReassignTaskPillars.mock.calls[0][0]).toMatchObject({ status: expected });
	});

	// Test-Pflege #1642: Portions-/offset-Tests entfallen — die Portionierung liegt auf dem Server.
	it('zeigt Ergebnis und Fehlergründe des Hintergrund-Batches aus dem Status', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		finishBatchWith({ updated: 7, failed: 2, skipped: 1, failureReasons: { 'HTTP 429': 2 } });

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		await startRun();

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('7 Aufgaben neu zugeordnet, 1 unverändert gelassen'),
		);
		expect(screen.getByRole('alert')).toHaveTextContent('HTTP 429 (Rate-Limit des KI-Anbieters): 2');
		expect(mockReassignTaskPillars).toHaveBeenCalledTimes(1);
	});

	it('zeigt während des Laufs einen zugänglichen Fortschrittsbalken', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		let calls = 0;
		mockGetReassignPillarsStatus.mockImplementation(() => {
			calls += 1;
			return Promise.resolve(
				calls === 1
					? NO_RUN
					: { startedAt: '2026-09-23T08:00:00.000Z', total: 5, pending: 3, running: true, processed: 2 },
			);
		});
		mockReassignTaskPillars.mockResolvedValue({ running: true, processed: 0 });

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByText('Anna Admin')).toBeInTheDocument());
		await startRun();

		const bar = await screen.findByRole('progressbar');
		expect(bar).toHaveAttribute('aria-valuemax', '5');
		expect(bar).toHaveAttribute('aria-valuenow', '2');
	});

	it('zeigt den Stand und setzt über „Fortsetzen“ ohne Neustart fort', async () => {
		mockGetAdminUsers.mockResolvedValue([user({ id: 1, displayName: 'Anna Admin' })]);
		mockGetReassignPillarsStatus.mockImplementation(() =>
			Promise.resolve({ startedAt: '2026-09-23T08:00:00.000Z', total: 145, pending: 54 }),
		);
		mockReassignTaskPillars.mockResolvedValue({ running: true, processed: 0 });

		render(<AdminUsersSection />);
		await waitFor(() => expect(screen.getByTestId('reassign-batch-status')).toHaveTextContent('91 von 145'));

		fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen (54 offen)' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Jetzt fortsetzen' }));

		await waitFor(() => expect(mockReassignTaskPillars).toHaveBeenCalled());
		expect(mockReassignTaskPillars.mock.calls[0][0]).toMatchObject({ restart: false });
	});
});
