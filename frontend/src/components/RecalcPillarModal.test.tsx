import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Pillar, Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests für #1614 — „Säulen-Verteilung neu berechnen“.
 *
 * Die KoliBri-Hosts sind in jsdom nicht lauffähig (`KolDialog` nutzt ein natives `<dialog>`);
 * wie in `ConfirmDeleteDialog.test.tsx` werden sie auf schlanke DOM-Äquivalente reduziert. Der
 * `KolProgress`-Mock spiegelt die durchgereichten Werte als `progressbar` — so bleibt geprüft,
 * dass der Fortschritt über eine zugängliche Komponente statt über einen Style-Balken läuft.
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

const updateTask = vi.fn();
vi.mock('../api', () => ({ api: { updateTask: (args: unknown) => updateTask(args) } }));

vi.mock('../lib/apiError', () => ({
	toApiError: (reason: unknown) => Promise.resolve({ message: (reason as Error).message }),
}));

import { RecalcPillarModal } from './RecalcPillarModal';

afterEach(() => {
	cleanup();
	// `reset` statt `clear`: die Tests setzen eigene Implementierungen, die sonst in den nächsten leckten.
	vi.resetAllMocks();
});

const pillars: Pillar[] = [
	{ id: 1, name: 'Körper', description: '', weight: 50 },
	{ id: 2, name: 'Sinn', description: '', weight: 50 },
];

const task = (id: number, status: Task['status'], contributions: TaskPillarContribution[] = []): Task => ({
	id,
	title: `T${id}`,
	status,
	priority: 3,
	estimatedEffort: 2,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pinned: false,
	pillars: contributions,
});

const openTask = task(1, TaskStatus.Open);
const inProcessTask = task(2, TaskStatus.InProcess);
const doneTask = task(3, TaskStatus.Done);

const setup = (tasks: Task[]) => {
	const onClose = vi.fn();
	const onCompleted = vi.fn();
	render(<RecalcPillarModal tasks={tasks} pillars={pillars} onClose={onClose} onCompleted={onCompleted} />);
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

describe('RecalcPillarModal — Filterauswahl', () => {
	it('„Alle Aufgaben“ zählt jede Aufgabe, unabhängig vom Status', () => {
		setup([openTask, inProcessTask, doneTask]);

		expect(screen.getByText('3 Aufgaben')).toBeInTheDocument();
	});

	it('„Nur offene Aufgaben“ umfasst Open UND „In process“', async () => {
		setup([openTask, inProcessTask, doneTask]);

		chooseFilter('Nur offene Aufgaben');

		// Kern-Regression: der Status heißt im Vertrag „In process“, nicht „InProcess“ —
		// mit dem falschen Literal fiele die laufende Aufgabe still aus dem Filter.
		expect(screen.getByText('2 Aufgaben')).toBeInTheDocument();

		await start();

		expect(updateTask.mock.calls.map(([args]) => (args as { id: number }).id)).toEqual([1, 2]);
	});

	it('„Nur erledigte Aufgaben“ umfasst ausschließlich Done', async () => {
		setup([openTask, inProcessTask, doneTask]);

		chooseFilter('Nur erledigte Aufgaben');

		expect(screen.getByText('1 Aufgabe')).toBeInTheDocument();

		await start();

		expect(updateTask.mock.calls.map(([args]) => (args as { id: number }).id)).toEqual([3]);
	});

	it('warnt bei leerer Treffermenge und sperrt den Start', () => {
		setup([doneTask]);

		chooseFilter('Nur offene Aufgaben');

		expect(screen.getByRole('alert')).toHaveTextContent('Keine Aufgaben');
		expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
	});
});

describe('RecalcPillarModal — Verarbeitung', () => {
	it('speichert je Aufgabe die neu berechnete Verteilung und meldet den Abschluss', async () => {
		const { onCompleted } = setup([openTask, inProcessTask]);

		await start();

		expect(updateTask).toHaveBeenCalledTimes(2);
		// `fillContributions` verteilt auf alle Säulen — ohne Vorbelegung zu gleichen Teilen.
		expect(updateTask).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 1,
				taskUpdate: {
					pillars: [
						{ pillarId: 1, share: 50, confidence: 100 },
						{ pillarId: 2, share: 50, confidence: 100 },
					],
				},
			}),
		);
		expect(onCompleted).toHaveBeenCalledTimes(1);
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getAllByRole('alert')[0]).toHaveTextContent('erfolgreich bearbeitet');
	});

	it('zeigt während des Laufs einen zugänglichen Fortschrittsbalken statt eines Style-Balkens', async () => {
		// Beide Aufrufe bleiben offen, damit der Lauf zwischen den Aufgaben beobachtbar ist.
		const resolvers: Array<() => void> = [];
		updateTask.mockImplementation(() => new Promise<void>((resolve) => resolvers.push(resolve)));

		setup([openTask, inProcessTask]);

		await start();

		const bar = screen.getByRole('progressbar');
		expect(bar).toHaveAttribute('aria-valuemax', '2');
		expect(bar).toHaveAttribute('aria-valuenow', '0');
		// Regression: der Fortschritt darf kein handgebauter Style-Balken mehr sein.
		expect(document.querySelector('.progress-bar')).toBeNull();

		await act(async () => {
			resolvers[0]();
		});

		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
	});

	it('zählt Fehler einzeln, läuft weiter und listet sie am Ende auf', async () => {
		updateTask.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Serverfehler'));

		setup([openTask, inProcessTask]);

		await start();

		expect(updateTask).toHaveBeenCalledTimes(2);
		const alerts = screen.getAllByRole('alert');
		expect(alerts[0]).toHaveTextContent('1 erfolgreich bearbeitet, 1 Fehler');
		expect(alerts[1]).toHaveTextContent('Task #2: Serverfehler');
	});
});

describe('RecalcPillarModal — Abbruch', () => {
	it('reicht das Abbruch-Signal an die API durch', async () => {
		setup([openTask]);

		await start();

		const [args] = updateTask.mock.calls[0] as [{ signal?: AbortSignal }];
		expect(args.signal).toBeInstanceOf(AbortSignal);
		expect(args.signal?.aborted).toBe(false);
	});

	it('bricht die laufende Schleife ab und meldet keinen Abschluss', async () => {
		let resolveFirst: () => void = () => undefined;
		updateTask
			.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
			.mockResolvedValue(undefined);

		const { onClose, onCompleted } = setup([openTask, inProcessTask, doneTask]);

		await start();

		const [args] = updateTask.mock.calls[0] as [{ signal?: AbortSignal }];

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(args.signal?.aborted).toBe(true);

		await act(async () => {
			resolveFirst();
		});

		// Die zweite und dritte Aufgabe werden nach dem Abbruch nicht mehr angefasst.
		expect(updateTask).toHaveBeenCalledTimes(1);
		expect(onCompleted).not.toHaveBeenCalled();
	});
});
