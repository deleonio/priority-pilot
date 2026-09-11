import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { TaskGraphNode } from 'client';
import { formatNumber } from '../lib/task';

/** Nutzdaten je Graph-Knoten. Als `type` (nicht `interface`), weil xyflow `Record<string, unknown>` verlangt. */
type TaskGraphNodeData = {
	node: TaskGraphNode;
	/** Der Knoten ist ausgewählt — er und seine Kanten stehen im Vordergrund. */
	isSelected: boolean;
	/** Ein anderer Knoten ist ausgewählt: dieser tritt in den Hintergrund. */
	isDimmed: boolean;
};

export type TaskGraphFlowNode = Node<TaskGraphNodeData, 'taskGraphNode'>;

const STATUS_LABEL: Record<string, string> = {
	Open: 'Offen',
	'In process': 'In Arbeit',
	Done: 'Erledigt',
};

/** Priorität 1–5 auf drei Rollen-Stufen. Die Stufe steht immer auch als Text im Chip. */
const priorityLevel = (priority: number): 'high' | 'medium' | 'low' =>
	priority >= 4 ? 'high' : priority >= 2 ? 'medium' : 'low';

/**
 * Fortschritt in Prozent, hart auf 0..100 begrenzt. `total === 0` liefert 0 statt `NaN`; ein
 * `done > total` (erledigte Unteraufgaben fallen aus dem Graphen, gezählt werden sie weiter)
 * würde den Balken sonst über seine Spur hinausschieben.
 */
const progressPercent = (done: number, total: number): number =>
	total <= 0 ? 0 : Math.min(Math.max((done / total) * 100, 0), 100);

/**
 * Ein Knoten im Aufgabengraphen.
 *
 * Bewusst **ohne** `KolBadge`/`KolCard`: im Canvas stehen bis zu 60 Knoten gleichzeitig, und jede
 * KoliBri-Komponente ist ein eigenes Custom Element mit Shadow-DOM. Das kostet beim Zoomen und
 * Pannen spürbar Layout-Zeit und lässt die Knoten flackern. Die Ausnahme von der KoliBri-First-Regel
 * (`frontend/DESIGN.md`) bleibt auf die reine Canvas-Darstellung beschränkt — die inhaltsgleiche,
 * bedienbare Fassung in `TaskGraphList` nutzt durchgehend KoliBri-Komponenten.
 *
 * Farbe trägt hier nie allein Bedeutung: Priorität, Status und Fortschritt stehen als Text im Knoten.
 */
export const TaskGraphNodeCard = ({ data }: NodeProps<TaskGraphFlowNode>) => {
	const { node, isSelected, isDimmed } = data;
	const progress = node.progress;

	return (
		<div
			className={`task-graph-node task-graph-node--${priorityLevel(node.priority)}${
				isSelected ? ' task-graph-node--selected' : ''
			}${isDimmed ? ' task-graph-node--dimmed' : ''}`}
			data-testid={`graph-node-${node.id}`}
		>
			{/* Andockpunkte für die Kanten: oben mündet die Kante ein, unten geht sie ab.
			    Nicht verbindbar — Kanten entstehen ausschließlich über den Abhängigkeits-Dialog. */}
			<Handle type="target" position={Position.Top} isConnectable={false} />
			<div className="task-graph-node__head">
				<span className="task-graph-node__id">#{node.id}</span>
				<span className="task-graph-node__priority">P{node.priority}</span>
			</div>
			<p className="task-graph-node__title">{node.title}</p>
			<div className="task-graph-node__meta">
				<span>Wert {formatNumber(node.value)}</span>
				<span className="task-graph-node__status">{STATUS_LABEL[node.status] ?? node.status}</span>
			</div>
			{progress !== null && progress !== undefined && (
				<div className="task-graph-node__progress">
					<span>
						{progress.done}/{progress.total} erledigt
					</span>
					<span className="task-graph-node__progress-track" aria-hidden="true">
						<span
							className="task-graph-node__progress-fill"
							style={{ width: `${progressPercent(progress.done, progress.total)}%` }}
						/>
					</span>
				</div>
			)}
			<Handle type="source" position={Position.Bottom} isConnectable={false} />
		</div>
	);
};
