import type { Task } from 'client';
import { TaskStatus } from 'client';

/** Auswahl-Optionen für das Status-Feld (Reihenfolge wie im Workflow). */
export const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
	{ label: 'Offen', value: TaskStatus.Open },
	{ label: 'In Bearbeitung', value: TaskStatus.InProcess },
	{ label: 'Erledigt', value: TaskStatus.Done },
];

/**
 * Filtert die auswählbaren Status-Optionen anhand der direkten Unteraufgaben (#246): ist mindestens
 * eine Unteraufgabe offen (nicht `Done`), fällt „Erledigt" aus der Auswahl.
 */
export const allowedStatusOptions = (subtasks: { status: TaskStatus }[]): { label: string; value: TaskStatus }[] => {
	const hasOpenSubtask = subtasks.some((s) => s.status !== TaskStatus.Done);
	if (!hasOpenSubtask) return STATUS_OPTIONS;
	return STATUS_OPTIONS.filter((o) => o.value !== TaskStatus.Done);
};

/** Liefert den Hinweistext, warum „Erledigt" bei offenen Unteraufgaben blockiert ist (#246). */
export const doneBlockedHint = (openCount: number): string => {
	if (openCount === 0) return '';
	return openCount === 1
		? 'Es gibt noch 1 offene Unteraufgabe. Bitte alle Unteraufgaben zuerst erledigen.'
		: `Es gibt noch ${openCount} offene Unteraufgaben. Bitte alle Unteraufgaben zuerst erledigen.`;
};

/** Formatiert eine Zahl im deutschen Format mit bis zu zwei Nachkommastellen. */
export const formatNumber = (value: number): string => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/**
 * Dialog-Titel für das Task-Formular — einheitlich für den eigenständigen Bearbeiten-Dialog
 * (`TaskFormModal`) und den Anlege-Flow (`QuickCaptureModal`), damit die Beschriftung nicht an zwei
 * Stellen driftet.
 */
export const taskFormModalTitle = (task: Task | null, parentTask: Task | null): string =>
	task !== null
		? `Task bearbeiten: ${task.title}`
		: parentTask !== null
			? `Unteraufgabe zu #${parentTask.id} – ${parentTask.title}`
			: 'Neuen Task anlegen';

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

/** Dringlichkeit einer Deadline relativ zu „jetzt" (für die farbliche Hervorhebung im Dashboard). */
export type DeadlineUrgency = 'overdue' | 'soon' | 'later';

/** Bis einschließlich dieser Resttage gilt eine Deadline als „bald fällig" (amber). */
const SOON_THRESHOLD_DAYS = 3;

const MS_PER_DAY = 86_400_000;

/**
 * Ganze Kalendertage von `now` bis `deadline` (negativ = überfällig).
 *
 * Gerechnet wird auf **UTC-Kalendertagen** – konsistent zur Anzeige (`formatDeadline` nutzt
 * `timeZone: 'UTC'`), damit sich die Dringlichkeit nicht je nach Zeitzone um einen Tag verschiebt.
 */
const daysUntilDeadline = (deadline: Date, now: Date): number => {
	const deadlineDay = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
	const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return Math.round((deadlineDay - nowDay) / MS_PER_DAY);
};

/** Klassifiziert eine Deadline relativ zu `now` in überfällig / bald / später. */
export const deadlineUrgency = (deadline: Date, now: Date): DeadlineUrgency => {
	const days = daysUntilDeadline(deadline, now);
	if (days < 0) {
		return 'overdue';
	}
	if (days <= SOON_THRESHOLD_DAYS) {
		return 'soon';
	}
	return 'later';
};

/** Kurze, deutsche Restzeit-Angabe einer Deadline relativ zu `now` (für das Dringlichkeits-Badge). */
export const formatRelativeDeadline = (deadline: Date, now: Date): string => {
	const days = daysUntilDeadline(deadline, now);
	if (days < 0) {
		const overdue = Math.abs(days);
		return overdue === 1 ? '1 Tag überfällig' : `${overdue} Tage überfällig`;
	}
	if (days === 0) {
		return 'heute fällig';
	}
	if (days === 1) {
		return 'in 1 Tag';
	}
	return `in ${days} Tagen`;
};

/** CSS-Akzentklasse je Status für die Dashboard-Kennzahlen-Karten (farbcodierter Statusbezug). */
export const statusAccentClass = (status: TaskStatus): string => {
	switch (status) {
		case TaskStatus.Open:
			return 'open';
		case TaskStatus.InProcess:
			return 'inprocess';
		case TaskStatus.Done:
			return 'done';
	}
};

/** Prüft, ob das Auf-„Erledigt"-Schalten durch offene direkte Unteraufgaben gesperrt ist (#315). */
export const isDoneBlockedBySubtasks = (subtasks: { status: TaskStatus }[]): boolean =>
	subtasks.some((s) => s.status !== TaskStatus.Done);
