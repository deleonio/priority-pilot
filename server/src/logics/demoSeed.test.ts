import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, TaskPillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { seedDemoData } from './demoSeed.js';

// Tests für #2077 AK6 (docs/spec/issue-2077.md): der Demo-Seed (`logics/demoSeed.ts`) legt beim
// ersten Start nur gültige Säulenverteilungen an — Vollverteilung über alle (Demo-)Säulen, jeder
// Anteil 5–80, Summe 100.

describe('Demo-Seed (#2077 AK6)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		await closeDb();
	});

	it('jede gesäte Task-Verteilung ist eine gültige Vollverteilung (alle Säulen, je 5–80, Summe 100)', async () => {
		// Die Demo-Säulen werden wie im Produktivstart über SEED_PILLARS gesät; seedDemoData setzt darauf auf.
		await Pillar.bulkCreate(
			SEED_PILLARS.map(({ key, name, description, weight }) => ({ key, name, description, weight })),
		);
		await seedDemoData();

		const pillars = await Pillar.findAll();
		assert.ok(pillars.length >= 2, 'Setup: der Seed braucht Demo-Säulen');
		const contributions = await TaskPillar.findAll();
		assert.ok(contributions.length > 0, 'der Demo-Seed muss Säulen-Beiträge anlegen');

		const byTask = new Map<number, TaskPillar[]>();
		for (const entry of contributions) {
			const list = byTask.get(entry.taskId) ?? [];
			list.push(entry);
			byTask.set(entry.taskId, list);
		}
		for (const [taskId, entries] of byTask) {
			const sum = entries.reduce((acc, entry) => acc + entry.share, 0);
			assert.ok(Math.abs(sum - 100) < 1e-6, `Task ${taskId}: Summe muss 100 sein (war ${sum})`);
			assert.equal(
				entries.length,
				pillars.length,
				`Task ${taskId}: Verteilung muss alle ${pillars.length} Säulen abdecken (deckt ${entries.length} ab)`,
			);
			for (const entry of entries) {
				assert.ok(
					entry.share >= 5 && entry.share <= 80,
					`Task ${taskId}: Anteil ${entry.share} verletzt die Grenzen 5–80`,
				);
			}
		}
	});
});
