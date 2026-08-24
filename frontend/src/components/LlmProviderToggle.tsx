import { KolAlert, KolInputRadio } from '@public-ui/react-v19';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { LlmProvider } from 'client';
import { setProvider, setToastCallback } from '../lib/llm-provider';
import { useIsMobile } from '../lib/use-is-mobile';

/**
 * LLM-Provider-Auswahl: dynamische Radio-Group über alle konfigurierten Provider
 * (`GET /llm-providers`, #951) statt der festen Mistral/OpenRouter-Umschaltung (#749).
 *
 * - Radio-Auswahl = serverseitig aktiver Provider: Klick löst `POST
 *   /llm-providers/{id}/activate` aus (alle anderen werden deaktiviert).
 * - Zusätzlich pinnt die Auswahl lokale LLM-Anfragen auf den Provider (Query-Parameter,
 *   Muster aus #749) — „System-Standard“ hebt das Pinning auf.
 * - Ist kein Provider konfiguriert, zeigt die Gruppe nur „System-Standard“ mit Hinweis
 *   (die Kaskade bleibt serverseitiger Fallback, solange kein Provider aktiv ist).
 * - Auf Mobile (<768px) werden die Optionen vertikal gestapelt (useIsMobile aus ../lib).
 */
export const LlmProviderToggle = () => {
	const [providers, setProviders] = useState<LlmProvider[] | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const isMobile = useIsMobile();

	// Provider-Liste einmalig laden (inkl. Aktiv-Markierung des Servers).
	useEffect(() => {
		let cancelled = false;
		api
			.listLlmProviders()
			.then((list) => {
				if (!cancelled) setProviders(list);
			})
			.catch(() => {
				if (!cancelled) setError('Provider-Liste konnte nicht geladen werden.');
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Toast-Callback registrieren (Feedback beim Wechsel, siehe lib/llm-provider).
	useEffect(() => {
		setToastCallback((message) => {
			setToastMessage(message);
			// Toast nach 3 Sekunden ausblenden
			setTimeout(() => setToastMessage(null), 3000);
		});
		return () => setToastCallback(null);
	}, []);

	const activeProvider = useMemo(() => providers?.find((p) => p.isActive) ?? null, [providers]);

	// Radio-Wert: '' = System-Standard, sonst die Provider-ID als String (stabil & eindeutig).
	const radioValue = activeProvider === null ? '' : String(activeProvider.id);

	const handleProviderChange = useCallback(
		(_event: unknown, value: unknown): void => {
			if (providers === null || typeof value !== 'string') return;
			if (value === '') {
				// System-Standard: lokales Pinning aufheben (Server-Aktivierung bleibt unangetastet).
				setProvider(undefined);
				return;
			}
			const selected = providers.find((p) => String(p.id) === value);
			if (selected === undefined) return;

			// Serverseitig aktivieren + lokal pinnen (Toast kommt aus dem Lib-Callback).
			void api
				.activateLlmProvider({ id: selected.id })
				.then(() => {
					// Pinning nutzt die schlanke Lib-Form (ohne isActive) — das localStorage-Format
					// bleibt dadurch stabil, auch wenn das DTO künftig Felder ergänzt.
					const { id, name, endpoint, model } = selected;
					setProvider({ id, name, endpoint, model });
					// Radio-Gruppe sofort spiegeln: Der Server hat umgeschaltet — ohne dieses
					// State-Update wuerde ein Re-Render (z. B. der Toast) die Auswahl auf den
					// VORHER aktiven Provider zuruecksetzen.
					setProviders((current) => current?.map((p) => ({ ...p, isActive: p.id === selected.id })) ?? current);
				})
				.catch(() => {
					setProviders((current) => current); // kein State-Rerender nötig; Fehler Alert unten
					setToastMessage(null);
					setError(`„${selected.name}“ konnte nicht aktiviert werden.`);
				});
		},
		[providers],
	);

	// Optionen: System-Standard + je konfiguriertem Provider eine Option (Label = Name).
	const options = useMemo(() => {
		const providerOptions = (providers ?? []).map((p) => ({ label: p.name, value: String(p.id) }));
		return [{ label: 'System-Standard', value: '' }, ...providerOptions];
	}, [providers]);

	return (
		<>
			{toastMessage !== null && (
				<KolAlert _type="success" _alert _label="Provider gewechselt">
					{toastMessage}
				</KolAlert>
			)}
			{error !== null && (
				<KolAlert _type="error" _alert _label="Provider-Wechsel fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<KolInputRadio
				_label="LLM-Provider"
				_orientation={isMobile ? 'vertical' : 'horizontal'}
				_options={options}
				_value={radioValue}
				_hint={
					(providers ?? []).length === 0
						? 'Kein Provider konfiguriert — der Server nutzt die Standard-Kaskade. Lege unten einen Provider an.'
						: 'Wähle den aktiven LLM-Provider. Die Auswahl gilt serverweit; „System-Standard“ hebt das lokale Pinning auf.'
				}
				_on={{
					onChange: handleProviderChange,
				}}
			/>
		</>
	);
};
