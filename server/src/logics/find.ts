import { Task } from '../models/index.js';

export const findNextImportantTask = async (): Promise<Task | null> => {
	// Alle offenen Tasks abrufen
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
	});

	// Tasks filtern: Nur solche, deren Abhängigkeiten abgeschlossen sind
	const independentTasks: Task[] = [];
	for (const task of tasks) {
		const dependencies = await task.getDependencies(); // Abhängige Tasks laden
		const hasUnfinishedDependencies = dependencies.some((dep) => dep.status !== 'Done');
		if (!hasUnfinishedDependencies) {
			independentTasks.push(task);
		}
	}

	console.log(independentTasks);

	// Sortiere Tasks nach Priorität und Gewichtung der Abhängigkeiten
	independentTasks.sort((a, b) => {
		// Höhere Priorität zuerst
		if (a.priority !== b.priority) {
			return b.priority - a.priority;
		}

		a.getDependencies().then((deps) => deps.reduce(console.log, 0));

		return 1;
	});

	// Gib den ersten Task aus der sortierten Liste zurück
	return independentTasks.length > 0 ? independentTasks[0] : null;
};
