import { KolAlert, KolInputRadio } from '@public-ui/react-v19';
import { useMemo, useState, useEffect } from 'react';
import type { LlmProvider } from '../lib/llm-provider';
import { getProvider, setProvider, setToastCallback } from '../lib/llm-provider';

/**
 * LLM-Provider-Toggle für Issue-749: Test-Schalter für Mistral und OpenRouter.
 *
 * Ermöglicht das gezielte Umleiten von LLM-Anfragen an einen bestimmten Provider.
 * Persistiert die Auswahl im localStorage.
 */
export const LlmProviderToggle = () => {
	const [provider, setProviderState] = useState<LlmProvider>(undefined);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Initialisierung: Provider aus localStorage laden
	useEffect(() => {
		setProviderState(getProvider());
	}, []);

	// Toast-Callback registrieren
	useEffect(() => {
		setToastCallback((message) => {
			setToastMessage(message);
			// Toast nach 3 Sekunden ausblenden
			setTimeout(() => setToastMessage(null), 3000);
		});
		return () => setToastCallback(null);
	}, []);

	// Optionen für die Radiogruppe (exklusive Toggles)
	const options = useMemo(
		() => [
			{ label: 'System-Standard', value: '' },
			{ label: 'Mistral', value: 'mistral' },
			{ label: 'OpenRouter', value: 'openrouter' },
		],
		[],
	);

	// Provider-Wechsel behandeln
	const handleProviderChange = (_event: unknown, value: unknown) => {
		if (typeof value !== 'string') return;

		let newProvider: LlmProvider = undefined;
		if (value === 'mistral') newProvider = 'mistral';
		else if (value === 'openrouter') newProvider = 'openrouter';
		// '' bleibt undefined (System-Standard)

		const success = setProvider(newProvider);
		if (success) {
			setProviderState(newProvider);
		}
	};

	// Mapping für KolInputRadio: undefined → '' (System-Standard)
	const radioValue = provider === undefined ? '' : provider;

	return (
		<>
			{toastMessage !== null && (
				<KolAlert _type="success" _alert _label="Provider gewechselt">
					{toastMessage}
				</KolAlert>
			)}
			<KolInputRadio
				_label="LLM-Provider"
				_orientation="horizontal"
				_options={options}
				_value={radioValue}
				_hint="Wähle den LLM-Provider für Test-Zwecke. Standard nutzt die Kaskade (Mistral primär, optional OpenRouter-Verfeinerung)."
				_on={{
					onChange: handleProviderChange,
				}}
			/>
		</>
	);
};
