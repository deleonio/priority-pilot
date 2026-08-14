import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmConfig } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';

/**
 * Formular des Settings-Tabs „LLM" (#640): Keys und Modell der Mistral/OpenRouter-Kaskade lesen
 * (`GET /llm-config`) und speichern (`PUT /llm-config`). Die API-Keys werden bewusst als
 * Passwort-Feld gerendert, damit sie nicht im Klartext auf dem Bildschirm stehen.
 *
 * Die Eingaben liegen — wie im übrigen UI (siehe `PillarFormDialog`) — in einem Ref, damit die
 * KoliBri-Felder ihren Anzeigewert selbst verwalten; der Anzeigewert wird zusätzlich als State
 * geführt, damit der geladene Serverstand nach dem Mount in die Felder kommt.
 */
export const LlmSettingsForm = () => {
	const form = useRef<LlmConfig>({ mistralApiKey: '', openrouterApiKey: '', openrouterModel: '' });
	const [values, setValues] = useState<LlmConfig | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);

	// Persistierten Stand einmalig laden; der Abbruch-Controller verhindert ein setState nach Unmount.
	useEffect(() => {
		const controller = new AbortController();
		api
			.getLlmConfig({ signal: controller.signal })
			.then((config) => {
				form.current = config;
				setValues(config);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError('Die LLM-Konfiguration konnte nicht geladen werden.');
					setValues({ mistralApiKey: '', openrouterApiKey: '', openrouterModel: '' });
				}
			});
		return () => controller.abort();
	}, []);

	const update = (field: keyof LlmConfig, value: unknown): void => {
		form.current = { ...form.current, [field]: readString(value) };
	};

	const save = async (): Promise<void> => {
		setError(null);
		setSaved(false);
		setSaving(true);
		try {
			const persisted = await api.setLlmConfig({ llmConfig: form.current });
			form.current = persisted;
			setValues(persisted);
			setSaved(true);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setSaving(false);
		}
	};

	if (values === null) {
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
				Die Kaskade fragt zuerst Mistral (Primär) und lässt die Antwort optional von OpenRouter verfeinern. Gespeicherte
				Werte haben Vorrang vor den Umgebungsvariablen des Servers; leere Felder fallen darauf zurück.
			</p>

			<div className="form-grid">
				<KolInputPassword
					_label="Mistral API-Key"
					_value={values.mistralApiKey}
					_hint="Primär-Provider der Kaskade."
					_on={{
						onInput: (_event, value) => update('mistralApiKey', value),
						onChange: (_event, value) => update('mistralApiKey', value),
					}}
				/>
				<KolInputPassword
					_label="OpenRouter API-Key"
					_value={values.openrouterApiKey}
					_hint="Optional — aktiviert die Verfeinerungs-Stufe."
					_on={{
						onInput: (_event, value) => update('openrouterApiKey', value),
						onChange: (_event, value) => update('openrouterApiKey', value),
					}}
				/>
				<KolInputText
					_label="OpenRouter Modell"
					_value={values.openrouterModel}
					_hint="Modellkennung für die Verfeinerungs-Stufe (Default: openrouter/free)."
					_on={{
						onInput: (_event, value) => update('openrouterModel', value),
						onChange: (_event, value) => update('openrouterModel', value),
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
