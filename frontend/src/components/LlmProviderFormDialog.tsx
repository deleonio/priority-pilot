import { KolAlert, KolButton, KolInputPassword, KolInputText } from '@public-ui/react-v19';
import type { LlmProvider, LlmProviderInput, LlmProviderTestResult, LlmProviderUpdate } from 'client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation(['settings', 'common', 'forms']);
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
			setError(t('categoryForm.nameEmpty'));
			return;
		}
		try {
			const url = new URL(endpoint);
			if (url.protocol !== 'http:' && url.protocol !== 'https:') {
				throw new Error('protocol');
			}
		} catch {
			setError(t('llmProviderForm.endpointInvalid'));
			return;
		}
		if (!isEdit && apiKey === '') {
			setError(t('llmProviderForm.apiKeyEmpty'));
			return;
		}
		const model = form.current.model.trim();
		if (model === '') {
			setError(t('llmProviderForm.modelEmpty'));
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
		<Modal title={isEdit ? t('llmProviderForm.editTitle') : t('llmProviderForm.createTitle')} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label={t('categoryForm.saveFailed')}>
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label={t('forms:labels.name')}
					_type="search"
					_value={nameState}
					_hint={t('llmProviderForm.nameHint')}
					_on={{
						onInput: fieldHandler('name', setNameState),
						onChange: fieldHandler('name', setNameState),
					}}
				/>
				<KolInputText
					_label={t('llmProviderForm.endpoint')}
					_value={endpointState}
					_hint={t('llmProviderForm.endpointHint')}
					_on={{
						onInput: fieldHandler('endpoint', setEndpointState),
						onChange: fieldHandler('endpoint', setEndpointState),
					}}
				/>
				<KolInputPassword
					_label={t('llmProviderForm.apiKey')}
					_value={apiKeyState}
					_hint={isEdit ? t('llmProviderForm.apiKeyHintEdit') : t('llmProviderForm.apiKeyHintCreate')}
					_on={{
						onInput: fieldHandler('apiKey', setApiKeyState),
						onChange: fieldHandler('apiKey', setApiKeyState),
					}}
				/>
				<KolInputText
					_label={t('llmProviderForm.model')}
					_type="search"
					_value={modelState}
					_hint={t('llmProviderForm.modelHint')}
					_on={{
						onInput: fieldHandler('model', setModelState),
						onChange: fieldHandler('model', setModelState),
					}}
				/>
			</div>
			{testResult !== null && testResult.ok && (
				<KolAlert _type="success" _alert _label={t('llmProviderForm.testOkLabel')}>
					{t('llmProviderForm.testOkText', {
						model: testResult.model ?? t('llmProviderForm.model'),
						latency: testResult.latencyMs ?? '?',
					})}
				</KolAlert>
			)}
			{testResult !== null && !testResult.ok && (
				<KolAlert _type="error" _alert _label={t('llmProviderForm.testFailedLabel')}>
					{testResult.message ?? t('llmProviderForm.unknownError')}
				</KolAlert>
			)}
			<div className="modal-actions">
				<KolButton
					_label={isEdit ? t('common:actions.save') : t('common:actions.create')}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton
					_label={testing ? t('llmSettings.testing') : t('llmSettings.test')}
					_variant="secondary"
					_disabled={saving || testing}
					_on={{ onClick: () => void runDryTest() }}
				/>
				<KolButton
					_label={t('common:actions.cancel')}
					_variant="secondary"
					_disabled={saving}
					_on={{ onClick: () => onClose() }}
				/>
			</div>
		</Modal>
	);
};
