import { KolButton, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { invertForest } from '../lib/invertForest';
import { isDoneBlockedBySubtasks } from '../lib/task';

interface TaskTreeProps {
	/** Aufgabenwald (`GET /forest`): Wurzeln und ihre `dependents` (Unteraufgaben). */
	forest: TaskTreeNode[];
	/** Alle Tasks, um zu einem Baumknoten den vollständigen Task für die Aktionen aufzulösen. */
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

interface TreeNodeProps {
	node: TaskTreeNode;
	expandedIds: Set<number>;
	onToggle: (id: number) => void;
	taskById: Map<number, Task>;
	progressMap: Map<number, { done: number; total: number }>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	onAddSubtask: (task: Task) => void;
	onDoneToggle: (task: Task) => Promise<void>;
	/** IDs des aktuellen Pfads — bricht bei einem (unerwarteten) Zyklus im Wald den Abstieg ab. */
	visited: Set<number>;
	/**
	 * Semantische Knoten je Task-ID aus dem **unveränderten** Wald. Im invertierten Anzeige-Wald
	 * enthält `node.dependents` die Oberaufgabe (Elternteil), nicht die Unteraufgaben — der Guard
	 * (`isDoneBlockedBySubtasks`) muss aber weiterhin auf den semantischen Unteraufgaben rechnen.
	 */
	semanticNodeById: Map<number, TaskTreeNode>;
}

const TreeNode = ({
	node,
	expandedIds,
	onToggle,
	taskById,
	progressMap,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onDoneToggle,
	visited,
	semanticNodeById,
}: TreeNodeProps) => {
	const [isUpdating, setIsUpdating] = useState(false);
	// #361: Die vier sekundären Aktionen liegen hinter einem „…"-Popover. KolPopoverButton regelt
	// Öffnen/Schließen, Click-outside, Escape und Fokusrückgabe über die native Popover-API selbst;
	// der Ref dient nur dazu, das Panel nach einer Aktion programmatisch zu schließen.
	const popoverRef = useRef<HTMLKolPopoverButtonElement | null>(null);

	if (visited.has(node.id)) {
		return null;
	}
	const hasChildren = node.dependents.length > 0;
	const expanded = expandedIds.has(node.id);
	const nextVisited = new Set(visited).add(node.id);
	const task = taskById.get(node.id) ?? null;
	const progress = progressMap.get(node.id);

	// Erledigt-Toggle-Guard (#315): der Toggle auf „Erledigt" ist gesperrt, solange nicht alle
	// direkten Unteraufgaben erledigt sind. Das Wieder-Öffnen bleibt jederzeit erlaubt.
	const semanticSubtasks = semanticNodeById.get(node.id)?.dependents ?? [];
	const directSubtaskStatuses = semanticSubtasks.map((d) => ({
		status: taskById.get(d.id)?.status ?? TaskStatus.Open,
	}));
	const doneBlocked = isDoneBlockedBySubtasks(directSubtaskStatuses);
	const isDone = task?.status === TaskStatus.Done;

	return (
		<li className="task-tree-item" data-testid={`task-tree-item-${node.id}`}>
			<div className="task-tree-row">
				{hasChildren ? (
					<KolButton
						className="task-tree-toggle"
						_label={expanded ? 'Zuklappen' : 'Aufklappen'}
						_hideLabel
						_ariaExpanded={expanded}
						_icons={{ left: { icon: expanded ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right' } }}
						_variant="secondary"
						_on={{ onClick: () => onToggle(node.id) }}
					/>
				) : (
					<span className="task-tree-toggle-placeholder" aria-hidden="true" />
				)}
				<span className="task-tree-title">{node.title}</span>
				{task !== null && task.seriesId != null && (
					<span className="task-tree-badge task-tree-badge--series">Serie</span>
				)}
				{task !== null && task.isException && (
					<span className="task-tree-badge task-tree-badge--exception">geändert</span>
				)}
				{progress !== undefined && (
					<span className="task-tree-badge task-tree-badge--progress">
						{progress.done}/{progress.total}
					</span>
				)}
				{task !== null && (
					<>
						<KolButton
							data-testid={`done-toggle-${task.id}`}
							_label={isDone ? 'Wieder öffnen' : 'Erledigen'}
							_hideLabel
							_icons={{ left: { icon: isDone ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check' } }}
							_variant={isDone ? 'secondary' : 'primary'}
							_disabled={isUpdating || (!isDone && doneBlocked)}
							// Der Gesperrt-Zustand muss für Tests/AT auch am Host sichtbar sein: Playwrights
							// `toBeDisabled()` wertet `aria-disabled` nur auf Elementen aus, die selbst eine
							// ARIA-Rolle aus seiner Allowlist tragen — der rollenlose `<kol-button>`-Host würde
							// ignoriert. `role="group"` ist ein nicht-interaktiver Container (der innere
							// Shadow-DOM-Button bleibt der einzige Button); die echte Sperre sitzt in `_disabled`.
							role="group"
							aria-disabled={isUpdating || (!isDone && doneBlocked) ? 'true' : 'false'}
							_on={{
								onClick: () => {
									setIsUpdating(true);
									void onDoneToggle(task).finally(() => setIsUpdating(false));
								},
							}}
						/>
						{!isDone && doneBlocked && (
							<span className="task-tree-done-blocked-hint" data-testid={`done-blocked-hint-${task.id}`}>
								Bitte erst alle Unteraufgaben erledigen
							</span>
						)}
					</>
				)}
				{task !== null && (
					<div className="task-tree-actions">
						<KolPopoverButton
							ref={popoverRef}
							className="task-tree-more"
							_label="Weitere Aktionen"
							_hideLabel
							_icons={{ left: { icon: 'fa-solid fa-ellipsis' } }}
							_variant="secondary"
							_popoverAlign="bottom"
						>
							<KolToolbar
								_label={`Aktionen für ${task.title}`}
								_orientation="horizontal"
								_items={[
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
												void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onDelete(task));
											},
										},
									},
								]}
							/>
						</KolPopoverButton>
					</div>
				)}
			</div>
			{hasChildren && (
				<ul className="task-tree-children" hidden={!expanded}>
					{node.dependents.map((child) => (
						<TreeNode
							key={child.id}
							node={child}
							expandedIds={expandedIds}
							onToggle={onToggle}
							taskById={taskById}
							progressMap={progressMap}
							onEdit={onEdit}
							onDelete={onDelete}
							onEditDependencies={onEditDependencies}
							onAddSubtask={onAddSubtask}
							onDoneToggle={onDoneToggle}
							visited={nextVisited}
							semanticNodeById={semanticNodeById}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

/**
 * Expandierbare Listendarstellung des Aufgabenwaldes (#238), die die frühere Tabelle im „Aufgaben"-
 * Tab ersetzt. Unteraufgaben (`dependents`) sind als DOM-Nachfahren des Elternteils verschachtelt und
 * standardmäßig eingeklappt (`hidden`); ein Aufklapp-Button je Knoten mit Unteraufgaben macht sie
 * sichtbar. Der Aufklapp-Zustand lebt lokal in dieser Komponente (`expandedIds`).
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
	const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set<number>());

	const onToggle = useCallback((id: number): void => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

	// Semantische Knoten je Task-ID aus dem unveränderten Wald: Der Guard braucht die echten
	// Unteraufgaben, während der invertierte Anzeige-Wald unter `dependents` die Oberaufgaben führt.
	const semanticNodeById = useMemo(() => {
		const map = new Map<number, TaskTreeNode>();
		const collect = (nodes: TaskTreeNode[]): void => {
			for (const node of nodes) {
				map.set(node.id, node);
				collect(node.dependents);
			}
		};
		collect(forest);
		return map;
	}, [forest]);

	// Anzeige-Wald in umgekehrter Leserichtung (#363): Unter-/Einzelaufgaben als Wurzeln, die
	// Oberaufgaben als aufklappbare Anzeige-Kinder darüber.
	const displayForest = useMemo(() => invertForest(forest), [forest]);

	if (forest.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	return (
		<ul className="task-tree" data-testid="task-tree">
			{displayForest.map((node) => (
				<TreeNode
					key={node.id}
					node={node}
					expandedIds={expandedIds}
					onToggle={onToggle}
					taskById={taskById}
					progressMap={progressMap}
					onEdit={onEdit}
					onDelete={onDelete}
					onEditDependencies={onEditDependencies}
					onAddSubtask={onAddSubtask}
					onDoneToggle={onDoneToggle}
					visited={new Set<number>()}
					semanticNodeById={semanticNodeById}
				/>
			))}
		</ul>
	);
};
