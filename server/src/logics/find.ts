import { Pillar, Task } from '../models/index.js';

export const findNextImportantTask = async (): Promise<Task | null> => {
	// Alle offenen Tasks abrufen — inkl. Säulen-Beiträge, damit der zurückgegebene Task direkt
	// serialisierbar ist (GET /next gibt einen vollständigen Task zurück).
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
		include: [Pillar],
	});

	// Tasks filtern: Nur solche, deren Abhängigkeiten alle abgeschlossen sind
	const independentTasks: Task[] = [];
	for (const task of tasks) {
		const dependencies = await task.getDependencies();
		const hasUnfinishedDependencies = dependencies.some((dep) => dep.status !== 'Done');
		if (!hasUnfinishedDependencies) {
			independentTasks.push(task);
		}
	}

	// Höhere Priorität zuerst
	independentTasks.sort((a, b) => b.priority - a.priority);

	// Gib den wichtigsten Task aus der sortierten Liste zurück
	return independentTasks.length > 0 ? independentTasks[0] : null;
};
