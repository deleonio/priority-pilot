import type { TaskTreeNode } from 'client';

/** Filterkriterien der Aufgabenliste: Titel-Suchbegriff und (optional) Kategorie. */
export interface ForestFilter {
	/** Substring, case-insensitive; leer bedeutet „kein Titelfilter". */
	search?: string;
	/** ID der Kategorie; `null`/`undefined` bedeutet „keine Einschränkung". */
	categoryId?: number | null;
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
export const filterForest = (forest: TaskTreeNode[], filter: ForestFilter): TaskTreeNode[] => {
	const query = (filter.search ?? '').trim().toLowerCase();
	const categoryId = filter.categoryId ?? null;

	if (query === '' && categoryId === null) {
		return forest;
	}

	/** Trifft der Knoten selbst alle gesetzten Kriterien? */
	const matchesSelf = (node: TaskTreeNode): boolean =>
		(query === '' || node.title.toLowerCase().includes(query)) &&
		(categoryId === null || node.categoryId === categoryId);

	// Prüft, ob ein Knoten oder einer seiner Nachkommen passt.
	const matches = (node: TaskTreeNode): boolean => matchesSelf(node) || node.dependents.some(matches);

	// Filtert die `dependents` eines Knotens rekursiv und behält nur den Pfad zu passenden Nachkommen.
	const filterDependents = (node: TaskTreeNode): TaskTreeNode => ({
		...node,
		dependents: node.dependents.filter(matches).map(filterDependents),
	});

	// Nur Wurzeln behalten, die selbst oder in ihrer Struktur matchen.
	return forest.filter(matches).map(filterDependents);
};
