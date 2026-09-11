import { KolBadge, KolHeading, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Category, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useEffect, useRef, useState } from 'react';
import { extractLeaves } from '../lib/extractLeaves';
import { CategoryBadge } from './CategoryBadge';
import { GeoBadge } from './GeoBadge';
import { isDoneBlockedBySubtasks, priorityBadge } from '../lib/task';
import { sortTasksByBalance, virtualPriorityLabel, type BalancePriority } from '../lib/balancePriority';
import { setupPopoverAlignment } from '../lib/popoverAlign';

interface TaskTreeProps {
	/** Aufgabenwald (`GET /forest`), ggf. bereits gefiltert (`filterForest`): Wurzeln und ihre `dependents` (Unteraufgaben). */
	forest: TaskTreeNode[];
	/**
	 * Der ORIGINALE, ungefilterte Aufgabenwald (#1345): Grundlage für den Erledigt-Guard. Eine
	 * Oberaufgabe kann durch `filterForest`s Kontextpfad-Erhalt mit geleerten `dependents` in `forest`
	 * ankommen und faelschlich wie ein Blatt aussehen — der Guard muss deshalb immer den Original-
	 * Knoten (per ID) nachschlagen, unabhaengig vom aktiven Filter.
	 */
	fullForest: TaskTreeNode[];
	/**
	 * Zusaetzlich einzublendende Oberaufgaben (#1345, Schalter „Oberaufgaben anzeigen"), bereits nach
	 * Titel/Kategorie gefiltert und auf offene Unteraufgaben eingegrenzt. Leer, wenn der Schalter aus
	 * ist.
	 */
	parentNodes?: TaskTreeNode[];
	/** Alle Tasks, um zu einem Knoten den vollständigen Task für die Aktionen aufzulösen. */
	tasks: Task[];
	/** Fortschritt (erledigt/gesamt) je Task-ID; fehlt der Eintrag, hat der Task keine Unter-Tasks. */
	progressMap: Map<number, { done: number; total: number }>;
	/**
	 * ID des angemeldeten Kontos (#1213): unterscheidet „Erstellt von: …" (Aufgabe eines anderen
	 * für mich) von selbst angelegten Aufgaben. `null`, wenn unbekannt — dann kein Ersteller-Hinweis.
	 */
	userId?: number | null;
	/** Kategorien des Nutzers — löst die `categoryId` einer Aufgabe zum Badge auf. */
	categories?: Category[];
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
	/** Schaltet eine Aufgabe per binärem Toggle zwischen „Erledigt" und „Offen" um (#315). */
	onDoneToggle: (task: Task) => Promise<void>;
	/**
	 * Virtuelle Balance-Prioritäten je Task-ID. `null`/leer → originale Wertbeitrags-Sortierung und
	 * `P{n}`-Badges; gesetzt → Liste nach Balance-Score sortiert, Badges als `~P{n}`.
	 */
	balancePriorities?: ReadonlyMap<number, BalancePriority> | null;
}

interface LeafItemProps {
	node: TaskTreeNode;
	taskById: Map<number, Task>;
	progressMap: Map<number, { done: number; total: number }>;
	/** Hat der Knoten im ungefilterten Wald mindestens eine offene Unteraufgabe (#1345, AK6)? */
	hasOpenSubtasks: boolean;
	userId: number | null;
	/** Kategorien des Nutzers — löst die `categoryId` der Aufgabe zum Badge auf. */
	categories: Category[];
	/** Virtuelle Balance-Priorität dieses Tasks; `null` → Original-P-Badge. */
	balancePriority?: BalancePriority | null;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	onAddSubtask: (task: Task) => void;
	onDoneToggle: (task: Task) => Promise<void>;
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

const LeafItem = ({
	node,
	taskById,
	progressMap,
	hasOpenSubtasks,
	userId,
	categories,
	balancePriority,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onDoneToggle,
}: LeafItemProps) => {
	const [isUpdating, setIsUpdating] = useState(false);
	// #361: Die vier sekundären Aktionen liegen hinter einem „…"-Popover. KolPopoverButton regelt
	// Öffnen/Schließen, Click-outside, Escape und Fokusrückgabe über die native Popover-API selbst;
	// der Ref dient nur dazu, das Panel nach einer Aktion programmatisch zu schließen.
	const popoverRef = useRef<HTMLKolPopoverButtonElement | null>(null);

	useEffect(() => setupPopoverAlignment(popoverRef.current), []);

	const task = taskById.get(node.id) ?? null;
	const progress = progressMap.get(node.id);
	const isDone = task?.status === TaskStatus.Done;
	// #1345 AK6/AK7: eine Oberaufgabe mit offener Unteraufgabe darf nicht direkt auf „Erledigt"
	// geschaltet werden (Guard `isDoneBlockedBySubtasks`, #315); Wiedereröffnen bleibt frei.
	const doneToggleBlocked = !isDone && hasOpenSubtasks;
	const doneToggleLabel = isDone ? 'Wieder öffnen' : doneToggleBlocked ? 'Erledigt (Unteraufgaben offen)' : 'Erledigt';
	const priority = task?.priority ?? 1;
	// Im Balance-Modus zeigt das Badge die virtuelle Priorität (~P{n}, eigene Farbe nach Stufe)
	// statt der Server-Prio — unterscheidbar per Tilde-Präfix, nie nur per Farbe (KI-UX).
	const priorityBadgeInfo = priorityBadge(balancePriority?.virtualPriority ?? priority);
	const priorityBadgeLabel =
		balancePriority != null ? virtualPriorityLabel(balancePriority.virtualPriority) : priorityBadgeInfo.label;
	// #1213: Ersteller-Sicht auf eine abgegebene Aufgabe — lesbar, aber ohne Schreibrechte (AK5).
	// Die Aktionen werden ausgeblendet statt anklickbar angeboten, sonst endet jede Aktion in 404.
	const handedOff = task?.forUserId != null;

	// P2-2: Farb-Mapping für Prioritäts-Badges (analog URGENCY_COLOR im Dashboard).
	const PRIORITY_COLOR: Record<'info' | 'warning' | 'danger', string> = {
		info: '#005b99', // --kol-color-primary
		warning: '#c66a00', // --kol-color-warning
		danger: '#b42318', // --kol-color-danger (red)
	};
	const priorityColor = PRIORITY_COLOR[priorityBadgeInfo.type];

	return (
		<li className="task-list-item" data-testid={`task-list-item-${node.id}`}>
			<div className="task-tree-row">
				<div className="task-tree-row-header">
					<KolHeading _label={node.title} _level={4} className="task-tree-title" />
					{task !== null && (task.latitude != null || task.address != null) && (
						<>
							{/* geschütztes Leerzeichen (U+00A0): Titel + Globus-Icon sind eine Einheit (#1121). */}
							{'\u00a0'}
							<GeoBadge latitude={task.latitude ?? null} longitude={task.longitude ?? null} address={task.address} />
						</>
					)}
				</div>
				<div className="task-tree-row-controls">
					<div className="task-tree-badges">
						{/* #1213: Provenienz-Hinweise als Text-Badge (KI-UX: nie nur Farbe, muted ohne
						    weiteren Hex-Wert; umbrechfähig über die bestehende Badge-Zeile). „Für: …"
						    sieht der Ersteller, „Erstellt von: …" der Empfänger. */}
						{task !== null && task.forUserName != null && (
							<KolBadge _label={`Für: ${task.forUserName}`} className="task-tree-badge task-tree-badge--provenance" />
						)}
						{task !== null && task.forUserName == null && task.createdByName != null && task.createdById !== userId && (
							<KolBadge
								_label={`Erstellt von: ${task.createdByName}`}
								className="task-tree-badge task-tree-badge--provenance"
							/>
						)}
						<CategoryBadge category={categories.find((category) => category.id === node.categoryId)} />
						{task !== null && task.seriesId != null && (
							<KolBadge _label="Serie" _color="#005b99" className="task-tree-badge" />
						)}
						{task !== null && task.isException && (
							<KolBadge _label="geändert" _color="#c66a00" className="task-tree-badge" />
						)}
						{progress !== undefined && (
							<KolBadge _label={`${progress.done}/${progress.total}`} _color="#2e7d32" className="task-tree-badge" />
						)}
						{task !== null && (
							<KolBadge
								_label={priorityBadgeLabel}
								_color={priorityColor}
								className="task-tree-badge task-tree-badge--priority"
							/>
						)}
					</div>
					{task !== null && !handedOff && (
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
											_variant: isDone ? 'secondary' : 'primary',
											_disabled: isUpdating || doneToggleBlocked,
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
		</li>
	);
};

/**
 * Indexiert einen Aufgabenwald nach ID (#1345) — Grundlage für den Erledigt-Guard, der pro
 * gerenderter Zeile den ORIGINAL-Knoten (mit ungefilterten `dependents`) nachschlagen muss.
 */
const indexById = (forest: TaskTreeNode[]): Map<number, TaskTreeNode> => {
	const byId = new Map<number, TaskTreeNode>();

	const visit = (node: TaskTreeNode): void => {
		if (byId.has(node.id)) return;
		byId.set(node.id, node);
		node.dependents.forEach(visit);
	};
	forest.forEach(visit);

	return byId;
};

/**
 * Flache Listendarstellung ausschließlich der Blatt-Aufgaben (#537): Statt den Aufgabenwald als
 * aufklappbaren Baum (`invertForest`, #363) zu zeigen, werden nur noch die ausführbaren Blatt-Tasks
 * (`dependents.length === 0`) als einfache Liste gerendert — ohne Baumstruktur, ohne
 * Aufklappfunktionalität, sortiert nach Wertbeitrag absteigend. Oberaufgaben bleiben über das
 * ForestPanel (Tab 3) verwaltbar; optional (`parentNodes`, #1345) mischt die Liste zusätzlich
 * offene Oberaufgaben ein.
 */
export const TaskTree = ({
	forest,
	fullForest,
	parentNodes = [],
	tasks,
	progressMap,
	userId = null,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onDoneToggle,
	categories = [],
	balancePriorities = null,
}: TaskTreeProps) => {
	const taskById = new Map(tasks.map((task) => [task.id, task]));
	const fullForestById = indexById(fullForest);

	// Anzuzeigende Blatt-Aufgaben aus dem originalen `/forest`-Wald extrahieren (nicht invertieren).
	const leaves = extractLeaves(forest);
	// #1345: eingeblendete Oberaufgaben (Schalter „Oberaufgaben anzeigen") in dieselbe Menge
	// einmischen — dedupliziert (eine Oberaufgabe kann durch `filterForest`s Kontextpfad-Erhalt
	// bereits als vermeintliches Blatt in `leaves` stehen) und gemeinsam nach Wertbeitrag sortiert.
	const parentIds = new Set(parentNodes.map((node) => node.id));
	const combinedNodes =
		parentNodes.length === 0
			? leaves
			: [...leaves.filter((node) => !parentIds.has(node.id)), ...parentNodes].sort((a, b) => b.value - a.value);
	// Im Balance-Modus ersetzt die virtuelle Balance-Priorität die Wertbeitrags-Sortierung; die
	// Original-`priority` bleibt als Sekundärkriterium erhalten.
	const visibleLeaves =
		balancePriorities !== null && balancePriorities.size > 0
			? sortTasksByBalance(
					combinedNodes.map((node) => ({ ...node, priority: taskById.get(node.id)?.priority ?? 1 })),
					balancePriorities,
				)
			: combinedNodes;

	if (combinedNodes.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	return (
		<ul className="task-list" data-testid="task-list">
			{visibleLeaves.map((node) => (
				<LeafItem
					key={node.id}
					node={node}
					taskById={taskById}
					progressMap={progressMap}
					hasOpenSubtasks={isDoneBlockedBySubtasks((fullForestById.get(node.id) ?? node).dependents)}
					userId={userId}
					categories={categories}
					balancePriority={balancePriorities?.get(node.id) ?? null}
					onEdit={onEdit}
					onDelete={onDelete}
					onEditDependencies={onEditDependencies}
					onAddSubtask={onAddSubtask}
					onDoneToggle={onDoneToggle}
				/>
			))}
		</ul>
	);
};
