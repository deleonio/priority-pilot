import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import { LlmProviderToggle } from './LlmProviderToggle';
import type { FreeModel, LlmConfigInput, LlmConfigStatus } from 'client';
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
/** Anzeige-Default des Kaskaden-Modells, identisch zu `DEFAULT_OPENROUTER_MODEL` im Server. */
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export const LlmSettingsForm = () => {
	// Status aus dem Backend: ob jeweils ein Key gesetzt ist + das (nicht-geheime) Modell.
	const [status, setStatus] = useState<LlmConfigStatus | null>(null);
	// Free-Modelle für das Single-Select
	const [freeModels, setFreeModels] = useState<FreeModel[] | null>(null);
	// Write-only-Eingaben: leerer Wert = „unverändert"; nur ein getippter Wert überschreibt.
	const [mistralKeyInput, setMistralKeyInput] = useState('');
	const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
	const [model, setModel] = useState('');
	const [loadFailed, setLoadFailed] = useState(false);
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
				if (!controller.signal.aborted) setLoadFailed(true);
			});
		api
			.getFreeModels({ signal: controller.signal })
			.then((result) => {
				if (!controller.signal.aborted) setFreeModels(result.models);
			})
			.catch(() => {
				// Free-Models-Liste ist optional, bei Fehler leer lassen
			});
		return () => controller.abort();
	}, []);

	/** Schickt einen fertigen PUT-Body und übernimmt den zurückgemeldeten Status ins UI. */
	const persist = async (body: LlmConfigInput): Promise<void> => {
		setError(null);
		setSaved(false);
		setSaving(true);
		try {
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

	const save = (): Promise<void> => {
		// Nur ausgefüllte Felder übernehmen: leere Eingaben lassen den DB-Stand unverändert,
		// whitespace-only wird als „keine Eingabe" behandelt (würde serverseitig ohnehin 400 auslösen).
		const body: LlmConfigInput = {};
		if (mistralKeyInput.trim() !== '') body.mistralApiKey = mistralKeyInput.trim();
		if (openrouterKeyInput.trim() !== '') body.openrouterApiKey = openrouterKeyInput.trim();
		// Nur ein *geändertes* Modell senden. Ohne persistierte Zeile liefert `GET` den reinen
		// Anzeige-Default (`openrouter/free`); würde der ungeprüft zurückgeschrieben, stünde er als
		// echter DB-Wert in der Kaskade und `OPENROUTER_MODEL` aus der Env wäre still wirkungslos.
		if (model.trim() !== '' && model.trim() !== status?.openrouterModel) body.openrouterModel = model.trim();
		return persist(body);
	};

	/**
	 * Löscht einen persistierten Wert gezielt (leerer String) — der Env-Fallback greift danach wieder.
	 * Nötig, weil ein leeres Eingabefeld „unverändert" bedeutet und daher nie etwas löschen kann.
	 */
	const clearField = (field: keyof LlmConfigInput): Promise<void> => persist({ [field]: '' });

	// Ein Ladefehler darf keine Key-Zustände behaupten: „nicht gesetzt" würde dazu verleiten, einen
	// funktionierenden (write-only, also nicht wiederherstellbaren) Key zu überschreiben.
	if (loadFailed) {
		return (
			<KolAlert _type="error" _alert _label="Laden fehlgeschlagen">
				Die LLM-Konfiguration konnte nicht geladen werden.
			</KolAlert>
		);
	}

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

			<LlmProviderToggle />

			<p className="hint">
				Die Kaskade fragt zuerst Mistral (Primär) und lässt die Antwort optional von OpenRouter verfeinern. Aus
				Sicherheitsgründen werden gespeicherte API-Keys nicht zurückgelesen — das Feld zeigt nur, ob ein Key gesetzt
				ist. Ein leeres Eingabefeld belässt den bisherigen Wert unverändert; über „Key löschen" bzw. „Modell
				zurücksetzen" fällt die Kaskade wieder auf die Umgebungsvariablen des Servers zurück.
			</p>

			<div className="form-grid">
				<div className="llm-key-input-group" data-provider="mistral">
					<KolInputPassword
						_label="Mistral API-Key"
						_value={mistralKeyInput}
						_hint="Feld leer lassen, um den gespeicherten Key nicht zu ändern."
						_on={{
							onInput: (_event, value) => setMistralKeyInput(readString(value)),
							onChange: (_event, value) => setMistralKeyInput(readString(value)),
						}}
					/>
					{(status.hasMistralApiKey || mistralKeyInput !== '') && (
						<button
							type="button"
							aria-label="API-Key löschen"
							className="llm-key-x-button"
							disabled={saving}
							onClick={() => (mistralKeyInput !== '' ? setMistralKeyInput('') : void clearField('mistralApiKey'))}
						>
							✕
						</button>
					)}
				</div>
				<div className="llm-key-input-group" data-provider="openrouter">
					<KolInputPassword
						_label="OpenRouter API-Key"
						_value={openrouterKeyInput}
						_hint="Optional — aktiviert die Verfeinerungs-Stufe. Leer lassen, um nichts zu ändern."
						_on={{
							onInput: (_event, value) => setOpenrouterKeyInput(readString(value)),
							onChange: (_event, value) => setOpenrouterKeyInput(readString(value)),
						}}
					/>
					{(status.hasOpenrouterApiKey || openrouterKeyInput !== '') && (
						<button
							type="button"
							aria-label="API-Key löschen"
							className="llm-key-x-button"
							disabled={saving}
							onClick={() =>
								openrouterKeyInput !== '' ? setOpenrouterKeyInput('') : void clearField('openrouterApiKey')
							}
						>
							✕
						</button>
					)}
				</div>
				{freeModels !== null ? (
					<div className="llm-model-select">
						<label htmlFor="openrouter-model">OpenRouter Modell</label>
						<select
							id="openrouter-model"
							name="model"
							value={model}
							onChange={(e) => setModel(e.target.value)}
							disabled={saving}
						>
							{freeModels.map((m) => (
								<option key={m.id} value={m.id}>
									{m.name} ({m.id})
								</option>
							))}
						</select>
						<p className="hint">Modellkennung für die Verfeinerungs-Stufe.</p>
					</div>
				) : (
					<KolInputText
						_label="OpenRouter Modell"
						_value={model}
						_hint="Modellkennung für die Verfeinerungs-Stufe (Default: openrouter/free)."
						_on={{
							onInput: (_event, value) => setModel(readString(value)),
							onChange: (_event, value) => setModel(readString(value)),
						}}
					/>
				)}
				{/*
				 * Rücksetzen nur anbieten, wenn ein vom Anzeige-Default abweichendes Modell persistiert ist —
				 * genau dann verdeckt der DB-Wert ein gesetztes `OPENROUTER_MODEL`. Ohne DB-Zeile liefert
				 * `GET` den Default, ein Reset wäre dort ein wirkungsloses Schreiben.
				 */}
				{status.openrouterModel !== DEFAULT_OPENROUTER_MODEL && (
					<KolButton
						_label="Modell zurücksetzen"
						_variant="tertiary"
						_disabled={saving}
						_on={{ onClick: () => void clearField('openrouterModel') }}
					/>
				)}
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
