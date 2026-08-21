import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolBadge, KolTableStateful, KolToolbar } from '@public-ui/react-v19';
import type { ChecklistItem, Task } from 'client';
import { memo } from 'react';
import type { DependencyRef } from '../lib/dependencies';
import { renderIntoCell } from '../lib/reactCellRoot';
import { seriesBadge } from '../lib/series';
import { formatDeadline } from '../lib/task';
import { priorityBadge } from '../lib/task';

interface TaskTableProps {
	tasks: Task[];
	/** Vorgänger je Task-ID (aus dem Aufgabenwald abgeleitet) — für die Spalte „Vorgänger". */
	dependencyMap: Map<number, DependencyRef[]>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
}

/**
 * Checklisten-Fortschritt als „erledigt/gesamt"-Text (z. B. „2/5", #531). Leer bei Tasks ohne
 * Einträge, damit die Spalte unauffällig bleibt. Lokal (nicht aus `lib/task`) gehalten, da der
 * Komponenten-Test `lib/task` stubt.
 */
const checklistProgress = (items: ChecklistItem[] | undefined): string => {
	if (items === undefined || items.length === 0) {
		return '';
	}
	return `${items.filter((item) => item.completed).length}/${items.length}`;
};

/** Eine Datenzeile der Tabelle. Numerische Spalten bleiben Zahlen (für korrekte Sortierung). */
interface TaskRow extends KoliBriTableDataType {
	id: number;
	title: string;
	status: string;
	priority: number;
	estimatedEffort: number;
	deadline: string;
	/** Checklisten-Fortschritt „erledigt/gesamt" (leer ohne Einträge, #531). */
	checklist: string;
	predecessors: number;
	/** Serien-Kennzeichnung (leer bei Einzelaufgaben) — markiert generierte Instanzen sichtbar (#142). */
	series: string;
	/** Referenz auf den Original-Task, damit die Aktions-Callbacks ihn erhalten. */
	_task: Task;
}

/** P2-2: Farb-Mapping für Prioritäts-Badges (analog URGENCY_COLOR im Dashboard). */
const PRIORITY_COLOR: Record<'info' | 'warning' | 'danger', string> = {
	info: '#005b99', // --kol-color-primary
	warning: '#c66a00', // --kol-color-warning
	danger: '#b42318', // --kol-color-danger (red)
};

/** Rendert die Priorität als farbigen Badge für die Tabellenzelle (P2-2). */
const renderPriorityBadge = (priority: number) => {
	const { label, type } = priorityBadge(priority);
	const color = PRIORITY_COLOR[type];
	return <KolBadge _label={label} _color={color} />;
};

/**
 * Tabellarische Übersicht aller Tasks mit Aktionen je Zeile.
 *
 * `memo`, damit das Öffnen eines Dialogs (State-Änderung in `App`) die Tabelle NICHT neu rendert —
 * sonst würde `KolTableStateful` seine Zellen samt Toolbar neu aufbauen und der fokussierte
 * Auslöser-Button verlöre den Fokus (Voraussetzung: die Callback-Props sind in `App` stabil).
 */
export const TaskTable = memo((props: TaskTableProps) => {
	const { tasks, dependencyMap, onEdit, onDelete, onEditDependencies, onAddSubtask } = props;
	if (tasks.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	const data: TaskRow[] = tasks.map((task) => ({
		id: task.id,
		title: task.title,
		status: task.status,
		priority: task.priority,
		estimatedEffort: task.estimatedEffort,
		deadline: formatDeadline(task.deadline),
		checklist: checklistProgress(task.checklist),
		predecessors: dependencyMap.get(task.id)?.length ?? 0,
		series: seriesBadge(task)?.label ?? '',
		_task: task,
	}));

	const headers: { horizontal: KoliBriTableHeaderCellWithLogic[][] } = {
		horizontal: [
			[
				{ key: 'id', label: 'ID' },
				{ key: 'title', label: 'Titel' },
				{ key: 'status', label: 'Status' },
				{
					key: 'priority',
					label: 'Priorität',
					render: (domNode, _cell, tupel) => {
						const priority = (tupel as TaskRow).priority;
						const badge = renderPriorityBadge(priority);
						// Über renderIntoCell wie bei der Toolbar-Spalte (reactCellRoot)
						renderIntoCell(domNode, badge);
					},
				},
				{ key: 'estimatedEffort', label: 'Aufwand (Tage)' },
				{ key: 'deadline', label: 'Deadline' },
				{ key: 'checklist', label: 'Checkliste' },
				{ key: 'series', label: 'Serie' },
				{ key: 'predecessors', label: 'Vorgänger' },
				{
					key: 'actions',
					label: 'Aktionen',
					// Feste Breite, damit die vier Icon-Buttons der Toolbar einzeilig bleiben (sonst Umbruch).
					width: 210,
					// Aktionen als `KolToolbar` (Pfeiltasten-Navigation, gruppierte Semantik). Da eine Web
					// Component nicht deklarativ in eine KoliBri-Zelle passt, wird sie über `render` in eine
					// pro Zelle gecachte React-Root gemountet (siehe reactCellRoot). Icon-Buttons mit
					// `_hideLabel` (Label bleibt aria-label + Tooltip). Die KolIcons-Font kennt keinen
					// Stift/Papierkorb → Zahnrad (Bearbeiten), Kette (Abhängigkeiten), Kreuz (Löschen);
					// für „Unteraufgabe anlegen" liefert die KolIcons-Font kein Plus → Font-Awesome-Plus.
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
										_label: 'Unteraufgabe anlegen',
										_hideLabel: true,
										_icons: { left: { icon: 'fa-solid fa-plus' } },
										_variant: 'secondary',
										_on: { onClick: () => onAddSubtask(task) },
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
});

TaskTable.displayName = 'TaskTable';
