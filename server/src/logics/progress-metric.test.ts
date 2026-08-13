import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgressMetric, checkNoProgressThreshold, ProgressMetricError } from './progress-metric';

/**
 * Issue 611: CI Fortschrittsmetrik
 * Spec: docs/spec/issue-611.md
 *
 * Testet die Fortschrittsmetrik für CI-Läufe basierend auf Commit-Anzahl.
 */

describe('Progress Metric (Issue 611)', () => {
	describe('Metrik-Berechnung: base..HEAD Commits', () => {
		it('AK 1: Metrik = 0 bei keinem Fortschritt (keine Commits seit Start)', async () => {
			// Given: Git rev-list liefert 0
			const mockExec = async () => '0';
			// When: Metrik wird berechnet
			const metric = await calculateProgressMetric('base', 'head', mockExec);
			// Then: Ergebnis = 0
			assert.equal(metric, 0);
		});

		it('AK 1: Metrik > 0 bei echtem Fortschritt (Commits vorhanden)', async () => {
			// Given: Git rev-list liefert 5
			const mockExec = async () => '5';
			// When: Metrik wird berechnet
			const metric = await calculateProgressMetric('base', 'head', mockExec);
			// Then: Ergebnis > 0
			assert.equal(metric, 5);
		});
	});

	describe('Reproduzierbarkeit (Testfall 3)', () => {
		it('Metrik ist reproduzierbar bei gleichem Git-Status', async () => {
			// Given: Gleicher Git-Status (rev-list immer 3)
			const mockExec = async () => '3';
			// When: Metrik wird mehrfach berechnet
			const metric1 = await calculateProgressMetric('base', 'head', mockExec);
			const metric2 = await calculateProgressMetric('base', 'head', mockExec);
			const metric3 = await calculateProgressMetric('base', 'head', mockExec);
			// Then: Alle Ergebnisse identisch
			assert.equal(metric1, metric2);
			assert.equal(metric2, metric3);
		});
	});

	describe('Fehlerpfade: Git-Executor Fehler', () => {
		it('Propagiert Git-Fehler als ProgressMetricError', async () => {
			// Given: Git-Executor wirft Fehler
			const mockExec = async () => {
				throw new Error('fatal: bad revision');
			};
			// When/Then: ProgressMetricError mit cause
			await assert.rejects(calculateProgressMetric('base', 'head', mockExec), (err: Error) => {
				assert.ok(err instanceof ProgressMetricError);
				assert.ok(err.cause instanceof Error);
				assert.match((err.cause as Error).message, /bad revision/);
				return true;
			});
		});

		it('Propagiert bei nicht-existente Refs', async () => {
			const mockExec = async () => {
				throw new Error("fatal: ambiguous argument 'unknown-ref'");
			};
			await assert.rejects(calculateProgressMetric('unknown', 'head', mockExec), ProgressMetricError);
		});

		it('Propagiert bei korruptem Repo', async () => {
			const mockExec = async () => {
				throw new Error('fatal: not a git repository');
			};
			await assert.rejects(calculateProgressMetric('base', 'head', mockExec), ProgressMetricError);
		});
	});

	describe('Validation: parseInt (Finding 3)', () => {
		it('Wirft bei NaN-Output', async () => {
			const mockExec = async () => 'abc';
			await assert.rejects(calculateProgressMetric('base', 'head', mockExec), (err: Error) => {
				assert.ok(err instanceof ProgressMetricError);
				assert.match(err.message, /keine gültige nicht-negative Zahl/);
				return true;
			});
		});

		it('Wirft bei negativer Zahl', async () => {
			const mockExec = async () => '-5';
			await assert.rejects(calculateProgressMetric('base', 'head', mockExec), ProgressMetricError);
		});

		it('Akzeptiert gültige 0', async () => {
			const mockExec = async () => '0';
			const metric = await calculateProgressMetric('base', 'head', mockExec);
			assert.equal(metric, 0);
		});

		it('Akzeptiert große positive Zahlen', async () => {
			const mockExec = async () => '99999';
			const metric = await calculateProgressMetric('base', 'head', mockExec);
			assert.equal(metric, 99999);
		});

		it('Akzeptiert Whitespace-trimmed Output', async () => {
			const mockExec = async () => '  42  ';
			const metric = await calculateProgressMetric('base', 'head', mockExec);
			assert.equal(metric, 42);
		});
	});

	describe('Schwellenwert: no progress (AK 2)', () => {
		it('AK 2: 0 Commits in 2+ Läufen gilt als no progress', async () => {
			// Given: Mehrere CI-Läufe mit Metrik = 0
			const metrics = [0, 0, 0];
			// When: Schwellenwert-Check
			const isNoProgress = checkNoProgressThreshold(metrics);
			// Then: no progress
			assert.equal(isNoProgress, true);
		});

		it('AK 2: >0 Commits in einem Lauf bricht no progress', async () => {
			const metrics = [0, 0, 1];
			const isNoProgress = checkNoProgressThreshold(metrics);
			assert.equal(isNoProgress, false);
		});

		it('Leeres Array → false', async () => {
			assert.equal(checkNoProgressThreshold([]), false);
		});

		it('Ein Lauf mit 0 → false (braucht ≥2)', async () => {
			assert.equal(checkNoProgressThreshold([0]), false);
		});
	});
});
