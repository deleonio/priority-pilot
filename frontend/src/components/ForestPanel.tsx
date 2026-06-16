import type { TaskTreeNode } from 'client';
import { formatNumber } from '../lib/task';

interface ForestPanelProps {
	forest: TaskTreeNode[];
}

/**
 * Rekursive Darstellung eines Baumknotens samt seiner abhängigen Tasks.
 *
 * `visited` reicht die IDs des aktuellen Pfads weiter und bricht bei einem (unerwarteten) Zyklus in
 * den Baumdaten ab, damit kein endloser Render-Loop entsteht.
 */
const TreeNode = ({ node, visited = new Set<number>() }: { node: TaskTreeNode; visited?: Set<number> }) => {
	if (visited.has(node.id)) {
		return null;
	}
	const nextVisited = new Set(visited).add(node.id);
	return (
		<li>
			<span className="tree-node-label">
				#{node.id} – {node.title}
			</span>
			<span className="tree-node-meta">
				(Priorität {node.priority}, Wert {formatNumber(node.value)}, Gesamtaufwand{' '}
				{formatNumber(node.totalEstimatedEffort)} Tage)
			</span>
			{node.dependents.length > 0 && (
				<ul>
					{node.dependents.map((child) => (
						<TreeNode key={child.id} node={child} visited={nextVisited} />
					))}
				</ul>
			)}
		</li>
	);
};

/**
 * Optionale Visualisierung: nach Wertbeitrag sortierter Aufgabenwald (`GET /forest`).
 *
 * Die nächste wichtige Aufgabe (`GET /next`) wird prominent im Dashboard angezeigt (siehe
 * `Dashboard`), daher konzentriert sich dieses Panel auf die Baumdarstellung.
 */
export const ForestPanel = ({ forest }: ForestPanelProps) => (
	<section className="forest-panel">
		<h2>Priorisierung</h2>
		<div className="forest">
			<h3>Aufgabenwald (nach Wert sortiert)</h3>
			{forest.length === 0 ? (
				<p>Keine offenen Aufgabenbäume vorhanden.</p>
			) : (
				<ul className="tree-root">
					{forest.map((node) => (
						<TreeNode key={node.id} node={node} />
					))}
				</ul>
			)}
		</div>
	</section>
);
