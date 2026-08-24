import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmProvider, LlmProviderInput, LlmProviderUpdate } from 'client';
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
 * Custom-Providers: Name, Endpoint (http(s)-URL) und API-Key (write-only). Das Modell wird
 * bewusst NICHT hier gesetzt, sondern danach aus der Modellliste des Providers im Settings-Tab.
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
	});
	const [nameState, setNameState] = useState(form.current.name);
	const [endpointState, setEndpointState] = useState(form.current.endpoint);
	const [apiKeyState, setApiKeyState] = useState(form.current.apiKey);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		form.current = {
			name: provider?.name ?? '',
			endpoint: provider?.endpoint ?? '',
			apiKey: '',
		};
		setNameState(form.current.name);
		setEndpointState(form.current.endpoint);
		setApiKeyState(form.current.apiKey);
	}, [provider]);

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

		setError(null);
		setSaving(true);
		try {
			if (isEdit && provider !== undefined) {
				const input: LlmProviderUpdate = { name, endpoint };
				if (apiKey !== '') {
					input.apiKey = apiKey; // Nur bei Änderung senden (leer = unverändert)
				}
				await api.updateLlmProvider({ id: provider.id, input });
			} else {
				const input: LlmProviderInput = { name, endpoint, apiKey };
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
					_value={nameState}
					_hint="Anzeigename, z. B. z.ai oder Groq"
					_on={{
						onInput: (_event: unknown, v: unknown) => {
							form.current.name = readString(v);
							setNameState(form.current.name);
						},
						onChange: (_event: unknown, v: unknown) => {
							form.current.name = readString(v);
							setNameState(form.current.name);
						},
					}}
				/>
				<KolInputText
					_label="Endpoint"
					_value={endpointState}
					_hint="OpenAI-kompatible Basis-URL (http/https), z. B. https://api.mistral.ai/v1"
					_on={{
						onInput: (_event: unknown, v: unknown) => {
							form.current.endpoint = readString(v);
							setEndpointState(form.current.endpoint);
						},
						onChange: (_event: unknown, v: unknown) => {
							form.current.endpoint = readString(v);
							setEndpointState(form.current.endpoint);
						},
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
						onInput: (_event: unknown, v: unknown) => {
							form.current.apiKey = readString(v);
							setApiKeyState(form.current.apiKey);
						},
						onChange: (_event: unknown, v: unknown) => {
							form.current.apiKey = readString(v);
							setApiKeyState(form.current.apiKey);
						},
					}}
				/>
			</div>
			<div className="modal-actions">
				<KolButton
					_label={isEdit ? 'Speichern' : 'Anlegen'}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
