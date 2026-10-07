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
});
