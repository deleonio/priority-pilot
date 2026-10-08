import type { Task } from 'client';
import { KolButton } from '@public-ui/react-v19';
import { useRef, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
	const { t } = useTranslation(['tasks', 'common']);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	return (
		<Modal
			title={t('completeTask.title')}
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			<p>
				<Trans t={t} i18nKey="missedComplete.question" components={{ title: <strong>{task.title}</strong> }} />
			</p>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label={t('common:actions.cancel')}
					_variant="secondary"
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton _label={t('missedComplete.onTime')} _variant="secondary" _on={{ onClick: () => onAnswer(true) }} />
				<KolButton _label={t('missedComplete.now')} _variant="primary" _on={{ onClick: () => onAnswer(false) }} />
			</div>
		</Modal>
	);
};
