import sequelize from './database.js';
import { launchServer } from './express/index.js';
import { buildTaskForest } from './logics/tree.js';
import { Task } from './models/index.js';

// Daten nur auf ausdrücklichen Wunsch zurücksetzen (sonst kein stiller Datenverlust).
const shouldReset = process.env.DB_RESET === 'true';

const seedDemoData = async (): Promise<void> => {
	const existing = await Task.count();
	if (existing > 0) {
		return;
	}

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

	await task1.addDependency(task2, { through: { weight: 0.5 } });
	await task1.addDependency(task3, { through: { weight: 0.1 } });
	await task4.addDependency(task3, { through: { weight: 1.0 } });
};

const main = async (): Promise<void> => {
	try {
		// Verbindung herstellen
		await sequelize.authenticate();
		console.log('Datenbankverbindung erfolgreich.');

		// Datenbank synchronisieren (force nur bei DB_RESET=true)
		await sequelize.sync({ force: shouldReset });
		console.log('Modelle synchronisiert.');

		// Beispiel-Daten nur anlegen, wenn die Datenbank leer ist
		await seedDemoData();

		console.log(JSON.stringify(await buildTaskForest(), null, 2));
		await launchServer();
	} catch (error) {
		console.error('Fehler:', error);
	}
};

main();
