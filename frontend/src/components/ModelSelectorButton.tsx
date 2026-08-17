import type { LlmConfigStatus } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { createPortal } from 'react-dom';
import { ModelSelectionDialog } from './ModelSelectionDialog';

/**
 * KI-Modell-Auswahl als nativer Button für die Toolbar (#787).
 *
 * Der Button zeigt das aktuelle Modell an und öffnet bei Klick den ModelSelectionDialog.
 * Das Element hat role="combobox" und aria-expanded für A11y-Konformität (Spec Journey 2 AK3).
 */
export const ModelSelectorButton = () => {
	const [currentModel, setCurrentModel] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	// Aktuelles Modell beim Mount laden
	useEffect(() => {
		const controller = new AbortController();
		api
			.getLlmConfig({ signal: controller.signal })
			.then((config) => {
				if (!controller.signal.aborted) setCurrentModel(config.openrouterModel);
			})
			.catch(async (reason) => {
				// Fehler stillschweigend ignorieren — das UI zeigt "Laden…" bis zum nächsten Reload
				console.error('Modell-Status konnte nicht geladen werden:', await toApiError(reason));
			});
		return () => controller.abort();
	}, []);

	const handleOpen = useCallback((): void => setDialogOpen(true), []);
	const handleClose = useCallback((): void => setDialogOpen(false), []);

	// Nach Speicherung: aktualisiertes Modell vom Dialog übernehmen
	const handleModelSaved = useCallback((status: LlmConfigStatus) => {
		setCurrentModel(status.openrouterModel);
	}, []);

	// Kurzname des Modells (z.B. "Sonnet 5" aus "anthropic/claude-sonnet-5")
	const shortName = currentModel?.split('/').pop()?.replace('claude-', '').replace('claude-', '') ?? 'Laden…';

	return (
		<>
			<button
				type="button"
				className="model-selector-button"
				onClick={handleOpen}
				role="combobox"
				aria-label={`KI-Modellauswahl, aktuell ${shortName}. 5 Modelle verfügbar.`}
				aria-expanded={dialogOpen}
				data-testid="model-selector-button"
			>
				{shortName}
				<i className="fa-solid fa-chevron-down model-selector-chevron" aria-hidden="true" />
			</button>
			{dialogOpen &&
				createPortal(<ModelSelectionDialog onClose={handleClose} onModelSaved={handleModelSaved} />, document.body)}
		</>
	);
};
