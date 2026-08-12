import { describe, it } from 'node:test';
import assert from 'node:assert';
import Task from '../models/task.js';
import Series from '../models/series.js';

/**
 * Issue #582: Titel-Längenbeschränkung (30 Zeichen)
 * Rote Tests für DB-Schema-Validierung.
 * Prüft, ob das Datenbank-Schema die 30-Zeichen-Beschränkung tatsächlich erzwingt.
 */
describe('DB-Schema — Titel-Länge (Issue #582)', () => {
	describe('Task.title — VARCHAR(30)', async () => {
		it('Task-Model hat title mit maxLength=30', async () => {
			const titleAttr = Task.rawAttributes.title;
			assert.ok(titleAttr, 'title muss im Task-Model definiert sein');

			// Sequelize STRING ohne Längenlimit -> kein maxLength
			// STRING(30) -> options.length = 30
			const typeOptions = titleAttr.type.options || {};
			assert.strictEqual(typeOptions.length, 30, 'title muss STRING(30) sein');
		});

		it('DB-Validierung: 31 Zeichen löst DatabaseError aus', async () => {
			const title31 = 'a'.repeat(31);

			try {
				await Task.create({
					title: title31,
					status: 'Open',
					priority: 3,
					estimatedEffort: 0.5,
				});
				assert.fail('Task mit 31 Zeichen sollte DB-Error werfen');
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

		it('DB-Validierung: 30 Zeichen wird erfolgreich gespeichert', async () => {
			const title30 = 'b'.repeat(30);
			const task = await Task.create({
				title: title30,
				status: 'Open',
				priority: 3,
				estimatedEffort: 0.5,
			});
			assert.strictEqual(task.title.length, 30);
			await task.destroy();
		});
	});

	describe('Series.title — VARCHAR(30)', async () => {
		it('Series-Model hat title mit maxLength=30', async () => {
			const titleAttr = Series.rawAttributes.title;
			assert.ok(titleAttr, 'title muss im Series-Model definiert sein');

			// Sequelize STRING ohne Längenlimit -> kein maxLength
			// STRING(30) -> options.length = 30
			const typeOptions = titleAttr.type.options || {};
			assert.strictEqual(typeOptions.length, 30, 'title muss STRING(30) sein');
		});

		it('DB-Validierung: 31 Zeichen löst DatabaseError aus', async () => {
			const title31 = 'c'.repeat(31);

			try {
				await Series.create({
					title: title31,
					rhythm: 'weekly',
					priority: 3,
					estimatedEffort: 0.5,
					startDate: new Date(),
				});
				assert.fail('Series mit 31 Zeichen sollte DB-Error werfen');
			} catch (error) {
				assert.ok(
					error.name === 'DatabaseError' ||
						error.name === 'ValidationError' ||
						error.name === 'SequelizeValidationError',
					`Sollte DB/ValidationError/SequelizeValidationError sein, got: ${error.name}`,
				);
			}
		});

		it('DB-Validierung: 30 Zeichen wird erfolgreich gespeichert', async () => {
			const title30 = 'd'.repeat(30);
			const series = await Series.create({
				title: title30,
				rhythm: 'weekly',
				priority: 3,
				estimatedEffort: 0.5,
				startDate: new Date(),
			});
			assert.strictEqual(series.title.length, 30);
			await series.destroy();
		});
	});
});
