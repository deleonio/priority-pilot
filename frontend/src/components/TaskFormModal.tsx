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
	/** Vorgewählter Formularmodus beim Anlegen (#334) — z. B. `'series'` im Vorlage-Flow (#2361). */
	initialMode?: 'task' | 'series';
	/** Verfügbare Lebensbalance-Säulen für die Zuordnung (`GET /pillars`). */
	pillars: Pillar[];
	/** Verfügbare Kategorien für die thematische Zuordnung (`GET /categories`). */
	categories?: Category[];
	/**
	 * Vorbelegung der Formularfelder beim Anlegen (`task === null`), z. B. aus der Schnellerfassung
	 * per LLM (#236). Greift nur, wenn `task` selbst keinen Wert liefert.
	 */
	initialValues?: TaskFormInitialValues;
	/** Vorgegebener Dialogtitel — override für Spezial-Flows, z. B. „Vorlage erstellen" (#2361). */
	title?: string;
	/** Siehe `TaskForm.lockMode` (#2361): Modus-Umschalter sperren + „Termin & Ort" initial auf. */
	lockMode?: boolean;
	/** Fallback-Fokusziel für die Fokus-Rückgabe beim Schließen (durchgereicht an `Modal`). */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
	/** Siehe `TaskForm.onChanged` (#2350). */
	onChanged?: () => void;
}

/**
 * Eigenständiger Dialog zum Bearbeiten (bzw. direkten Anlegen) eines Tasks: dünner `Modal`-Rahmen um
 * das {@link TaskForm}. Der Anlege-Flow mit Schnellerfassung nutzt stattdessen {@link QuickCaptureModal},
 * das denselben `TaskForm`-Body in einen **gemeinsamen** persistenten Dialog einbettet.
 */
export const TaskFormModal = ({
	task,
	parentTask = null,
	initialMode,
	pillars,
	categories,
	initialValues,
	title,
	lockMode,
	fallbackFocusRef,
	onClose,
	onSaved,
	onChanged,
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
			title={title ?? taskFormModalTitle(task, parentTask, 'task')}
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
				initialMode={initialMode}
				pillars={pillars}
				categories={categories}
				initialValues={initialValues}
				lockMode={lockMode}
				onClose={onClose}
				onSaved={onSaved}
				onChanged={onChanged}
				reopenModal={() => modalRef.current?.reopen()}
			/>
		</Modal>
	);
};

/**
 * #2361: Überführt eine bestehende Aufgabe in die Vorbelegung des Serien-Formulars (Vorlage-Flow).
 * Titel, Beschreibung, Priorität, Aufwand, Adresse (inkl. Koordinaten), Kategorie und Säulen-Verteilung
 * werden 1:1 übernommen; die Serien-Einstellungen stehen bewusst auf „Automatisch anlegen" aus und
 * „Ohne Rhythmus". Deadline, Checkliste, Status und Pin entfallen bewusst (kein Serien-Gegenstück).
 */
export const taskAsTemplateInitialValues = (task: Task): TaskFormInitialValues => ({
	title: task.title,
	description: task.description ?? '',
	priority: task.priority,
	estimatedEffort: task.estimatedEffort ?? undefined,
	address: task.address ?? '',
	latitude: task.latitude ?? undefined,
	longitude: task.longitude ?? undefined,
	categoryId: task.categoryId ?? undefined,
	pillars: task.pillars,
	autoCreate: false,
	rhythm: 'none',
});
