import { KolButton, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Traversiert Shadow- und Light-DOM ab `el` nach unten und liefert das erste native `<button>`.
 * #361: Nach programmatischem `hidePopover()` gibt die native Popover-API den Fokus nicht an den
 * Invoker zurück (er wandert zu `document.body`). Wir fokussieren den inneren Button daher explizit,
 * damit das anschließend geöffnete Modal den korrekten Trigger für die Fokusrückgabe erfasst.
 */
const findInnerButton = (el: Element | null | undefined): HTMLElement | null => {
	if (el == null) return null;
	if (el instanceof HTMLButtonElement) return el;
	return findInnerButton(el.shadowRoot?.firstElementChild ?? el.firstElementChild);
};

/**
 * #369/#380: Das Panel (`.kol-popover-button__popover`) liegt im offenen Shadow-DOM von
 * `kol-popover-button` und ist damit von außen per CSS nicht erreichbar (kein `::part`).
 * `_popoverAlign="left"` lässt floating-ui das Panel links neben dem Trigger platzieren.
 * Die CSS-Shrink-to-fit-Breite bemisst sich am verfügbaren Platz; `width: max-content`
 * erzwingt die inhaltsbasierte Breite (alle 4 Aktionen in einer Zeile), unabhängig vom
 * verfügbaren Platz. Überschreitet das Panel den rechten Viewport-Rand, korrigiert
 * `correct()` `left` um den Überlauf (funktioniert, da KoliBri keinen MutationObserver
 * auf Panel-Style-Änderungen setzt — nur ResizeObserver/Scroll/Resize via autoUpdate).
 * Alle Shadow-DOM-Zugriffe sind unpublizierte KoliBri-API (@public-ui/react-v19 v4.2.1) —
 * bei KoliBri-Upgrades prüfen.
 */
const alignPopoverPanelLeft = (host: HTMLKolPopoverButtonElement): (() => void) => {
	const root = host.shadowRoot;
	if (!root) return () => {};

	const correct = () => {
		const panel = root.querySelector<HTMLElement>('.kol-popover-button__popover');
		if (!panel) return;
		if (panel.style.width !== 'max-content') {
			panel.style.width = 'max-content';
		}
		const rect = panel.getBoundingClientRect();
		if (rect.width === 0) return; // Panel versteckt (display:none) — DOM-Writes und Reflow sparen
		const overflow = Math.ceil(rect.right) - window.innerWidth;
		if (overflow > 0) {
			const newLeft = `${Math.round((parseFloat(panel.style.left) || 0) - overflow)}px`;
			if (panel.style.left !== newLeft) {
				panel.style.left = newLeft;
			}
		}
	};

	let panelObs: MutationObserver | null = null;

	const watchPanel = () => {
		const panel = root.querySelector<HTMLElement>('.kol-popover-button__popover');
		if (!panel) {
			panelObs?.disconnect();
			panelObs = null;
			return;
		}
		if (panelObs) return; // Observer läuft bereits — unnötiges Recycling vermeiden
		correct();
		panelObs = new MutationObserver(correct);
		panelObs.observe(panel, { attributes: true, attributeFilter: ['style'] });
	};

	const rootObs = new MutationObserver(watchPanel);
	rootObs.observe(root, { childList: true, subtree: true });

	const onResize = () => requestAnimationFrame(correct);
	window.addEventListener('resize', onResize);

	return () => {
		rootObs.disconnect();
		panelObs?.disconnect();
		window.removeEventListener('resize', onResize);
	};
};

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

	useEffect(() => {
		const host = popoverRef.current;
		if (!host) return;
		let cleanup: () => void = () => {};
		const setup = () => {
			cleanup = alignPopoverPanelLeft(host);
		};
		// KoliBri-Custom-Elements werden asynchron aufgewertet — shadowRoot ist bei schnellem
		// Mount u. U. noch null. Wir warten ggf. auf die Custom-Element-Definition.
		if (host.shadowRoot) {
			setup();
		} else {
			void customElements.whenDefined('kol-popover-button').then(() => {
				if (host.isConnected) setup();
			});
		}
		return () => cleanup();
	}, []);

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
	// Der Sperrgrund steht nur noch im (per `_hideLabel` visuell verborgenen) Button-Label, nicht
	// mehr als eigener sichtbarer Hinweistext daneben — vermeidet redundante Doppel-Anzeige.
	const doneToggleLabel = isDone
		? 'Wieder öffnen'
		: doneBlocked
			? 'Erledigt (bitte erst alle Unteraufgaben erledigen)'
			: 'Erledigt';

	return (
		<li className="task-tree-item" data-testid={`task-tree-item-${node.id}`}>
			<div className="task-tree-row">
				<div className="task-tree-row-header">
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
				</div>
				<div className="task-tree-row-controls">
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
						<div className="task-tree-actions">
							<KolPopoverButton
								ref={popoverRef}
								className="task-tree-more"
								_label="Weitere Aktionen"
								_hideLabel
								_icons={{ left: { icon: 'fa-solid fa-ellipsis' } }}
								_variant="secondary"
								_popoverAlign="left"
							>
								<KolToolbar
									_label={`Aktionen für ${task.title}`}
									_orientation="horizontal"
									_items={[
										{
											// #387: Der binäre Erledigt-Toggle (#315) liegt als erstes Toolbar-Item hinter dem
											// „…"-Popover, statt direkt in der Zeile. Bewusst KEIN `hidePopover()` im onClick, damit
											// mehrfaches Umschalten ohne Neuöffnen des Menüs möglich bleibt.
											type: 'button',
											_label: doneToggleLabel,
											_hideLabel: true,
											_icons: { left: { icon: isDone ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check' } },
											// secondary (Outline) auch bei doneBlocked: visuelles Feedback für gesperrten Zustand
											_variant: isDone || doneBlocked ? 'secondary' : 'primary',
											_disabled: isUpdating || (!isDone && doneBlocked),
											_on: {
												onClick: () => {
													setIsUpdating(true);
													void onDoneToggle(task).finally(() => setIsUpdating(false));
												},
											},
										},
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
													void popoverRef.current?.hidePopover().then(() => {
														findInnerButton(popoverRef.current)?.focus();
														onDelete(task);
													});
												},
											},
										},
									]}
								/>
							</KolPopoverButton>
						</div>
					)}
				</div>
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
