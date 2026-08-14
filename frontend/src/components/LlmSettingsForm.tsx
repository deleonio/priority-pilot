import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmConfigInput, LlmConfigStatus } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';

/**
 * Formular des Settings-Tabs „LLM" (#640): Status der Mistral/OpenRouter-Kaskade lesen
 * (`GET /llm-config`) und neue Keys/ein Modell speichern (`PUT /llm-config`).
 *
 * **Sicherheit (Write-Only-Keys):** Die API liefert bewusst keine Key-Werte zurück, sondern nur,
 * ob jeweils ein Key gesetzt ist. Die Eingabefelder starten daher immer leer — der gespeicherte
 * Key wird nie ins Feld geladen und damit nie in den Client transportiert. Wer einen Key ändern
 * will, tippt ihn neu ein; ein leeres Feld bedeutet „unverändert" und überschreibt nichts.
 */
export const LlmSettingsForm = () => {
	// Status aus dem Backend: ob jeweils ein Key gesetzt ist + das (nicht-geheime) Modell.
	const [status, setStatus] = useState<LlmConfigStatus | null>(null);
	// Write-only-Eingaben: leerer Wert = „unverändert"; nur ein getippter Wert überschreibt.
	const [mistralKeyInput, setMistralKeyInput] = useState('');
	const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
	const [model, setModel] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);

	// Persistierten Stand einmalig laden; der Abbruch-Controller verhindert ein setState nach Unmount.
	useEffect(() => {
		const controller = new AbortController();
		api
			.getLlmConfig({ signal: controller.signal })
			.then((config) => {
				setStatus(config);
				setModel(config.openrouterModel);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError('Die LLM-Konfiguration konnte nicht geladen werden.');
				}
			});
		return () => controller.abort();
	}, []);

	const save = async (): Promise<void> => {
		setError(null);
		setSaved(false);
		setSaving(true);
		try {
			// Nur ausgefüllte Felder übernehmen: leere Eingaben lassen den DB-Stand unverändert,
			// whitespace-only wird als „keine Eingabe" behandelt (würde serverseits ohnehin 400 auslösen).
			const body: LlmConfigInput = {};
			if (mistralKeyInput.trim() !== '') body.mistralApiKey = mistralKeyInput.trim();
			if (openrouterKeyInput.trim() !== '') body.openrouterApiKey = openrouterKeyInput.trim();
			if (model.trim() !== '') body.openrouterModel = model.trim();

			const newStatus = await api.setLlmConfig({ llmConfig: body });
			setStatus(newStatus);
			setModel(newStatus.openrouterModel);
			// Getippte Keys nach erfolgreichem Speichern aus dem Feld nehmen (und aus dem State).
			setMistralKeyInput('');
			setOpenrouterKeyInput('');
			setSaved(true);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setSaving(false);
		}
	};

	if (status === null) {
		return <p>Konfiguration wird geladen…</p>;
	}

	return (
		<>
			{/* `_alert` sorgt für role="alert" — die Erfolgsmeldung wird Screenreadern aktiv angesagt. */}
			{saved && (
				<KolAlert _type="success" _alert _label="Gespeichert">
					Die LLM-Konfiguration wurde gespeichert.
				</KolAlert>
			)}
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			<p className="hint">
				Die Kaskade fragt zuerst Mistral (Primär) und lässt die Antwort optional von OpenRouter verfeinern. Aus
				Sicherheitgründen werden gespeicherte API-Keys nicht zurückgelesen — das Feld zeigt nur, ob ein Key gesetzt ist.
				Ein leeres Eingabefeld belässt den bisherigen Key unverändert; die Umgebungsvariablen des Servers bleiben
				außerdem als Fallback wirksam.
			</p>

			<div className="form-grid">
				<p className="llm-key-state" data-provider="mistral">
					Mistral API-Key: {status.hasMistralApiKey ? 'gespeichert' : 'nicht gesetzt'}
				</p>
				<KolInputPassword
					_label="Mistral API-Key (neu)"
					_value={mistralKeyInput}
					_hint="Feld leer lassen, um den gespeicherten Key nicht zu ändern."
					_on={{
						onInput: (_event, value) => setMistralKeyInput(readString(value)),
						onChange: (_event, value) => setMistralKeyInput(readString(value)),
					}}
				/>
				<p className="llm-key-state" data-provider="openrouter">
					OpenRouter API-Key: {status.hasOpenrouterApiKey ? 'gespeichert' : 'nicht gesetzt'}
				</p>
				<KolInputPassword
					_label="OpenRouter API-Key (neu)"
					_value={openrouterKeyInput}
					_hint="Optional — aktiviert die Verfeinerungs-Stufe. Leer lassen, um nichts zu ändern."
					_on={{
						onInput: (_event, value) => setOpenrouterKeyInput(readString(value)),
						onChange: (_event, value) => setOpenrouterKeyInput(readString(value)),
					}}
				/>
				<KolInputText
					_label="OpenRouter Modell"
					_value={model}
					_hint="Modellkennung für die Verfeinerungs-Stufe (Default: openrouter/free)."
					_on={{
						onInput: (_event, value) => setModel(readString(value)),
						onChange: (_event, value) => setModel(readString(value)),
					}}
				/>
			</div>

			<div className="modal-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void save() }}
				/>
			</div>
		</>
	);
};
