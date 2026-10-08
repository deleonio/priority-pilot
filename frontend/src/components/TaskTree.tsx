import { KolBadge, KolHeading, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Category, Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractLeaves } from '../lib/extractLeaves';
import { seriesBadge } from '../lib/series';
import { CategoryBadge } from './CategoryBadge';
import { GeoBadge } from './GeoBadge';
import { PillarMissingBadge } from './PillarMissingBadge';
import { PinnedBadge } from './PinnedBadge';
import { SeriesBadge } from './SeriesBadge';
import { isDoneBlockedBySubtasks, priorityBadge, sortPinnedFirst } from '../lib/task';
import { sortTasksByBalance, virtualPriorityLabel, type BalancePriority } from '../lib/balancePriority';
import { setupPopoverAlignment } from '../lib/popoverAlign';

/** i18n-Schlüssel des Anzeigenamens der KI-Eignungs-Kategorie (#2349). */
const AI_SUITABILITY_LABEL = {
	draft: 'taskTree.aiSuitability.draft',
	summary: 'taskTree.aiSuitability.summary',
	research: 'taskTree.aiSuitability.research',
} as const;

/** Stabiler Default für `seriesById` (kein neues Map-Objekt je Render). */
const NO_SERIES: ReadonlyMap<number, { autoCreate?: boolean }> = new Map();

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
	/**
	 * Säulen des Nutzers (#1465): Ohne angelegte Säulen bleibt das Badge „keine Säulen-Gewichtung"
	 * aus — es trüge sonst jede Zeile, ohne dass es etwas zu entscheiden gäbe.
	 */
	pillars?: Pillar[];
	/** Serien des Nutzers je ID (#2359): Aufgaben aus Vorlagen (`autoCreate === false`) tragen „Vorlage“ statt des Serien-Icons. */
	seriesById?: ReadonlyMap<number, { autoCreate?: boolean }>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	/** Legt eine neue Unteraufgabe an, die als Vorgänger mit dieser Aufgabe verknüpft wird. */
	onAddSubtask: (task: Task) => void;
	/** #2361: Öffnet das Serien-Formular als Vorlage, vorbelegt aus dieser Aufgabe. */
	onSaveAsTemplate: (task: Task) => void;
	/** Schaltet eine Aufgabe per binärem Toggle zwischen „Erledigt" und „Offen" um (#315). */
	onDoneToggle: (task: Task) => Promise<void>;
	/** Pinnt die Aufgabe an bzw. wieder ab (#1582). */
	onPinToggle: (task: Task) => void;
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
	/** Hat der Nutzer überhaupt Säulen angelegt? Nur dann ist ein fehlender Beitrag eine Aussage. */
	pillarsConfigured: boolean;
	seriesById: ReadonlyMap<number, { autoCreate?: boolean }>;
	/** Virtuelle Balance-Priorität dieses Tasks; `null` → Original-P-Badge. */
	balancePriority?: BalancePriority | null;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
	onAddSubtask: (task: Task) => void;
	onSaveAsTemplate: (task: Task) => void;
	onDoneToggle: (task: Task) => Promise<void>;
	onPinToggle: (task: Task) => void;
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
	pillarsConfigured,
	seriesById,
	balancePriority,
	onEdit,
	onDelete,
	onEditDependencies,
	onAddSubtask,
	onSaveAsTemplate,
	onDoneToggle,
	onPinToggle,
}: LeafItemProps) => {
	const { t } = useTranslation(['tasks', 'common']);
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
	const doneToggleLabel = isDone
		? t('actions.reopen')
		: doneToggleBlocked
			? t('taskTree.doneBlocked')
			: t('actions.done');
	const priority = task?.priority ?? 1;
	// Im Balance-Modus zeigt das Badge die virtuelle Priorität (~P{n}, eigene Farbe nach Stufe)
	// statt der Server-Prio — unterscheidbar per Tilde-Präfix, nie nur per Farbe (KI-UX).
	const priorityBadgeInfo = priorityBadge(balancePriority?.virtualPriority ?? priority);
	const priorityBadgeLabel =
		balancePriority != null ? virtualPriorityLabel(balancePriority.virtualPriority) : priorityBadgeInfo.label;
	// #1213: Ersteller-Sicht auf eine abgegebene Aufgabe — lesbar, aber ohne Schreibrechte (AK5).
	// Die Aktionen werden ausgeblendet statt anklickbar angeboten, sonst endet jede Aktion in 404.
	const handedOff = task?.forUserId != null;
	// #2359: Aufgabe aus einer Vorlage — Text-Badge „Vorlage“/„Vorlage (geändert)“ statt Serien-Icon + „geändert“.
	const templateBadge =
		task !== null && task.seriesId != null && seriesById.get(task.seriesId)?.autoCreate === false
			? seriesBadge(task, seriesById)
			: null;

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
							<KolBadge
								_label={t('taskTree.forUser', { name: task.forUserName })}
								className="task-tree-badge task-tree-badge--provenance"
							/>
						)}
						{/* #1521 (AK7): Gruppen-Aufgabe trägt den Gruppennamen statt eines Personennamens —
						    für jedes Mitglied sichtbar, solange sie niemand erledigt hat. */}
						{task !== null && task.groupName != null && task.userId == null && (
							// Bewusst ein Light-DOM-Span statt KolBadge: der Test-Anker (`data-testid`) muss am
							// sichtbaren Element hängen, und KolBadge nimmt weder Fremd-Attribute entgegen noch
							// liefert sein Shadow-Label eine messbare Box für die 375px-Prüfung (AK8).
							<span
								data-testid="group-task-badge"
								className="task-tree-badge task-tree-badge--provenance task-tree-badge-anchor"
							>
								{t('taskTree.forUser', { name: task.groupName })}
							</span>
						)}
						{/* #2349: KI-Eignung (Heuristik, nur mit ai_assist) als nicht-interaktives Text-Badge; Light-DOM-Span
						    wie das Gruppen-Badge (Test-Anker + messbare Box), ohne Upsell-Hinweis (ADR 0014). */}
						{task?.aiSuitability != null && (
							<span
								data-testid="ai-suitability-badge"
								className="task-tree-badge task-tree-badge--provenance task-tree-badge-anchor"
							>
								{t(AI_SUITABILITY_LABEL[task.aiSuitability])}
							</span>
						)}
						{task !== null && task.forUserName == null && task.createdByName != null && task.createdById !== userId && (
							<KolBadge
								_label={t('taskTree.createdBy', { name: task.createdByName })}
								className="task-tree-badge task-tree-badge--provenance"
							/>
						)}
						<CategoryBadge category={categories.find((category) => category.id === node.categoryId)} />
						{/* #1518: Serien-Icon mit Screenreader-Text statt Text-Badge „Serie" — die Liste zeigt je
						    Serie nur die aktuelle Instanz. */}
						{templateBadge !== null ? (
							<KolBadge _label={templateBadge.label} className="task-tree-badge" />
						) : (
							task !== null && task.seriesId != null && <SeriesBadge />
						)}
						{/* #1582: Der Pin-Zustand steht als Icon-Badge in derselben Zeile wie Serie/Ort — die
						    Pin-Aktion selbst liegt im „…"-Popover (siehe Toolbar unten). */}
						{task !== null && task.pinned && <PinnedBadge />}
						{task !== null && task.isException && templateBadge === null && (
							<KolBadge _label={t('taskTree.changed')} _color="#c66a00" className="task-tree-badge" />
						)}
						{/* #1465: Zahlt die Aufgabe auf keine Säule ein, zeigt die Zeile das Säulen-Badge —
						    sichtbar, ohne den Eintrag zu öffnen. Es ersetzt das beschreibungs-getriebene
						    „Hinweis"-Badge aus #1430. Ohne angelegte Säulen bleibt es aus, sonst trüge es
						    jede Zeile. */}
						{task !== null && pillarsConfigured && (task.pillars ?? []).length === 0 && <PillarMissingBadge />}
						{progress !== undefined && (
							<KolBadge _label={`${progress.done}/${progress.total}`} _color="#2e7d32" className="task-tree-badge" />
						)}
						{/* #1583 AK6: Checklisten-Fortschritt bleibt sichtbar, solange nicht alle Einträge
						    abgehakt sind — dieselbe „erledigt/gesamt"-Formatierung wie in TaskTable.tsx. */}
						{task !== null && (task.checklist?.length ?? 0) > 0 && (
							<KolBadge
								_label={`${task.checklist!.filter((item) => item.completed).length}/${task.checklist!.length}`}
								_color="#005b99"
								className="task-tree-badge task-tree-badge--checklist"
							/>
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
								_label={t('taskTree.moreActions')}
								_hideLabel
								_icons={{ left: { icon: 'fa-solid fa-ellipsis' } }}
								_variant="secondary"
								_popoverAlign="left"
							>
								<KolToolbar
									_label={t('actions.actionsFor', { title: task.title })}
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
											_label: t('common:actions.edit'),
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
											_label: t('actions.dependencies'),
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
											_label: t('actions.addSubtask'),
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
											// #2361: Mit Abstand vor „Löschen" (destruktive Aktion); Popover schließt sich
											// wie bei „Unteraufgabe anlegen", damit der Dialog den Trigger kennt.
											type: 'button',
											_label: t('common:actions.saveAsTemplate'),
											_hideLabel: true,
											_icons: { left: { icon: 'fa-solid fa-clone' } },
											_variant: 'secondary',
											_on: {
												onClick: () => {
													void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onSaveAsTemplate(task));
												},
											},
										},
										{
											// #1582: Der Pin-Toggle liegt als vorletztes Toolbar-Item vor „Löschen", statt als
											// eigener Schalter in der Zeile. Wie beim Erledigt-Toggle bewusst KEIN
											// `hidePopover()`: mehrfaches Umschalten soll ohne Neuöffnen möglich bleiben.
											// `KolButton` kennt kein `aria-pressed` — den Zustand tragen das wechselnde Label
											// (auch als Tooltip der `_hideLabel`-Variante) und das Pin-Badge in der Zeile.
											type: 'button',
											_label: task.pinned ? t('actions.unpin') : t('actions.pin'),
											_hideLabel: true,
											_icons: { left: { icon: 'fa-solid fa-thumbtack' } },
											_variant: 'secondary',
											_on: { onClick: () => onPinToggle(task) },
										},
										{
											type: 'button',
											_label: t('common:actions.delete'),
											_hideLabel: true,
											_icons: { left: { icon: 'fa-solid fa-trash' } },
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
	onSaveAsTemplate,
	onDoneToggle,
	onPinToggle,
	categories = [],
	pillars = [],
	seriesById = NO_SERIES,
	balancePriorities = null,
}: TaskTreeProps) => {
	const { t } = useTranslation('tasks');
	const pillarsConfigured = pillars.length > 0;
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
	const balanceSortedLeaves =
		balancePriorities !== null && balancePriorities.size > 0
			? sortTasksByBalance(
					combinedNodes.map((node) => ({ ...node, priority: taskById.get(node.id)?.priority ?? 1 })),
					balancePriorities,
				)
			: combinedNodes;

	if (combinedNodes.length === 0) {
		return <p>{t('taskList.empty')}</p>;
	}

	// #1582 AK2/AK5: angepinnte Aufgaben stehen unabhängig von Wertbeitrags-/Balance-Sortierung immer
	// oben — deshalb als letzter Schritt vor dem Rendern über die zugehörigen Tasks angewendet.
	const nodeByTaskId = new Map(balanceSortedLeaves.map((node) => [node.id, node]));
	const tasksInOrder = balanceSortedLeaves
		.map((node) => taskById.get(node.id))
		.filter((task): task is Task => task !== undefined);
	const pinnedOrderedTasks = sortPinnedFirst(tasksInOrder);
	const visibleLeaves = [
		...pinnedOrderedTasks
			.map((task) => nodeByTaskId.get(task.id))
			.filter((node): node is TaskTreeNode => node !== undefined),
		...balanceSortedLeaves.filter((node) => !taskById.has(node.id)),
	];

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
					pillarsConfigured={pillarsConfigured}
					seriesById={seriesById}
					balancePriority={balancePriorities?.get(node.id) ?? null}
					onEdit={onEdit}
					onDelete={onDelete}
					onEditDependencies={onEditDependencies}
					onAddSubtask={onAddSubtask}
					onSaveAsTemplate={onSaveAsTemplate}
					onDoneToggle={onDoneToggle}
					onPinToggle={onPinToggle}
				/>
			))}
		</ul>
	);
};
