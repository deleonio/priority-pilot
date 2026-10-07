import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Series, Task } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #2359 (AK1–AK3, AK5): `SeriesInstanceDialog` legt per
 * `api.createSeriesInstance` genau eine Aufgabe aus einer Serie/Vorlage an. Vertrag:
 * docs/spec/issue-2359.md. Rot, weil `./SeriesInstanceDialog` noch fehlt. KoliBri nativ gemockt.
 */
type OnInput = { onInput?: (e: Event, value: unknown) => void };
vi.mock('@public-ui/react-v19', () => {
	const field =
		(tag: 'input' | 'textarea') =>
		({ _label, _value, _on }: { _label?: string; _value?: unknown; _on?: OnInput }) => {
			const Tag = tag;
			return (
				<Tag
					aria-label={_label}
					value={String(_value ?? '')}
					onChange={(e: { nativeEvent: Event; target: { value: string } }) =>
						_on?.onInput?.(e.nativeEvent, e.target.value)
					}
				/>
			);
		};
	return {
		KolInputText: field('input'),
		KolInputDate: field('input'),
		KolInputRange: field('input'),
		KolTextarea: field('textarea'),
		KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
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
			_on?: { onClick?: (e: MouseEvent) => void };
		}) => (
			<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
				{_label}
			</button>
		),
	};
});
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../lib/apiError', () => ({
	toApiError: vi.fn().mockResolvedValue({ message: 'Diese Serie ist ruhend. Es wurde keine Aufgabe angelegt.' }),
}));
vi.mock('../api', () => ({ api: { createSeriesInstance: vi.fn() } }));

import { api } from '../api';
import { SeriesInstanceDialog } from './SeriesInstanceDialog';

const create = api.createSeriesInstance as ReturnType<typeof vi.fn>;
const series: Series = {
	id: 5,
	title: 'Wäsche',
	description: 'Alles waschen',
	rhythm: 'weekly',
	priority: 3,
	estimatedEffort: 0.5,
	active: true,
	autoCreate: false,
	startDate: new Date('2026-09-07T00:00:00.000Z'),
	pillars: [],
};
const task = { id: 77, title: 'Wäsche' } as Task;

beforeEach(() => {
	create.mockReset();
});
afterEach(cleanup);

const setup = () => {
	const onClose = vi.fn();
	const onCreated = vi.fn();
	render(<SeriesInstanceDialog series={series} onClose={onClose} onCreated={onCreated} />);
	return { onClose, onCreated };
};

describe('SeriesInstanceDialog (#2359)', () => {
	it('AK1: ist mit den Serienwerten vorbefüllt, Fälligkeit leer', () => {
		setup();
		expect(screen.getByLabelText(/Titel/)).toHaveValue('Wäsche');
		expect(screen.getByLabelText(/Beschreibung/)).toHaveValue('Alles waschen');
		expect(screen.getByLabelText(/Priorität/)).toHaveValue('3');
		expect(screen.getByLabelText(/Aufwand/)).toHaveValue('0.5');
		expect(screen.getByLabelText(/Fällig am/)).toHaveValue('');
	});

	it('AK2: Doppelklick auf Bestätigen ruft die API genau einmal; unveränderte Übernahme sendet keine Feldwerte', async () => {
		let resolve!: (t: Task) => void;
		create.mockReturnValue(new Promise<Task>((r) => (resolve = r)));
		const { onCreated } = setup();
		const button = screen.getByRole('button', { name: 'Aufgabe anlegen' });
		fireEvent.click(button);
		fireEvent.click(button);
		await act(async () => resolve(task));
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0].id).toBe(5);
		expect(create.mock.calls[0][0].seriesInstanceInput).toEqual({});
		expect(onCreated).toHaveBeenCalledWith(task);
	});

	it('AK2/AK4: sendet nur den geänderten Titel und ein gesetztes Fälligkeitsdatum', async () => {
		create.mockResolvedValue(task);
		setup();
		fireEvent.change(screen.getByLabelText(/Titel/), { target: { value: 'Wäsche heute' } });
		fireEvent.change(screen.getByLabelText(/Fällig am/), { target: { value: '2026-10-20' } });
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Aufgabe anlegen' })));
		const input = create.mock.calls[0][0].seriesInstanceInput;
		expect(Object.keys(input).sort()).toEqual(['deadline', 'title']);
		expect(input.title).toBe('Wäsche heute');
		expect(String(input.deadline)).toContain('2026-10-20');
	});

	it('AK3: Abbrechen schließt ohne API-Aufruf', () => {
		const { onClose } = setup();
		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
		expect(onClose).toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('AK5: Serverfehler (409) zeigt Meldung, Dialog bleibt offen, nichts angelegt', async () => {
		create.mockRejectedValue(new Error('409'));
		const { onClose, onCreated } = setup();
		await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Aufgabe anlegen' })));
		expect(screen.getByRole('alert')).toHaveTextContent(/ruhend/);
		expect(onCreated).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Aufgabe anlegen' })).toBeEnabled();
	});
});
