import type { Task } from '../models/index.js';

/**
 * Prüft, ob das Hinzufügen von `newDependency` als Abhängigkeit (Vorgänger) von
 * `dependentTask` einen Zyklus im Abhängigkeitsgraphen erzeugen würde.
 *
 * Wiederverwendbar von der Konsole ([`console.ts`](../console.ts)) und der
 * Express-API ([`express/routes/tasks.ts`](../express/routes/tasks.ts)) — DRY.
 */
export const wouldCreateCycle = async (
	dependentTask: Task,
	newDependency: Task,
	visited: Set<number> = new Set(),
): Promise<boolean> => {
	// Basisfall: Wenn der neue Dependency-Task der abhängige Task selbst ist, liegt ein Zyklus vor.
	if (dependentTask.id === newDependency.id) {
		return true;
	}

	// Bereits besuchte Knoten nicht erneut laden — verhindert redundante getDependencies()-Queries
	// bei geteilten Teilbäumen (Diamond) und schützt vor Endlosschleifen in bereits zyklischen Graphen.
	if (visited.has(newDependency.id)) {
		return false;
	}
	visited.add(newDependency.id);

	// Alle direkten Abhängigkeiten des neuen Dependency-Tasks holen.
	const dependencies = await newDependency.getDependencies();

	// Rekursiv prüfen, ob der abhängige Task in der Abhängigkeitskette auftaucht.
	for (const dependency of dependencies) {
		if (await wouldCreateCycle(dependentTask, dependency, visited)) {
			return true;
		}
	}

	return false; // Kein Zyklus gefunden.
};
