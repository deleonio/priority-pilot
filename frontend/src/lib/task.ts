import type { Task } from 'client';
import { TaskStatus } from 'client';

/** Auswahl-Optionen für das Status-Feld (Reihenfolge wie im Workflow). */
export const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
	{ label: 'Offen', value: TaskStatus.Open },
	{ label: 'In Bearbeitung', value: TaskStatus.InProcess },
	{ label: 'Erledigt', value: TaskStatus.Done },
];

/** Deutsches Label für einen Status (Fallback: der Rohwert). */
export const statusLabel = (status: TaskStatus): string =>
	STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

/** Formatiert eine Zahl im deutschen Format mit bis zu zwei Nachkommastellen. */
export const formatNumber = (value: number): string => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/**
 * Formatiert eine optionale Deadline als deutsches Datum, sonst „–".
 *
 * Eine Deadline ist ein Kalendertag: Anzeige und Eingabe erfolgen in UTC (`timeZone: 'UTC'` bzw.
 * `getUTC*`), damit sich der Tag nicht je nach Zeitzone des Nutzers um einen Tag verschiebt.
 */
export const formatDeadline = (deadline: Task['deadline']): string => {
	if (deadline === null || deadline === undefined || Number.isNaN(deadline.getTime())) {
		return '–';
	}
	return deadline.toLocaleDateString('de-DE', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone: 'UTC',
	});
};

/** Wandelt eine Deadline (Date) in den Wert eines `<input type="date">` (YYYY-MM-DD, UTC) um. */
export const deadlineToDateInput = (deadline: Task['deadline']): string => {
	if (deadline === null || deadline === undefined || Number.isNaN(deadline.getTime())) {
		return '';
	}
	const year = deadline.getUTCFullYear().toString().padStart(4, '0');
	const month = (deadline.getUTCMonth() + 1).toString().padStart(2, '0');
	const day = deadline.getUTCDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
};
