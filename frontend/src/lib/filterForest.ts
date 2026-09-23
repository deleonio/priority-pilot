import type { TaskTreeNode } from 'client';

/** Filterkriterien der Aufgabenliste: Titel-Suchbegriff, (optional) Kategorie und (optional) eine explizite ID-Menge. */
export interface ForestFilter {
	/** Substring, case-insensitive; leer bedeutet „kein Titelfilter". */
	search?: string;
	/** ID der Kategorie; `null`/`undefined` bedeutet „keine Einschränkung". */
	categoryId?: number | null;
	/**
	 * Erlaubte Task-IDs (z. B. „fällig an Tag X", #1617 Kreuzverhör-Entscheidung #5/Option 5.2);
	 * `null`/`undefined` bedeutet „keine Einschränkung". Bewusst generisch (nicht deadline-spezifisch),
	 * weil `TaskTreeNode` selbst keine Deadline führt — der Aufrufer bildet die ID-Menge aus der
	 * `tasks`-Liste (die eine Deadline führt) und reicht sie hier nur noch als Mitgliedschaftstest durch.
	 */
	taskIds?: Set<number> | null;
}

/**
 * Filtert einen Aufgabenwald nach Titel (Substring, case-insensitive) und Kategorie. Eine Aufgabe
 * bleibt im Ergebnis, wenn sie selbst oder eine ihrer Unteraufgaben allen gesetzten Kriterien
 * genügt — Oberaufgaben werden als Kontextpfad erhalten, nur die passende Unteraufgabe bleibt in
 * `dependents`.
 *
 * Die Kriterien sind bewusst in EINER Funktion vereint (statt zweier hintereinander laufender
 * Filter): Nur so entscheidet der Kontextpfad-Erhalt über beide Kriterien gemeinsam — eine
 * Unteraufgabe muss Titel UND Kategorie treffen, nicht je eines in verschiedenen Durchgängen.
 */
/**
 * Trifft ein einzelner Knoten (ohne seine Nachkommen zu betrachten) die gesetzten Kriterien?
 * Exportiert für den „Oberaufgaben anzeigen"-Schalter (#1345): eine eingeblendete Oberaufgabe folgt
 * derselben Regel wie ein Blatt hier — sie muss selbst matchen, ein Kontextpfad über Nachkommen
 * (wie ihn `filterForest` für Blätter gewährt) gilt für sie nicht.
 */
export const nodeMatchesFilter = (node: TaskTreeNode, filter: ForestFilter): boolean => {
	const query = (filter.search ?? '').trim().toLowerCase();
	const categoryId = filter.categoryId ?? null;
	const taskIds = filter.taskIds ?? null;
	return (
		(query === '' || node.title.toLowerCase().includes(query)) &&
		(categoryId === null || node.categoryId === categoryId) &&
		(taskIds === null || taskIds.has(node.id))
	);
};

export const filterForest = (forest: TaskTreeNode[], filter: ForestFilter): TaskTreeNode[] => {
	const query = (filter.search ?? '').trim().toLowerCase();
	const categoryId = filter.categoryId ?? null;
	const taskIds = filter.taskIds ?? null;

	if (query === '' && categoryId === null && taskIds === null) {
		return forest;
	}

	// Prüft, ob ein Knoten oder einer seiner Nachkommen passt.
	const matches = (node: TaskTreeNode): boolean => nodeMatchesFilter(node, filter) || node.dependents.some(matches);

	// Filtert die `dependents` eines Knotens rekursiv und behält nur den Pfad zu passenden Nachkommen.
	const filterDependents = (node: TaskTreeNode): TaskTreeNode => ({
		...node,
		dependents: node.dependents.filter(matches).map(filterDependents),
	});

	// Nur Wurzeln behalten, die selbst oder in ihrer Struktur matchen.
	return forest.filter(matches).map(filterDependents);
};
