import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OwnReassignPillarsResult } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests für #1614 — „Säulen-Verteilung neu berechnen“.
 *
 * Die Komponente rechnet bewusst nichts selbst: sie treibt den serverseitigen Endpunkt
 * (`POST /tasks/reassign-pillars`) portionsweise, bis nichts mehr offen ist. Geprüft wird
 * genau das — die Filterauswahl landet am Server, die Portionen setzen mit `offset` disjunkt
 * fort, und der Fortschritt kommt aus `remaining`.
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

const portion = (over: Partial<OwnReassignPillarsResult> = {}): OwnReassignPillarsResult => ({
	updated: 0,
	failed: 0,
	skipped: 0,
	remaining: 0,
	quotaExhausted: false,
	...over,
});

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
		limit?: number;
		offset?: number;
		restart?: boolean;
	};

describe('RecalcPillarModal — Filterauswahl', () => {
	it.each([
		['Alle Aufgaben', 'all'],
		['Nur offene Aufgaben', 'open'],
		['Nur erledigte Aufgaben', 'done'],
	])('reicht „%s" als status=%s an den Server durch', async (label, expected) => {
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 1 }));
		setup();

		chooseFilter(label);
		await start();

		expect(callArgs(0).status).toBe(expected);
	});

	it('rechnet nichts selbst — der einzige API-Aufruf ist der Server-Endpunkt', async () => {
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 3 }));
		const { onCompleted } = setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
		expect(onCompleted).toHaveBeenCalledTimes(1);
		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('3 Aufgaben neu zugeordnet');
	});
});

describe('RecalcPillarModal — portionierter Lauf', () => {
	it('setzt mit offset disjunkt fort, bis nichts mehr offen ist', async () => {
		reassignOwnTaskPillars
			.mockResolvedValueOnce(portion({ updated: 2, remaining: 3 }))
			.mockResolvedValueOnce(portion({ updated: 2, skipped: 1, remaining: 0 }));
		setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(2);
		// Erfolgreich verarbeitete fallen serverseitig aus der Auswahl — ohne Fehlschlag bleibt der
		// offset bei 0. Nur der erste Aufruf beginnt den Lauf neu.
		expect(callArgs(0).offset).toBe(0);
		expect(callArgs(1).offset).toBe(0);
		expect(callArgs(0).restart).toBe(true);
		expect(callArgs(1).restart).toBe(false);
		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('4 Aufgaben neu zugeordnet, 1 unverändert gelassen');
	});

	it('speist den Fortschrittsbalken aus remaining', async () => {
		const resolvers: ((value: OwnReassignPillarsResult) => void)[] = [];
		reassignOwnTaskPillars.mockImplementation(
			() => new Promise<OwnReassignPillarsResult>((resolve) => resolvers.push(resolve)),
		);
		setup();

		await start();

		// Vor der ersten Antwort ist die Gesamtzahl noch unbekannt — kein „0 / 0“-Balken, der wie
		// ein hängender Lauf aussieht.
		expect(screen.queryByRole('progressbar')).toBeNull();
		expect(screen.getByText(/Ermittle Aufgaben/)).toBeInTheDocument();

		await act(async () => {
			resolvers[0](portion({ updated: 2, remaining: 3 }));
		});

		const bar = screen.getByRole('progressbar');
		expect(bar).toHaveAttribute('aria-valuemax', '5');
		expect(bar).toHaveAttribute('aria-valuenow', '2');
	});

	it('fordert kleine Portionen an, damit der Fortschritt während des Laufs weiterläuft', async () => {
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 1 }));
		setup();

		await start();

		// Ohne limit nähme der Server 200 Aufgaben in EINEM Request — der Balken stünde bis zum Ende.
		expect(callArgs(0).limit).toBe(5);
	});

	it('bricht ab, wenn eine Portion nichts mehr verarbeitet, statt endlos zu laufen', async () => {
		// Server meldet offene Aufgaben, verarbeitet aber keine — ohne Abbruch liefe die Schleife ewig.
		reassignOwnTaskPillars.mockResolvedValue(portion({ remaining: 7 }));
		setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
	});
});

describe('RecalcPillarModal — Abbruch, Fehler und Kontingent', () => {
	it('hält bei aufgebrauchtem Kontingent an und benennt die offenen Aufgaben', async () => {
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 2, remaining: 8, quotaExhausted: true }));
		setup();

		await start();

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
		const alerts = screen.getAllByRole('alert');
		expect(alerts.some((alert) => alert.textContent?.includes('KI-Kontingent aufgebraucht'))).toBe(true);
		expect(alerts.some((alert) => alert.textContent?.includes('8 Aufgaben sind noch offen'))).toBe(true);
	});

	it('summiert die Fehlergründe aller Portionen und nennt sie im Abschluss', async () => {
		reassignOwnTaskPillars
			.mockResolvedValueOnce(portion({ updated: 3, failed: 2, remaining: 5, failureReasons: { 'HTTP 429': 2 } }))
			.mockResolvedValueOnce(
				portion({ updated: 3, failed: 2, remaining: 0, failureReasons: { 'HTTP 429': 1, 'HTTP 500': 1 } }),
			);
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

	it('bricht den laufenden Lauf ab und fordert keine weitere Portion an', async () => {
		const resolvers: ((value: OwnReassignPillarsResult) => void)[] = [];
		reassignOwnTaskPillars.mockImplementation(
			() => new Promise<OwnReassignPillarsResult>((resolve) => resolvers.push(resolve)),
		);
		const { onClose, onCompleted } = setup();

		await start();
		const { signal } = reassignOwnTaskPillars.mock.calls[0][0] as { signal: AbortSignal };

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(signal.aborted).toBe(true);

		await act(async () => {
			resolvers[0](portion({ updated: 1, remaining: 5 }));
		});

		expect(reassignOwnTaskPillars).toHaveBeenCalledTimes(1);
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
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 5, remaining: 0 }));
		setup();

		const resume = await screen.findByRole('button', { name: 'Fortsetzen (54 offen)' });
		await act(async () => {
			fireEvent.click(resume);
		});

		expect(callArgs(0).restart).toBe(false);
	});

	it('schiebt den offset nur um die fehlgeschlagenen Aufgaben weiter', async () => {
		reassignOwnTaskPillars
			.mockResolvedValueOnce(portion({ updated: 3, failed: 2, remaining: 4 }))
			.mockResolvedValueOnce(portion({ updated: 4, remaining: 0 }));
		setup();

		await start();

		// Die zwei fehlgeschlagenen stehen vorn in der Auswahl — der nächste Aufruf überspringt genau sie.
		expect(callArgs(1).offset).toBe(2);
	});

	it('nennt nach dem Lauf die noch offenen Aufgaben und bietet „Fortsetzen“ an', async () => {
		getOwnReassignPillarsStatus
			.mockResolvedValueOnce({ startedAt: null, total: 10, pending: 10 })
			.mockResolvedValue({ startedAt: '2026-09-23T08:00:00.000Z', total: 10, pending: 3 });
		reassignOwnTaskPillars.mockResolvedValue(portion({ updated: 7, failed: 3, remaining: 0 }));
		setup();

		await start();

		expect(await screen.findByTestId('recalc-pending-hint')).toHaveTextContent('3 Aufgaben sind noch offen');
		expect(screen.getByRole('button', { name: 'Fortsetzen (3 offen)' })).toBeInTheDocument();
	});
});
