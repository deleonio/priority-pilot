import type { Category } from 'client';
import type { RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface CategoryDeleteDialogProps {
	/** Kategorie, die gelöscht werden soll. */
	category: Category;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** Bestätigungsdialog vor dem Löschen einer Kategorie (`DELETE /categories/{id}`). */
export const CategoryDeleteDialog = ({ category, onClose, onDeleted, fallbackFocusRef }: CategoryDeleteDialogProps) => {
	const { t } = useTranslation('settings');
	return (
		<ConfirmDeleteDialog
			title={t('categoryDeleteDialog.title')}
			body={
				<p>
					<Trans t={t} i18nKey="categoryDeleteDialog.body" components={{ name: <strong>{category.name}</strong> }} />
				</p>
			}
			confirmLabel={t('categoryDeleteDialog.confirm')}
			onConfirm={() => api.deleteCategory({ id: category.id })}
			onClose={onClose}
			onDeleted={onDeleted}
			fallbackFocusRef={fallbackFocusRef}
		/>
	);
};
