import { KolAlert, KolButton, KolInputRadio } from '@public-ui/react-v19';
import type { LlmProvider } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { setProvider, setToastCallback } from '../lib/llm-provider';
import { useIsMobile } from '../lib/use-is-mobile';
import { LlmProviderFormDialog } from './LlmProviderFormDialog';
import { LlmProviderDeleteDialog } from './LlmProviderDeleteDialog';

type DialogState =
	| { kind: 'closed' }
	| { kind: 'create' }
	| { kind: 'edit'; provider: LlmProvider }
	| { kind: 'delete'; provider: LlmProvider };

/**
 * LLM-Provider-Verwaltung (#951): dynamische Radio-Group über alle konfigurierten
 * Provider (`GET /llm-providers`) plus Verwaltung — „Neuer Provider"-Dialog,
 * Bearbeiten und Löschen mit Bestätigung (Spec Journey 1–5). Ablösung der festen
 * Mistral/OpenRouter-Umschaltung (#749).
 *
 * - Radio-Auswahl = serverseitig aktiver Provider: Klick löst `POST
 *   /llm-providers/{id}/activate` aus (alle anderen werden deaktiviert) und pinnt
 *   lokale LLM-Anfragen auf den Provider (Query-Parameter, Muster aus #749).
 * - „System-Standard" hebt nur das lokale Pinning auf (Server-Aktivierung bleibt).
 * - Beliebig viele Provider anlegbar (Name, Endpoint, API-Key, Modell); API-Keys
 *   sind write-only — das Bearbeiten-Formular startet mit leerem Key-Feld.
 * - Auf Mobile (<768px) stapeln Radio-Optionen und Verwaltungsliste vertikal.
 */
export const LlmProviderToggle = () => {
	const [providers, setProviders] = useState<LlmProvider[] | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
	const isMobile = useIsMobile();

	// Fokus-Rückgabe nach Dialog-Ende: der Trigger-Button kann aus dem DOM gefallen sein
	// (z. B. Löschen des letzten Providers) — Fallback wie in DeleteTaskDialog (#472).
	const deleteTriggerRef = useRef<HTMLKolButtonElement>(null);

	const reloadProviders = useCallback(async (): Promise<void> => {
		try {
			setProviders(await api.listLlmProviders());
			setError(null);
		} catch {
			setError('Provider-Liste konnte nicht geladen werden.');
		}
	}, []);

	// Provider-Liste einmalig laden (inkl. Aktiv-Markierung des Servers).
	useEffect(() => {
		void reloadProviders();
	}, [reloadProviders]);

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
				<KolAlert _type="error" _alert _label="Provider-Verwaltung">
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
						? 'Noch kein Provider konfiguriert — lege unten einen an.'
						: 'Wähle den aktiven LLM-Provider. Die Auswahl gilt serverweit; „System-Standard“ hebt das lokale Pinning auf.'
				}
				_on={{
					onChange: handleProviderChange,
				}}
			/>

			{/* Verwaltung (Spec Journey 2/4/5): Anlegen + je Provider Bearbeiten/Löschen */}
			<div className="llm-provider-admin">
				<p className="llm-provider-admin__heading">Provider verwalten</p>
				<KolButton
					_label="Neuer Provider"
					_variant="secondary"
					_on={{ onClick: () => setDialog({ kind: 'create' }) }}
				/>
				{providers !== null && providers.length > 0 && (
					<ul className="llm-provider-admin__list">
						{providers.map((provider) => (
							<li key={provider.id} className="llm-provider-admin__item">
								<span className="llm-provider-admin__name">
									{provider.name}
									{provider.isActive ? ' (aktiv)' : ''}
									<span className="llm-provider-admin__meta"> · {provider.model}</span>
								</span>
								<span className="llm-provider-admin__actions">
									<KolButton
										_label="Bearbeiten"
										_variant="secondary"
										_on={{ onClick: () => setDialog({ kind: 'edit', provider }) }}
									/>
									<KolButton
										ref={provider.id === providers.at(-1)?.id ? deleteTriggerRef : undefined}
										_label="Löschen"
										_variant="danger"
										_on={{ onClick: () => setDialog({ kind: 'delete', provider }) }}
									/>
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

			{dialog.kind === 'create' && (
				<LlmProviderFormDialog
					onClose={() => setDialog({ kind: 'closed' })}
					onSaved={() => {
						setDialog({ kind: 'closed' });
						void reloadProviders();
					}}
				/>
			)}
			{dialog.kind === 'edit' && (
				<LlmProviderFormDialog
					provider={dialog.provider}
					onClose={() => setDialog({ kind: 'closed' })}
					onSaved={() => {
						setDialog({ kind: 'closed' });
						void reloadProviders();
					}}
				/>
			)}
			{dialog.kind === 'delete' && (
				<LlmProviderDeleteDialog
					provider={dialog.provider}
					onClose={() => setDialog({ kind: 'closed' })}
					onDeleted={() => {
						setDialog({ kind: 'closed' });
						void reloadProviders();
					}}
					fallbackFocusRef={deleteTriggerRef as React.RefObject<HTMLElement | null>}
				/>
			)}
		</>
	);
};
