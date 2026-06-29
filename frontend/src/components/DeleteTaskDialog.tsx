import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface DeleteTaskDialogProps {
	task: Task;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** Bestätigungsdialog vor dem Löschen eines Tasks (`DELETE /tasks/{id}`). */
export const DeleteTaskDialog = ({ task, onClose, onDeleted, fallbackFocusRef }: DeleteTaskDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	const confirm = async (): Promise<void> => {
		setError(null);
		setDeleting(true);
		try {
			await api.deleteTask({ id: task.id });
			// Fokus vor dem Unmount explizit auf den Fallback verschieben — sonst übernimmt der noch
			// (asynchron) im DOM hängende Trigger-Button im Modal-Cleanup den Fokus.
			fallbackFocusRef?.current?.focus();
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	return (
		<Modal title="Task löschen" onClose={onClose} fallbackFocusRef={fallbackFocusRef}>
			{error !== null && (
				<KolAlert _type="error" _label="Löschen fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Soll der Task <strong>„{task.title}"</strong> (ID {task.id}) wirklich gelöscht werden? Diese Aktion kann nicht
				rückgängig gemacht werden.
			</p>
			<div className="modal-actions">
				<KolButton
					_label={deleting ? 'Löschen…' : 'Endgültig löschen'}
					_variant="danger"
					_disabled={deleting}
					_on={{ onClick: () => void confirm() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={deleting} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
