import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Series, Task } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #2359 (AK1, AK2, AK5): Aktion „Aufgabe anlegen" im `SeriesTab`.
 * Vertrag: docs/spec/issue-2359.md. Dialog selbst: SeriesInstanceDialog.test.tsx (hier gemockt).
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolSpin: () => <span aria-busy="true" />,
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolToolbar: ({ _items }: { _items?: Array<{ _label?: string; _on?: { onClick?: () => void } }> }) => (
		<div role="toolbar">
			{(_items ?? []).map((item, index) => (
				<button key={index} onClick={() => item._on?.onClick?.()}>
					{item._label}
				</button>
			))}
		</div>
	),
}));
vi.mock('./DeleteSeriesDialog', () => ({ DeleteSeriesDialog: () => null }));
vi.mock('./Modal', () => ({ Modal: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('./TaskForm', () => ({ TaskForm: () => null }));
vi.mock('./SeriesInstanceDialog', () => ({
	SeriesInstanceDialog: ({
		series,
		onClose,
		onCreated,
	}: {
		series: Series;
		onClose: () => void;
		onCreated: (task: Task) => void;
	}) => (
		<div data-testid="instance-dialog">
			{series.title}
			<button onClick={onClose}>Dialog schließen</button>
			<button onClick={() => onCreated({ id: 9, title: 'Neue Aufgabe' } as Task)}>Dialog erfolgreich</button>
		</div>
	),
}));
vi.mock('../api', () => ({ api: { listSeries: vi.fn() } }));

import { api } from '../api';
import { SeriesTab } from './SeriesTab';

const base: Series = {
	id: 1,
	title: 'Aktive Serie',
	rhythm: 'weekly',
	priority: 3,
	estimatedEffort: 0.5,
	active: true,
	autoCreate: true,
	startDate: new Date('2026-09-07T00:00:00.000Z'),
	pillars: [],
};
const dormant: Series = { ...base, id: 2, title: 'Ruhende Serie', active: false };

afterEach(cleanup);

const renderTab = async (onTasksChanged = vi.fn()) => {
	(api.listSeries as ReturnType<typeof vi.fn>).mockResolvedValue([base, dormant]);
	await act(async () => {
		render(<SeriesTab pillars={[]} onTasksChanged={onTasksChanged} />);
	});
	return onTasksChanged;
};
const within = (id: number) => screen.getByTestId(`series-tree-item-${id}`);

describe('SeriesTab — Aufgabe anlegen (#2359)', () => {
	it('AK1/AK5: Aktion nur bei aktiver Serie, Klick öffnet den Dialog für diese Serie', async () => {
		await renderTab();
		expect(within(2).textContent).not.toContain('Aufgabe anlegen');
		expect(within(1).textContent).toContain('Aufgabe anlegen');
		fireEvent.click(screen.getAllByText('Aufgabe anlegen')[0]);
		expect(screen.getByTestId('instance-dialog')).toHaveTextContent('Aktive Serie');
	});

	it('AK2: Erfolg schließt den Dialog, zeigt Erfolgsmeldung und lädt die Aufgaben neu', async () => {
		const changed = await renderTab();
		fireEvent.click(screen.getAllByText('Aufgabe anlegen')[0]);
		fireEvent.click(screen.getByText('Dialog erfolgreich'));
		expect(screen.queryByTestId('instance-dialog')).toBeNull();
		expect(screen.getByRole('alert')).toHaveTextContent('Aufgabe angelegt: Neue Aufgabe');
		expect(changed).toHaveBeenCalled();
	});

	it('AK3: Schließen ohne Anlegen meldet nichts und lädt nichts neu', async () => {
		const changed = await renderTab();
		fireEvent.click(screen.getAllByText('Aufgabe anlegen')[0]);
		fireEvent.click(screen.getByText('Dialog schließen'));
		expect(screen.queryByTestId('instance-dialog')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(changed).not.toHaveBeenCalled();
	});
});
