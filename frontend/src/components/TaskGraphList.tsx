import { KolBadge, KolButton, KolCard } from '@public-ui/react-v19';
import type { TaskGraphEdge, TaskGraphNode } from 'client';
import { useMemo } from 'react';
import { formatNumber } from '../lib/task';

interface TaskGraphListProps {
	nodes: TaskGraphNode[];
	edges: TaskGraphEdge[];
	/** Öffnet den Abhängigkeits-Dialog für die Aufgabe. `null`, wenn die Aufgabe nicht bedienbar ist. */
	onEditDependencies: ((taskId: number) => void) | null;
}

const STATUS_LABEL: Record<string, string> = {
	Open: 'Offen',
	'In process': 'In Arbeit',
	Done: 'Erledigt',
};

/** Eine Kantenbeziehung aus Sicht eines Knotens: Gegenüber + Gewicht der Kante. */
interface Relation {
	id: number;
	title: string;
	weight: number;
}

/**
 * Der Aufgabengraph als Liste — die inhaltsgleiche, bedienbare Fassung des Canvas.
 *
 * Der Canvas selbst ist für Screenreader ausgeblendet (SVG-Transformationen sind nicht sinnvoll
 * navigierbar), deshalb läuft die gesamte Tastatur- und Screenreader-Bedienung über diese Liste.
 * Sie steht immer im DOM, nur eingeklappt.
 *
 * Bewusst Karten statt `KolTableStateful`: fünf Spalten (Titel, Priorität, Wert, Vorgänger,
 * Nachfolger) erzwängen bei 375 px horizontales Scrollen — dieselbe Begründung, aus der die
 * Aufgabenliste (#238) keine Tabelle mehr ist.
 */
export const TaskGraphList = ({ nodes, edges, onEditDependencies }: TaskGraphListProps) => {
	const titleById = useMemo(() => new Map(nodes.map((node) => [node.id, node.title])), [nodes]);

	// Vorgänger („Hängt ab von") und Nachfolger („Ermöglicht") je Knoten aus der Kantenliste.
	const { predecessors, successors } = useMemo(() => {
		const predecessorsByNode = new Map<number, Relation[]>();
		const successorsByNode = new Map<number, Relation[]>();
		for (const edge of edges) {
			const fromTitle = titleById.get(edge.from);
			const toTitle = titleById.get(edge.to);
			if (fromTitle === undefined || toTitle === undefined) {
				continue;
			}
			predecessorsByNode.set(edge.to, [
				...(predecessorsByNode.get(edge.to) ?? []),
				{ id: edge.from, title: fromTitle, weight: edge.weight },
			]);
			successorsByNode.set(edge.from, [
				...(successorsByNode.get(edge.from) ?? []),
				{ id: edge.to, title: toTitle, weight: edge.weight },
			]);
		}
		return { predecessors: predecessorsByNode, successors: successorsByNode };
	}, [edges, titleById]);

	if (nodes.length === 0) {
		return <p>Keine offenen Aufgaben — es gibt nichts zu verknüpfen.</p>;
	}

	return (
		<ul className="task-graph-list">
			{nodes.map((node) => {
				const dependsOn = predecessors.get(node.id) ?? [];
				const enables = successors.get(node.id) ?? [];
				return (
					<li key={node.id} data-testid={`graph-list-item-${node.id}`}>
						<KolCard _label={`#${node.id} – ${node.title}`} _level={4}>
							<div className="task-graph-list-badges">
								<KolBadge _label={`Priorität ${node.priority}`} />
								<KolBadge _label={STATUS_LABEL[node.status] ?? node.status} />
							</div>
							<p className="task-graph-list-meta">
								Wert {formatNumber(node.value)} · Gesamtaufwand {formatNumber(node.totalEstimatedEffort)} Tage
								{node.progress ? ` · ${node.progress.done}/${node.progress.total} erledigt` : ''}
							</p>
							<p className="task-graph-list-group-title">Hängt ab von</p>
							{dependsOn.length === 0 ? (
								<p className="task-graph-list-empty">Keine Unteraufgaben.</p>
							) : (
								<ul>
									{dependsOn.map((relation) => (
										<li key={relation.id}>
											#{relation.id} – {relation.title} (Gewicht {formatNumber(relation.weight)})
										</li>
									))}
								</ul>
							)}
							<p className="task-graph-list-group-title">Ermöglicht</p>
							{enables.length === 0 ? (
								<p className="task-graph-list-empty">Keine übergeordnete Aufgabe.</p>
							) : (
								<ul>
									{enables.map((relation) => (
										<li key={relation.id}>
											#{relation.id} – {relation.title} (Gewicht {formatNumber(relation.weight)})
										</li>
									))}
								</ul>
							)}
							{onEditDependencies !== null && (
								<KolButton
									_label={`Abhängigkeiten bearbeiten: ${node.title}`}
									_variant="secondary"
									_on={{ onClick: () => onEditDependencies(node.id) }}
								/>
							)}
						</KolCard>
					</li>
				);
			})}
		</ul>
	);
};
