import type { Task } from 'client';
import { TaskStatus } from 'client';
import i18next from '../i18n/config';

/** Auswahl-Optionen für das Status-Feld (Reihenfolge wie im Workflow), beim Aufruf übersetzt. */
const statusOptions = (): { label: string; value: TaskStatus }[] => [
	{ label: i18next.t('common:status.open'), value: TaskStatus.Open },
	{ label: i18next.t('common:status.inProcess'), value: TaskStatus.InProcess },
	{ label: i18next.t('common:status.done'), value: TaskStatus.Done },
];

/**
 * Filtert die auswählbaren Status-Optionen anhand der direkten Unteraufgaben (#246): ist mindestens
 * eine Unteraufgabe offen (nicht `Done`), fällt „Erledigt" aus der Auswahl.
 */
export const allowedStatusOptions = (subtasks: { status: TaskStatus }[]): { label: string; value: TaskStatus }[] => {
	const hasOpenSubtask = subtasks.some((s) => s.status !== TaskStatus.Done);
	if (!hasOpenSubtask) return statusOptions();
	return statusOptions().filter((o) => o.value !== TaskStatus.Done);
};

/** Liefert den Hinweistext, warum „Erledigt" bei offenen Unteraufgaben blockiert ist (#246). */
export const doneBlockedHint = (openCount: number): string => {
	if (openCount === 0) return '';
	return i18next.t('taskForm:task.doneBlocked', { count: openCount });
};

/** Formatiert eine Zahl in der aktiven Sprache mit bis zu zwei Nachkommastellen. */
export const formatNumber = (value: number): string =>
	value.toLocaleString(i18next.language, { maximumFractionDigits: 2 });

/**
 * Dialog-Titel für das Task-Formular — einheitlich für den eigenständigen Bearbeiten-Dialog
 * (`TaskFormModal`) und den Anlege-Flow (`QuickCaptureModal`), damit die Beschriftung nicht an zwei
 * Stellen driftet.
 */
export const taskFormModalTitle = (task: Task | null, parentTask: Task | null, mode?: 'task' | 'series'): string => {
	const t = (key: string, title?: string): string => i18next.t(`taskForm:task.modalTitle.${key}`, { title });
	if (task !== null) return mode === 'series' ? t('editSeries', task.title) : t('editTask', task.title);
	if (parentTask !== null) return t('subtask', parentTask.title);
	if (mode === 'task') return t('createTask');
	if (mode === 'series') return t('createSeries');
	return t('createDefault');
};

/**
 * Formatiert eine optionale Deadline als Datum in der aktiven Sprache, sonst „–".
 *
 * Eine Deadline ist ein Kalendertag: Anzeige und Eingabe erfolgen in UTC (`timeZone: 'UTC'` bzw.
 * `getUTC*`), damit sich der Tag nicht je nach Zeitzone des Nutzers um einen Tag verschiebt.
 */
export const formatDeadline = (deadline: Task['deadline']): string => {
	if (deadline === null || deadline === undefined || Number.isNaN(deadline.getTime())) {
		return '–';
	}
	return deadline.toLocaleDateString(i18next.language, {
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

/** Kurze Restzeit-Angabe einer Deadline relativ zu `now` (für das Dringlichkeits-Badge). */
export const formatRelativeDeadline = (deadline: Date, now: Date): string => {
	const days = daysUntilDeadline(deadline, now);
	if (days < 0) {
		return i18next.t('taskForm:task.overdue', { count: Math.abs(days) });
	}
	if (days === 0) {
		return i18next.t('taskForm:task.dueToday');
	}
	return i18next.t('taskForm:task.inDays', { count: days });
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

/** Liefert Badge-Text und -Typ für eine Priorität (P2-2: Priorisierung sichtbar machen). */
export const priorityBadge = (priority: number): { label: string; type: 'info' | 'warning' | 'danger' } => {
	if (priority >= 4) return { label: `P${priority}`, type: 'danger' };
	if (priority >= 2) return { label: `P${priority}`, type: 'warning' };
	return { label: `P${priority}`, type: 'info' };
};

/** Snapshot der Aufgabenformular-Werte für die Dirty-Erkennung beim Schließen (#1584, AK7). */
export interface TaskFormSnapshot {
	title: string;
	priority: number | null;
	estimatedEffort: number | null;
	description: string;
	address: string;
	deadline: string;
	categoryId: number | null;
	mode: 'task' | 'series';
	contributions: { pillarId: number; share: number; confidence: number }[];
}

/**
 * Reihenfolge-unabhängiger Vergleich der Säulen-Beiträge — gleiches Muster wie `pillarsEqual` in
 * `TaskForm.tsx` (dort nicht exportiert, daher hier eigenständig für den Snapshot-Vergleich).
 */
const contributionsEqual = (a: TaskFormSnapshot['contributions'], b: TaskFormSnapshot['contributions']): boolean => {
	if (a.length !== b.length) return false;
	const signature = (list: TaskFormSnapshot['contributions']) =>
		list
			.map((entry) => `${entry.pillarId}:${entry.share}:${entry.confidence}`)
			.sort()
			.join('|');
	return signature(a) === signature(b);
};

/**
 * Reine Dirty-Erkennung für die Schließen-Rückfrage im Aufgabenformular (#1584, AK7): vergleicht den
 * Snapshot beim Öffnen gegen den aktuellen Stand beim Schließzeitpunkt (Wert-Vergleich, nicht
 * „wurde berührt" — ein getippt-und-zurückgesetztes Feld gilt als unverändert).
 */
export const isTaskFormDirty = (initial: TaskFormSnapshot, current: TaskFormSnapshot): boolean =>
	initial.title !== current.title ||
	initial.priority !== current.priority ||
	initial.estimatedEffort !== current.estimatedEffort ||
	initial.description !== current.description ||
	initial.address !== current.address ||
	initial.deadline !== current.deadline ||
	initial.categoryId !== current.categoryId ||
	initial.mode !== current.mode ||
	!contributionsEqual(initial.contributions, current.contributions);

/**
 * Stellt angepinnte Tasks (#1582) vor alle unangepinnten — unabhängig von der Sortierung des
 * übergebenen Arrays. Unter mehreren angepinnten Tasks steht der zuletzt angepinnte zuerst
 * (`pinnedAt` absteigend); unangepinnte Tasks behalten untereinander ihre relative
 * Ausgangsreihenfolge (stabile Sortierung, kein Vergleich der beiden Gruppen gegeneinander).
 */
export const sortPinnedFirst = (tasks: Task[]): Task[] => {
	const pinned = tasks
		.filter((task) => task.pinned)
		.sort((a, b) => new Date(b.pinnedAt ?? 0).getTime() - new Date(a.pinnedAt ?? 0).getTime());
	const unpinned = tasks.filter((task) => !task.pinned);
	return [...pinned, ...unpinned];
};
