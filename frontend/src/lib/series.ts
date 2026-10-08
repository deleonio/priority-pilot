import type { Task } from 'client';
import i18next from '../i18n/config';

/**
 * Kennzeichnung einer Aufgaben-Zeile als zu einer Serie gehörig (#142, AK 2). Das Badge wird aus
 * `seriesId`/`isException` eines Tasks abgeleitet und in der Aufgaben-Tabelle (`TaskTable`) gerendert.
 */
interface SeriesBadge {
	/** `instance` = reguläre generierte Serien-Instanz, `exception` = individuell geänderte Instanz. */
	variant: 'instance' | 'exception';
	/** Sichtbares Label für die Tabellen-Zelle. */
	label: string;
}

/**
 * Leitet aus `seriesId`/`isException` eines Tasks die sichtbare Serien-Kennzeichnung ab.
 *
 * - Einzelaufgabe (`seriesId` null/undefined) → kein Badge (`null`).
 * - Reguläre Serien-Instanz (`isException` false/fehlt) → Badge `variant: 'instance'`.
 * - Individuell geänderte Instanz (`isException` true) → Badge `variant: 'exception'`.
 * - Stammt die Aufgabe aus einer Vorlage (`seriesById` liefert `autoCreate === false`, #2359), lautet das
 *   Label „Vorlage“ bzw. „Vorlage (geändert)“; ohne Eintrag bleibt es bei „Serie“.
 *
 * Bewusst eine reine Funktion (kein DOM): die Tabelle konsumiert nur das Ergebnis fürs Rendern.
 */
export const seriesBadge = (
	task: Partial<Pick<Task, 'seriesId' | 'isException'>>,
	seriesById?: ReadonlyMap<number, { autoCreate?: boolean }>,
): SeriesBadge | null => {
	if (task.seriesId === null || task.seriesId === undefined) {
		return null;
	}
	const noun = seriesById?.get(task.seriesId)?.autoCreate === false ? 'template' : 'series';
	if (task.isException === true) {
		return { variant: 'exception', label: i18next.t(`capture:seriesBadge.${noun}Changed`) };
	}
	return { variant: 'instance', label: i18next.t(`capture:seriesBadge.${noun}`) };
};
