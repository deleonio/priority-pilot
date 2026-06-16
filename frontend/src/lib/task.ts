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

/** Formatiert eine optionale Deadline als deutsches Datum, sonst „–". */
export const formatDeadline = (deadline: Task['deadline']): string => {
	if (deadline === null || deadline === undefined) {
		return '–';
	}
	return deadline.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

/** Wandelt eine Deadline (Date) in den Wert eines `<input type="date">` (YYYY-MM-DD) um. */
export const deadlineToDateInput = (deadline: Task['deadline']): string => {
	if (deadline === null || deadline === undefined) {
		return '';
	}
	const year = deadline.getFullYear().toString().padStart(4, '0');
	const month = (deadline.getMonth() + 1).toString().padStart(2, '0');
	const day = deadline.getDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
};
