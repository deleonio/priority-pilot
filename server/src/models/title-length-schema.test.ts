import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import Task from '../models/task.js';
import Series from '../models/series.js';
import { resetDb, closeDb } from '../test/helpers.js';

beforeEach(resetDb);
after(closeDb);

/**
 * Titel-Längenbeschränkung (65 Zeichen)
 * Tests für DB-Schema-Validierung.
 */
describe('DB-Schema — Titel-Länge', () => {
	describe('Task.title — VARCHAR(65)', async () => {
		it('Task-Model hat title mit maxLength=65', async () => {
			const titleAttr = Task.rawAttributes.title;
			assert.ok(titleAttr, 'title muss im Task-Model definiert sein');

			// Sequelize STRING ohne Längenlimit -> kein maxLength
			// STRING(65) -> options.length = 65
			const typeOptions = titleAttr.type.options || {};
			assert.strictEqual(typeOptions.length, 65, 'title muss STRING(65) sein');
		});

		it('DB-Validierung: 66 Zeichen löst DatabaseError aus', async () => {
			const title66 = 'a'.repeat(66);

			try {
				await Task.create({
					title: title66,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				});
				assert.fail('Task mit 66 Zeichen sollte DB-Error werfen');
			} catch (error) {
				// Expected: DatabaseError, ValidationError oder SequelizeValidationError
				assert.ok(
					error.name === 'DatabaseError' ||
						error.name === 'ValidationError' ||
						error.name === 'SequelizeValidationError',
					`Sollte DB/ValidationError/SequelizeValidationError sein, got: ${error.name}`,
				);
			}
		});

		it('DB-Validierung: 65 Zeichen wird erfolgreich gespeichert', async () => {
			const title65 = 'b'.repeat(65);
			const task = await Task.create({
				title: title65,
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
			});
			assert.strictEqual(task.title.length, 65);
			await task.destroy();
		});
	});

	describe('Series.title — VARCHAR(65)', async () => {
		it('Series-Model hat title mit maxLength=65', async () => {
			const titleAttr = Series.rawAttributes.title;
			assert.ok(titleAttr, 'title muss im Series-Model definiert sein');

			// Sequelize STRING ohne Längenlimit -> kein maxLength
			// STRING(65) -> options.length = 65
			const typeOptions = titleAttr.type.options || {};
			assert.strictEqual(typeOptions.length, 65, 'title muss STRING(65) sein');
		});

		it('DB-Validierung: 65 Zeichen wird erfolgreich gespeichert', async () => {
			const title65 = 'd'.repeat(65);
			const series = await Series.create({
				title: title65,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date(),
			});
			assert.strictEqual(series.title.length, 65);
			await series.destroy();
		});
	});
});
