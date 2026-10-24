import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { ChecklistItem, Task } from 'client';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

/**
 * Rote Spec-Tests für #2938 (AK4 Lade-/Fehlerzustände, AK6 „Mehr Details") und #2939
 * (AK1 Checkliste, AK2 Unteraufgaben-Sperre, AK4 Anpinnen/Zurückstellen, AK5 Fehler-Alert).
 * Spezifikation: docs/spec/issue-2938.md und docs/spec/issue-2939.md.
 */

// API-Fassade (Vertrag: getTask({ id }) → Task, !ok → ResponseError mit response.status 404;
// #2939 zusätzlich updateTask/snoozeTask/unarchiveTask/getForest) als Mock über vi.hoisted,
// weil Teile des echten Exports in api.ts erst mit der Umsetzung genutzt werden.
const { getTaskMock, updateTaskMock, snoozeTaskMock, unarchiveTaskMock, getForestMock } = vi.hoisted(() => ({
	getTaskMock: vi.fn(),
	updateTaskMock: vi.fn(),
	snoozeTaskMock: vi.fn(),
	unarchiveTaskMock: vi.fn(),
	getForestMock: vi.fn(),
}));
vi.mock('../api', () => ({
	getTask: getTaskMock,
	updateTask: updateTaskMock,
	snoozeTask: snoozeTaskMock,
	unarchiveTask: unarchiveTaskMock,
	getForest: getForestMock,
}));

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _type, children }: { _type?: string; children?: ReactNode }) => (
		<div role="alert" data-type={_type}>
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on, _disabled }: { _label?: string; _on?: { onClick?: () => void }; _disabled?: boolean }) => (
		<button disabled={_disabled} onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
	// Muster CompleteTaskDialog.test.tsx: native Checkbox mit KoliBri-Callback-Signatur.
	KolInputCheckbox: ({
		_label,
		_checked,
		_on,
	}: {
		_label?: string;
		_checked?: boolean;
		_on?: { onChange?: (_e: unknown, v: boolean) => void };
	}) => (
		<input
			type="checkbox"
			role="switch"
			aria-label={_label}
			checked={_checked ?? false}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.checked)}
		/>
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

describe('TaskView (#2938/#2939)', () => {
	beforeEach(() => {
		getTaskMock.mockReset();
		// Default: leerer Wald — keine Unteraufgaben, „Erledigt“ nicht gesperrt (AK2-Test
		// überschreibt das mit offener Unteraufgabe).
		getForestMock.mockReset();
		getForestMock.mockResolvedValue([]);
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

	// Fixup-Review: TASKS_CHANGED_EVENT (TaskForm löst es nach dem Speichern aus) stößt einen
	// erneuten Abruf an — die Leseseite zeigt danach die gespeicherten Werte, nicht den alten Stand.
	it('lädt nach TASKS_CHANGED_EVENT erneut', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(getTaskMock).toHaveBeenCalledTimes(1);

		act(() => {
			window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
		});
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

	// AK6/TF6b: „Mehr Details“ ist ein eingeklapptes KolDetails — die Adresse steht darin,
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

	// #2939 AK1: Abhaken sendet PATCH /tasks/:id mit der KOMPLETTEN Checkliste (#531) und
	// aktualisiert den Zähler sofort (optimistisch, „1 von 3“ → „2 von 3“).
	it('AK1: Abhaken sendet die komplette Checkliste und aktualisiert den Zähler', async () => {
		const checklist: ChecklistItem[] = [
			{ id: '11111111-1111-4111-8111-111111111111', title: 'Zahlen prüfen', completed: true },
			{ id: '22222222-2222-4222-8222-222222222222', title: 'Bericht lesen', completed: false },
			{ id: '33333333-3333-4333-8333-333333333333', title: 'Abschicken', completed: false },
		];
		getTaskMock.mockResolvedValue(sampleTask({ checklist }));
		updateTaskMock.mockImplementation(({ taskUpdate }: { taskUpdate: { checklist?: ChecklistItem[] } }) =>
			Promise.resolve(sampleTask({ checklist: taskUpdate.checklist })),
		);
		renderView();

		expect(await screen.findByText('1 von 3')).toBeVisible();
		fireEvent.click(screen.getByRole('switch', { name: 'Bericht lesen' }));

		await waitFor(() => expect(updateTaskMock).toHaveBeenCalledTimes(1));
		expect(updateTaskMock).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 42,
				taskUpdate: expect.objectContaining({
					checklist: [
						expect.objectContaining({ id: checklist[0]!.id, completed: true }),
						expect.objectContaining({ id: checklist[1]!.id, completed: true }),
						expect.objectContaining({ id: checklist[2]!.id, completed: false }),
					],
				}),
			}),
		);
		expect(await screen.findByText('2 von 3')).toBeVisible();
	});

	// #2939 AK2: offene direkte Unteraufgabe (über gemockten Forest, `dependents`) sperrt
	// „Erledigt“ (`_disabled`) und zeigt den Grund dauerhaft als Text (doneBlockedHint-Wortlaut).
	it('AK2: offene Unteraufgabe sperrt „Erledigt“ mit sichtbarem Grund', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		getForestMock.mockResolvedValue([
			{
				id: 42,
				title: 'Kundenbericht fertigstellen',
				status: TaskStatus.Open,
				dependents: [{ id: 43, title: 'Teilschritt', status: TaskStatus.Open, dependents: [] }],
			},
		]);
		renderView();

		const done = await screen.findByRole('button', { name: 'Erledigt' });
		expect(done).toBeDisabled();
		expect(screen.getByText(/offene Unteraufgabe/)).toBeVisible();
	});

	// #2939 AK4: Anpinnen sendet PATCH `pinned` und spiegelt sofort („Angepinnt“-Badge);
	// Zurückstellen ruft snoozeTask und bestätigt sichtbar (Bestands-Notice
	// common:actions.snoozed — das Task-DTO liefert kein snoozedUntil) — ohne Dialog.
	it('AK4: Anpinnen und Zurückstellen wirken sofort mit sichtbarem Spiegel', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		updateTaskMock.mockResolvedValue(sampleTask({ pinned: true }));
		snoozeTaskMock.mockResolvedValue(sampleTask());
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });

		fireEvent.click(screen.getByRole('button', { name: 'Anpinnen' }));
		await waitFor(() =>
			expect(updateTaskMock).toHaveBeenCalledWith(
				expect.objectContaining({ id: 42, taskUpdate: expect.objectContaining({ pinned: true }) }),
			),
		);
		expect(await screen.findByText('Angepinnt')).toBeVisible();

		fireEvent.click(screen.getByRole('button', { name: 'Kurz zurückstellen' }));
		await waitFor(() => expect(snoozeTaskMock).toHaveBeenCalledWith(expect.objectContaining({ id: 42 })));
		expect(await screen.findByText('Aufgabe zurückgestellt. Sie kommt später wieder.')).toBeVisible();
	});

	// #2939 AK5: schlägt das Abhaken fehl (Server-Guard, z. B. unvollständige Checkliste),
	// erscheint der Fehler-KolAlert (type=error) und der Zustand springt zurück — kein Toast.
	it('AK5: fehlgeschlagenes Abhaken zeigt Fehler-Alert und setzt den Zustand zurück', async () => {
		const checklist: ChecklistItem[] = [
			{ id: '44444444-4444-4444-8444-444444444444', title: 'Zahlen prüfen', completed: true },
			{ id: '55555555-5555-4555-8555-555555555555', title: 'Bericht lesen', completed: false },
		];
		getTaskMock.mockResolvedValue(sampleTask({ checklist }));
		updateTaskMock.mockRejectedValue(new Error('Server-Guard: Checkliste unvollständig'));
		renderView();

		expect(await screen.findByText('1 von 2')).toBeVisible();
		fireEvent.click(screen.getByRole('switch', { name: 'Bericht lesen' }));

		const alert = await screen.findByRole('alert');
		expect(alert).toBeVisible();
		expect(alert).toHaveAttribute('data-type', 'error');
		// Zustand zurück: Zähler unverändert, Haken wieder raus.
		expect(screen.getByText('1 von 2')).toBeVisible();
		expect(screen.getByRole('switch', { name: 'Bericht lesen' })).not.toBeChecked();
	});

	// #2939 AK5 (POST-Pfad): schlägt das Zurückstellen fehl, erscheint derselbe Fehler-Alert
	// und die Ansicht bleibt im offenen Zustand (Aktion erneut erreichbar).
	it('AK5: fehlgeschlagenes Zurückstellen zeigt den Fehler-Alert ohne Zustandswechsel', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		snoozeTaskMock.mockRejectedValue(new Error('Server-Guard'));
		renderView();

		const snooze = await screen.findByRole('button', { name: 'Kurz zurückstellen' });
		fireEvent.click(snooze);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('data-type', 'error');
		expect(screen.getByRole('button', { name: 'Kurz zurückstellen' })).toBeVisible();
	});
});
