import type { Pillar, Task, TaskStatus } from 'client';
import type { RefObject } from 'react';
import { taskFormModalTitle } from '../lib/task';
import { Modal } from './Modal';
import { TaskForm, type TaskFormInitialValues } from './TaskForm';

interface TaskFormModalProps {
	/** Zu bearbeitender Task; `null` legt einen neuen Task an. */
	task: Task | null;
	/**
	 * Beim Anlegen optional die Eltern-Aufgabe: Die neue Aufgabe wird nach dem Speichern als deren
	 * Vorgänger verknüpft (Unteraufgabe über das bestehende Abhängigkeits-/Aufgabenwald-Konzept).
	 */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen für die Zuordnung (`GET /pillars`). */
	pillars: Pillar[];
	/**
	 * Vorbelegung der Formularfelder beim Anlegen (`task === null`), z. B. aus der Schnellerfassung
	 * per LLM (#236). Greift nur, wenn `task` selbst keinen Wert liefert.
	 */
	initialValues?: TaskFormInitialValues;
	/**
	 * Direkte Unteraufgaben des zu bearbeitenden Tasks (#246): steuert im `TaskForm`, ob „Erledigt"
	 * wählbar ist.
	 */
	subtasks?: { status: TaskStatus }[];
	/** Fallback-Fokusziel für die Fokus-Rückgabe beim Schließen (durchgereicht an `Modal`). */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Eigenständiger Dialog zum Bearbeiten (bzw. direkten Anlegen) eines Tasks: dünner `Modal`-Rahmen um
 * das {@link TaskForm}. Der Anlege-Flow mit Schnellerfassung nutzt stattdessen {@link QuickCaptureModal},
 * das denselben `TaskForm`-Body in einen **gemeinsamen** persistenten Dialog einbettet.
 */
export const TaskFormModal = ({
	task,
	parentTask = null,
	pillars,
	initialValues,
	subtasks,
	fallbackFocusRef,
	onClose,
	onSaved,
}: TaskFormModalProps) => (
	<Modal title={taskFormModalTitle(task, parentTask)} onClose={onClose} fallbackFocusRef={fallbackFocusRef}>
		<TaskForm
			task={task}
			parentTask={parentTask}
			pillars={pillars}
			initialValues={initialValues}
			subtasks={subtasks}
			onClose={onClose}
			onSaved={onSaved}
		/>
	</Modal>
);
