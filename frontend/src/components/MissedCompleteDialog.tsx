import type { Task } from 'client';
import { KolButton } from '@public-ui/react-v19';
import { useRef, type RefObject } from 'react';
import { Modal } from './Modal';

interface MissedCompleteDialogProps {
	/** Verpasste Aufgabe, die erledigt werden soll (Titel im Dialogtext). */
	task: Task;
	/** `true` = „Nein, pünktlich" (Erledigt-Zeitpunkt = Deadline), `false` = „Ja, jetzt". */
	onAnswer: (onTime: boolean) => void;
	/** Schließen ohne Statusänderung (Abbrechen, Escape). */
	onClose: () => void;
	/** An `Modal` durchgereicht — der Trigger-Button fällt nach Erfolg aus dem DOM. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Nachfrage vor dem Erledigen einer verpassten Aufgabe: wurde sie erst jetzt erledigt oder schon
 * pünktlich und nur nicht abgehakt? „Pünktlich" bucht die Erledigung zur Deadline (volle Punkte,
 * Streak am Fälligkeitstag). Nicht-destruktiv wie `CompleteTaskDialog`, Initialfokus „Abbrechen".
 */
export const MissedCompleteDialog = ({ task, onAnswer, onClose, fallbackFocusRef }: MissedCompleteDialogProps) => {
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	return (
		<Modal
			title="Aufgabe erledigen"
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			<p>
				Aufgabe <strong>„{task.title}"</strong> erst jetzt erledigt?
			</p>
			<div className="modal-actions">
				<KolButton ref={cancelRef} _label="Abbrechen" _variant="secondary" _on={{ onClick: () => onClose() }} />
				<KolButton _label="Nein, pünktlich" _variant="secondary" _on={{ onClick: () => onAnswer(true) }} />
				<KolButton _label="Ja, jetzt" _variant="primary" _on={{ onClick: () => onAnswer(false) }} />
			</div>
		</Modal>
	);
};
