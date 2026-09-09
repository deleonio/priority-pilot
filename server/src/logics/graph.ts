import { Op } from 'sequelize';
import type { components } from '../api';
// Import über den Barrel `models/index.js` ist zwingend: erst dort werden die belongsToMany-
// Assoziationen registriert, die dem Through-Modell `Dependency` die FK-Attribute
// `dependentTaskId`/`dependingTaskId` verpassen. Ein Direktimport von `dependency.js` kennt
// die Spalten nicht und lieferte eine Query ohne diese Attribute.
import { Dependency, Pillar, Task, TaskPillar } from '../models/index.js';

const ACTIVE_STATUSES = ['Open', 'In process'] as const;

/** Legacy-Verhalten aus value.ts: 5 Säulen à 20 % ⇒ Faktor 1, wenn task.userId === null. */
const LEGACY_PILLAR_COUNT = 5;

/** `share`/`confidence`/`weight` sind Prozentwerte (0–100); hier auf Bruchteile normiert. */
const PERCENT = 100;

/** Ein Knoten des Aufgabengraphen — identisch zu `TaskTreeNode`, aber ohne die Baumkinder. */
interface TaskGraphNode {
	id: number;
	title: string;
	priority: number;
	estimatedEffort: number;
	/** Gesamtzeit inkl. aller (transitiven) aktiven Unteraufgaben. */
	totalEstimatedEffort: number;
	value: number;
	status: components['schemas']['TaskStatus'];
	/** Fortschritt (erledigt/gesamt) über die UNGEFILTERTE Unteraufgaben-Kette; `null` ohne Unteraufgaben. */
	progress: { done: number; total: number } | null;
}

/**
 * Eine gerichtete, gewichtete Kante. `from` ist die **Unteraufgabe/der Vorgänger**
 * (`dependencies.dependingTaskId`), `to` die **übergeordnete Aufgabe** (`dependencies.dependentTaskId`).
 * Gelesen: „`from` ermöglicht `to`" bzw. „`to` kann erst, wenn `from` fertig ist".
 *
 * Diese Richtung ist bewusst explizit benannt: der Feldname `dependents` im Wald (`tree.ts`) meint
 * historisch die *Kinder* und nicht die Dependents im Graph-Sinn (#336) — die Verwechslung soll sich
 * hier nicht wiederholen.
 */
interface TaskGraphEdge {
	from: number;
	to: number;
	weight: number;
}

export interface TaskGraph {
	nodes: TaskGraphNode[];
	edges: TaskGraphEdge[];
}

/** Rohzeile aus `dependencies` — die FK-Spalten stammen aus der Assoziation, nicht aus `Dependency.init`. */
interface DependencyRow {
	dependentTaskId: number;
	dependingTaskId: number;
	weight: number | null;
}

interface TaskPillarRow {
	taskId: number;
	pillarId: number;
	share: number;
	confidence: number;
}

interface PillarRow {
	id: number;
	weight: number;
	userId: number | null;
}

const isActive = (status: string): boolean => ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);

/**
 * Baut den Aufgabengraphen des Nutzers: eine flache Knotenliste plus die gewichteten Kanten
 * zwischen ihnen. Anders als `buildTaskForest` (`tree.ts`) dupliziert der Graph keine Aufgabe,
 * die mehreren übergeordneten Aufgaben zuarbeitet — sie ist genau ein Knoten mit mehreren Kanten.
 *
 * Kennzahlen (`value`, `totalEstimatedEffort`, `progress`) sind wertgleich zum Wald; der
 * Paritätstest in `graph.test.ts` hält das fest. Der Unterschied liegt im Aufwand: der Wald setzt
 * pro Knoten und Teilbaum eigene `getDependencies()`-Queries ab (Kommentar `tree.ts:42-44`), hier
 * werden Tasks, Kanten und Säulen je einmal geladen und alles Weitere in-memory gerechnet.
 *
 * Geladen werden **alle** Status, weil `value` über die ungefilterte Nachfolgerkette und `progress`
 * über die ungefilterte Unteraufgabenkette zählen. Ausgeliefert werden nur aktive Knoten
 * (`Open`/`In process`) und nur Kanten, deren **beide** Enden in dieser Knotenliste stehen — es
 * zeigt also nie eine Kante ins Leere.
 */
export const buildTaskGraph = async (userId?: number): Promise<TaskGraph> => {
	const tasks = await Task.findAll({
		where: {
			// Datenisolation (#207, AK5): auf den eingeloggten Nutzer filtern, sofern vorhanden.
			...(userId !== undefined ? { userId } : {}),
		},
		attributes: ['id', 'title', 'priority', 'estimatedEffort', 'status', 'userId'],
	});

	if (tasks.length === 0) {
		return { nodes: [], edges: [] };
	}

	const taskById = new Map(tasks.map((task) => [task.id, task]));
	const taskIds = [...taskById.keys()];

	// `raw: true` liefert die Join-Zeilen als plain objects; die FK-Attribute kennt Sequelize nur
	// über die Assoziation, deshalb der Cast auf die lokale Row-Form statt eines Modell-Typs.
	const dependencyRows = (await Dependency.findAll({
		where: { dependentTaskId: { [Op.in]: taskIds } },
		attributes: ['dependentTaskId', 'dependingTaskId', 'weight'],
		raw: true,
	})) as unknown as DependencyRow[];
	const edgeRows = dependencyRows.filter((row) => taskById.has(row.dependingTaskId));

	const taskPillarRows = (await TaskPillar.findAll({
		where: { taskId: { [Op.in]: taskIds } },
		attributes: ['taskId', 'pillarId', 'share', 'confidence'],
		raw: true,
	})) as unknown as TaskPillarRow[];

	const referencedPillarIds = [...new Set(taskPillarRows.map((row) => row.pillarId))];
	const ownerIds = [...new Set(tasks.map((task) => task.userId).filter((id): id is number => id != null))];
	// Zwei Dinge in einer Query: die Gewichte der referenzierten Säulen und — für N je Eigentümer —
	// alle Säulen der vorkommenden Nutzer. Ohne beides gäbe es nichts zu laden.
	const pillarRows =
		referencedPillarIds.length === 0 && ownerIds.length === 0
			? []
			: ((await Pillar.findAll({
					where: {
						[Op.or]: [{ id: { [Op.in]: referencedPillarIds } }, { userId: { [Op.in]: ownerIds } }],
					},
					attributes: ['id', 'weight', 'userId'],
					raw: true,
				})) as unknown as PillarRow[]);

	// --- Adjazenz ---------------------------------------------------------------------------

	/** Nachfolger je Task (Alias `dependents` in models/index.ts) inkl. Kantengewicht. */
	const dependentsOf = new Map<number, { id: number; weight: number }[]>();
	/** Vorgänger/Unteraufgaben je Task (Alias `dependencies`). */
	const dependenciesOf = new Map<number, number[]>();
	for (const row of edgeRows) {
		const weight = row.weight || 1;
		const dependents = dependentsOf.get(row.dependingTaskId);
		if (dependents) {
			dependents.push({ id: row.dependentTaskId, weight });
		} else {
			dependentsOf.set(row.dependingTaskId, [{ id: row.dependentTaskId, weight }]);
		}
		const dependencies = dependenciesOf.get(row.dependentTaskId);
		if (dependencies) {
			dependencies.push(row.dependingTaskId);
		} else {
			dependenciesOf.set(row.dependentTaskId, [row.dependingTaskId]);
		}
	}

	const pillarById = new Map(pillarRows.map((row) => [row.id, row]));
	const pillarCountByUser = new Map<number, number>();
	for (const row of pillarRows) {
		if (row.userId != null) {
			pillarCountByUser.set(row.userId, (pillarCountByUser.get(row.userId) ?? 0) + 1);
		}
	}
	const contributionsByTask = new Map<number, TaskPillarRow[]>();
	for (const row of taskPillarRows) {
		const existing = contributionsByTask.get(row.taskId);
		if (existing) {
			existing.push(row);
		} else {
			contributionsByTask.set(row.taskId, [row]);
		}
	}

	// --- Kennzahlen -------------------------------------------------------------------------

	/** Säulen-Faktor, Formel identisch zu `getPillarFactor` in value.ts. */
	const pillarFactorOf = (task: Task): number => {
		// Nur auflösbare Beiträge zählen — `task.getPillars()` in value.ts liefert über den JOIN
		// ebenfalls nur Zeilen mit existierender Säule.
		const contributions = (contributionsByTask.get(task.id) ?? []).filter((row) => pillarById.has(row.pillarId));
		if (contributions.length === 0) {
			return 1;
		}
		const pillarCount = task.userId != null ? (pillarCountByUser.get(task.userId) ?? 0) : LEGACY_PILLAR_COUNT;
		if (pillarCount <= 0) {
			return 1;
		}
		let factor = 0;
		for (const contribution of contributions) {
			const pillarWeight = pillarById.get(contribution.pillarId)?.weight ?? 0;
			const share = contribution.share / PERCENT;
			const confidence = contribution.confidence / PERCENT;
			factor += share * (1 + confidence * ((pillarWeight * pillarCount) / PERCENT - 1));
		}
		return factor;
	};

	const valueCache = new Map<number, number>();
	/** Wertbeitrag, Formel identisch zu `calculateValueContribution` in value.ts. */
	const valueOf = (id: number, visiting: Set<number>): number => {
		const cached = valueCache.get(id);
		if (cached !== undefined) {
			return cached;
		}
		// Der Graph ist per `cycle.ts` ein DAG; das Set schützt nur vor korrupten Daten.
		if (visiting.has(id)) {
			return 0;
		}
		const task = taskById.get(id);
		if (!task) {
			return 0;
		}
		visiting.add(id);
		const dependents = dependentsOf.get(id) ?? [];
		let sum = 0;
		for (const dependent of dependents) {
			sum += valueOf(dependent.id, visiting) * dependent.weight;
		}
		visiting.delete(id);
		const result = ((sum + task.priority) / (dependents.length + 1)) * pillarFactorOf(task);
		valueCache.set(id, result);
		return result;
	};

	const effortCache = new Map<number, number>();
	/** Aufwands-Rollup über die **aktiven** Unteraufgaben, Semantik aus `getEstimatedEffort` (tree.ts). */
	const effortOf = (id: number, visiting: Set<number>): number => {
		const cached = effortCache.get(id);
		if (cached !== undefined) {
			return cached;
		}
		if (visiting.has(id)) {
			return 0;
		}
		const task = taskById.get(id);
		if (!task) {
			return 0;
		}
		visiting.add(id);
		let total = task.estimatedEffort;
		for (const dependencyId of dependenciesOf.get(id) ?? []) {
			const dependency = taskById.get(dependencyId);
			if (dependency && isActive(dependency.status)) {
				total += effortOf(dependencyId, visiting);
			}
		}
		visiting.delete(id);
		effortCache.set(id, total);
		return total;
	};

	/**
	 * Fortschritt über die UNGEFILTERTE Unteraufgaben-Kette (auch erledigte zählen, #392 ∩ #241).
	 * Bewusst ein eigener Walk je Knoten statt eines Bottom-up-Memos: bei Diamanten im DAG würde ein
	 * Memo doppelt zählen (siehe Begründung in `tree.ts`). Ohne DB-Zugriff ist der Aufwand unkritisch.
	 */
	const progressOf = (id: number): { done: number; total: number } | null => {
		if ((dependenciesOf.get(id) ?? []).length === 0) {
			return null;
		}
		const visited = new Set<number>();
		let done = 0;
		let total = 0;
		const walk = (nodeId: number): void => {
			if (visited.has(nodeId)) {
				return;
			}
			const task = taskById.get(nodeId);
			if (!task) {
				return;
			}
			visited.add(nodeId);
			total += 1;
			if (task.status === 'Done') {
				done += 1;
			}
			for (const dependencyId of dependenciesOf.get(nodeId) ?? []) {
				walk(dependencyId);
			}
		};
		walk(id);
		return { done, total };
	};

	// --- Ausgabe ----------------------------------------------------------------------------

	const nodes: TaskGraphNode[] = tasks
		.filter((task) => isActive(task.status))
		.map((task) => ({
			id: task.id,
			title: task.title,
			priority: task.priority,
			estimatedEffort: task.estimatedEffort || 0,
			totalEstimatedEffort: effortOf(task.id, new Set()),
			value: valueOf(task.id, new Set()),
			status: task.status,
			progress: progressOf(task.id),
		}))
		// Absteigend nach Wertbeitrag wie der Wald; `id` als Tie-Break hält die Reihenfolge stabil.
		.sort((a, b) => b.value - a.value || a.id - b.id);

	const visibleIds = new Set(nodes.map((node) => node.id));
	const edges: TaskGraphEdge[] = edgeRows
		.filter((row) => visibleIds.has(row.dependingTaskId) && visibleIds.has(row.dependentTaskId))
		.map((row) => ({ from: row.dependingTaskId, to: row.dependentTaskId, weight: row.weight || 1 }))
		.sort((a, b) => a.to - b.to || a.from - b.from);

	return { nodes, edges };
};
