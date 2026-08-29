import type { Series } from 'client';
import type { RefObject } from 'react';
import { api } from '../api';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

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
 * Bestätigung. Dieser Dialog schaltet sich davor und bietet die Kaskaden-Auswahl (#553): „Ja“
 * löscht Serie + alle generierten Instanzen, „Nein“ nur die Serie. Der Initialfokus liegt auf
 * „Abbrechen“ (irreversible Aktion nicht per Enter auslösbar); Strg+Enter löst den Danger-Button
 * („Ja“ = Kaskade) aus.
 */
export const DeleteSeriesDialog = ({ series, onClose, onDeleted, fallbackFocusRef }: DeleteSeriesDialogProps) => (
	<ConfirmDeleteDialog
		title="Serie löschen"
		body={
			<p>
				Soll die Serie <strong>„{series.title}"</strong> gelöscht werden — und falls ja, sollen auch alle bereits
				generierten Instanzen mitgelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
			</p>
		}
		confirmLabel="Ja (Serie + alle Aufgaben)"
		onConfirm={() => api.deleteSeries({ id: series.id, cascade: true })}
		onClose={onClose}
		onDeleted={onDeleted}
		fallbackFocusRef={fallbackFocusRef}
		secondaryAction={{
			label: 'Nein (nur Serie, Aufgaben bleiben eigenständig)',
			// Promise bewusst zurückgeben: `ConfirmDeleteDialog` awaited ihn (Fehler-/`deleting`-Behandlung).
			onClick: () => api.deleteSeries({ id: series.id, cascade: false }),
		}}
	/>
);
