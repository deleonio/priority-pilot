import type { Task, TaskTreeNode } from 'client';

interface ForestPanelProps {
	forest: TaskTreeNode[];
	/** Nächste wichtige Aufgabe (`GET /next`) oder `null`, falls keine ansteht. */
	nextTask: Task | null;
}

const formatNumber = (value: number): string => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** Rekursive Darstellung eines Baumknotens samt seiner abhängigen Tasks. */
const TreeNode = ({ node }: { node: TaskTreeNode }) => (
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
					<TreeNode key={child.id} node={child} />
				))}
			</ul>
		)}
	</li>
);

/**
 * Optionale Visualisierung: nach Wertbeitrag sortierter Aufgabenwald (`GET /forest`) und die
 * nächste wichtige Aufgabe (`GET /next`).
 */
export const ForestPanel = ({ forest, nextTask }: ForestPanelProps) => (
	<section className="forest-panel">
		<h2>Priorisierung</h2>
		<div className="next-task">
			<h3>Nächste Aufgabe</h3>
			{nextTask === null ? (
				<p>Aktuell steht keine Aufgabe an (alle erledigt oder durch offene Vorgänger blockiert).</p>
			) : (
				<p>
					<strong>
						#{nextTask.id} – {nextTask.title}
					</strong>{' '}
					(Priorität {nextTask.priority})
				</p>
			)}
		</div>
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
