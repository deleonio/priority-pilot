import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmConfigInput, LlmConfigStatus } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { ModelSelectionDialog } from './ModelSelectionDialog';

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
	// Write-only-Eingaben: leerer Wert = „unverändert"; nur ein getippter Wert überschreibt.
	const [mistralKeyInput, setMistralKeyInput] = useState('');
	const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
	const [model, setModel] = useState('');
	const [loadFailed, setLoadFailed] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);
	// Auswahl-Dialog für die aktuellen OpenRouter-Free-Modelle (#742) — schließt das Freitext-Feld
	// nicht aus, sondern ergänzt es: Wer will, tippt weiter beliebige (auch bezahlte) Modell-IDs.
	const [modelDialogOpen, setModelDialogOpen] = useState(false);

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
		// whitespace-only wird als „keine Eingabe" behandelt (würde serverseits ohnehin 400 auslösen).
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

			<p className="hint">
				Die Kaskade fragt zuerst Mistral (Primär) und lässt die Antwort optional von OpenRouter verfeinern. Aus
				Sicherheitsgründen werden gespeicherte API-Keys nicht zurückgelesen — das Feld zeigt nur, ob ein Key gesetzt
				ist. Ein leeres Eingabefeld belässt den bisherigen Wert unverändert; über „Key löschen" bzw. „Modell
				zurücksetzen" fällt die Kaskade wieder auf die Umgebungsvariablen des Servers zurück.
			</p>

			<div className="form-grid">
				<p className="llm-key-state" data-provider="mistral">
					Mistral API-Key: {status.hasMistralApiKey ? 'gespeichert' : 'nicht gesetzt'}
				</p>
				{status.hasMistralApiKey && (
					<KolButton
						_label="Mistral API-Key löschen"
						_variant="tertiary"
						_disabled={saving}
						_on={{ onClick: () => void clearField('mistralApiKey') }}
					/>
				)}
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
				{status.hasOpenrouterApiKey && (
					<KolButton
						_label="OpenRouter API-Key löschen"
						_variant="tertiary"
						_disabled={saving}
						_on={{ onClick: () => void clearField('openrouterApiKey') }}
					/>
				)}
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
				<KolButton
					_label="Free-Modelle auswählen…"
					_variant="secondary"
					_disabled={saving}
					_on={{ onClick: () => setModelDialogOpen(true) }}
				/>
				{modelDialogOpen && (
					<ModelSelectionDialog
						onClose={() => setModelDialogOpen(false)}
						// Der Dialog speichert seine Auswahl selbst (PUT /llm-config); hier wird nur der
						// angezeigte Status nachgezogen — derselbe Zustand, den auch persist() setzt.
						onModelSaved={(newStatus) => {
							setStatus(newStatus);
							setModel(newStatus.openrouterModel);
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
