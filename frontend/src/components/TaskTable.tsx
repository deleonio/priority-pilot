import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolTableStateful, KolToolbar } from '@public-ui/react-v19';
import type { Task } from 'client';
import { memo } from 'react';
import type { DependencyRef } from '../lib/dependencies';
import { renderIntoCell } from '../lib/reactCellRoot';
import { seriesBadge } from '../lib/series';
import { formatDeadline, statusLabel } from '../lib/task';

interface TaskTableProps {
	tasks: Task[];
	/** Vorgänger je Task-ID (aus dem Aufgabenwald abgeleitet) — für die Spalte „Vorgänger". */
	dependencyMap: Map<number, DependencyRef[]>;
	/** Fortschritt (erledigt/gesamt) je Task-ID; fehlt der Eintrag, hat der Task keine Unter-Tasks. */
	progressMap?: Map<number, { done: number; total: number }>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
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
	/** Fortschritt „erledigt/gesamt" inkl. Unter-Tasks; leer, wenn der Task keine Unter-Tasks hat. */
	progress: string;
	/** Serien-Kennzeichnung (leer bei Einzelaufgaben) — markiert generierte Instanzen sichtbar (#142). */
	series: string;
	/** Referenz auf den Original-Task, damit die Aktions-Callbacks ihn erhalten. */
	_task: Task;
}

/**
 * Tabellarische Übersicht aller Tasks mit Aktionen je Zeile.
 *
 * `memo`, damit das Öffnen eines Dialogs (State-Änderung in `App`) die Tabelle NICHT neu rendert —
 * sonst würde `KolTableStateful` seine Zellen samt Toolbar neu aufbauen und der fokussierte
 * Auslöser-Button verlöre den Fokus (Voraussetzung: die Callback-Props sind in `App` stabil).
 */
export const TaskTable = memo((props: TaskTableProps) => {
	const { tasks, dependencyMap, progressMap, onEdit, onDelete, onEditDependencies, onAddSubtask } = props;
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
		progress: (() => {
			const p = progressMap?.get(task.id);
			return p ? `${p.done}/${p.total}` : '';
		})(),
		series: seriesBadge(task)?.label ?? '',
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
				{ key: 'series', label: 'Serie' },
				{ key: 'predecessors', label: 'Vorgänger' },
				{ key: 'progress', label: 'Fortschritt' },
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
