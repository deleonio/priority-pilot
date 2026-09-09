import { KolAlert, KolButton, KolCard, KolDetails, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Task, TaskGraph } from 'client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { MAX_GRAPH_NODES, selectTopNodes } from '../lib/graphLayout';
import { formatNumber } from '../lib/task';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';
import { TaskGraphCanvas } from './TaskGraphCanvas';
import { TaskGraphList } from './TaskGraphList';

interface TaskGraphPanelProps {
	/** Alle Aufgaben — zum Auflösen einer Knoten-ID auf den Task, den der Dialog erwartet. */
	tasks: Task[];
	onEditDependencies: (task: Task) => void;
}

/**
 * Tab „Wald": der Aufgabengraph mit gewichteten Abhängigkeitskanten.
 *
 * Löst die frühere `ForestPanel`-Baumdarstellung ab. Der Baum musste eine Aufgabe, die mehreren
 * übergeordneten Aufgaben zuarbeitet, mehrfach zeigen — im Graphen ist sie ein Knoten mit mehreren
 * Kanten. Und das Kantengewicht, das im Abhängigkeits-Dialog gesetzt wird, ist hier erstmals wieder
 * sichtbar (Strichstärke plus Zahl am Kanten-Label).
 *
 * **Ausnahme von der KoliBri-First-Regel (AGENTS.md, frontend/DESIGN.md):** Für die Canvas-Ebene
 * wird `@xyflow/react` (MIT) eingesetzt. KoliBri/KERN UX hat keine Graph- oder Diagramm-Komponente,
 * und ein pan- und zoombarer DAG mit Kanten-Routing, Viewport-Transform und Touch-Gesten wäre
 * handgerollt mehrere hundert Zeilen Eigenbau samt Fokus- und Gesten-Verwaltung — genau der
 * Wartungsaufwand, den das Minimalprinzip vermeiden soll. Die Bibliothek deckt ausschließlich die
 * visuelle Ebene ab: alle Bedienelemente (Zoom-Toolbar, Detailbereich, Aktionen) und die
 * barrierefreie Parallelansicht (`TaskGraphList`) bestehen weiterhin aus KoliBri-Komponenten.
 *
 * Die Daten holt das Panel selbst (`GET /graph`) statt über den App-weiten `reload()`: sonst zahlte
 * jeder Kaltstart einen zusätzlichen Request für einen Tab, den viele nie öffnen. Auf Änderungen am
 * Aufgabenbestand hört es über `TASKS_CHANGED_EVENT` (Muster `SeriesTab`, `NearbyCard`).
 */
export const TaskGraphPanel = ({ tasks, onEditDependencies }: TaskGraphPanelProps) => {
	const [graph, setGraph] = useState<TaskGraph | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);

	const reload = useCallback(async (signal?: AbortSignal): Promise<void> => {
		try {
			const loaded = await api.getGraph({ signal });
			setGraph(loaded);
			setError(null);
		} catch (reason) {
			if (signal?.aborted === true) {
				return;
			}
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void reload(controller.signal);
		return () => controller.abort();
	}, [reload]);

	useEffect(() => {
		const handleChanged = (): void => void reload();
		window.addEventListener(TASKS_CHANGED_EVENT, handleChanged);
		return () => window.removeEventListener(TASKS_CHANGED_EVENT, handleChanged);
	}, [reload]);

	// Escape hebt die Auswahl auf — dasselbe wie ein Klick auf die freie Fläche.
	useEffect(() => {
		if (selectedId === null) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') setSelectedId(null);
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [selectedId]);

	const visible = useMemo(() => (graph === null ? null : selectTopNodes(graph, MAX_GRAPH_NODES)), [graph]);
	const selected = visible?.nodes.find((node) => node.id === selectedId) ?? null;
	const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

	const editDependencies = useCallback(
		(taskId: number): void => {
			const task = taskById.get(taskId);
			if (task) onEditDependencies(task);
		},
		[taskById, onEditDependencies],
	);

	const relations = useMemo(() => {
		if (visible === null || selected === null) {
			return { dependsOn: [], enables: [] };
		}
		const titleOf = (id: number): string => visible.nodes.find((node) => node.id === id)?.title ?? `#${id}`;
		return {
			dependsOn: visible.edges
				.filter((edge) => edge.to === selected.id)
				.map((edge) => ({ id: edge.from, title: titleOf(edge.from), weight: edge.weight })),
			enables: visible.edges
				.filter((edge) => edge.from === selected.id)
				.map((edge) => ({ id: edge.to, title: titleOf(edge.to), weight: edge.weight })),
		};
	}, [visible, selected]);

	return (
		<section className="task-graph-panel">
			<KolHeading _label="Priorisierung" _level={2} />

			{error !== null && (
				<KolAlert _type="error" _label="Der Aufgabengraph konnte nicht geladen werden">
					<p>{error}</p>
					<KolButton _label="Erneut versuchen" _variant="primary" _on={{ onClick: () => void reload() }} />
				</KolAlert>
			)}

			{error === null && visible === null && <KolSpin _show _variant="cycle" aria-label="Graph wird geladen" />}

			{error === null && visible !== null && visible.nodes.length === 0 && (
				<KolCard _label="Keine offenen Aufgaben" _level={3}>
					<p>Sobald es offene Aufgaben mit Abhängigkeiten gibt, erscheinen sie hier als Graph.</p>
				</KolCard>
			)}

			{error === null && visible !== null && visible.nodes.length > 0 && (
				<>
					<KolHeading _label="Abhängigkeitsgraph" _level={3} />

					{graph !== null && graph.nodes.length > visible.nodes.length && (
						<KolAlert _type="info" _label="Ausschnitt">
							<p>
								Es werden die {visible.nodes.length} wertvollsten von {graph.nodes.length} Aufgaben angezeigt. Die
								vollständige Liste steht im Tab „Aufgaben".
							</p>
						</KolAlert>
					)}

					<KolCard _label="Legende" _level={4} className="task-graph-legend">
						<ul>
							<li>Ein Pfeil zeigt von der Unteraufgabe nach unten auf die Aufgabe, die sie ermöglicht.</li>
							<li>Je dicker die Linie, desto stärker das Gewicht — die Zahl steht an der Linie.</li>
							<li>Jeder Knoten zeigt Nummer, Titel, Priorität, Wertbeitrag und Fortschritt.</li>
						</ul>
					</KolCard>

					<TaskGraphCanvas
						nodes={visible.nodes}
						edges={visible.edges}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>

					{selected !== null && (
						<KolCard _label={`#${selected.id} – ${selected.title}`} _level={4} className="task-graph-detail">
							<p>
								Priorität {selected.priority} · Wert {formatNumber(selected.value)} · Gesamtaufwand{' '}
								{formatNumber(selected.totalEstimatedEffort)} Tage
							</p>
							{selected.progress && (
								<p>
									Fortschritt {selected.progress.done}/{selected.progress.total}. Gezählt werden auch erledigte
									Unteraufgaben, die im Graphen nicht mehr erscheinen.
								</p>
							)}
							<p>
								Hängt ab von:{' '}
								{relations.dependsOn.length === 0
									? 'nichts'
									: relations.dependsOn
											.map((relation) => `${relation.title} (${formatNumber(relation.weight)})`)
											.join(', ')}
							</p>
							<p>
								Ermöglicht:{' '}
								{relations.enables.length === 0
									? 'nichts'
									: relations.enables
											.map((relation) => `${relation.title} (${formatNumber(relation.weight)})`)
											.join(', ')}
							</p>
							{taskById.has(selected.id) && (
								<KolButton
									_label="Abhängigkeiten bearbeiten"
									_variant="primary"
									_on={{ onClick: () => editDependencies(selected.id) }}
								/>
							)}
						</KolCard>
					)}

					<KolDetails _label="Graph als Liste" _open={false}>
						<TaskGraphList nodes={visible.nodes} edges={visible.edges} onEditDependencies={editDependencies} />
					</KolDetails>
				</>
			)}
		</section>
	);
};
