import type { Category } from 'client';
import type { RefObject } from 'react';
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
export const CategoryDeleteDialog = ({ category, onClose, onDeleted, fallbackFocusRef }: CategoryDeleteDialogProps) => (
	<ConfirmDeleteDialog
		title="Kategorie löschen"
		body={
			<p>
				Soll die Kategorie <strong>„{category.name}“</strong> wirklich gelöscht werden? Aufgaben und Serien in dieser
				Kategorie bleiben erhalten und verlieren nur ihre Zuordnung.
			</p>
		}
		confirmLabel="Endgültig löschen"
		onConfirm={() => api.deleteCategory({ id: category.id })}
		onClose={onClose}
		onDeleted={onDeleted}
		fallbackFocusRef={fallbackFocusRef}
	/>
);
