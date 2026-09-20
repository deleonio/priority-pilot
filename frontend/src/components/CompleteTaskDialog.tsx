import type { ChecklistItem, Task } from 'client';
import { KolAlert, KolButton, KolInputCheckbox } from '@public-ui/react-v19';
import { useRef, useState, type RefObject } from 'react';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface CompleteTaskDialogProps {
	/** Betroffene Aufgabe (Titel im Dialogtext, `task.checklist` für die Checklisten-Sektion). */
	task: Task;
	/** Speichert den Checklisten-Stand und, wenn `allChecked`, zusätzlich `status: Done`. */
	onConfirm: (checklist: ChecklistItem[], allChecked: boolean) => Promise<void>;
	/** Schließen ohne Statusänderung (Abbrechen, Escape). */
	onClose: () => void;
	/** Nach erfolgreichem Bestätigen aufgerufen (Panel neu laden + Dialog schließen). */
	onCompleted: () => void;
	/** An `Modal` durchgereicht — der Trigger-Button fällt nach Erfolg aus dem DOM. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Fehlt die Checkliste oder sind bereits alle Einträge abgehakt, verhält sich der Dialog wie vor
 * #1583 (kein Sektion, keine `checklist` im Payload) — sonst zeigt er die Checklisten-Sektion.
 */
export const hasOpenChecklistItems = (checklist?: ChecklistItem[]): boolean =>
	checklist !== undefined && checklist.some((item) => !item.completed);

/**
 * Nicht-destruktiver Bestätigungsdialog vor dem Erledigen einer Aufgabe (#1168) — bewusst kein
 * `ConfirmDeleteDialog`: Erledigen ist keine destruktive Aktion (keine Danger-Variante). Hat die
 * Aufgabe offene Checklisten-Einträge, zeigt der Dialog eine Checklisten-Sektion; der Hauptknopf
 * speichert dann immer den Checklisten-Stand, `status: Done` folgt nur, wenn dabei alle Einträge
 * abgehakt sind (#1583).
 */
export const CompleteTaskDialog = ({
	task,
	onConfirm,
	onClose,
	onCompleted,
	fallbackFocusRef,
}: CompleteTaskDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [completing, setCompleting] = useState(false);
	const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? []);

	// Sichtbarkeit einmalig aus dem Ausgangszustand ableiten (#1583 AK8) — bleibt an, auch wenn der
	// letzte offene Eintrag lokal abgehakt wird, statt während der Eingabe zu verschwinden.
	const showChecklistSection = hasOpenChecklistItems(task.checklist);
	const allChecked = checklist.every((item) => item.completed);

	// Initialfokus auf „Abbrechen" (#472-Muster) — konsistent mit den Lösch-Dialogen.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const toggleItem = (id: string): void => {
		setChecklist((prev) => prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
	};

	const checkAllItems = (): void => {
		setChecklist((prev) => prev.map((item) => ({ ...item, completed: true })));
	};

	const handleConfirm = async (): Promise<void> => {
		setError(null);
		setCompleting(true);
		try {
			await onConfirm(checklist, allChecked);
			onCompleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setCompleting(false);
		}
	};

	const mainLabel = completing ? 'Wird erledigt…' : allChecked ? 'Als erledigt markieren' : 'Checkliste speichern';

	return (
		<Modal
			title="Aufgabe erledigen"
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<div role="alert">
					<KolAlert _type="error" _label="Erledigen fehlgeschlagen">
						{error}
					</KolAlert>
				</div>
			)}
			<p>
				Soll die Aufgabe <strong>„{task.title}"</strong> als erledigt markiert werden?
			</p>
			{showChecklistSection && (
				<div className="checklist-section" data-testid="checklist-section">
					{checklist.map((item) => (
						<div key={item.id} className="checklist-item" data-testid="checklist-item">
							<KolInputCheckbox
								_label="Erledigen"
								_variant="switch"
								_checked={item.completed}
								_on={{ onChange: () => toggleItem(item.id) }}
							/>
							<span className="checklist-item-title">{item.title}</span>
						</div>
					))}
					<KolButton
						_label="Alle abhaken"
						_variant="secondary"
						_disabled={completing}
						_on={{ onClick: () => checkAllItems() }}
					/>
				</div>
			)}
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={completing}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					_label={mainLabel}
					_variant="primary"
					_disabled={completing}
					_on={{ onClick: () => void handleConfirm() }}
				/>
			</div>
		</Modal>
	);
};
