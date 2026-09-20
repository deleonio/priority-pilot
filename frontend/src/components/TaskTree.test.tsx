import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TaskTree } from './TaskTree';

/**
 * Test-Pflege #1345 (TF2): Erledigt-Guard, Label und die vier übrigen Toolbar-Aktionen für
 * eingeblendete Oberaufgaben (`TaskTree.tsx:110`, `doneToggleBlocked`). `KolToolbar`/
 * `KolPopoverButton` bleiben ohne lokalen Mock nicht hochgestufte Custom Elements (kein Klick auf
 * `_items`-Buttons möglich) — deshalb hier auf reale, klickbare Elemente reduziert; `KolBadge`/
 * `KolHeading` geben ihr `_label` als Text aus, damit Titel/Badges per `getByText` prüfbar sind.
 * `KolPopoverButton` forwarded den Ref mit einem `hidePopover`-Stub — der Löschen-Handler in
 * `TaskTree.tsx` ruft `popoverRef.current?.hidePopover().then(...)` auf; ohne Stub wäre
 * `.hidePopover()` `undefined` und `.then(...)` würfe eine TypeError.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolHeading: ({ _label }: { _label?: string }) => <h4>{_label}</h4>,
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolPopoverButton: forwardRef<{ hidePopover: () => Promise<void> }, { children?: React.ReactNode }>(
		({ children }, ref) => {
			if (ref !== null && typeof ref === 'object') {
				ref.current = { hidePopover: () => Promise.resolve() };
			}
			return <div>{children}</div>;
		},
	),
	KolToolbar: ({
		_items,
	}: {
		_items: {
			_label: string;
			_disabled?: boolean;
			_on?: { onClick?: () => void };
		}[];
	}) => (
		<div>
			{_items.map((item) => (
				<button key={item._label} disabled={item._disabled} onClick={() => item._on?.onClick?.()}>
					{item._label}
				</button>
			))}
		</div>
	),
}));

const node = (id: number, title: string, dependents: TaskTreeNode[] = []): TaskTreeNode => ({
	id,
	title,
	priority: 3,
	estimatedEffort: 1,
	totalEstimatedEffort: 1,
	value: 5,
	status: 'Open',
	dependents,
});

const task = (id: number, title: string, status: TaskStatus = TaskStatus.Open): Task => ({
	id,
	title,
	status,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pinned: false,
	pillars: [],
});

const baseProps = {
	tasks: [] as Task[],
	progressMap: new Map<number, { done: number; total: number }>(),
	onEdit: vi.fn(),
	onDelete: vi.fn(),
	onEditDependencies: vi.fn(),
	onAddSubtask: vi.fn(),
	onDoneToggle: vi.fn().mockResolvedValue(undefined),
};

describe('TaskTree — Erledigt-Guard für eingeblendete Oberaufgaben (#1345, TaskTree.tsx:110)', () => {
	it('AK6/AK7: Erledigt-Button ist disabled mit Label "Erledigt (Unteraufgaben offen)", solange eine Unteraufgabe offen ist', () => {
		const parent = node(1, 'Elternaufgabe', [node(2, 'Kind offen')]);
		render(
			<TaskTree
				{...baseProps}
				forest={[]}
				fullForest={[parent]}
				parentNodes={[parent]}
				tasks={[task(1, 'Elternaufgabe')]}
			/>,
		);

		const toggle = screen.getByRole('button', { name: 'Erledigt (Unteraufgaben offen)' });
		expect(toggle).toBeDisabled();
	});

	it('AK7: Erledigt-Button ist aktiv mit Label "Erledigt", wenn alle Unteraufgaben erledigt sind (5/5)', () => {
		const doneChildren = Array.from({ length: 5 }, (_, i) => ({
			...node(100 + i, `Kind ${i}`),
			status: TaskStatus.Done,
		}));
		const parent = node(1, 'Elternaufgabe', doneChildren);
		const progressMap = new Map([[1, { done: 5, total: 5 }]]);
		render(
			<TaskTree
				{...baseProps}
				forest={[]}
				fullForest={[parent]}
				parentNodes={[parent]}
				tasks={[task(1, 'Elternaufgabe')]}
				progressMap={progressMap}
			/>,
		);

		expect(screen.getByText('5/5')).toBeInTheDocument();
		const toggle = screen.getByRole('button', { name: 'Erledigt' });
		expect(toggle).not.toBeDisabled();
	});

	it('AK8: die vier übrigen Aktionen rufen ihren Handler mit der Oberaufgabe auf', async () => {
		const parent = node(1, 'Elternaufgabe', [node(2, 'Kind offen')]);
		const parentTask = task(1, 'Elternaufgabe');
		const onEdit = vi.fn();
		const onDelete = vi.fn();
		const onEditDependencies = vi.fn();
		const onAddSubtask = vi.fn();
		render(
			<TaskTree
				{...baseProps}
				forest={[]}
				fullForest={[parent]}
				parentNodes={[parent]}
				tasks={[parentTask]}
				onEdit={onEdit}
				onDelete={onDelete}
				onEditDependencies={onEditDependencies}
				onAddSubtask={onAddSubtask}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
		fireEvent.click(screen.getByRole('button', { name: 'Abhängigkeiten' }));
		fireEvent.click(screen.getByRole('button', { name: 'Unteraufgabe anlegen' }));
		fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

		// Die Handler hängen hinter `popoverRef.current?.hidePopover().then(...)` (Promise-Kette) —
		// erst nach dem Microtask-Flush aufgerufen.
		await waitFor(() => expect(onEdit).toHaveBeenCalledWith(parentTask));
		await waitFor(() => expect(onEditDependencies).toHaveBeenCalledWith(parentTask));
		await waitFor(() => expect(onAddSubtask).toHaveBeenCalledWith(parentTask));
		await waitFor(() => expect(onDelete).toHaveBeenCalledWith(parentTask));
	});
});

// ── #1465: Säulen-Badge statt des beschreibungs-getriebenen „Hinweis"-Badges (#1430) ────────

/**
 * #1465: Zahlt eine Aufgabe auf keine Säule ein (`pillars: []`), trägt ihre Zeile das Icon-Badge
 * „Keine Säulen-Gewichtung gesetzt" — sonst nicht. Die Beschreibung spielt keine Rolle mehr, das
 * „Hinweis"-Badge aus #1430 ist ersatzlos entfallen. Ohne angelegte Säulen bleibt das Badge aus,
 * sonst trüge es jede Zeile. Die übrigen Badges (hier: Priorität) bleiben unverändert.
 */
const pillar: Pillar = { id: 7, name: 'Körper', description: '', weight: 100 };

describe('TaskTree — Säulen-Badge für Aufgaben ohne Säulen-Gewichtung (#1465)', () => {
	it('Aufgabe ohne Säulen-Beitrag zeigt das Badge, Prioritäts-Badge bleibt', () => {
		const leaf = node(1, 'Aufgabe ohne Säule');
		render(
			<TaskTree
				{...baseProps}
				forest={[leaf]}
				fullForest={[leaf]}
				pillars={[pillar]}
				tasks={[{ ...task(1, 'Aufgabe ohne Säule'), description: 'Bitte Schlüssel mitnehmen' }]}
			/>,
		);

		expect(screen.getByTestId('pillar-missing-badge')).toBeInTheDocument();
		expect(screen.getByText('P3')).toBeInTheDocument();
		expect(screen.queryByText('Hinweis')).toBeNull();
	});

	it('Aufgabe mit Säulen-Beitrag zeigt kein Badge', () => {
		const leaf = node(1, 'Aufgabe mit Säule');
		render(
			<TaskTree
				{...baseProps}
				forest={[leaf]}
				fullForest={[leaf]}
				pillars={[pillar]}
				tasks={[{ ...task(1, 'Aufgabe mit Säule'), pillars: [{ pillarId: pillar.id, share: 100, confidence: 100 }] }]}
			/>,
		);

		expect(screen.queryByTestId('pillar-missing-badge')).toBeNull();
	});

	it('ohne angelegte Säulen bleibt das Badge aus', () => {
		const leaf = node(1, 'Aufgabe ohne Säule');
		render(<TaskTree {...baseProps} forest={[leaf]} fullForest={[leaf]} tasks={[task(1, 'Aufgabe ohne Säule')]} />);

		expect(screen.queryByTestId('pillar-missing-badge')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #1518 AK11 (Spec docs/spec/issue-1518.md, Journey 1): die Zeile einer
 * Serien-Instanz trägt ein Serien-Icon mit dem Screenreader-Text „Serienaufgabe" (`role="img"` +
 * `aria-label`, Muster `PillarMissingBadge`); das Text-Badge „Serie" existiert nicht mehr.
 */
describe('TaskTree — Serien-Icon statt Text-Badge (#1518)', () => {
	it('AK11: Serien-Instanz zeigt das Icon mit Screenreader-Text „Serienaufgabe", kein Text-Badge „Serie"', () => {
		const leaf = node(1, 'Täglich');
		render(
			<TaskTree {...baseProps} forest={[leaf]} fullForest={[leaf]} tasks={[{ ...task(1, 'Täglich'), seriesId: 7 }]} />,
		);

		expect(screen.getByRole('img', { name: 'Serienaufgabe' })).toBeInTheDocument();
		expect(screen.queryByText('Serie', { exact: true })).toBeNull();
	});

	it('AK11: Einzelaufgabe trägt kein Serien-Icon', () => {
		const leaf = node(1, 'Einzeln');
		render(<TaskTree {...baseProps} forest={[leaf]} fullForest={[leaf]} tasks={[task(1, 'Einzeln')]} />);

		expect(screen.queryByRole('img', { name: 'Serienaufgabe' })).toBeNull();
	});
});
