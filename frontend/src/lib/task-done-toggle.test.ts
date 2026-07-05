import { TaskStatus } from 'client';
import { describe, expect, it } from 'vitest';
import { isDoneBlockedBySubtasks } from './task';

/**
 * Roter TDD-Vertrag für #315 (AK2) — Guard für den binären Erledigt-Toggle.
 *
 * `isDoneBlockedBySubtasks` entscheidet, ob eine Aufgabe per Toggle auf „Erledigt" geschaltet werden
 * darf: Solange mindestens eine direkte Unteraufgabe nicht `Done` ist, bleibt der Toggle gesperrt.
 *
 * Bewusst NICHT dupliziert: `allowedStatusOptions` und `doneBlockedHint` (bereits in
 * `lib/task.test.ts` getestet, #246). Diese neue Funktion kapselt ausschließlich das binäre
 * „gesperrt?"-Prädikat für den Toggle und existiert im Produktivcode noch nicht → RED (der Import
 * scheitert zur Compile-Zeit, weil der Export fehlt).
 */
describe('isDoneBlockedBySubtasks — Guard für binären Erledigt-Toggle (#315)', () => {
	it('AK2a: ohne Unteraufgaben ist der Toggle nicht gesperrt', () => {
		expect(isDoneBlockedBySubtasks([])).toBe(false);
	});

	it('AK2b: sind alle direkten Unteraufgaben Done, ist der Toggle nicht gesperrt', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.Done }, { status: TaskStatus.Done }])).toBe(false);
	});

	it('AK2c: bei mindestens einer offenen Unteraufgabe ist der Toggle gesperrt', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.Done }, { status: TaskStatus.Open }])).toBe(true);
	});

	it('AK2d: eine „In process"-Unteraufgabe sperrt den Toggle ebenfalls', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.InProcess }])).toBe(true);
	});
});
