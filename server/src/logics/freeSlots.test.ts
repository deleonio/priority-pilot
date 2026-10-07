import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { effortToMinutes, findFreeSlots, fitTasksToSlots } from './freeSlots.js';

/**
 * Rote Spec-Tests für #1990 (Spec docs/spec/issue-1990.md) — AK1 (Lückenerkennung) und AK2
 * (Aufwand→Minuten, Filter, Reihenfolge). Rot, bis `freeSlots.ts` existiert. KEIN Produktivcode.
 */

const at = (h: number, m = 0): Date => new Date(2026, 9, 7, h, m, 0, 0);
const ev = (start: Date, end: Date, allDay = false) => ({ start, end, allDay });
const range = (slots: { start: Date; end: Date }[]): string[] =>
	slots.map(
		(s) =>
			`${s.start.getHours()}:${String(s.start.getMinutes()).padStart(2, '0')}-${s.end.getHours()}:${String(s.end.getMinutes()).padStart(2, '0')}`,
	);

describe('findFreeSlots (#1990 AK1)', () => {
	const now = at(9);

	it('ohne Termine: eine Lücke von jetzt bis 22:00', () => {
		assert.deepEqual(range(findFreeSlots({ events: [], now, minMinutes: 30 })), ['9:00-22:00']);
	});

	it('Termin teilt das Fenster in zwei Lücken', () => {
		const slots = findFreeSlots({ events: [ev(at(12), at(13))], now, minMinutes: 30 });
		assert.deepEqual(range(slots), ['9:00-12:00', '13:00-22:00']);
	});

	it('Lücke genau mindestens minMinutes zählt, eine Minute weniger nicht', () => {
		const events = [ev(at(9, 30), at(21, 30))];
		assert.deepEqual(range(findFreeSlots({ events, now, minMinutes: 30 })), ['9:00-9:30', '21:30-22:00']);
		assert.deepEqual(range(findFreeSlots({ events: [ev(at(9, 29), at(21, 31))], now, minMinutes: 30 })), []);
	});

	it('ganztägige Termine blockieren nicht', () => {
		const slots = findFreeSlots({ events: [ev(at(0), at(23, 59), true)], now, minMinutes: 30 });
		assert.deepEqual(range(slots), ['9:00-22:00']);
	});

	it('überlappende und anliegende Termine ergeben keine Scheinlücke', () => {
		const events = [ev(at(10), at(12)), ev(at(11), at(11, 30)), ev(at(12), at(13)), ev(at(11, 45), at(12, 15))];
		assert.deepEqual(range(findFreeSlots({ events, now, minMinutes: 10 })), ['9:00-10:00', '13:00-22:00']);
	});

	it('vergangene Zeit und Termine nach 22:00 zählen nicht', () => {
		const slots = findFreeSlots({ events: [ev(at(7), at(10)), ev(at(23), at(23, 30))], now, minMinutes: 30 });
		assert.deepEqual(range(slots), ['10:00-22:00']);
	});

	it('nach 22:00 gibt es keine Lücke', () => {
		assert.deepEqual(findFreeSlots({ events: [], now: at(22, 5), minMinutes: 30 }), []);
	});
});

describe('effortToMinutes (#1990 AK2)', () => {
	it('bildet 0.1 → 15, 0.55 → 68 (gerundet), 1.0 → 120 linear ab', () => {
		assert.equal(effortToMinutes(0.1), 15);
		assert.equal(effortToMinutes(0.55), 68);
		assert.equal(effortToMinutes(1), 120);
	});
});

describe('fitTasksToSlots (#1990 AK2)', () => {
	const slot = (s: Date, e: Date) => ({ start: s, end: e });
	const t = (id: number, estimatedEffort: number) => ({ id, title: `T${id}`, estimatedEffort });

	it('nimmt nur Aufgaben, die in die Lücke passen, und behält die Score-Reihenfolge', () => {
		const out = fitTasksToSlots([slot(at(10), at(11, 10))], [t(1, 1), t(2, 0.55), t(3, 0.1), t(4, 0.3)]);
		assert.deepEqual(
			out[0].tasks.map((x) => x.id),
			[2, 3, 4],
		);
	});

	it('Aufgabe erscheint nur in der ersten passenden Lücke; leere Lücken entfallen', () => {
		const out = fitTasksToSlots(
			[slot(at(10), at(10, 20)), slot(at(12), at(14)), slot(at(15), at(15, 20))],
			[t(1, 1), t(2, 0.1)],
		);
		assert.deepEqual(
			out.map((o) => o.tasks.map((x) => x.id)),
			[[2], [1]],
		);
	});

	it('begrenzt auf 3 Aufgaben je Lücke', () => {
		const out = fitTasksToSlots([slot(at(9), at(12))], [t(1, 0.1), t(2, 0.1), t(3, 0.1), t(4, 0.1)]);
		assert.equal(out[0].tasks.length, 3);
	});
});
