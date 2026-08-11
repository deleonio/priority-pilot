import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { Series } from 'client';
import { useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { Modal } from './Modal';

interface DeleteSeriesDialogProps {
	/** Serie, die gelöscht werden soll. */
	series: Series;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Bestätigungsdialog vor dem Löschen eines Serien-Templates (`DELETE /series/{id}`).
 *
 * #472: Bislang erfolgte die Serien-Löschung aus der Serien-Verwaltung (`SeriesTab`) sofort ohne
 * Bestätigung. Dieser Dialog schaltet sich davor: Er erfordert ein bewusstes „Endgültig löschen"
 * und fokussiert initial den „Abbrechen"-Button (sicherer Initialfokus — die irreversible Aktion
 * ist nicht per Enter auslösbar, bevor der Nutzer den Fokus verlagert). Aufbau analog zu
 * `DeleteTaskDialog` / `PillarDeleteDialog`.
 */
export const DeleteSeriesDialog = ({ series, onClose, onDeleted, fallbackFocusRef }: DeleteSeriesDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// „Nein" ist der sicherere Initialfokus (#553): die kaskadierende Löschung (Ja) soll nicht per
	// Enter versehentlich auslösbar sein, bevor der Nutzer den Fokus bewusst verlagert.
	const noRef = useRef<HTMLKolButtonElement>(null);

	const confirm = async (cascade: boolean): Promise<void> => {
		setError(null);
		setDeleting(true);
		try {
			await api.deleteSeries({ id: series.id, cascade });
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den sicheren Default („Nein" = nur Serie) aus — keine
	// versehentliche Kaskade über das Tastenkürzel.
	useCtrlEnter(() => void confirm(false), !deleting);

	return (
		<Modal
			title="Serie löschen"
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={noRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label="Löschen fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Soll die Serie <strong>„{series.title}"</strong> gelöscht werden — und falls ja, sollen auch alle bereits
				generierten Instanzen mitgelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
			</p>
			<div className="modal-actions">
				<KolButton
					_label={deleting ? 'Löschen…' : 'Ja (Serie + alle Aufgaben)'}
					_variant="danger"
					_disabled={deleting}
					_on={{ onClick: () => void confirm(true) }}
				/>
				<KolButton
					ref={noRef}
					_label="Nein (nur Serie, Aufgaben bleiben als eigenständig)"
					_variant="secondary"
					_disabled={deleting}
					_on={{ onClick: () => void confirm(false) }}
				/>
				<KolButton _label="Abbrechen" _variant="ghost" _disabled={deleting} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
