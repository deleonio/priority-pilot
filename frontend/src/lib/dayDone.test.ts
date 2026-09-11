import type { Task } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
// ROTER Spec-Test (#1361, Spec docs/spec/issue-1361.md): `dayDone.ts` existiert noch nicht.
// Der Import schlägt fehl, bis das Modul die Ableitung bereitstellt.
import { istTagGeschafft } from './dayDone';

/**
 * Spec-Tests für die reine Ableitung `istTagGeschafft` (AK1/AK2/AK3, #1361): „Tag geschafft" gilt
 * nur, wenn keine offene Aufgabe existiert UND die letzte Erledigung (`letzterTag` aus
 * `GET /scores/streak`) auf den heutigen Kalendertag fällt.
 */

const baseTask: Task = {
	id: 1,
	title: 'T',
	status: TaskStatus.Done,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

const doneTask = (id: number): Task => ({ ...baseTask, id, status: TaskStatus.Done });
const openTask = (id: number): Task => ({ ...baseTask, id, status: TaskStatus.Open });
const inProcessTask = (id: number): Task => ({ ...baseTask, id, status: TaskStatus.InProcess });

describe('istTagGeschafft (#1361 AK1/AK2/AK3)', () => {
	it('AK1: keine offenen Aufgaben + letzterTag = heute → true', () => {
		expect(istTagGeschafft([doneTask(1), doneTask(2)], '2026-09-11', '2026-09-11')).toBe(true);
	});

	it('AK1: leere Aufgabenliste + letzterTag = heute → true', () => {
		expect(istTagGeschafft([], '2026-09-11', '2026-09-11')).toBe(true);
	});

	it('AK2: eine offene Aufgabe (Open) + letzterTag = heute → false', () => {
		expect(istTagGeschafft([doneTask(1), openTask(2)], '2026-09-11', '2026-09-11')).toBe(false);
	});

	it('AK2: eine Aufgabe in Bearbeitung (InProcess) + letzterTag = heute → false', () => {
		expect(istTagGeschafft([inProcessTask(1)], '2026-09-11', '2026-09-11')).toBe(false);
	});

	it('AK3: keine offenen Aufgaben, aber letzterTag = gestern → false', () => {
		expect(istTagGeschafft([doneTask(1)], '2026-09-10', '2026-09-11')).toBe(false);
	});

	it('AK3: keine offenen Aufgaben, letzterTag = null (nie erledigt) → false', () => {
		expect(istTagGeschafft([], null, '2026-09-11')).toBe(false);
	});
});
