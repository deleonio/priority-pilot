import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { Task } from 'client';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #2938 — AK4 (Lade-/Fehlerzustände) und AK6 (Felder ohne Wert,
 * „Mehr Details"). Spezifikation: docs/spec/issue-2938.md.
 * Rot, bis `TaskView` existiert (fehlt das Modul, ist das der legitime erste Rot-Zustand).
 */

// API-Fassade (Vertrag: getTask({ id }) → Task, !ok → ResponseError mit response.status 404)
// als Mock über vi.hoisted, weil der echte Export in api.ts erst mit der Umsetzung entsteht.
const { getTaskMock } = vi.hoisted(() => ({ getTaskMock: vi.fn() }));
vi.mock('../api', () => ({ getTask: getTaskMock }));

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _type, children }: { _type?: string; children?: ReactNode }) => (
		<div role="alert" data-type={_type}>
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button onClick={() => _on?.onClick?.()}>{_label}</button>
	),
	KolDetails: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<details>
			<summary>{_label}</summary>
			{children}
		</details>
	),
	KolHeading: ({ _level, children }: { _level?: number; children?: ReactNode }) => {
		const Tag = `h${_level ?? 1}` as 'h1';
		return <Tag>{children}</Tag>;
	},
	KolLink: ({ _label, _href }: { _label?: string; _href?: string }) => <a href={_href}>{_label}</a>,
	KolPopoverButton: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-label={_label}>{children}</div>
	),
}));

import { TaskView } from './TaskView';

const sampleTask = (overrides: Partial<Task> = {}): Task =>
	({
		id: 42,
		title: 'Kundenbericht fertigstellen',
		status: TaskStatus.Open,
		priority: 3,
		estimatedEffort: 0.5,
		description: 'Zahlen prüfen und abschicken.',
		deadline: new Date('2030-01-15T12:00:00.000Z'),
		address: null,
		...overrides,
	}) as Task;

const renderView = () => render(<TaskView taskId={42} onBack={vi.fn()} onEdit={vi.fn()} />);

describe('TaskView (#2938)', () => {
	beforeEach(() => {
		getTaskMock.mockReset();
	});

	// AK4/TF4a: Während des Ladens Skelett in der Form der Ansicht (Titelbalken + Faktenzeilen),
	// kein Spinner/Alert und noch keine Aufgabe.
	it('AK4: zeigt während des Ladens ein Skelett ohne Spinner', () => {
		getTaskMock.mockReturnValue(new Promise(() => {}));
		const { container } = renderView();

		expect(container.querySelector('.task-view-skeleton')).not.toBeNull();
		expect(container.querySelector('.task-view-skeleton-title')).not.toBeNull();
		expect(container.querySelectorAll('.task-view-skeleton-row').length).toBeGreaterThanOrEqual(2);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Kundenbericht fertigstellen')).toBeNull();
	});

	// AK4/TF4b: Ladefehler → Fehler-KolAlert mit „Erneut laden"; Klick stößt denselben Abruf
	// erneut an.
	it('AK4: Ladefehler zeigt Fehler-Alert und lädt bei „Erneut laden" erneut', async () => {
		getTaskMock.mockRejectedValue(new Error('Netzwerk weg'));
		renderView();

		expect(await screen.findByText('Daten konnten nicht geladen werden')).toBeVisible();
		expect(getTaskMock).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
		await waitFor(() => expect(getTaskMock).toHaveBeenCalledTimes(2));
	});

	// AK6/TF6a: Felder ohne Wert erscheinen nicht — ohne Adresse gibt es keinen Ort-Block
	// (auch nicht eingeklappt unter „Mehr Details").
	it('AK6: ohne Adresse erscheint kein Ort-Block', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ address: null }));
		const { container } = renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(container.textContent).not.toContain('Ort');
	});

	// AK6/TF6b: „Mehr Details" ist ein eingeklapptes KolDetails — die Adresse steht darin,
	// nicht lose auf der Seite.
	it('AK6: mit Adresse steht der Ort unter „Mehr Details"', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ address: 'Mauerstraße 1, 10117 Berlin' }));
		const { container } = renderView();

		const details = await waitFor(() => {
			const el = container.querySelector('details');
			expect(el?.querySelector('summary')?.textContent).toContain('Mehr Details');
			return el;
		});
		expect(details!.textContent).toContain('Mauerstraße 1, 10117 Berlin');
	});
});
