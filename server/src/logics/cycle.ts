import type { Task } from '../models/index.js';

/**
 * Prüft, ob das Hinzufügen von `newDependency` als Abhängigkeit (Vorgänger) von
 * `dependentTask` einen Zyklus im Abhängigkeitsgraphen erzeugen würde.
 *
 * Wiederverwendbar von der Konsole ([`console.ts`](../console.ts)) und der
 * Express-API ([`express/routes/tasks.ts`](../express/routes/tasks.ts)) — DRY.
 */
export const wouldCreateCycle = async (dependentTask: Task, newDependency: Task): Promise<boolean> => {
	// Basisfall: Wenn der neue Dependency-Task der abhängige Task selbst ist, liegt ein Zyklus vor.
	if (dependentTask.id === newDependency.id) {
		return true;
	}

	// Alle direkten Abhängigkeiten des neuen Dependency-Tasks holen.
	const dependencies = await newDependency.getDependencies();

	// Rekursiv prüfen, ob der abhängige Task in der Abhängigkeitskette auftaucht.
	for (const dependency of dependencies) {
		if (await wouldCreateCycle(dependentTask, dependency)) {
			return true;
		}
	}

	return false; // Kein Zyklus gefunden.
};
