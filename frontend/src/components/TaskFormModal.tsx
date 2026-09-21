import type { Category, Pillar, Task } from 'client';
import { useRef, type RefObject } from 'react';
import { taskFormModalTitle } from '../lib/task';
import { Modal, type ModalHandle } from './Modal';
import { TaskForm, type TaskFormHandle, type TaskFormInitialValues } from './TaskForm';

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
	/** Verfügbare Kategorien für die thematische Zuordnung (`GET /categories`). */
	categories?: Category[];
	/**
	 * Vorbelegung der Formularfelder beim Anlegen (`task === null`), z. B. aus der Schnellerfassung
	 * per LLM (#236). Greift nur, wenn `task` selbst keinen Wert liefert.
	 */
	initialValues?: TaskFormInitialValues;
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
	categories,
	initialValues,
	fallbackFocusRef,
	onClose,
	onSaved,
}: TaskFormModalProps) => {
	// #1584: X/Escape/Backdrop laufen über `Modal.onClose` — `TaskForm.requestClose()` fragt bei
	// geänderten Werten selbst nach (AK1-AK5), statt sofort zu schließen. Der explizite
	// „Abbrechen"-Button im Formular ruft weiterhin direkt `onClose` auf (kein Umweg über den Ref).
	const taskFormRef = useRef<TaskFormHandle>(null);
	// Muss den Dialog wieder öffnen können, wenn `requestClose()` das Schließen abbricht — das native
	// `<dialog>` hat sich zu diesem Zeitpunkt bereits selbst geschlossen (s. `Modal.tsx`).
	const modalRef = useRef<ModalHandle>(null);

	return (
		<Modal
			ref={modalRef}
			title={taskFormModalTitle(task, parentTask, 'task')}
			onClose={() => {
				if (taskFormRef.current !== null) {
					taskFormRef.current.requestClose();
				} else {
					onClose();
				}
			}}
			fallbackFocusRef={fallbackFocusRef}
		>
			<TaskForm
				ref={taskFormRef}
				task={task}
				parentTask={parentTask}
				pillars={pillars}
				categories={categories}
				initialValues={initialValues}
				onClose={onClose}
				onSaved={onSaved}
				reopenModal={() => modalRef.current?.reopen()}
			/>
		</Modal>
	);
};
