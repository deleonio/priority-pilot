import readline from 'readline';
import { Task } from './models/index.js';
import { calculateValueContribution } from './logics/value.js';
import { wouldCreateCycle } from './logics/cycle.js';
import { Sequelize } from 'sequelize';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const showMenu = (): void => {
	console.log('\nTask Management Console');
	console.log('1. Neuen Task hinzufügen');
	console.log('2. Task bearbeiten');
	console.log('3. Task löschen');
	console.log('4. Abhängigkeit hinzufügen');
	console.log('5. Abhängigkeit löschen');
	console.log('6. Wichtigste 5 Tasks anzeigen');
	console.log('0. Beenden');
};

const getTaskInput = async (): Promise<{ title: string; priority: number; estimatedEffort: number }> => {
	return new Promise((resolve) => {
		rl.question('Task-Titel: ', (title) => {
			rl.question('Priorität (1-10) [Standard: 3]: ', (priorityInput) => {
				const priority = priorityInput ? parseInt(priorityInput, 10) : 3; // Standardwert: 3
				rl.question('Geschätzte Zeit (in Stunden) [Standard: 0.5]: ', (effortInput) => {
					const estimatedEffort = effortInput ? parseFloat(effortInput) : 0.5; // Standardwert: 0.5
					resolve({
						title,
						priority,
						estimatedEffort,
					});
				});
			});
		});
	});
};

const addTask = async (): Promise<void> => {
	const { title, priority, estimatedEffort } = await getTaskInput();
	await Task.create({
		title,
		priority,
		estimatedEffort,
		status: 'Open',
	});
	console.log('Neuer Task hinzugefügt!');
};

const editTask = async (): Promise<void> => {
	return new Promise((resolve) => {
		rl.question('Task-ID zum Bearbeiten: ', async (id) => {
			const task = await Task.findByPk(parseInt(id, 10));
			if (!task) {
				console.log('Task nicht gefunden!');
				return resolve(); // Zurück ins Menü, falls der Task nicht existiert
			}

			console.log(`Bearbeite Task: ${task.title}`);
			rl.question(`Neuer Titel [${task.title}]: `, async (titleInput) => {
				const title = titleInput.trim() !== '' ? titleInput : task.title;

				rl.question(`Neue Priorität (1-10) [${task.priority}]: `, async (priorityInput) => {
					const priority = priorityInput.trim() !== '' ? parseInt(priorityInput, 10) : task.priority;

					rl.question(`Neuer geschätzter Aufwand (in Stunden) [${task.estimatedEffort}]: `, async (effortInput) => {
						const estimatedEffort = effortInput.trim() !== '' ? parseFloat(effortInput) : task.estimatedEffort;

						rl.question(`Neuer Status (Open/In process/Done) [${task.status}]: `, async (statusInput) => {
							const validStatuses = ['Open', 'In process', 'Done'];
							const status = validStatuses.includes(statusInput.trim()) ? statusInput.trim() : task.status;

							await task.update({ title, priority, estimatedEffort, status });
							console.log('Task erfolgreich bearbeitet!');
							resolve(); // Bearbeitung abgeschlossen, zurück ins Menü
						});
					});
				});
			});
		});
	});
};

const deleteTask = async (): Promise<void> => {
	return new Promise((resolve) => {
		rl.question('Task-ID zum Löschen: ', async (id) => {
			const task = await Task.findByPk(parseInt(id, 10));
			if (!task) {
				console.log('Task nicht gefunden!');
				return resolve(); // Zurück ins Hauptmenü
			}
			await task.destroy();
			console.log('Task erfolgreich gelöscht!');
			resolve(); // Beende und kehre ins Menü zurück
		});
	});
};

const addDependency = async (): Promise<void> => {
	return new Promise((resolve) => {
		rl.question('ID des abhängigen Tasks: ', async (dependentId) => {
			rl.question('ID des Tasks, von dem es abhängt: ', async (dependencyId) => {
				const dependentTask = await Task.findByPk(parseInt(dependentId, 10));
				const dependencyTask = await Task.findByPk(parseInt(dependencyId, 10));
				if (!dependentTask || !dependencyTask) {
					console.log('Eine oder beide Tasks wurden nicht gefunden!');
					return resolve();
				}

				// Zyklusprüfung
				const hasCycle = await wouldCreateCycle(dependentTask, dependencyTask);
				if (hasCycle) {
					console.log('Abhängigkeit kann nicht hinzugefügt werden: Ein Zyklus würde entstehen.');
					return resolve();
				}

				// Abhängigkeit hinzufügen
				await dependentTask.addDependency(dependencyTask, { through: { weight: 1 } });
				console.log(
					`Abhängigkeit hinzugefügt: Task ${dependentTask.title} hängt nun von Task ${dependencyTask.title} ab.`,
				);
				resolve();
			});
		});
	});
};

const deleteDependency = async (): Promise<void> => {
	return new Promise((resolve) => {
		rl.question('ID des abhängigen Tasks: ', async (dependentId) => {
			rl.question('ID des Tasks, von dem es nicht mehr abhängen soll: ', async (dependencyId) => {
				const dependentTask = await Task.findByPk(parseInt(dependentId, 10));
				const dependencyTask = await Task.findByPk(parseInt(dependencyId, 10));
				if (!dependentTask || !dependencyTask) {
					console.log('Eine oder beide Tasks wurden nicht gefunden!');
					return resolve(); // Zurück ins Hauptmenü
				}
				await dependentTask.removeDependency(dependencyTask);
				console.log(
					`Abhängigkeit entfernt: Task ${dependentTask.title} hängt nicht mehr von Task ${dependencyTask.title} ab.`,
				);
				resolve(); // Beende und kehre ins Menü zurück
			});
		});
	});
};

const showTopTasks = async (): Promise<void> => {
	const tasks = await Task.findAll({
		where: {
			status: ['Open', 'In process'],
		},
	});

	if (tasks.length === 0) {
		console.log('Es gibt keine offenen oder in Bearbeitung befindlichen Tasks.');
		return;
	}

	const tasksWithValues = [];

	// Berechne Wertschöpfung und Gesamtzeit für jeden Task
	for (const task of tasks) {
		const value = await calculateValueContribution(task); // Wertschöpfung berechnen
		const dependents = await task.getDependents();
		let totalTime = task.estimatedEffort;

		// Füge die geschätzte Zeit aller Abhängigkeiten hinzu
		for (const dependent of dependents) {
			totalTime += dependent.estimatedEffort;
		}

		tasksWithValues.push({
			id: task.id,
			title: task.title,
			value,
			totalTime,
			priority: task.priority,
			status: task.status,
		});
	}

	// Sortiere die Tasks nach Wertschöpfung (absteigend)
	tasksWithValues.sort((a, b) => b.value - a.value);

	// Ausgabe als Tabelle
	console.log('\nTop 5 wichtigste Tasks:');
	console.log('ID | Titel          | Wertschöpfung | Gesamtzeit (h) | Priorität | Status');
	console.log('---|----------------|---------------|----------------|-----------|---------');
	tasksWithValues.slice(0, 5).forEach((task) => {
		console.log(
			`${task.id.toString().padEnd(3)}| ${task.title.padEnd(15)}| ${task.value
				.toFixed(1)
				.toString()
				.padEnd(13)}| ${task.totalTime.toFixed(1).toString().padEnd(14)}| ${task.priority
				.toString()
				.padEnd(9)}| ${task.status.padEnd(8)}`,
		);
	});
};

const listAllTasks = async (): Promise<void> => {
	const tasks = await Task.findAll(); // Alle Tasks abrufen

	if (tasks.length === 0) {
		console.log('Es gibt keine Tasks.');
		return;
	}

	console.log('\nListe aller Tasks:');
	console.log('ID | Titel          | Priorität | Geschätzt | Tatsächlich | Status');
	console.log('---|----------------|-----------|-----------|-------------|---------');

	tasks.forEach((task) => {
		console.log(
			`${task.id.toString().padEnd(3)}| ${task.title.padEnd(15)}| ${task.priority
				.toString()
				.padEnd(10)}| ${task.estimatedEffort.toFixed(1).toString().padEnd(10)}| ${
				task.actualEffort ? task.actualEffort.toFixed(1).toString().padEnd(11) : '0.0'.padEnd(11)
			}| ${task.status.padEnd(8)}`,
		);
	});
};

export const handleUserInput = async (sequelize: Sequelize): Promise<void> => {
	await listAllTasks();
	showMenu();
	rl.question('Option auswählen: ', async (option) => {
		switch (option) {
			case '1':
				await addTask();
				break;
			case '2':
				await editTask();
				break;
			case '3':
				await deleteTask();
				break;
			case '4':
				await addDependency();
				break;
			case '5':
				await deleteDependency();
				break;
			case '6':
				await showTopTasks();
				break;
			case '0':
				console.log('Beenden...');
				rl.close(); // Schließe readline-Interface
				await sequelize.close(); // Verbindung schließen
				process.exit(0); // Beende den Prozess
				return;
			default:
				console.log('Ungültige Option!');
		}
		await handleUserInput(sequelize); // Wiederhole Menü
	});
};
