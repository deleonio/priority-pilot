import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ResponseError } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #2210 AK1/AK2/AK4 (docs/spec/issue-2210.md) — Einstellungen → Kalender.
 * Muster: `PlaceFavoritesSection.test.tsx` (Proxy-Mock für `../api`, KoliBri auf native Elemente reduziert).
 * Rot, bis `CalendarSourcesSection.tsx` existiert.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAccordion: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<section aria-label={_label}>{children}</section>
	),
	KolDetails: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<details open>
			<summary>{_label}</summary>
			{children}
		</details>
	),
	KolButton: ({
		_label,
		_on,
		_disabled,
		children,
		...rest
	}: {
		_label?: string;
		_on?: { onClick?: () => void };
		_disabled?: boolean;
		children?: React.ReactNode;
	}) => (
		<button type="button" disabled={_disabled} onClick={() => _on?.onClick?.()} {...rest}>
			{_label}
			{children}
		</button>
	),
	KolInputText: ({
		_label,
		_value,
		_on,
		...rest
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
			{...(rest as Record<string, unknown>)}
		/>
	),
	KolInputPassword: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void };
	}) => (
		<input
			type="password"
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => _on?.onInput?.(e.nativeEvent, e.target.value)}
		/>
	),
	KolInputRadio: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void };
	}) => (
		<div role="radiogroup" aria-label={_label}>
			{(_options ?? []).map((option) => (
				<label key={option.value}>
					<input
						type="radio"
						name="source-type"
						checked={_value === option.value}
						onChange={(e) => _on?.onChange?.(e.nativeEvent, option.value)}
					/>
					{option.label}
				</label>
			))}
		</div>
	),
	KolSingleSelect: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string[] | string;
		_on?: { onChange?: (_e: unknown, v: unknown) => void };
	}) => (
		<select
			aria-label={_label}
			value={Array.isArray(_value) ? (_value[0] ?? '') : (_value ?? '')}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, [e.target.value])}
		>
			{(_options ?? []).map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
	KolSpin: ({ _label }: { _label?: string }) => <span role="status">{_label ?? 'wird geladen'}</span>,
	KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
	// Test-Pflege #1990: Regler „Mindestdauer freier Lücken" erscheint bei verbundenem Kalender.
	KolInputRange: ({ _label }: { _label?: string }) => <input type="range" aria-label={_label} />,
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
		<div data-testid="modal" aria-label={title}>
			{children}
		</div>
	),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useInRouterContext: () => true }));

const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(undefined)),
		},
	),
}));

import { CalendarSourcesSection } from './CalendarSourcesSection';

const ICS_URL = 'https://kalender.example.org/geheim-token/privat.ics';

beforeEach(() => {
	for (const key of Object.keys(apiMocks)) delete apiMocks[key];
});

afterEach(cleanup);

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

const fillAndConnect = async (url: string, name?: string) => {
	fireEvent.change(screen.getByLabelText(/kalender-adresse/i), { target: { value: url } });
	if (name !== undefined) fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: name } });
	fireEvent.click(screen.getByRole('button', { name: /verbinden/i }));
	await flush();
};

describe('CalendarSourcesSection (#2210)', () => {
	it('AK1 — Verbinden ruft createCalendarSource mit Adresse und Name auf; der Kalender erscheint, die Adresse nicht', async () => {
		apiMocks.listCalendarSources = vi.fn().mockResolvedValue([]);
		apiMocks.createCalendarSource = vi.fn().mockResolvedValue({ id: 7, name: 'Privat' });
		const { container } = render(<CalendarSourcesSection />);
		await flush();

		await fillAndConnect(`  ${ICS_URL}  `, 'Privat');

		expect(apiMocks.createCalendarSource).toHaveBeenCalledWith({ url: ICS_URL, name: 'Privat' });
		expect(screen.getByText('Privat')).toBeInTheDocument();
		expect(container.innerHTML).not.toContain('geheim-token');
	});

	it('AK1 — bereits verbundene Kalender werden mit Namen gelistet, ohne Adresse', async () => {
		apiMocks.listCalendarSources = vi.fn().mockResolvedValue([{ id: 1, name: 'Arbeit' }]);
		const { container } = render(<CalendarSourcesSection />);
		await flush();

		expect(screen.getByText('Arbeit')).toBeInTheDocument();
		expect(container.innerHTML).not.toMatch(/https?:\/\//);
	});

	it('AK2 — eine abgelehnte Adresse (400) zeigt die Server-Meldung, die Liste bleibt unverändert', async () => {
		apiMocks.listCalendarSources = vi.fn().mockResolvedValue([{ id: 1, name: 'Arbeit' }]);
		apiMocks.createCalendarSource = vi
			.fn()
			.mockRejectedValue(
				new ResponseError(new Response(null, { status: 400 }), { message: 'Kalender nicht abrufbar.' }),
			);
		render(<CalendarSourcesSection />);
		await flush();

		await fillAndConnect(ICS_URL);

		expect(screen.getByRole('alert').textContent).toContain('Kalender nicht abrufbar.');
		expect(screen.getByText('Arbeit')).toBeInTheDocument();
		expect(screen.queryAllByRole('listitem')).toHaveLength(1);
	});

	it('AK2 — Paketgrenze (403 plan_required) zeigt einen Hinweis, die Liste bleibt unverändert', async () => {
		apiMocks.listCalendarSources = vi.fn().mockResolvedValue([{ id: 1, name: 'Arbeit' }]);
		apiMocks.createCalendarSource = vi.fn().mockRejectedValue(
			new ResponseError(new Response(null, { status: 403 }), {
				code: 'plan_required',
				feature: 'calendar_sources',
				requiredPlan: 'plus',
				currentPlan: 'free',
				message: 'Paketgrenze erreicht.',
			}),
		);
		render(<CalendarSourcesSection />);
		await flush();

		await fillAndConnect(ICS_URL);

		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.queryAllByRole('listitem')).toHaveLength(1);
	});

	it('AK4 — Entfernen ruft deleteCalendarSource auf und nimmt den Kalender aus der Liste', async () => {
		apiMocks.listCalendarSources = vi.fn().mockResolvedValue([{ id: 1, name: 'Arbeit' }]);
		apiMocks.deleteCalendarSource = vi.fn().mockResolvedValue(undefined);
		render(<CalendarSourcesSection />);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /entfernen/i }));
		await flush();
		// Bestätigungsdialog (sequenzielle Bestätigung) ist erlaubt, aber nicht vorgeschrieben.
		const dialog = screen.queryByTestId('modal');
		if (dialog !== null) {
			fireEvent.click(within(dialog).getByRole('button', { name: /endgültig|entfernen|löschen/i }));
			await flush();
		}

		expect(apiMocks.deleteCalendarSource).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
		expect(screen.queryByText('Arbeit')).toBeNull();
	});

	describe('CalDAV (#2211, AK7)', () => {
		// Typ-Wahl als Radio („CalDAV") oder Select mit Option „CalDAV" — beides erlaubt.
		const chooseCalDav = () => {
			const radio = screen.queryByRole('radio', { name: /caldav/i });
			if (radio !== null) fireEvent.click(radio);
			else fireEvent.change(screen.getByRole('combobox'), { target: { value: 'caldav' } });
		};

		it('ICS bleibt Standard: keine Felder für Benutzername und Passwort', async () => {
			apiMocks.listCalendarSources = vi.fn().mockResolvedValue([]);
			render(<CalendarSourcesSection />);
			await flush();

			expect(screen.queryByLabelText(/benutzername/i)).toBeNull();
			expect(screen.queryByLabelText(/passwort/i)).toBeNull();
		});

		it('CalDAV zeigt Benutzername und maskiertes Passwort; Verbinden sendet alle Felder, das Passwort wird danach geleert', async () => {
			apiMocks.listCalendarSources = vi.fn().mockResolvedValue([]);
			apiMocks.createCalendarSource = vi.fn().mockResolvedValue({ id: 3, name: 'Dienst', type: 'caldav' });
			const { container } = render(<CalendarSourcesSection />);
			await flush();

			chooseCalDav();
			const password = screen.getByLabelText(/passwort/i) as HTMLInputElement;
			expect(password.type).toBe('password');
			fireEvent.change(screen.getByLabelText(/benutzername/i), { target: { value: 'max@example.org' } });
			fireEvent.change(password, { target: { value: 'app-pw-2211' } });
			await fillAndConnect(ICS_URL, 'Dienst');

			expect(apiMocks.createCalendarSource).toHaveBeenCalledWith({
				type: 'caldav',
				url: ICS_URL,
				username: 'max@example.org',
				password: 'app-pw-2211',
				name: 'Dienst',
			});
			expect((screen.getByLabelText(/passwort/i) as HTMLInputElement).value).toBe('');
			expect(container.innerHTML).not.toContain('app-pw-2211');
			expect(container.innerHTML).not.toContain('geheim-token');
		});

		it('eine CalDAV-Quelle in der Liste trägt den Hinweis „CalDAV", ohne Adresse', async () => {
			apiMocks.listCalendarSources = vi.fn().mockResolvedValue([{ id: 2, name: 'Dienst', type: 'caldav' }]);
			const { container } = render(<CalendarSourcesSection />);
			await flush();

			const row = screen.getByTestId('calendar-source-row');
			expect(row.textContent).toMatch(/caldav/i);
			expect(container.innerHTML).not.toMatch(/https?:\/\//);
		});
	});
});
