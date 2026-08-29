import type { Task } from 'client';
import type { RefObject } from 'react';
import { api } from '../api';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface DeleteTaskDialogProps {
	task: Task;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** Bestätigungsdialog vor dem Löschen eines Tasks (`DELETE /tasks/{id}`). */
export const DeleteTaskDialog = ({ task, onClose, onDeleted, fallbackFocusRef }: DeleteTaskDialogProps) => (
	<ConfirmDeleteDialog
		title="Task löschen"
		body={
			<p>
				Soll der Task <strong>„{task.title}"</strong> (ID {task.id}) wirklich gelöscht werden? Diese Aktion kann nicht
				rückgängig gemacht werden.
			</p>
		}
		confirmLabel="Endgültig löschen"
		onConfirm={() => api.deleteTask({ id: task.id })}
		onClose={onClose}
		onDeleted={onDeleted}
		fallbackFocusRef={fallbackFocusRef}
	/>
);
