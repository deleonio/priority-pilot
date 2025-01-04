import { handleUserInput } from './console.js';
import sequelize from './database.js';
import { buildTaskForest } from './logics/tree.js';
import { Task } from './models/index.js';

const main = async () => {
	try {
		// Verbindung herstellen
		await sequelize.authenticate();
		console.log('Datenbankverbindung erfolgreich.');

		// Datenbank synchronisieren
		await sequelize.sync({ force: true });
		console.log('Modelle synchronisiert.');

		// Beispiel-Daten
		const task1 = await Task.create({
			title: 'Task 1',
			status: 'Open',
			priority: 1,
			estimatedEffort: 1,
			deadline: new Date('2025-01-15'),
		});
		const task2 = await Task.create({ title: 'Task 2', status: 'In process', priority: 2, estimatedEffort: 2 });
		const task3 = await Task.create({
			title: 'Task 3',
			status: 'Open',
			priority: 3,
			estimatedEffort: 3,
			deadline: new Date('2025-01-20'),
		});
		const task4 = await Task.create({ title: 'Task 4', status: 'Open', priority: 4, estimatedEffort: 4 });

		// Abhängigkeiten erstellen
		await task1.addDependency(task2, { through: { weight: 0.5 } });
		await task1.addDependency(task3, { through: { weight: 0.1 } });
		await task4.addDependency(task3, { through: { weight: 1.0 } });

		await buildTaskForest();
		await handleUserInput(sequelize);
	} catch (error) {
		console.error('Fehler:', error);
	}
};

main();
