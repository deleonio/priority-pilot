import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import Task from '../models/task.js';
import Series from '../models/series.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

/**
 * Beschreibung-Längenbeschränkung (3000 Zeichen)
 * Tests für DB-Schema-Validierung. Die Beschreibung bleibt optional (nullable).
 */
describe('DB-Schema — Beschreibung-Länge', () => {
	describe('Task.description', () => {
		it('DB-Validierung: 3000 Zeichen wird erfolgreich gespeichert', async () => {
			const description3000 = 'a'.repeat(3000);
			const task = await Task.create({
				title: 'Task mit langer Beschreibung',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
				description: description3000,
			});
			assert.strictEqual(task.description?.length, 3000);
			await task.destroy();
		});

		it('DB-Validierung: 3001 Zeichen löst ValidationError aus', async () => {
			const description3001 = 'b'.repeat(3001);

			try {
				await Task.create({
					title: 'Task mit zu langer Beschreibung',
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
					description: description3001,
				});
				assert.fail('Task mit 3001 Zeichen Beschreibung sollte DB-Error werfen');
			} catch (error) {
				assert.ok(
					error.name === 'DatabaseError' ||
						error.name === 'ValidationError' ||
						error.name === 'SequelizeValidationError',
					`Sollte DB/ValidationError/SequelizeValidationError sein, got: ${error.name}`,
				);
			}
		});

		it('DB-Validierung: null-Beschreibung bleibt gültig (optional)', async () => {
			const task = await Task.create({
				title: 'Task ohne Beschreibung',
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
			});
			assert.strictEqual(task.description ?? null, null);
			await task.destroy();
		});
	});

	describe('Series.description', () => {
		it('DB-Validierung: 3000 Zeichen wird erfolgreich gespeichert', async () => {
			const description3000 = 'c'.repeat(3000);
			const series = await Series.create({
				title: 'Serie mit langer Beschreibung',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date(),
				description: description3000,
			});
			assert.strictEqual(series.description?.length, 3000);
			await series.destroy();
		});

		it('DB-Validierung: 3001 Zeichen löst ValidationError aus', async () => {
			const description3001 = 'd'.repeat(3001);

			try {
				await Series.create({
					title: 'Serie mit zu langer Beschreibung',
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date(),
					description: description3001,
				});
				assert.fail('Series mit 3001 Zeichen Beschreibung sollte DB-Error werfen');
			} catch (error) {
				assert.ok(
					error.name === 'DatabaseError' ||
						error.name === 'ValidationError' ||
						error.name === 'SequelizeValidationError',
					`Sollte DB/ValidationError/SequelizeValidationError sein, got: ${error.name}`,
				);
			}
		});

		it('DB-Validierung: null-Beschreibung bleibt gültig (optional)', async () => {
			const series = await Series.create({
				title: 'Serie ohne Beschreibung',
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date(),
			});
			assert.strictEqual(series.description ?? null, null);
			await series.destroy();
		});
	});
});
