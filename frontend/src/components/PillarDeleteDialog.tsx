import type { Pillar } from 'client';
import type { RefObject } from 'react';
import { api } from '../api';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface PillarDeleteDialogProps {
	/** Säule, die gelöscht werden soll. */
	pillar: Pillar;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/** Bestätigungsdialog vor dem Löschen einer Säule (`DELETE /pillars/{id}`). */
export const PillarDeleteDialog = ({ pillar, onClose, onDeleted, fallbackFocusRef }: PillarDeleteDialogProps) => (
	<ConfirmDeleteDialog
		title="Säule löschen"
		body={
			<p>
				Soll die Säule <strong>„{pillar.name}“</strong> wirklich gelöscht werden? Diese Säule wird endgültig gelöscht.
				Tasks und Serien, die dieser Säule zugeordnet sind, verlieren ihre Zuordnung.
			</p>
		}
		confirmLabel="Endgültig löschen"
		onConfirm={() => api.deletePillar({ id: pillar.id })}
		onClose={onClose}
		onDeleted={onDeleted}
		fallbackFocusRef={fallbackFocusRef}
	/>
);
