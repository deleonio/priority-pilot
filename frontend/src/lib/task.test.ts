import type { Task } from 'client';
import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import {
	allowedStatusOptions,
	deadlineUrgency,
	doneBlockedHint,
	formatRelativeDeadline,
	statusAccentClass,
	taskFormModalTitle,
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

/**
 * Roter TDD-Vertrag für #334 „Switch statt Button-Paar + dynamische Dialogtitel".
 *
 * `taskFormModalTitle` bekommt einen dritten Parameter `mode?: 'task' | 'series'`, der den Titel im
 * Anlege- wie im Bearbeiten-Modus typspezifisch macht (AK2 + AK4):
 *  - Anlegen (task === null, parentTask === null): „Aufgabe anlegen" / „Serie anlegen" je Switch-Stellung.
 *  - Bearbeiten (task !== null): „Aufgabe bearbeiten: <title>" / „Serie bearbeiten: <title>".
 *  - Unteraufgabe (parentTask !== null): unverändert „Unteraufgabe zu #<id> – <title>".
 *  - Ohne Modus (Fallback): „Neuen Task anlegen".
 *
 * Der lokale Cast `{ id, title } as Task` ist die bewusste Typ-Grenze des Vertrags — nur die für den
 * Titel relevanten Felder werden gesetzt. Diese Specs sind rot, solange `taskFormModalTitle` den
 * `mode`-Parameter ignoriert bzw. die alten Titel („Task bearbeiten: …", „Neuen Task anlegen") liefert.
 */
describe('taskFormModalTitle (#334)', () => {
	const makeTask = (id: number, title: string): Task => ({ id, title }) as Task;

	it('AK2: Anlegen im Task-Modus → „Aufgabe anlegen"', () => {
		expect(taskFormModalTitle(null, null, 'task')).toBe('Aufgabe anlegen');
	});

	it('AK2: Anlegen im Serie-Modus → „Serie anlegen"', () => {
		expect(taskFormModalTitle(null, null, 'series')).toBe('Serie anlegen');
	});

	it('AK4: Bearbeiten im Task-Modus nennt den Typ „Aufgabe bearbeiten: <title>"', () => {
		expect(taskFormModalTitle(makeTask(1, 'Steuererklärung'), null, 'task')).toBe(
			'Aufgabe bearbeiten: Steuererklärung',
		);
	});

	it('AK4: Bearbeiten im Serie-Modus nennt den Typ „Serie bearbeiten: <title>"', () => {
		expect(taskFormModalTitle(makeTask(7, 'Wöchentlicher Sport'), null, 'series')).toBe(
			'Serie bearbeiten: Wöchentlicher Sport',
		);
	});

	it('Unteraufgabe (parentTask gesetzt) bleibt unverändert', () => {
		expect(taskFormModalTitle(null, makeTask(42, 'Elternaufgabe'), 'task')).toBe('Unteraufgabe zu #42 – Elternaufgabe');
	});

	it('Bearbeiten einer Unteraufgabe (task UND parentTask gesetzt) zeigt Unteraufgaben-Titel', () => {
		expect(taskFormModalTitle(makeTask(5, 'Unteraufgabe'), makeTask(42, 'Elternaufgabe'), 'task')).toBe(
			'Aufgabe bearbeiten: Unteraufgabe',
		);
	});

	it('Fallback ohne Modus → „Neuen Task anlegen"', () => {
		expect(taskFormModalTitle(null, null)).toBe('Neuen Task anlegen');
	});
});
