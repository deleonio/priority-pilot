import { KolAlert, KolButton, KolCard, KolDetails, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Task, TaskGraph } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { splitIntoTrees } from '../lib/graphLayout';
import { usePrefersReducedMotion } from '../lib/reducedMotion';
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
 *
 * Gezeigt wird genau ein zusammenhängender Baum (`splitIntoTrees`), durchblätterbar über
 * „Zurück"/„Vor". Aufgaben ohne Abhängigkeit erscheinen nicht — im Graphen wären sie ein Punkt ohne
 * Aussage. Eine Knotengrenze braucht es damit nicht mehr: die Blätterung begrenzt die Menge, und
 * ein angezeigter Baum ist immer vollständig.
 */
export const TaskGraphPanel = ({ tasks, onEditDependencies }: TaskGraphPanelProps) => {
	const [graph, setGraph] = useState<TaskGraph | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [treeIndex, setTreeIndex] = useState(0);
	const detailRef = useRef<HTMLDivElement | null>(null);
	const prefersReducedMotion = usePrefersReducedMotion();

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

	// Ein Baum je Seite: getrennte Abhängigkeitsketten nebeneinander waren als Fläche nicht lesbar.
	const trees = useMemo(() => (graph === null ? [] : splitIntoTrees(graph)), [graph]);
	// Nach einem Reload über `TASKS_CHANGED_EVENT` kann der bisher gezeigte Baum verschwunden sein.
	const currentIndex = trees.length === 0 ? 0 : Math.min(treeIndex, trees.length - 1);
	const visible = trees[currentIndex] ?? null;

	const showTree = useCallback((index: number): void => {
		// Auswahl gehört zum verlassenen Baum — sonst zeigt die Detailkarte einen unsichtbaren Knoten.
		setSelectedId(null);
		setTreeIndex(index);
	}, []);

	const selected = visible?.nodes.find((node) => node.id === selectedId) ?? null;

	// Ein Reload über `TASKS_CHANGED_EVENT` kann den ausgewählten Knoten entfernen, während der Baum
	// bestehen bleibt. Ohne Aufräumen bliebe `selectedId` gesetzt: der Canvas dimmt dann *alle*
	// Knoten (`isDimmed` prüft nur auf „irgendetwas ausgewählt"), die Detailkarte ist aber weg — ein
	// grauer Graph ohne erkennbaren Grund.
	useEffect(() => {
		if (selectedId !== null && visible !== null && selected === null) {
			setSelectedId(null);
		}
	}, [selectedId, visible, selected]);

	// Auf 375px liegt die Detailkarte unterhalb des Canvas und damit außerhalb des Sichtfelds: ein
	// Tipp auf einen Knoten sähe folgenlos aus. Deshalb wird sie in den Blick geholt — `block: 'nearest'`
	// scrollt nur so weit wie nötig, der Canvas bleibt mit im Bild.
	useEffect(() => {
		if (selected === null) {
			return;
		}
		detailRef.current?.scrollIntoView?.({
			block: 'nearest',
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
		});
	}, [selected?.id, prefersReducedMotion]);

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

			{/* Ohne Wrapper mit `role="alert"`: `kol-alert` setzt die Rolle bereits im Shadow DOM (`_alert`
			    ist standardmäßig an), ein zweiter Live-Bereich darüber ließe den Fehler doppelt ansagen. */}
			{error !== null && (
				<KolAlert _type="error" _label="Der Aufgabengraph konnte nicht geladen werden">
					<p>{error}</p>
					<KolButton _label="Erneut versuchen" _variant="primary" _on={{ onClick: () => void reload() }} />
				</KolAlert>
			)}

			{/* `_label` statt `aria-label`: KoliBri beschriftet den Spinner intern, ein `aria-label` am
			    Host ohne Rolle wird von Screenreadern nicht vorgelesen. */}
			{error === null && graph === null && <KolSpin _show _variant="cycle" _label="Graph wird geladen" />}

			{error === null && graph !== null && visible === null && (
				<KolCard _label="Noch keine verknüpften Aufgaben" _level={3}>
					<p>
						Der Graph zeigt Aufgaben, die voneinander abhängen. Verknüpfe im Tab „Aufgaben" zwei Aufgaben über
						„Abhängigkeiten" — danach steht hier der erste Baum.
					</p>
				</KolCard>
			)}

			{error === null && visible !== null && (
				<>
					<KolHeading _label="Abhängigkeitsgraph" _level={3} />

					<div className="task-graph-pager">
						<KolButton
							_label="Zurück"
							_variant="secondary"
							_disabled={currentIndex === 0}
							_on={{ onClick: () => showTree(currentIndex - 1) }}
						/>
						{/* `aria-live`: ohne Ansage bemerkt ein Screenreader den Wechsel nur an der Knotenliste. */}
						<p className="task-graph-pager__position" aria-live="polite">
							{`Baum ${currentIndex + 1} von ${trees.length}`}
						</p>
						<KolButton
							_label="Vor"
							_variant="secondary"
							_disabled={currentIndex >= trees.length - 1}
							_on={{ onClick: () => showTree(currentIndex + 1) }}
						/>
					</div>

					{/*
					 * Reihenfolge bewusst: Blätter-Leiste → Graph → Detail → Erklärungen. Die Legende stand
					 * früher als aufgeklappte Karte zwischen Leiste und Canvas und kostete auf dem 375px-
					 * Referenzviewport rund 150px, bevor überhaupt ein Knoten zu sehen war. Sie erklärt
					 * etwas, das man erst gesehen haben muss — also zugeklappt und unter den Graphen.
					 */}
					<TaskGraphCanvas
						nodes={visible.nodes}
						edges={visible.edges}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>

					<div ref={detailRef} className="task-graph-detail-anchor">
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
					</div>

					<div className="task-graph-aside">
						<KolDetails _label="Legende" _open={false}>
							<ul className="task-graph-legend">
								<li>Ein Pfeil zeigt von der Unteraufgabe nach unten auf die Aufgabe, die sie ermöglicht.</li>
								<li>Je dicker die Linie, desto stärker das Gewicht — die Zahl steht an der Linie.</li>
								<li>Jeder Knoten zeigt Nummer, Titel, Priorität, Wertbeitrag und Fortschritt.</li>
							</ul>
						</KolDetails>

						<KolDetails _label="Graph als Liste" _open={false}>
							<TaskGraphList nodes={visible.nodes} edges={visible.edges} onEditDependencies={editDependencies} />
						</KolDetails>
					</div>
				</>
			)}
		</section>
	);
};
