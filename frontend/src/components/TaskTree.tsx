import { KolBadge, KolHeading, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useEffect, useRef, useState } from 'react';
import { extractLeaves } from '../lib/extractLeaves';
import { GeoBadge } from './GeoBadge';
import { priorityBadge } from '../lib/task';
import { setupPopoverAlignment } from '../lib/popoverAlign';

interface TaskTreeProps {
	/** Aufgabenwald (`GET /forest`): Wurzeln und ihre `dependents` (Unteraufgaben). */
	forest: TaskTreeNode[];
	/** Alle Tasks, um zu einem Knoten den vollständigen Task für die Aktionen aufzulösen. */
	tasks: Task[];
	/** Fortschritt (erledigt/gesamt) je Task-ID; fehlt der Eintrag, hat der Task keine Unter-Tasks. */
	progressMap: Map<number, { done: number; total: number }>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
	/** Schaltet eine Aufgabe per binärem Toggle zwischen „Erledigt" und „Offen" um (#315). */
	onDoneToggle: (task: Task) => Promise<void>;
}

interface LeafItemProps {
	node: TaskTreeNode;
	taskById: Map<number, Task>;
	progressMap: Map<number, { done: number; total: number }>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	onAddSubtask: (task: Task) => void;
	onDoneToggle: (task: Task) => Promise<void>;
}

/**
 * Traversiert Shadow- und Light-DOM ab `el` nach unten und liefert das erste native `<button>`.
 * #361: Nach programmatischem `hidePopover()` gibt die native Popover-API den Fokus nicht an den
 * Invoker zurück (er wandert zu `document.body`). Wir fokussieren den inneren Button daher explizit,
 * damit das anschließend geöffnete Modal den korrekten Trigger für die Fokusrückgabe erfasst.
 */
const findInnerButton = (el: Element | null | undefined): HTMLElement | null => {
	if (el == null) return null;
	if (el instanceof HTMLButtonElement) return el;
	return findInnerButton(el.shadowRoot?.firstElementChild ?? el.firstElementChild);
};

const LeafItem = ({
	node,
	taskById,
	progressMap,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onDoneToggle,
}: LeafItemProps) => {
	const [isUpdating, setIsUpdating] = useState(false);
	// #361: Die vier sekundären Aktionen liegen hinter einem „…"-Popover. KolPopoverButton regelt
	// Öffnen/Schließen, Click-outside, Escape und Fokusrückgabe über die native Popover-API selbst;
	// der Ref dient nur dazu, das Panel nach einer Aktion programmatisch zu schließen.
	const popoverRef = useRef<HTMLKolPopoverButtonElement | null>(null);

	useEffect(() => setupPopoverAlignment(popoverRef.current), []);

	const task = taskById.get(node.id) ?? null;
	const progress = progressMap.get(node.id);
	// Blatt-Aufgaben haben per Definition keine Unteraufgaben (`dependents.length === 0`), somit ist
	// der frühere Guard `isDoneBlockedBySubtasks` (#315) hier obsolet — der Toggle ist stets frei.
	const isDone = task?.status === TaskStatus.Done;
	const doneToggleLabel = isDone ? 'Wieder öffnen' : 'Erledigt';
	const priority = task?.priority ?? 1;
	const priorityBadgeInfo = priorityBadge(priority);

	// P2-2: Farb-Mapping für Prioritäts-Badges (analog URGENCY_COLOR im Dashboard).
	const PRIORITY_COLOR: Record<'info' | 'warning' | 'danger', string> = {
		info: '#005b99', // --kol-color-primary
		warning: '#c66a00', // --kol-color-warning
		danger: '#b42318', // --kol-color-danger (red)
	};
	const priorityColor = PRIORITY_COLOR[priorityBadgeInfo.type];

	return (
		<li className="task-list-item" data-testid={`task-list-item-${node.id}`}>
			<div className="task-tree-row">
				<div className="task-tree-row-header">
					<KolHeading _label={node.title} _level={4} className="task-tree-title" />
				</div>
				<div className="task-tree-row-controls">
					<div className="task-tree-badges">
						{task !== null && task.seriesId != null && (
							<KolBadge _label="Serie" _color="#005b99" className="task-tree-badge" />
						)}
						{task !== null && task.isException && (
							<KolBadge _label="geändert" _color="#c66a00" className="task-tree-badge" />
						)}
						{progress !== undefined && (
							<KolBadge _label={`${progress.done}/${progress.total}`} _color="#2e7d32" className="task-tree-badge" />
						)}
						{task !== null && (
							<KolBadge
								_label={priorityBadgeInfo.label}
								_color={priorityColor}
								className="task-tree-badge task-tree-badge--priority"
							/>
						)}
						{task !== null && (task.latitude != null || task.address != null) && (
							<GeoBadge latitude={task.latitude ?? null} longitude={task.longitude ?? null} address={task.address} />
						)}
					</div>
					{task !== null && (
						<div className="task-tree-actions">
							<KolPopoverButton
								ref={popoverRef}
								className="task-tree-more"
								_label="Weitere Aktionen"
								_hideLabel
								_icons={{ left: { icon: 'fa-solid fa-ellipsis' } }}
								_variant="secondary"
								_popoverAlign="left"
							>
								<KolToolbar
									_label={`Aktionen für ${task.title}`}
									_orientation="horizontal"
									_items={[
										{
											// #387: Der binäre Erledigt-Toggle (#315) liegt als erstes Toolbar-Item hinter dem
											// „…"-Popover, statt direkt in der Zeile. Bewusst KEIN `hidePopover()` im onClick, damit
											// mehrfaches Umschalten ohne Neuöffnen des Menüs möglich bleibt.
											type: 'button',
											_label: doneToggleLabel,
											_hideLabel: true,
											_icons: { left: { icon: isDone ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check' } },
											_variant: isDone ? 'secondary' : 'primary',
											_disabled: isUpdating,
											_on: {
												onClick: () => {
													setIsUpdating(true);
													void onDoneToggle(task).finally(() => setIsUpdating(false));
												},
											},
										},
										{
											type: 'button',
											_label: 'Bearbeiten',
											_hideLabel: true,
											_icons: { left: { icon: 'fa-solid fa-pen' } },
											_variant: 'secondary',
											_on: {
												onClick: () => {
													void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onEdit(task));
												},
											},
										},
										{
											type: 'button',
											_label: 'Abhängigkeiten',
											_hideLabel: true,
											_icons: { left: { icon: 'kolicon-link' } },
											_variant: 'secondary',
											_on: {
												onClick: () => {
													void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onEditDependencies(task));
												},
											},
										},
										{
											type: 'button',
											_label: 'Unteraufgabe anlegen',
											_hideLabel: true,
											_icons: { left: { icon: 'fa-solid fa-plus' } },
											_variant: 'secondary',
											_on: {
												onClick: () => {
													void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onAddSubtask(task));
												},
											},
										},
										{
											type: 'button',
											_label: 'Löschen',
											_hideLabel: true,
											_icons: { left: { icon: 'kolicon-cross' } },
											_variant: 'danger',
											_on: {
												onClick: () => {
													void popoverRef.current?.hidePopover().then(() => {
														findInnerButton(popoverRef.current)?.focus();
														onDelete(task);
													});
												},
											},
										},
									]}
								/>
							</KolPopoverButton>
						</div>
					)}
				</div>
			</div>
		</li>
	);
};

/**
 * Flache Listendarstellung ausschließlich der Blatt-Aufgaben (#537): Statt den Aufgabenwald als
 * aufklappbaren Baum (`invertForest`, #363) zu zeigen, werden nur noch die ausführbaren Blatt-Tasks
 * (`dependents.length === 0`) als einfache Liste gerendert — ohne Baumstruktur, ohne
 * Aufklappfunktionalität, sortiert nach Wertbeitrag absteigend. Oberaufgaben bleiben über das
 * ForestPanel (Tab 3) verwaltbar.
 */
export const TaskTree = ({
	forest,
	tasks,
	progressMap,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onDoneToggle,
}: TaskTreeProps) => {
	const taskById = new Map(tasks.map((task) => [task.id, task]));

	// Anzuzeigende Blatt-Aufgaben aus dem originalen `/forest`-Wald extrahieren (nicht invertieren).
	const leaves = extractLeaves(forest);

	if (leaves.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	return (
		<ul className="task-list" data-testid="task-list">
			{leaves.map((node) => (
				<LeafItem
					key={node.id}
					node={node}
					taskById={taskById}
					progressMap={progressMap}
					onEdit={onEdit}
					onDelete={onDelete}
					onEditDependencies={onEditDependencies}
					onAddSubtask={onAddSubtask}
					onDoneToggle={onDoneToggle}
				/>
			))}
		</ul>
	);
};
