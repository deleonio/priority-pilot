import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmProvider, LlmProviderInput, LlmProviderTestResult, LlmProviderUpdate } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readString } from '../lib/inputValue';
import { Modal } from './Modal';

interface LlmProviderFormDialogProps {
	/** Provider, der bearbeitet werden soll (`undefined` = Anlegen-Modus). */
	provider?: LlmProvider;
	onClose: () => void;
	/** Nach erfolgreichem Anlegen/Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Dialog zum Anlegen (`provider === undefined`) oder Bearbeiten (`provider` gesetzt) eines
 * Custom-Providers: Name, Endpoint (http(s)-URL), API-Key (write-only) und Modell. Das Modell
 * ist Pflicht, weil der `/models`-Endpoint nicht bei jedem Anbieter abrufbar ist — nach dem
 * Anlegen lässt es sich über die Modellliste des Providers im Settings-Tab ändern.
 * Basiert auf dem generischen `Modal` (KolDialog Variant `card`) und verwendet KoliBri-
 * Eingabefelder — Muster: `PillarFormDialog`.
 *
 * Die Eingaben liegen in einem Ref parallel zum State, damit KoliBri-Felder ihren Anzeigewert
 * selbst verwalten können und Strg+Enter den frischen Wert synchron liest (Race zum Re-Render).
 * Der API-Key startet im Bearbeiten-Modus bewusst LEER (write-only): leer lassen = unverändert;
 * nur ein eingegebener Wert wird gesendet.
 */
export const LlmProviderFormDialog = ({ provider, onClose, onSaved }: LlmProviderFormDialogProps) => {
	const isEdit = provider !== undefined;

	const form = useRef({
		name: provider?.name ?? '',
		endpoint: provider?.endpoint ?? '',
		apiKey: '',
		model: provider?.model ?? '',
	});
	const [nameState, setNameState] = useState(form.current.name);
	const [endpointState, setEndpointState] = useState(form.current.endpoint);
	const [apiKeyState, setApiKeyState] = useState(form.current.apiKey);
	const [modelState, setModelState] = useState(form.current.model);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	/** Ergebnis des Verbindungstests (`null` = noch keins) — #1577. */
	const [testResult, setTestResult] = useState<LlmProviderTestResult | null>(null);
	const [testing, setTesting] = useState(false);

	useEffect(() => {
		form.current = {
			name: provider?.name ?? '',
			endpoint: provider?.endpoint ?? '',
			apiKey: '',
			model: provider?.model ?? '',
		};
		setNameState(form.current.name);
		setEndpointState(form.current.endpoint);
		setApiKeyState(form.current.apiKey);
		setModelState(form.current.model);
		setTestResult(null);
	}, [provider]);

	/**
	 * Feld-Handler (onInput/onChange teilen sich die Logik): schreibt den Wert in Ref+State
	 * und verwirft ein vorhandenes Test-Ergebnis — der Alert gilt für die alten Werte und
	 * würde sonst einen Erfolg für die noch ungetestete Konfiguration behaupten.
	 */
	const fieldHandler =
		(field: 'name' | 'endpoint' | 'apiKey' | 'model', setState: (value: string) => void) =>
		(_event: unknown, value: unknown): void => {
			form.current[field] = readString(value);
			setState(form.current[field]);
			setTestResult(null);
		};

	const submit = async (): Promise<void> => {
		const name = form.current.name.trim();
		const endpoint = form.current.endpoint.trim();
		const apiKey = form.current.apiKey.trim();

		if (name === '') {
			setError('Name darf nicht leer sein.');
			return;
		}
		try {
			const url = new URL(endpoint);
			if (url.protocol !== 'http:' && url.protocol !== 'https:') {
				throw new Error('protocol');
			}
		} catch {
			setError('Endpoint muss eine gültige http(s)-URL sein (z. B. https://api.mistral.ai/v1).');
			return;
		}
		if (!isEdit && apiKey === '') {
			setError('API-Key darf beim Anlegen nicht leer sein.');
			return;
		}
		const model = form.current.model.trim();
		if (model === '') {
			setError('Modell darf nicht leer sein — die Modellliste ist nicht bei jedem Anbieter abrufbar.');
			return;
		}

		setError(null);
		setSaving(true);
		try {
			if (isEdit && provider !== undefined) {
				const input: LlmProviderUpdate = { name, endpoint, model };
				if (apiKey !== '') {
					input.apiKey = apiKey; // Nur bei Änderung senden (leer = unverändert)
				}
				await api.updateLlmProvider({ id: provider.id, input });
			} else {
				const input: LlmProviderInput = { name, endpoint, apiKey, model };
				await api.createLlmProvider({ input });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA aus, solange kein Speichern läuft.
	useCtrlEnter(() => void submit(), !saving);

	// Verbindungstest des ENTWURFS (#1577): prüft die ungespeicherten Formulardaten ohne
	// Anlegen/Verändern. Im Bearbeiten-Modus mit leerem Key-Feld wird die providerId mitgegeben —
	// der Server nutzt den gespeicherten Key („leer = unverändert", AK2).
	const runDryTest = async (): Promise<void> => {
		setTestResult(null);
		setTesting(true);
		try {
			const result = await api.testLlmProviderDraft({
				endpoint: form.current.endpoint.trim(),
				apiKey: form.current.apiKey.trim(),
				model: form.current.model.trim(),
				...(isEdit && provider !== undefined ? { providerId: provider.id } : {}),
			});
			setTestResult(result);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setTestResult({ ok: false, message: apiError.message });
		} finally {
			setTesting(false);
		}
	};

	return (
		<Modal title={isEdit ? 'Provider bearbeiten' : 'Neuen Provider anlegen'} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Name"
					_type="search"
					_value={nameState}
					_hint="Anzeigename, z. B. z.ai oder Groq"
					_on={{
						onInput: fieldHandler('name', setNameState),
						onChange: fieldHandler('name', setNameState),
					}}
				/>
				<KolInputText
					_label="Endpoint"
					_value={endpointState}
					_hint="OpenAI-kompatible Basis-URL (http/https), z. B. https://api.mistral.ai/v1"
					_on={{
						onInput: fieldHandler('endpoint', setEndpointState),
						onChange: fieldHandler('endpoint', setEndpointState),
					}}
				/>
				<KolInputPassword
					_label="API-Key"
					_value={apiKeyState}
					_hint={
						isEdit
							? 'Feld leer lassen, um den gespeicherten Key nicht zu ändern.'
							: 'Wird nie angezeigt oder zurückgelesen.'
					}
					_on={{
						onInput: fieldHandler('apiKey', setApiKeyState),
						onChange: fieldHandler('apiKey', setApiKeyState),
					}}
				/>
				<KolInputText
					_label="Modell"
					_type="search"
					_value={modelState}
					_hint="Modellkennung, z. B. glm-4.7 — später änderbar über die Modellliste."
					_on={{
						onInput: fieldHandler('model', setModelState),
						onChange: fieldHandler('model', setModelState),
					}}
				/>
			</div>
			{testResult !== null && testResult.ok && (
				<KolAlert _type="success" _alert _label="Verbindungstest erfolgreich">
					{`${testResult.model ?? 'Modell'} antwortete in ${testResult.latencyMs ?? '?'} ms.`}
				</KolAlert>
			)}
			{testResult !== null && !testResult.ok && (
				<KolAlert _type="error" _alert _label="Verbindungstest fehlgeschlagen">
					{testResult.message ?? 'Unbekannter Fehler.'}
				</KolAlert>
			)}
			<div className="modal-actions">
				<KolButton
					_label={isEdit ? 'Speichern' : 'Anlegen'}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton
					_label={testing ? 'Testen…' : 'Testen'}
					_variant="secondary"
					_disabled={saving || testing}
					_on={{ onClick: () => void runDryTest() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
