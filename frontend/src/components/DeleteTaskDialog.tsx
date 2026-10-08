import type { Task } from 'client';
import type { RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
export const DeleteTaskDialog = ({ task, onClose, onDeleted, fallbackFocusRef }: DeleteTaskDialogProps) => {
	const { t } = useTranslation('tasks');
	return (
		<ConfirmDeleteDialog
			title={t('deleteTask.title')}
			body={
				<p>
					<Trans t={t} i18nKey="deleteTask.body" components={{ title: <strong>{task.title}</strong> }} />
				</p>
			}
			confirmLabel={t('deleteTask.confirm')}
			onConfirm={() => api.deleteTask({ id: task.id })}
			onClose={onClose}
			onDeleted={onDeleted}
			fallbackFocusRef={fallbackFocusRef}
		/>
	);
};
