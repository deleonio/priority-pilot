import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgressMetric, checkNoProgressThreshold } from './progress-metric';

/**
 * Issue 611: CI Fortschrittsmetrik
 * Spec: docs/spec/issue-611.md
 *
 * Testet die Fortschrittsmetrik für CI-Läufe basierend auf Commit-Anzahl.
 */

describe('Progress Metric (Issue 611)', () => {
	describe('Metrik-Berechnung: base..HEAD Commits', () => {
		it('AK 1: Metrik = 0 bei keinem Fortschritt (keine Commits seit Start)', async () => {
			// Given: CI-Lauf ohne neue Commits seit Start
			// When: Metrik wird berechnet über git rev-list --count base..HEAD
			// Then: Ergebnis = 0 (kein Fortschritt)

			const baseRef = 'run-start-sha';
			const currentHead = 'run-start-sha'; // Keine Bewegung

			const metric = await calculateProgressMetric(baseRef, currentHead);
			assert.equal(metric, 0);
		});

		it('AK 1: Metrik > 0 bei echtem Fortschritt (Commits vorhanden)', async () => {
			// Given: CI-Lauf mit neuen Commits seit Start
			// When: Metrik wird berechnet über git rev-list --count base..HEAD
			// Then: Ergebnis > 0 (Fortschritt vorhanden)

			const baseRef = 'run-start-sha';
			const currentHead = 'new-commit-sha'; // HEAD hat bewegt

			const metric = await calculateProgressMetric(baseRef, currentHead);
			assert.ok(metric > 0);
		});
	});

	describe('Reproduzierbarkeit (Testfall 3)', () => {
		it('Metrik ist reproduzierbar bei gleichem Git-Status', async () => {
			// Given: Gleicher Git-Status (base..HEAD identisch)
			// When: Metrik wird mehrfach berechnet
			// Then: Alle Ergebnisse sind identisch

			const baseRef = 'run-start-sha';
			const currentHead = 'same-head-sha';

			const metric1 = await calculateProgressMetric(baseRef, currentHead);
			const metric2 = await calculateProgressMetric(baseRef, currentHead);
			const metric3 = await calculateProgressMetric(baseRef, currentHead);

			assert.equal(metric1, metric2);
			assert.equal(metric2, metric3);
		});
	});

	describe('Schwellenwert: no progress (AK 2)', () => {
		it('AK 2: 0 Commits in 2+ Läufen gilt als no progress', async () => {
			// Given: Mehrere CI-Läufe mit Metrik = 0
			// When: Schwellenwert-Check wird ausgeführt
			// Then: Ergebnis = "no progress" (keine Fortschritt-Bewegung)

			const metrics = [0, 0, 0]; // 3 Läufe, alle 0
			const isNoProgress = checkNoProgressThreshold(metrics);

			assert.equal(isNoProgress, true);
		});

		it('AK 2: >0 Commits in einem Lauf bricht no progress', async () => {
			// Given: Mindestens ein Lauf mit Metrik > 0
			// When: Schwellenwert-Check wird ausgeführt
			// Then: Ergebnis = "progress" (Fortschritt vorhanden)

			const metrics = [0, 0, 1]; // 2 Läufe 0, 1 Lauf mit Fortschritt
			const isNoProgress = checkNoProgressThreshold(metrics);

			assert.equal(isNoProgress, false);
		});
	});
});
