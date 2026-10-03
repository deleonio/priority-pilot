import { Pillar, Task } from '../models/index.js';
import { distributeWithMinimum } from './pillarShares.js';

/**
 * Demo-Seed beim ersten Start (aus `index.ts` ausgelagert, Seam für logics/demoSeed.test.ts):
 * legt die vier Demo-Tasks samt Abhängigkeiten an und zahlt auf Task 1 und Task 3 Säulen-Beiträge
 * ein. #2077 (AK6): nur noch gültige Vollverteilungen — jede Zahlung deckt ALLE Säulen ab,
 * jeder Anteil liegt zwischen 5 und 80, die Summe ist exakt 100 (`distributeWithMinimum`). Die
 * gewünschte Gewichtung (70/30 auf Wirksamkeit/Sinn, voll auf Körper) geht als Vorgabe ein.
 * Übrige Tasks bleiben ohne Säule (neutral, leere Liste ist gültig).
 */
export const seedDemoData = async (): Promise<void> => {
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
	const task2 = await Task.create({ title: 'Task 2', status: 'In process', priority: 2, estimatedEffort: 0.5 });
	const task3 = await Task.create({
		title: 'Task 3',
		status: 'Open',
		priority: 3,
		estimatedEffort: 0.75,
		deadline: new Date('2025-01-20'),
	});
	const task4 = await Task.create({ title: 'Task 4', status: 'Open', priority: 4, estimatedEffort: 1 });

	await task1.addDependency(task2, { through: { weight: 0.5 } });
	await task1.addDependency(task3, { through: { weight: 0.1 } });
	await task4.addDependency(task3, { through: { weight: 1.0 } });

	const pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
	if (pillars.length > 0) {
		// Beispielhafte Mehrfach-Einzahlung: Task 1 mit Schwerpunkt Wirksamkeit/Sinn (mit Konfidenz),
		// Task 3 mit Schwerpunkt Körper — jeweils als gültige Vollverteilung über alle Säulen.
		const shares1 = distributeWithMinimum(
			pillars.map((pillar) => (pillar.name === 'Wirksamkeit' ? 70 : pillar.name === 'Sinn' ? 30 : 0)),
		);
		const confidences1 = new Map([
			['Wirksamkeit', 90],
			['Sinn', 60],
		]);
		for (const [index, pillar] of pillars.entries()) {
			await task1.addPillar(pillar.id, {
				through: { share: shares1[index]!, confidence: confidences1.get(pillar.name) ?? 100 },
			});
		}
		const shares3 = distributeWithMinimum(pillars.map((pillar) => (pillar.name === 'Körper' ? 100 : 0)));
		for (const [index, pillar] of pillars.entries()) {
			await task3.addPillar(pillar.id, { through: { share: shares3[index]!, confidence: 100 } });
		}
	}
};
