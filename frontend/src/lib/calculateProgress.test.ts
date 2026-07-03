import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import { calculateProgress, type ProgressNode } from './calculateProgress';

const node = (status: TaskStatus, dependents: ProgressNode[] = []): ProgressNode => ({
	status,
	dependents,
});

describe('calculateProgress', () => {
	it('zählt den Task selbst plus seine direkten Sub-Tasks (AK1: 0/3)', () => {
		// Task A (Open) mit den Sub-Tasks B und C (beide Open) → 0 von 3 erledigt.
		const a = node(TaskStatus.Open, [node(TaskStatus.Open), node(TaskStatus.Open)]);

		expect(calculateProgress(a)).toEqual({ done: 0, total: 3 });
	});

	it('traversiert verschachtelte dependents inkl. Sub-Sub-Tasks (AK2: 1/3)', () => {
		// A → B → C; nur C ist „Done". Der Zähler traversiert den kompletten Teilbaum: 1 von 3.
		const a = node(TaskStatus.Open, [node(TaskStatus.Open, [node(TaskStatus.Done)])]);

		expect(calculateProgress(a)).toEqual({ done: 1, total: 3 });
	});

	it('liefert keinen Fortschrittswert ohne Sub-Tasks (AK3: leeres dependents-Array)', () => {
		// Kein abhängiger Task → keine redundante 1/1-Anzeige, sondern null.
		expect(calculateProgress(node(TaskStatus.Open))).toBeNull();
		expect(calculateProgress(node(TaskStatus.Done))).toBeNull();
	});

	it('zählt gemischte Status über mehrere Sub-Tasks korrekt', () => {
		// A (Done) mit B (Done), C (In process), D (Open) → 2 von 4 erledigt.
		const a = node(TaskStatus.Done, [node(TaskStatus.Done), node(TaskStatus.InProcess), node(TaskStatus.Open)]);

		expect(calculateProgress(a)).toEqual({ done: 2, total: 4 });
	});

	it('wertet nur „Done" als erledigt (In process zählt nicht als erledigt)', () => {
		const a = node(TaskStatus.Open, [node(TaskStatus.InProcess)]);

		expect(calculateProgress(a)).toEqual({ done: 0, total: 2 });
	});

	it('zählt einen mehrfach erreichbaren Sub-Task nur einmal', () => {
		// Derselbe Sub-Task (geteilte Referenz) hängt an zwei Sub-Tasks von A und darf den Zähler
		// nicht doppelt erhöhen (Dedupe über Identität, kein exponentielles Aufblähen im DAG).
		const shared = node(TaskStatus.Done);
		const a = node(TaskStatus.Open, [node(TaskStatus.Open, [shared]), node(TaskStatus.Open, [shared])]);

		expect(calculateProgress(a)).toEqual({ done: 1, total: 4 });
	});

	it('ist robust gegen Zyklen im Teilbaum', () => {
		const a = node(TaskStatus.Open);
		const b = node(TaskStatus.Open, [a]);
		a.dependents = [b];

		expect(() => calculateProgress(a)).not.toThrow();
	});
});
