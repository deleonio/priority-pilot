import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import type { FreeModel, LlmConfigStatus } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

/** Formatiert Kontext-Größe: 200000 → "200k", 1000000 → "1m" (#862). */
const formatContextLength = (contextLength: number | null | undefined): string | null => {
	if (contextLength == null) return null;
	if (contextLength >= 1_000_000) return `${Math.floor(contextLength / 1_000_000)}m`;
	if (contextLength >= 1000) return `${Math.floor(contextLength / 1000)}k`;
	return String(contextLength);
};

interface ModelSelectionDialogProps {
	/** Wird ausgelöst, wenn der Nutzer den Dialog schließt (Schließen-Button, Escape, Backdrop). */
	onClose: () => void;
	/**
	 * Optionaler Hook nach erfolgreicher Modell-Speicherung — z. B. synchronisiert das LLM-Settings-
	 * Formular (#640) damit seinen angezeigten Status, ohne die Konfiguration erneut zu laden.
	 */
	onModelSaved?: (status: LlmConfigStatus) => void;
}

/**
 * Auswahl der aktuellen kostenlosen OpenRouter-Modelle (#742).
 *
 * Beim Öffnen (Mount) werden zwei Dinge frisch geladen — bewusst ohne Client-Cache, damit jeder
 * Öffnungsvorgang den aktuellen Stand zeigt (AK4 „nicht veraltet"):
 *  - `GET /llm-config` → aktuell persistiertes Modell (Server defaultet auf `openrouter/free`),
 *  - `GET /models/free` → die dynamische Free-Modell-Liste (OpenRouter-Proxy des Servers).
 *
 * Die Auswahl persistiert über das bestehende `PUT /llm-config` (#640) und wird NUR gesendet, wenn
 * das Modell tatsächlich wechselt — sonst würde bereits das Anklicken des Defaults `openrouter/free`
 * ihn als DB-Wert pinnen und ein gesetztes `OPENROUTER_MODEL` (Env) still verdrahten (gleiche
 * Fußangel wie im LLM-Settings-Formular, siehe Kommentar dort).
 *
 * Die Listen-Items sind bewusst native Buttons (kein KoliBri-Shadow-DOM): Der e2e-Vertrag (#742)
 * klickt `[data-testid="free-model-item"]` direkt, und Screenreader erhalten mit `aria-pressed`
 * eine echte Toggle-Semantik ohne combobox-Umweg.
 */
export const ModelSelectionDialog = ({ onClose, onModelSaved }: ModelSelectionDialogProps) => {
	const [models, setModels] = useState<FreeModel[] | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [configError, setConfigError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Konfiguration und Free-Modell-Liste einmal pro Mount frisch laden. Der Abbruch-Controller
	// verhindert ein setState nach dem Schließen; Fehler werden getrennt behandelt — ein toter
	// Upstream darf die Anzeige des aktuellen Modells nicht blockieren (und umgekehrt).
	useEffect(() => {
		const controller = new AbortController();
		api
			.getLlmConfig({ signal: controller.signal })
			.then((config) => {
				if (!controller.signal.aborted) setSelected(config.openrouterModel);
			})
			.catch(async (reason) => {
				if (!controller.signal.aborted) setConfigError((await toApiError(reason)).message);
			});
		api
			.getFreeModels({ signal: controller.signal })
			.then((result) => {
				if (!controller.signal.aborted) setModels(result.models);
			})
			.catch(async (reason) => {
				if (!controller.signal.aborted) setModelsError((await toApiError(reason)).message);
			});
		return () => controller.abort();
	}, []);

	/** Speichert die Auswahl — nur bei echtem Wechsel (siehe Klassenkommentar zur Env-Fußangel). */
	const select = async (id: string): Promise<void> => {
		if (saving || id === selected) return;
		setSaveError(null);
		setSaving(true);
		try {
			const status = await api.setLlmConfig({ llmConfig: { openrouterModel: id } });
			setSelected(id);
			onModelSaved?.(status);
		} catch (reason) {
			setSaveError((await toApiError(reason)).message);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal title="KI-Modell auswählen" onClose={onClose}>
			{/* aria-live: die Auswahländerung wird Screenreadern angesagt, ohne Fokus zu verschieben. */}
			<p data-testid="current-model-display" className="model-selection-current" role="status">
				Aktuelles Modell: {selected ?? 'unbekannt'}
			</p>

			{configError !== null && (
				<KolAlert _type="error" _label="Modell-Status konnte nicht geladen werden">
					{configError}
				</KolAlert>
			)}
			{saveError !== null && (
				<KolAlert _type="error" _alert _label="Speichern fehlgeschlagen">
					{saveError}
				</KolAlert>
			)}

			{modelsError !== null && (
				<KolAlert _type="error" _label="Free-Modelle nicht verfügbar">
					Die Liste der kostenlosen Modelle konnte nicht geladen werden: {modelsError}
				</KolAlert>
			)}
			{models === null && modelsError === null && (
				<div className="loading">
					<KolSpin _show _variant="cycle" _label="Lädt" />
					<span>Free-Modelle werden geladen…</span>
				</div>
			)}

			{models !== null && (
				<ul data-testid="free-models-list" className="model-selection-list">
					{models.map((model) => {
						const isSelected = model.id === selected;
						const contextFormatted = formatContextLength(model.contextLength);
						const parts = [contextFormatted, model.modelSize ?? null].filter(Boolean);
						const metaText = parts.length > 0 ? parts.join(' · ') : null;
						return (
							<li
								key={model.id}
								data-testid="free-model-item"
								data-model-id={model.id}
								data-selected={isSelected ? 'true' : 'false'}
							>
								<button
									type="button"
									className="model-selection-item-button"
									aria-pressed={isSelected}
									disabled={saving}
									onClick={() => void select(model.id)}
								>
									<span className="model-selection-item-name">{model.name}</span>
									<span className="model-selection-item-id">{model.id}</span>
									{metaText && <span className="model-selection-item-meta">{metaText}</span>}
								</button>
							</li>
						);
					})}
				</ul>
			)}

			<div className="modal-actions">
				<KolButton
					data-testid="close-model-selection"
					_label="Schließen"
					_variant="secondary"
					_disabled={saving}
					_on={{ onClick: onClose }}
				/>
			</div>
		</Modal>
	);
};
