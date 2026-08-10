import { cleanup, render, screen } from '@testing-library/react';
import type { Task } from 'client';
import { TaskStatus } from 'client';
import type { DependencyRef } from '../lib/dependencies';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Roter Spec-Test für #531 (Frontend, AK6/T11) — Checklisten-Fortschritt in der TaskTable.
 *
 * Die Tabelle soll je Task den Fortschritt seiner Checkliste anzeigen (z. B. „2/5" = 2 von 5 Items
 * erledigt). Aktuell kennt `TaskRow` (`frontend/src/components/TaskTable.tsx`) kein davon abgeleitetes
 * Feld und `task.checklist` existiert im Client-Typ noch nicht → der Test ist rot, bis die Umsetzung
 * den Fortschritt in einer Spalte bzw. einem Zellwert ausgibt.
 *
 * KoliBri-Komponenten sind in jsdom nicht lauffähig (Custom Elements); `KolTableStateful` wird daher
 * durch eine native Tabelle ersetzt, die `_data`-Zeilen samt aller Feldwerte als Text rendert. So ist
 * der Fortschrittstext assertionsfähig, ohne die Web Component zu benötigen.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolTableStateful: ({ _data }: { _data?: Record<string, unknown>[] }) => (
		<table data-testid="task-table">
			<tbody>
				{(_data ?? []).map((row, i) => (
					<tr key={i} data-testid="task-row">
						{Object.values(row).map((value, j) => (
							<td key={j}>{String(value)}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	),
	KolToolbar: () => null,
}));

// renderIntoCell mountet in jsdom keine React-Root in eine Web-Component-Zelle → no-op.
vi.mock('../lib/reactCellRoot', () => ({
	renderIntoCell: () => {},
}));

vi.mock('../lib/series', () => ({
	seriesBadge: () => null,
}));

vi.mock('../lib/task', () => ({
	formatDeadline: () => '',
}));

import { TaskTable } from './TaskTable';

afterEach(() => {
	cleanup();
});

/**
 * Task-Fixture mit Checkliste (2 von 5 erledigt). `checklist` ist im Client-Typ noch nicht vorhanden,
 * daher der bewusste Cast (`as unknown as Task`) als einzige Typ-Grenze des TDD-Vertrags — hält den
 * Typecheck grün, bis die Umsetzung `checklist` zum Task-Schema hinzufügt.
 */
const taskWithChecklist = (): Task =>
	({
		id: 1,
		title: 'Deployment-Checkliste',
		status: TaskStatus.Open,
		priority: 3,
		estimatedEffort: 0.5,
		pillars: [],
		checklist: [
			{ id: 'u1', title: 'a', completed: true },
			{ id: 'u2', title: 'b', completed: true },
			{ id: 'u3', title: 'c', completed: false },
			{ id: 'u4', title: 'd', completed: false },
			{ id: 'u5', title: 'e', completed: false },
		],
	}) as unknown as Task;

const defaultProps = {
	dependencyMap: new Map<number, DependencyRef[]>(),
	onEdit: vi.fn(),
	onDelete: vi.fn(),
	onEditDependencies: vi.fn(),
	onAddSubtask: vi.fn(),
};

describe('TaskTable — Checklisten-Fortschritt (#531, AK6/T11)', () => {
	it('zeigt den Checklisten-Fortschritt als „2/5" (2 von 5 Items erledigt)', () => {
		render(<TaskTable tasks={[taskWithChecklist()]} {...defaultProps} />);

		expect(screen.getByTestId('task-table')).toBeInTheDocument();
		expect(screen.getByText('2/5')).toBeInTheDocument();
	});
});
