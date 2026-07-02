import { KolButton, KolToolbar } from '@public-ui/react-v19';
import type { Task, TaskTreeNode } from 'client';
import { useCallback, useMemo, useState } from 'react';

interface TaskTreeProps {
	/** Aufgabenwald (`GET /forest`): Wurzeln und ihre `dependents` (Unteraufgaben). */
	forest: TaskTreeNode[];
	/** Alle Tasks, um zu einem Baumknoten den vollständigen Task für die Aktionen aufzulösen. */
	tasks: Task[];
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
}

interface TreeNodeProps {
	node: TaskTreeNode;
	expandedIds: Set<number>;
	onToggle: (id: number) => void;
	taskById: Map<number, Task>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	onAddSubtask: (task: Task) => void;
	/** IDs des aktuellen Pfads — bricht bei einem (unerwarteten) Zyklus im Wald den Abstieg ab. */
	visited: Set<number>;
}

const TreeNode = ({
	node,
	expandedIds,
	onToggle,
	taskById,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	visited,
}: TreeNodeProps) => {
	if (visited.has(node.id)) {
		return null;
	}
	const hasChildren = node.dependents.length > 0;
	const expanded = expandedIds.has(node.id);
	const nextVisited = new Set(visited).add(node.id);
	const task = taskById.get(node.id) ?? null;

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
				{task !== null && (
					<div className="task-tree-actions">
						<KolButton
							className="task-tree-edit"
							_label="Bearbeiten"
							_variant="secondary"
							_on={{ onClick: () => onEdit(task) }}
						/>
						<KolToolbar
							_label={`Weitere Aktionen für ${task.title}`}
							_orientation="horizontal"
							_items={[
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
						/>
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
							onEdit={onEdit}
							onDelete={onDelete}
							onEditDependencies={onEditDependencies}
							onAddSubtask={onAddSubtask}
							visited={nextVisited}
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
export const TaskTree = ({ forest, tasks, onEdit, onDelete, onEditDependencies, onAddSubtask }: TaskTreeProps) => {
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

	if (forest.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	return (
		<ul className="task-tree" data-testid="task-tree">
			{forest.map((node) => (
				<TreeNode
					key={node.id}
					node={node}
					expandedIds={expandedIds}
					onToggle={onToggle}
					taskById={taskById}
					onEdit={onEdit}
					onDelete={onDelete}
					onEditDependencies={onEditDependencies}
					onAddSubtask={onAddSubtask}
					visited={new Set<number>()}
				/>
			))}
		</ul>
	);
};
