import { KolAlert, KolButton, KolInputRadio, KolSingleSelect } from '@public-ui/react-v19';
import type { LlmModel, LlmProvider } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { useIsMobile } from '../lib/use-is-mobile';
import { LlmProviderFormDialog } from './LlmProviderFormDialog';
import { LlmProviderDeleteDialog } from './LlmProviderDeleteDialog';

type DialogState =
	| { kind: 'closed' }
	| { kind: 'create' }
	| { kind: 'edit'; provider: LlmProvider }
	| { kind: 'delete'; provider: LlmProvider };

interface LlmSettingsProps {
	/** Nach Provider-/Modell-Änderungen aufgerufen, damit umliegende UI ggf. neu lädt. */
	onChanged?: () => void;
}

/**
 * LLM-Einstellungen (Settings-Tab „LLM“): Radio-Auswahl genau eines Providers, Modellwahl
 * aus der Modellliste des aktiven Providers und Verwaltung der Custom-Provider.
 *
 * - Radio-Auswahl = serverseitig aktiver Provider (`POST /llm-providers/{id}/activate`).
 *   Ohne explizite Wahl markiert der Server den Built-in-Fallback als aktiv (Mistral vor
 *   OpenRouter, nach ENV-Key-Präsenz) — die Radio-Group spiegelt das.
 * - Mistral und OpenRouter sind fix (`kind='builtin'`): kein Bearbeiten/Löschen, Key liegt
 *   als ENV im Server. Custom-Provider (Name, URL, Token) sind frei anleg- und löschbar.
 * - Die Modelle des aktiven Providers kommen live von dessen `GET /models`-Endpoint
 * (`GET /llm-providers/{id}/models`); die Wahl persistiert über `PUT /llm-providers/{id}`.
 * - KI-Features sind nutzbar, sobald der aktive Provider Key UND Modell hat — der
 *   Status-Hinweis zeigt an, was ggf. noch fehlt.
 */
export const LlmSettings = ({ onChanged }: LlmSettingsProps) => {
	const [providers, setProviders] = useState<LlmProvider[] | null>(null);
	const [models, setModels] = useState<LlmModel[] | null>(null);
	/** True, wenn die Liste nicht live vom Provider kam, sondern aus dem eingebauten Katalog. */
	const [modelsAreFallback, setModelsAreFallback] = useState(false);
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
	const isMobile = useIsMobile();

	// Fokus-Rückgabe nach Dialog-Ende: der Trigger-Button kann aus dem DOM gefallen sein
	// (Löschen des letzten Custom-Providers) — Fallback wie in DeleteTaskDialog (#472).
	const deleteTriggerRef = useRef<HTMLKolButtonElement>(null);

	const activeProvider = useMemo(() => providers?.find((p) => p.isActive) ?? null, [providers]);

	const reloadProviders = useCallback(async (): Promise<void> => {
		try {
			setProviders(await api.listLlmProviders());
			setError(null);
		} catch {
			setError('Provider-Liste konnte nicht geladen werden.');
		}
	}, []);

	// Provider-Liste einmalig laden (inkl. effektiver Aktiv-Markierung des Servers).
	useEffect(() => {
		void reloadProviders();
	}, [reloadProviders]);

	// Modellliste des aktiven Providers laden — neu bei jedem Provider-Wechsel. Der
	// Abbruch-Controller verhindert ein setState nach Unmount/Wechsel.
	useEffect(() => {
		if (activeProvider === null) {
			setModels(null);
			setModelsError(null);
			return;
		}
		const controller = new AbortController();
		setModels(null);
		setModelsAreFallback(false);
		setModelsError(null);
		api
			.listLlmProviderModels({ id: activeProvider.id, signal: controller.signal })
			.then((result) => {
				if (!controller.signal.aborted) {
					setModels(result.models);
					setModelsAreFallback(result.source === 'fallback');
				}
			})
			.catch(async (reason) => {
				if (!controller.signal.aborted) setModelsError((await toApiError(reason)).message);
			});
		return () => controller.abort();
	}, [activeProvider]);

	// Toast nach 3 Sekunden ausblenden.
	const showToast = useCallback((message: string): void => {
		setToastMessage(message);
		setTimeout(() => setToastMessage(null), 3000);
	}, []);

	const handleProviderChange = useCallback(
		(_event: unknown, value: unknown): void => {
			if (providers === null || typeof value !== 'string') return;
			const selected = providers.find((p) => String(p.id) === value);
			if (selected === undefined) return;
			void api
				.activateLlmProvider({ id: selected.id })
				.then(() => {
					// Radio-Gruppe sofort spiegeln: ohne dieses State-Update würde ein Re-Render
					// (z. B. der Toast) die Auswahl auf den VORHER aktiven Provider zurücksetzen.
					setProviders((current) => current?.map((p) => ({ ...p, isActive: p.id === selected.id })) ?? current);
					showToast(`Provider gewechselt: ${selected.name}`);
					onChanged?.();
				})
				.catch(() => {
					setToastMessage(null);
					setError(`„${selected.name}“ konnte nicht aktiviert werden.`);
				});
		},
		[providers, onChanged, showToast],
	);

	/** Persistiert die Modellwahl des aktiven Providers und spiegelt sie lokal. */
	const handleModelChange = useCallback(
		async (model: string): Promise<void> => {
			if (activeProvider === null || model === activeProvider.model) return;
			try {
				const updated = await api.updateLlmProvider({ id: activeProvider.id, input: { model } });
				setProviders((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? current);
				showToast(`Modell gesetzt: ${model}`);
				onChanged?.();
			} catch (reason) {
				setError((await toApiError(reason)).message);
			}
		},
		[activeProvider, onChanged, showToast],
	);

	// Optionen: je Provider eine Option „Name (Modell)“ (Built-ins zuerst — Server-Reihenfolge),
	// damit die Radio-Group direkt zeigt, mit welchem Modell jeder Provider läuft. Ist kein
	// Provider aktiv (kein ENV-Key, keine Wahl), bekommt die Gruppe eine passende „inaktiv“-Option —
	// sonst markiert KoliBri nativ die erste Option als gewählt und signalisiert falsch eine Auswahl.
	const options = useMemo(() => {
		const providerOptions = (providers ?? []).map((p) => ({
			label: p.model !== '' ? `${p.name} (${p.model})` : p.name,
			value: String(p.id),
		}));
		return activeProvider === null
			? [{ label: 'Kein Provider aktiv', value: '' }, ...providerOptions]
			: providerOptions;
	}, [providers, activeProvider]);
	const radioValue = activeProvider === null ? '' : String(activeProvider.id);

	// Ist das aktuell gewählte Modell (Server-Default) nicht in der Liste, bleibt es trotzdem
	// wählbar sichtbar — sonst springt das Select still auf eine andere Option.
	const selectedModelInList = models?.some((m) => m.id === activeProvider?.model) ?? false;
	const modelOptions = useMemo(() => {
		if (models === null) return [];
		const list = models.map((m) => ({
			label: m.name === m.id ? m.id : `${m.name} (${m.id})`,
			value: m.id,
		}));
		const current = activeProvider?.model ?? '';
		if (current === '') return [{ label: 'Bitte Modell wählen…', value: '' }, ...list];
		return selectedModelInList ? list : [{ label: current, value: current }, ...list];
	}, [models, activeProvider, selectedModelInList]);

	return (
		<>
			{toastMessage !== null && (
				<KolAlert _type="success" _alert _label="Gespeichert">
					{toastMessage}
				</KolAlert>
			)}
			{error !== null && (
				<KolAlert _type="error" _alert _label="LLM-Einstellungen">
					{error}
				</KolAlert>
			)}

			{providers === null ? (
				<p>Provider werden geladen…</p>
			) : (
				<>
					<KolInputRadio
						_label="KI-Provider"
						_orientation={isMobile ? 'vertical' : 'horizontal'}
						_options={options}
						_value={radioValue}
						_hint={
							activeProvider === null
								? 'Kein Provider aktiv — es ist kein ENV-Key für Mistral/OpenRouter gesetzt und kein Custom-Provider gewählt.'
								: 'Wähle den Provider für alle KI-Anfragen. Ohne eigene Wahl übernimmt der Fallback (Mistral vor OpenRouter).'
						}
						_on={{ onChange: handleProviderChange }}
					/>

					{activeProvider !== null && (
						<div className="llm-model-select">
							{models === null && modelsError === null && <p className="hint">Modelle werden geladen…</p>}
							{modelsError !== null && (
								<p className="hint" role="alert">
									Modellliste nicht verfügbar: {modelsError}
								</p>
							)}
							{/* KoliBri-First (ux-design.md): Bedienelemente kommen aus KoliBri — die
							    Modellwahl ist ein Auswahl-Element und daher KolSingleSelect (wie in
							    TaskForm/DependencyModal), kein natives Select im Eigen-Styling. */}
							{models !== null && (
								<KolSingleSelect
									_label={`Modell von ${activeProvider.name}${activeProvider.kind === 'builtin' ? ' (fix)' : ''}`}
									_options={modelOptions}
									_value={activeProvider.model}
								_hint={
									modelsAreFallback
										? 'Live-Liste nicht erreichbar — es werden bekannte Standard-Modelle angeboten.'
										: 'Die Modelle werden live vom gewählten Provider geladen.'
								}
									_on={{
										onChange: (_event, value) => void handleModelChange(readString(value)),
									}}
								/>
							)}
						</div>
					)}

					{/* Bereitschaft der KI-Features: aktiv + Key + Modell = nutzbar. */}
					{activeProvider !== null && activeProvider.model !== '' && activeProvider.hasApiKey ? (
						<KolAlert _type="success" _label="KI-Features bereit">
							Alle KI-Features laufen über {activeProvider.name} mit Modell {activeProvider.model}.
						</KolAlert>
					) : (
						activeProvider !== null && (
							<KolAlert _type="warning" _label="KI-Features noch nicht nutzbar">
								{!activeProvider.hasApiKey
									? activeProvider.kind === 'builtin'
										? `Für ${activeProvider.name} ist kein API-Key auf dem Server hinterlegt (ENV-Variable fehlt). Wähle einen anderen Provider oder hinterlege den Key serverseitig.`
										: `Für ${activeProvider.name} ist kein API-Key hinterlegt — bearbeite den Provider und trage den Key ein.`
									: 'Wähle oben ein Modell, dann sind alle KI-Features nutzbar.'}
							</KolAlert>
						)
					)}
				</>
			)}

			{/* Verwaltung: Anlegen + je Custom-Provider Bearbeiten/Löschen; Built-ins sind fix. */}
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
									<span className="llm-provider-admin__meta">
										{provider.kind === 'builtin' ? ' · fix, Key aus Server-ENV' : ` · ${provider.endpoint}`}
										{provider.model !== '' ? ` · ${provider.model}` : ' · kein Modell gewählt'}
									</span>
								</span>
								{provider.kind === 'custom' && (
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
								)}
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
						onChanged?.();
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
						onChanged?.();
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
						onChanged?.();
					}}
					fallbackFocusRef={deleteTriggerRef as React.RefObject<HTMLElement | null>}
				/>
			)}
		</>
	);
};
