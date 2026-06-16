import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolTableStateful, KolToolbar } from '@public-ui/react-v19';
import type { Task } from 'client';
import type { DependencyRef } from '../lib/dependencies';
import { renderIntoCell } from '../lib/reactCellRoot';
import { formatDeadline, statusLabel } from '../lib/task';

interface TaskTableProps {
	tasks: Task[];
	/** Vorgänger je Task-ID (aus dem Aufgabenwald abgeleitet) — für die Spalte „Vorgänger". */
	dependencyMap: Map<number, DependencyRef[]>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
}

/** Eine Datenzeile der Tabelle. Numerische Spalten bleiben Zahlen (für korrekte Sortierung). */
interface TaskRow extends KoliBriTableDataType {
	id: number;
	title: string;
	status: string;
	priority: number;
	estimatedEffort: number;
	deadline: string;
	predecessors: number;
	/** Referenz auf den Original-Task, damit die Aktions-Callbacks ihn erhalten. */
	_task: Task;
}

/** Tabellarische Übersicht aller Tasks mit Aktionen je Zeile. */
export const TaskTable = ({ tasks, dependencyMap, onEdit, onDelete, onEditDependencies }: TaskTableProps) => {
	if (tasks.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	const data: TaskRow[] = tasks.map((task) => ({
		id: task.id,
		title: task.title,
		status: statusLabel(task.status),
		priority: task.priority,
		estimatedEffort: task.estimatedEffort,
		deadline: formatDeadline(task.deadline),
		predecessors: dependencyMap.get(task.id)?.length ?? 0,
		_task: task,
	}));

	const headers: { horizontal: KoliBriTableHeaderCellWithLogic[][] } = {
		horizontal: [
			[
				{ key: 'id', label: 'ID' },
				{ key: 'title', label: 'Titel' },
				{ key: 'status', label: 'Status' },
				{ key: 'priority', label: 'Priorität' },
				{ key: 'estimatedEffort', label: 'Aufwand (Tage)' },
				{ key: 'deadline', label: 'Deadline' },
				{ key: 'predecessors', label: 'Vorgänger' },
				{
					key: 'actions',
					label: 'Aktionen',
					// Feste Breite, damit die drei Icon-Buttons der Toolbar einzeilig bleiben (sonst Umbruch).
					width: 170,
					// Aktionen als `KolToolbar` (Pfeiltasten-Navigation, gruppierte Semantik). Da eine Web
					// Component nicht deklarativ in eine KoliBri-Zelle passt, wird sie über `render` in eine
					// pro Zelle gecachte React-Root gemountet (siehe reactCellRoot). Icon-Buttons mit
					// `_hideLabel` (Label bleibt aria-label + Tooltip). Die KolIcons-Font kennt keinen
					// Stift/Papierkorb → Zahnrad (Bearbeiten), Kette (Abhängigkeiten), Kreuz (Löschen).
					render: (domNode, _cell, tupel) => {
						const task = (tupel as TaskRow)._task;
						renderIntoCell(
							domNode,
							<KolToolbar
								_label={`Aktionen für ${task.title}`}
								_orientation="horizontal"
								_items={[
									{
										type: 'button',
										_label: 'Bearbeiten',
										_hideLabel: true,
										_icons: { left: { icon: 'kolicon-cogwheel' } },
										_variant: 'secondary',
										_on: { onClick: () => onEdit(task) },
									},
									{
										type: 'button',
										_label: 'Abhängigkeiten',
										_hideLabel: true,
										_icons: { left: { icon: 'kolicon-link' } },
										_variant: 'secondary',
										_on: { onClick: () => onEditDependencies(task) },
									},
									{
										type: 'button',
										_label: 'Löschen',
										_hideLabel: true,
										_icons: { left: { icon: 'kolicon-cross' } },
										_variant: 'danger',
										_on: { onClick: () => onDelete(task) },
									},
								]}
							/>,
						);
					},
				},
			],
		],
	};

	// `_fixedCols: [0, 1]` fixiert die letzte Spalte (Aktionen) beim horizontalen Scrollen.
	return <KolTableStateful _label="Liste aller Tasks" _data={data} _headers={headers} _fixedCols={[0, 1]} />;
};
