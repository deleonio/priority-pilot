import type { TaskTreeNode } from 'client';

/**
 * Filtert einen Aufgabenwald nach Titel (Substring, case-insensitive). Eine Aufgabe bleibt im
 * Ergebnis, wenn ihr Titel oder der Titel einer Unteraufgabe passt — Oberaufgaben werden als
 * Kontextpfad erhalten, nur die passende Unteraufgabe bleibt in `dependents`.
 */
export const filterForestByTitle = (forest: TaskTreeNode[], search: string): TaskTreeNode[] => {
	const trimmed = search.trim();
	if (trimmed === '') {
		return forest;
	}

	const query = trimmed.toLowerCase();

	// Prüft, ob ein Knoten oder einer seiner Nachkommen dem Query entspricht.
	const matches = (node: TaskTreeNode): boolean => {
		if (node.title.toLowerCase().includes(query)) {
			return true;
		}
		return node.dependents.some(matches);
	};

	// Filtert die `dependents` eines Knotens rekursiv und behält nur den Pfad zu passenden Nachkommen.
	const filterDependents = (node: TaskTreeNode): TaskTreeNode => {
		const filteredDependents = node.dependents.filter(matches).map(filterDependents);

		return {
			...node,
			dependents: filteredDependents,
		};
	};

	// Nur Wurzeln behalten, die selbst oder in ihrer Struktur matchen.
	return forest.filter(matches).map(filterDependents);
};
