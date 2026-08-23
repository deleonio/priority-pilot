import { KolBadge, KolCard, KolHeading } from '@public-ui/react-v19';
import type { TaskTreeNode } from 'client';
import { formatNumber } from '../lib/task';

interface ForestPanelProps {
	forest: TaskTreeNode[];
}

/**
 * Rekursive Darstellung eines Baumknotens samt seiner abhängigen Tasks.
 *
 * P2-5: Statt roher Textzeilen jetzt strukturierte Cards mit Badges für Priorität/Wert/Aufwand.
 * Bewusst kein `KolTree`/`KolTreeItem`: das sind Navigations-Bäume (`_href` ist Pflicht, `_label`
 * akzeptiert nur einen String und es gibt keinen Slot für Metadaten). Unser Baum ist read-only und
 * zeigt je Knoten zusätzliche Kennzahlen (Priorität, Wert, Gesamtaufwand) – das lässt sich nicht
 * sinnvoll auf die KoliBri-Tree-API abbilden, daher bleibt die Darstellung handgerollt, aber mit
 * KoliBri-Komponenten (KolCard, KolBadge, KolHeading) für visuelle Hierarchie.
 *
 * `visited` reicht die IDs des aktuellen Pfads weiter und bricht bei einem (unerwarteten) Zyklus in
 * den Baumdaten ab, damit kein endloser Render-Loop entsteht.
 */
const TreeNode = ({ node, visited = new Set<number>() }: { node: TaskTreeNode; visited?: Set<number> }) => {
	if (visited.has(node.id)) {
		return null;
	}
	const nextVisited = new Set(visited).add(node.id);
	// Tiefe = Anzahl der Vorgänger im Pfad (0 für Wurzel, 1+ für Kinder)
	const depth = visited.size;
	// Indentation: 24px pro Ebene (im 16-48px Spektrum, mittig für gute Lesbarkeit)
	const indent = depth * 24;

	// P2-5: Priority-Badge für den Knoten
	const priority = node.priority;
	const priorityType = priority >= 4 ? 'danger' : priority >= 2 ? 'warning' : 'info';
	const PRIORITY_COLOR: Record<'info' | 'warning' | 'danger', string> = {
		info: '#005b99',
		warning: '#c66a00',
		danger: '#b42318',
	};
	const priorityColor = PRIORITY_COLOR[priorityType];

	return (
		<li data-testid={`forest-node-${node.id}`} style={{ marginLeft: `${indent}px` }}>
			<KolCard _label={`Task #${node.id}`} _level={0} className="forest-node-card">
				<div className="forest-node-header">
					<KolHeading
						_label={`#${node.id} – ${node.title}`}
						_level={depth === 0 ? 3 : 4}
						className="forest-node-title"
					/>
					<KolBadge _label={`P${priority}`} _color={priorityColor} className="forest-node-priority" />
				</div>
				<div className="forest-node-meta">
					<span className="forest-node-meta-item">
						<strong>Wert:</strong> {formatNumber(node.value)}
					</span>
					<span className="forest-node-meta-item">
						<strong>Gesamtaufwand:</strong> {formatNumber(node.totalEstimatedEffort)} Tage
					</span>
				</div>
				{node.dependents.length > 0 && (
					<ul className="forest-node-children">
						{node.dependents.map((child) => (
							<TreeNode key={child.id} node={child} visited={nextVisited} />
						))}
					</ul>
				)}
			</KolCard>
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
		<KolHeading _label="Priorisierung" _level={2} />
		<div className="forest">
			{forest.length === 0 ? (
				<KolCard _label="Keine offenen Aufgabenbäume" _level={0}>
					<p>Keine offenen Aufgabenbäume vorhanden.</p>
				</KolCard>
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
