import {
	MarkerType,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	type Edge,
	type NodeMouseHandler,
} from '@xyflow/react';
// Bewusst nur `base.css`, nicht `style.css`: base.css enthält ausschließlich die für Viewport-
// Transform und Kanten-Rendering nötigen Regeln, kein Default-Theme. Damit kollidiert nichts mit
// `app.css`, und jeder sichtbare Wert kommt aus den `--pp-*`-Rollen.
import '@xyflow/react/dist/base.css';
import { KolToolbar } from '@public-ui/react-v19';
import type { TaskGraphEdge, TaskGraphNode } from 'client';
import { useMemo } from 'react';
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH } from '../lib/graphLayout';
import { usePrefersReducedMotion } from '../lib/reducedMotion';
import { formatNumber } from '../lib/task';
import { TaskGraphNodeCard, type TaskGraphFlowNode } from './TaskGraphNodeCard';

interface TaskGraphCanvasProps {
	nodes: TaskGraphNode[];
	edges: TaskGraphEdge[];
	/** Aktuell ausgewählter Knoten (`null` = keine Auswahl). */
	selectedId: number | null;
	onSelect: (id: number | null) => void;
}

const nodeTypes = { taskGraphNode: TaskGraphNodeCard };

/** Strichstärke aus dem Gewicht (0,1–1 ⇒ 1,3–4 px). Die Zahl steht zusätzlich am Kanten-Label. */
const strokeWidthOf = (weight: number): number => 1 + weight * 3;

const Viewport = ({ nodes, edges, selectedId, onSelect }: TaskGraphCanvasProps) => {
	const { fitView, zoomIn, zoomOut } = useReactFlow();
	const prefersReducedMotion = usePrefersReducedMotion();
	const animationDuration = prefersReducedMotion ? 0 : 200;

	const flowNodes = useMemo<TaskGraphFlowNode[]>(
		() =>
			layoutGraph(nodes, edges).map((positioned) => ({
				id: String(positioned.node.id),
				type: 'taskGraphNode' as const,
				position: { x: positioned.x, y: positioned.y },
				width: NODE_WIDTH,
				height: NODE_HEIGHT,
				data: {
					node: positioned.node,
					isSelected: positioned.node.id === selectedId,
					isDimmed: selectedId !== null && positioned.node.id !== selectedId,
				},
			})),
		[nodes, edges, selectedId],
	);

	const flowEdges = useMemo<Edge[]>(
		() =>
			edges.map((edge) => {
				const touchesSelection = selectedId !== null && (edge.from === selectedId || edge.to === selectedId);
				const dimmed = selectedId !== null && !touchesSelection;
				return {
					id: `${edge.from}-${edge.to}`,
					source: String(edge.from),
					target: String(edge.to),
					// Das Gewicht steht als Zahl an der Kante — die Strichstärke allein dürfte die
					// Information nicht tragen (WCAG 1.4.1).
					label: formatNumber(edge.weight),
					labelShowBg: true,
					className: `task-graph-edge${touchesSelection ? ' task-graph-edge--active' : ''}${
						dimmed ? ' task-graph-edge--dimmed' : ''
					}`,
					style: { strokeWidth: strokeWidthOf(edge.weight) + (touchesSelection ? 1 : 0) },
					markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
				};
			}),
		[edges, selectedId],
	);

	const handleNodeClick: NodeMouseHandler = (_event, node) => onSelect(Number(node.id));

	return (
		<>
			<KolToolbar
				_label="Ansicht des Aufgabengraphen"
				_orientation="horizontal"
				className="task-graph-toolbar"
				_items={[
					{
						type: 'button',
						_label: 'Ansicht einpassen',
						_variant: 'secondary',
						_on: { onClick: () => fitView({ duration: animationDuration }) },
					},
					{
						type: 'button',
						_label: 'Vergrößern',
						_variant: 'secondary',
						_on: { onClick: () => zoomIn({ duration: animationDuration }) },
					},
					{
						type: 'button',
						_label: 'Verkleinern',
						_variant: 'secondary',
						_on: { onClick: () => zoomOut({ duration: animationDuration }) },
					},
				]}
			/>
			{/*
			 * Für Screenreader ausgeblendet: ein Canvas aus SVG-Transformationen ist nicht sinnvoll
			 * navigierbar, eine halbe Tastaturbedienung wäre eine Fokusfalle. Die inhaltsgleiche,
			 * bedienbare Fassung steht direkt darunter als „Graph als Liste" (TaskGraphList).
			 */}
			<div className="task-graph-canvas" aria-hidden="true" data-testid="task-graph-canvas">
				<ReactFlow
					nodes={flowNodes}
					edges={flowEdges}
					nodeTypes={nodeTypes}
					proOptions={{ hideAttribution: true }}
					fitView
					minZoom={0.2}
					maxZoom={1.6}
					nodesDraggable={false}
					nodesConnectable={false}
					nodesFocusable={false}
					edgesFocusable={false}
					elementsSelectable={false}
					disableKeyboardA11y
					zoomOnDoubleClick={false}
					onlyRenderVisibleElements
					onNodeClick={handleNodeClick}
					onPaneClick={() => onSelect(null)}
				/>
			</div>
		</>
	);
};

/**
 * Canvas des Aufgabengraphen — der einzige Ort (neben dem Knoten-Renderer), an dem `@xyflow/react`
 * importiert wird. Unit-Tests des Panels mocken deshalb genau diese Datei bzw. das Paket.
 *
 * Die Zoom-Bedienung läuft über eine `KolToolbar` statt über die mitgelieferten xyflow-`Controls`:
 * deren Buttons sind rund 26 px groß und verfehlen die 44-px-Regel für Touch-Ziele.
 */
export const TaskGraphCanvas = (props: TaskGraphCanvasProps) => (
	<ReactFlowProvider>
		<Viewport {...props} />
	</ReactFlowProvider>
);
