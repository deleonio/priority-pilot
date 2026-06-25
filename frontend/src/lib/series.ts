import type { Task } from 'client';

/**
 * Kennzeichnung einer Aufgaben-Zeile als zu einer Serie gehörig (#142, AK 2). Das Badge wird aus
 * `seriesId`/`isException` eines Tasks abgeleitet und in der Aufgaben-Tabelle (`TaskTable`) gerendert.
 */
export interface SeriesBadge {
	/** `instance` = reguläre generierte Serien-Instanz, `exception` = individuell geänderte Instanz. */
	variant: 'instance' | 'exception';
	/** Sichtbares, deutsches Label für die Tabellen-Zelle. */
	label: string;
}

/**
 * Leitet aus `seriesId`/`isException` eines Tasks die sichtbare Serien-Kennzeichnung ab.
 *
 * - Einzelaufgabe (`seriesId` null/undefined) → kein Badge (`null`).
 * - Reguläre Serien-Instanz (`isException` false/fehlt) → Badge `variant: 'instance'`.
 * - Individuell geänderte Instanz (`isException` true) → Badge `variant: 'exception'`.
 *
 * Bewusst eine reine Funktion (kein DOM): die Tabelle konsumiert nur das Ergebnis fürs Rendern.
 */
export const seriesBadge = (task: Pick<Task, 'seriesId' | 'isException'>): SeriesBadge | null => {
	if (task.seriesId === null || task.seriesId === undefined) {
		return null;
	}
	if (task.isException === true) {
		return { variant: 'exception', label: 'Serie (geändert)' };
	}
	return { variant: 'instance', label: 'Serie' };
};
