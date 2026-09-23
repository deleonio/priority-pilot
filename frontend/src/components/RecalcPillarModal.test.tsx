import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OwnReassignPillarsStatus } from 'client';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests für #1614 — „Säulen-Verteilung neu berechnen“.
 *
 * Die Komponente rechnet bewusst nichts selbst: sie startet den serverseitigen Hintergrundlauf
 * (`POST /tasks/reassign-pillars`, #1642) und liest Fortschritt und Ergebnis aus dem Status.
 * Test-Pflege #1642: die Tests der Client-Portionsschleife (offset, limit, Abbruch) entfallen —
 * die Portionierung liegt jetzt auf dem Server (`reassign-own-pillars.test.ts`).
 *
 * Die KoliBri-Hosts sind wie in `ConfirmDeleteDialog.test.tsx` auf schlanke DOM-Äquivalente
 * reduziert (`KolDialog` ist in jsdom nicht lauffähig).
 */

type RadioOption = { label: string; value: string };

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolInputRadio: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: RadioOption[];
		_value?: string;
		_on?: { onChange?: (_e: Event, _value: string) => void };
	}) => (
		<fieldset>
			<legend>{_label}</legend>
			{(_options ?? []).map((option) => (
				<label key={option.value}>
					<input
						type="radio"
						name="recalc-filter"
						checked={_value === option.value}
						onChange={() => _on?.onChange?.(new Event('change'), option.value)}
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

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
}));

const reassignOwnTaskPillars = vi.fn();
const getOwnReassignPillarsStatus = vi.fn();
vi.mock('../api', () => ({
	api: {
		reassignOwnTaskPillars: (args: unknown) => reassignOwnTaskPillars(args),
		// Ohne eigene Implementierung: noch nie gelaufen — dann gibt es nur „Start“.
		getOwnReassignPillarsStatus: (args: unknown) =>
			Promise.resolve(getOwnReassignPillarsStatus(args) ?? { startedAt: null, total: 0, pending: 0 }),
	},
}));

vi.mock('../lib/apiError', () => ({
	toApiError: (reason: unknown) => Promise.resolve({ message: (reason as Error).message }),
}));

import { RecalcPillarModal } from './RecalcPillarModal';

afterEach(() => {
	cleanup();
	// `reset` statt `clear`: die Tests setzen eigene Implementierungen, die sonst in den nächsten leckten.
	vi.resetAllMocks();
});

const IDLE_STATUS: OwnReassignPillarsStatus = { startedAt: null, total: 0, pending: 0 };

beforeEach(() => {
	getOwnReassignPillarsStatus.mockResolvedValue(IDLE_STATUS);
	reassignOwnTaskPillars.mockResolvedValue({ running: true, processed: 0 });
});

/** Hintergrundlauf, der bei der ersten Abfrage nach dem Start schon fertig ist. */
const finishedWith = (
	result: Partial<NonNullable<OwnReassignPillarsStatus['result']>>,
	over: Partial<OwnReassignPillarsStatus> = {},
): void => {
	const full = { updated: 0, failed: 0, skipped: 0, quotaExhausted: false, ...result };
	getOwnReassignPillarsStatus.mockResolvedValueOnce(IDLE_STATUS).mockResolvedValue({
		startedAt: '2026-09-23T08:00:00.000Z',
		total: full.updated + full.failed + full.skipped,
		pending: full.failed,
		running: false,
		processed: full.updated + full.failed + full.skipped,
		result: full,
		...over,
	});
};

const setup = () => {
	const onClose = vi.fn();
	const onCompleted = vi.fn();
	render(<RecalcPillarModal onClose={onClose} onCompleted={onCompleted} />);
	return { onClose, onCompleted };
};

const chooseFilter = (label: string) => {
	fireEvent.click(screen.getByRole('radio', { name: label }));
};

const start = async () => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name: 'Start' }));
	});
};

const callArgs = (index: number) =>
	reassignOwnTaskPillars.mock.calls[index][0] as {
		status?: string;
		restart?: boolean;
	};

describe('RecalcPillarModal — Filterauswahl', () => {
	it.each([
		['Alle Aufgaben', 'all'],
		['Nur offene Aufgaben', 'open'],
		['Nur erledigte Aufgaben', 'done'],
	])('reicht „%s" als status=%s an den Server durch', async (label, expected) => {
		setup();

		chooseFilter(label);
		await start();

		expect(callArgs(0).status).toBe(expected);
	});

	it('rechnet nichts selbst — der einzige API-Aufruf ist der Server-Endpunkt', async () => {
		finishedWith({ updated: 3 });
		const { onCompleted } = setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
		expect(onCompleted).toHaveBeenCalledTimes(1);
		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('3 Aufgaben neu zugeordnet');
	});
});

describe('RecalcPillarModal — Hintergrundlauf (#1642)', () => {
	it('speist den Fortschrittsbalken aus dem Status des laufenden Server-Laufs', async () => {
		getOwnReassignPillarsStatus.mockResolvedValueOnce(IDLE_STATUS).mockResolvedValue({
			startedAt: '2026-09-23T08:00:00.000Z',
			total: 5,
			pending: 3,
			running: true,
			processed: 2,
		});
		setup();

		await start();

		const bar = screen.getByRole('progressbar');
		expect(bar).toHaveAttribute('aria-valuemax', '5');
		expect(bar).toHaveAttribute('aria-valuenow', '2');
		// Kein zweiter Start während des Laufs.
		expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
	});

	it('Schließen bricht den Server-Lauf nicht ab und startet keinen weiteren', async () => {
		getOwnReassignPillarsStatus.mockResolvedValueOnce(IDLE_STATUS).mockResolvedValue({
			startedAt: '2026-09-23T08:00:00.000Z',
			total: 5,
			pending: 5,
			running: true,
			processed: 0,
		});
		const { onClose } = setup();

		await start();
		fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
	});
});

describe('RecalcPillarModal — Fehler und Kontingent', () => {
	it('hält bei aufgebrauchtem Kontingent an und benennt die offenen Aufgaben', async () => {
		finishedWith({ updated: 2, quotaExhausted: true }, { total: 10, pending: 8 });
		setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
		const alerts = screen.getAllByRole('alert');
		expect(alerts.some((alert) => alert.textContent?.includes('KI-Kontingent aufgebraucht'))).toBe(true);
		expect(alerts.some((alert) => alert.textContent?.includes('8 Aufgaben sind noch offen'))).toBe(true);
	});

	it('nennt die Fehlergründe des Laufs im Abschluss', async () => {
		finishedWith({ updated: 6, failed: 4, failureReasons: { 'HTTP 429': 3, 'HTTP 500': 1 } });
		setup();

		await start();

		const alert = screen.getAllByRole('alert')[0];
		expect(alert).toHaveTextContent('4 fehlgeschlagen');
		expect(alert).toHaveTextContent('HTTP 429 (Rate-Limit des KI-Anbieters): 3');
		expect(alert).toHaveTextContent('HTTP 500: 1');
	});

	it('zeigt einen Serverfehler an und meldet keinen Abschluss', async () => {
		reassignOwnTaskPillars.mockRejectedValue(new Error('Serverfehler'));
		const { onCompleted } = setup();

		await start();

		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Serverfehler');
		expect(onCompleted).not.toHaveBeenCalled();
	});
});

describe('RecalcPillarModal — fortsetzbarer Lauf', () => {
	const resumableStatus = { startedAt: '2026-09-23T08:00:00.000Z', total: 145, pending: 54 };

	it('zeigt den Stand des letzten Laufs und bietet „Fortsetzen“ an', async () => {
		getOwnReassignPillarsStatus.mockResolvedValue(resumableStatus);
		setup();

		const status = await screen.findByTestId('recalc-run-status');
		expect(status).toHaveTextContent('91 von 145');
		expect(status).toHaveTextContent('54 noch offen');
		expect(screen.getByRole('button', { name: 'Fortsetzen (54 offen)' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Alle 145 neu starten' })).toBeInTheDocument();
	});

	it('„Fortsetzen“ beginnt keinen neuen Lauf', async () => {
		getOwnReassignPillarsStatus.mockResolvedValue(resumableStatus);
		setup();

		const resume = await screen.findByRole('button', { name: 'Fortsetzen (54 offen)' });
		await act(async () => {
			fireEvent.click(resume);
		});

		expect(callArgs(0).restart).toBe(false);
	});

	it('nennt nach dem Lauf die noch offenen Aufgaben und bietet „Fortsetzen“ an', async () => {
		finishedWith({ updated: 7, failed: 3 }, { total: 10, pending: 3 });
		setup();

		await start();

		expect(await screen.findByTestId('recalc-pending-hint')).toHaveTextContent('3 Aufgaben sind noch offen');
		expect(screen.getByRole('button', { name: 'Fortsetzen (3 offen)' })).toBeInTheDocument();
	});
});
