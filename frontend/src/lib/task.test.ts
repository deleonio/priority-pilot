import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import {
	allowedStatusOptions,
	deadlineUrgency,
	doneBlockedHint,
	formatRelativeDeadline,
	statusAccentClass,
} from './task';

/** Fixer Bezugszeitpunkt für deterministische Dringlichkeits-Tests (UTC-Mittag). */
const NOW = new Date('2026-07-09T12:00:00.000Z');

const utc = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

describe('deadlineUrgency', () => {
	it('markiert eine in der Vergangenheit liegende Deadline als überfällig', () => {
		expect(deadlineUrgency(utc('2026-07-01'), NOW)).toBe('overdue');
		expect(deadlineUrgency(utc('2026-07-08'), NOW)).toBe('overdue');
	});

	it('markiert heute und die nächsten drei Tage als bald fällig', () => {
		expect(deadlineUrgency(utc('2026-07-09'), NOW)).toBe('soon');
		expect(deadlineUrgency(utc('2026-07-10'), NOW)).toBe('soon');
		expect(deadlineUrgency(utc('2026-07-12'), NOW)).toBe('soon');
	});

	it('markiert ab dem vierten Tag als später', () => {
		expect(deadlineUrgency(utc('2026-07-13'), NOW)).toBe('later');
		expect(deadlineUrgency(utc('2026-08-01'), NOW)).toBe('later');
	});

	it('rechnet auf UTC-Kalendertagen unabhängig von der Tageszeit', () => {
		// `now` spät am Tag, Deadline früh am selben UTC-Tag → 0 Tage → soon, nicht overdue.
		expect(deadlineUrgency(utc('2026-07-09'), new Date('2026-07-09T23:30:00.000Z'))).toBe('soon');
	});
});

describe('formatRelativeDeadline', () => {
	it('formatiert überfällige Deadlines mit korrektem Singular/Plural', () => {
		expect(formatRelativeDeadline(utc('2026-07-08'), NOW)).toBe('1 Tag überfällig');
		expect(formatRelativeDeadline(utc('2026-07-01'), NOW)).toBe('8 Tage überfällig');
	});

	it('formatiert heute, morgen und spätere Tage', () => {
		expect(formatRelativeDeadline(utc('2026-07-09'), NOW)).toBe('heute fällig');
		expect(formatRelativeDeadline(utc('2026-07-10'), NOW)).toBe('in 1 Tag');
		expect(formatRelativeDeadline(utc('2026-07-14'), NOW)).toBe('in 5 Tagen');
	});
});

describe('statusAccentClass', () => {
	it('liefert je Status eine eindeutige Akzentklasse', () => {
		expect(statusAccentClass(TaskStatus.Open)).toBe('open');
		expect(statusAccentClass(TaskStatus.InProcess)).toBe('inprocess');
		expect(statusAccentClass(TaskStatus.Done)).toBe('done');
	});
});

/**
 * Roter TDD-Vertrag für #246 „Unteraufgaben-Done-Guard" (AK1–AK4, Frontend-Logik).
 *
 * `allowedStatusOptions` filtert die auswählbaren Status-Optionen anhand der direkten Unteraufgaben:
 * ist mindestens eine offen (nicht `Done`), fällt „Erledigt" aus der Auswahl. `doneBlockedHint`
 * liefert den zugehörigen Hinweistext an den Nutzer (AK4).
 */
describe('allowedStatusOptions', () => {
	it('AK1: ohne Unteraufgaben sind alle drei Optionen wählbar', () => {
		const options = allowedStatusOptions([]);
		const values = options.map((o) => o.value);
		expect(values).toContain(TaskStatus.Open);
		expect(values).toContain(TaskStatus.InProcess);
		expect(values).toContain(TaskStatus.Done);
		expect(options).toHaveLength(3);
	});

	it('AK2: sind alle direkten Unteraufgaben Done, ist Erledigt weiterhin wählbar', () => {
		const options = allowedStatusOptions([{ status: TaskStatus.Done }, { status: TaskStatus.Done }]);
		const values = options.map((o) => o.value);
		expect(values).toContain(TaskStatus.Done);
		expect(options).toHaveLength(3);
	});

	it('AK3: bei mindestens einer offenen Unteraufgabe fehlt Erledigt (nur Open + In process)', () => {
		const options = allowedStatusOptions([{ status: TaskStatus.Done }, { status: TaskStatus.Open }]);
		const values = options.map((o) => o.value);
		expect(values).toContain(TaskStatus.Open);
		expect(values).toContain(TaskStatus.InProcess);
		expect(values).not.toContain(TaskStatus.Done);
	});

	it('AK3: eine „In process"-Unteraufgabe blockiert Erledigt ebenfalls', () => {
		const options = allowedStatusOptions([{ status: TaskStatus.InProcess }]);
		const values = options.map((o) => o.value);
		expect(values).not.toContain(TaskStatus.Done);
	});
});

describe('doneBlockedHint', () => {
	it('AK4: bei offenen Unteraufgaben liefert einen nicht-leeren deutschen Hinweis', () => {
		const hint = doneBlockedHint(2);
		expect(typeof hint).toBe('string');
		expect(hint.length).toBeGreaterThan(0);
	});

	it('ohne offene Unteraufgaben ist der Hinweis leer', () => {
		expect(doneBlockedHint(0)).toBe('');
	});
});
