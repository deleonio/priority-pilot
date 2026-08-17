import type { LlmConfigStatus } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { createPortal } from 'react-dom';
import { ModelSelectionDialog } from './ModelSelectionDialog';

/**
 * Endsegmente einer Modell-ID, die für sich genommen nichts über das Modell aussagen. Der Server
 * defaultet auf `openrouter/free` — ein Label „free" benennt dann nur die Preisklasse, nicht das
 * Modell. In diesen Fällen bleibt der Anbieter im Label stehen (siehe `toShortName`).
 */
const GENERIC_ID_SEGMENTS = new Set(['free', 'chat', 'instruct', 'preview', 'latest', 'beta']);

/**
 * Kurzname für die Anzeige im Button, abgeleitet aus der OpenRouter-Modell-ID:
 * `anthropic/claude-sonnet-5` → `sonnet-5`, `google/gemma-7b-it:free` → `gemma-7b-it`.
 *
 * Ist das letzte Segment nur eine Preis-/Varianten-Angabe (`openrouter/free`), wäre der Kurzname
 * nichtssagend — dann wird die vollständige ID (ohne `:free`-Suffix) gezeigt.
 */
const toShortName = (model: string | null): string => {
	if (model === null) {
		return 'Laden…';
	}
	const withoutTier = model.replace(/:free$/, '');
	const lastSegment = withoutTier.split('/').at(-1) ?? withoutTier;
	return GENERIC_ID_SEGMENTS.has(lastSegment.toLowerCase()) ? withoutTier : lastSegment.replace(/^claude-/, '');
};

/**
 * KI-Modell-Auswahl als nativer Button für die Toolbar (#787).
 *
 * Der Button zeigt das aktuelle Modell an und öffnet bei Klick den ModelSelectionDialog.
 * Das Element hat role="combobox" und aria-expanded für A11y-Konformität (Spec Journey 2 AK3).
 *
 * `aria-haspopup="dialog"`: Das Popup ist der modale `ModelSelectionDialog`, keine Listbox. ARIA 1.2
 * erlaubt für `combobox` genau diese Popup-Rolle. Ein `aria-controls` auf den Dialog ist bewusst
 * nicht gesetzt — `KolDialog` rendert das native `<dialog>` in seinem Shadow-DOM, und eine
 * ID-Referenz aus dem Light-DOM kann die Shadow-Grenze nicht überschreiten (sie bliebe ins Leere
 * zeigend und damit schlechter als keine).
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

	const shortName = toShortName(currentModel);

	return (
		<>
			<button
				type="button"
				className="model-selector-button"
				onClick={handleOpen}
				role="combobox"
				// Keine Options-Anzahl im Label: Die Liste der verfügbaren Modelle lädt erst der Dialog
				// (`GET /models/free`, dynamisch). Eine hier hartcodierte Zahl wäre eine Falschaussage
				// gegenüber Screenreader-Nutzenden, sobald sich die Free-Modell-Liste ändert.
				aria-label={`KI-Modellauswahl, aktuell ${shortName}. Öffnet die Liste der verfügbaren Modelle.`}
				aria-haspopup="dialog"
				aria-expanded={dialogOpen}
				title={currentModel ?? undefined}
				data-testid="model-selector-button"
			>
				<span className="model-selector-label">{shortName}</span>
				<i className="fa-solid fa-chevron-down model-selector-chevron" aria-hidden="true" />
			</button>
			{dialogOpen &&
				createPortal(<ModelSelectionDialog onClose={handleClose} onModelSaved={handleModelSaved} />, document.body)}
		</>
	);
};
