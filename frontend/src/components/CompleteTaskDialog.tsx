import type { Task } from 'client';
import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useRef, useState, type RefObject } from 'react';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface CompleteTaskDialogProps {
	/** Betroffene Aufgabe (ID + Titel werden im Dialogtext genannt). */
	task: Task;
	/** Erledigt-Aktion des Aufrufers (setzt `status: Done`). */
	onConfirm: () => Promise<void>;
	/** Schließen ohne Statusänderung (Abbrechen, Escape). */
	onClose: () => void;
	/** Nach erfolgreichem Bestätigen aufgerufen (Panel neu laden + Dialog schließen). */
	onCompleted: () => void;
	/** An `Modal` durchgereicht — der Trigger-Button fällt nach Erfolg aus dem DOM. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Nicht-destruktiver Bestätigungsdialog vor dem Erledigen einer Aufgabe (#1168) — bewusst kein
 * `ConfirmDeleteDialog`: Erledigen ist keine destruktive Aktion (keine Danger-Variante).
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

	// Initialfokus auf „Abbrechen" (#472-Muster) — konsistent mit den Lösch-Dialogen.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const handleConfirm = async (): Promise<void> => {
		setError(null);
		setCompleting(true);
		try {
			await onConfirm();
			onCompleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setCompleting(false);
		}
	};

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
				Soll die Aufgabe <strong>„{task.title}"</strong> (ID {task.id}) als erledigt markiert werden?
			</p>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={completing}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					_label={completing ? 'Wird erledigt…' : 'Als erledigt markieren'}
					_variant="primary"
					_disabled={completing}
					_on={{ onClick: () => void handleConfirm() }}
				/>
			</div>
		</Modal>
	);
};
