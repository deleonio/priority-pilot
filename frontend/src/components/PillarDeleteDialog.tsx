import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { Modal } from './Modal';

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
export const PillarDeleteDialog = ({ pillar, onClose, onDeleted, fallbackFocusRef }: PillarDeleteDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	const confirm = async (): Promise<void> => {
		setError(null);
		setDeleting(true);
		try {
			await api.deletePillar({ id: pillar.id });
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA „Endgültig löschen\" aus, solange kein Löschen läuft.
	useCtrlEnter(() => void confirm(), !deleting);

	return (
		<Modal title="Säule löschen" onClose={onClose} fallbackFocusRef={fallbackFocusRef}>
			{error !== null && (
				<KolAlert _type="error" _label="Löschen fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Soll die Säule <strong>„{pillar.name}“</strong> wirklich gelöscht werden? Diese Säule wird endgültig gelöscht.
				Tasks und Serien, die dieser Säule zugeordnet sind, verlieren ihre Zuordnung.
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
