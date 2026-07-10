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

/**
 * Roter TDD-Vertrag für #413 — Der „Erledigt"-Schalter darf nur bei Leaf Tasks aktiv sein.
 *
 * Die Funktion `isDoneBlockedBySubtasks` entscheidet korrekt, ob eine Aufgabe per Toggle auf
 * „Erledigt" geschaltet werden darf. Diese Tests stellen sicher, dass die Entscheidung nur
 * von der tatsächlichen Aufgabenstruktur abhängt, nicht von der Anzeigeposition im Baum.
 *
 * Insbesondere bei gefilterter Darstellung (z.B. Suchfilter) darf eine Oberaufgabe nicht
 * fälschlicherweise einen aktivierten Schalter erhalten, wenn sie semantisch noch offene
 * Unteraufgaben hat.
 */
describe('isDoneBlockedBySubtasks — Unabhängig von Anzeigeposition (#413)', () => {
	it('AK-413-1: Oberaufgabe mit einem offenen Kind sperrt den Toggle', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.Open }, { status: TaskStatus.Done }])).toBe(true);
	});

	it('AK-413-2: Oberaufgabe mit einem „In process"-Kind sperrt den Toggle', () => {
		expect(
			isDoneBlockedBySubtasks([
				{ status: TaskStatus.Done },
				{ status: TaskStatus.Done },
				{ status: TaskStatus.InProcess },
			]),
		).toBe(true);
	});

	it('AK-413-3: Oberaufgabe mit allen erledigten Kindern sperrt den Toggle nicht', () => {
		expect(
			isDoneBlockedBySubtasks([{ status: TaskStatus.Done }, { status: TaskStatus.Done }, { status: TaskStatus.Done }]),
		).toBe(false);
	});

	it('AK-413-4: Oberaufgabe mit nur einem erledigten Kind sperrt den Toggle nicht', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.Done }])).toBe(false);
	});

	it('AK-413-5: Leaf-Task (keine Unteraufgaben) sperrt den Toggle nicht', () => {
		expect(isDoneBlockedBySubtasks([])).toBe(false);
	});

	it('AK-413-6: Gemischte Unteraufgaben (mindestens eine offen) sperrt den Toggle', () => {
		expect(
			isDoneBlockedBySubtasks([{ status: TaskStatus.Done }, { status: TaskStatus.Open }, { status: TaskStatus.Done }]),
		).toBe(true);
	});

	it('AK-413-7: Alle Kinder „In process" sperrt den Toggle', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.InProcess }, { status: TaskStatus.InProcess }])).toBe(true);
	});

	it('AK-413-8: Einziges Kind „In process" sperrt den Toggle', () => {
		expect(isDoneBlockedBySubtasks([{ status: TaskStatus.InProcess }])).toBe(true);
	});
});
