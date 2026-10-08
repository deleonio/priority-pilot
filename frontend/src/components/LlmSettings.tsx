import { KolAccordion, KolAlert, KolBadge, KolButton, KolInputRadio, KolSingleSelect } from '@public-ui/react-v19';
import type { LlmModel, LlmProvider, LlmProviderTestResult } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { useIsMobile } from '../lib/use-is-mobile';
import { useFollowingOpen } from '../lib/useFollowingOpen';
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
	/** #1903: Unterbereiche aufgeklappt — folgt dem Schalter „KI aktivieren". */
	open?: boolean;
	/** #1903 AK6: ohne Paket-Freischaltung sind alle Bedienelemente gesperrt. */
	disabled?: boolean;
}

/**
 * LLM-Einstellungen (Karte „KI-Provider" im Settings-Tab „KI"): Radio-Auswahl genau eines Providers, Modellwahl
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
export const LlmSettings = ({ onChanged, open = true, disabled = false }: LlmSettingsProps) => {
	const { t } = useTranslation(['settings', 'common']);
	const cardDetails = useFollowingOpen(open);
	const [providers, setProviders] = useState<LlmProvider[] | null>(null);
	const [models, setModels] = useState<LlmModel[] | null>(null);
	/** True, wenn die Liste nicht live vom Provider kam, sondern aus dem eingebauten Katalog. */
	const [modelsAreFallback, setModelsAreFallback] = useState(false);
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
	/** Test-Ergebnis je Provider-ID (undefined = noch nicht getestet). */
	const [testResults, setTestResults] = useState<Record<number, LlmProviderTestResult | undefined>>({});
	/** ID des gerade laufenden Tests (Button deaktiviert). */
	const [testingId, setTestingId] = useState<number | null>(null);
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
			setError(t('llmSettings.loadError'));
		}
	}, [t]);

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
					showToast(t('llmSettings.providerChanged', { name: selected.name }));
					onChanged?.();
				})
				.catch(() => {
					setToastMessage(null);
					setError(t('llmSettings.activateFailed', { name: selected.name }));
				});
		},
		[providers, onChanged, showToast, t],
	);

	/** Persistiert die Modellwahl des aktiven Providers und spiegelt sie lokal. */
	const handleModelChange = useCallback(
		async (model: string): Promise<void> => {
			if (activeProvider === null || model === activeProvider.model) return;
			try {
				const updated = await api.updateLlmProvider({ id: activeProvider.id, input: { model } });
				setProviders((current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? current);
				setTestResults((current) => ({ ...current, [updated.id]: undefined }));
				showToast(t('llmSettings.modelSet', { model }));
				onChanged?.();
			} catch (reason) {
				setError((await toApiError(reason)).message);
			}
		},
		[activeProvider, onChanged, showToast, t],
	);

	/** Führt den Test-Prompt für einen Provider aus und speichert das Ergebnis inline. */
	const handleTest = useCallback(
		async (provider: LlmProvider): Promise<void> => {
			if (testingId !== null) return;
			setTestingId(provider.id);
			setTestResults((current) => ({ ...current, [provider.id]: undefined }));
			try {
				const result = await api.testLlmProvider({ id: provider.id });
				setTestResults((current) => ({ ...current, [provider.id]: result }));
			} catch (reason) {
				const message = (await toApiError(reason)).message;
				setTestResults((current) => ({ ...current, [provider.id]: { ok: false, message } }));
			} finally {
				setTestingId(null);
			}
		},
		[testingId],
	);

	// Optionen: je Provider eine Option „Name (Modell) · eigen/instanzweit“ (Built-ins zuerst —
	// Server-Reihenfolge), damit die Radio-Group direkt zeigt, mit welchem Modell jeder Provider
	// läuft. Der Eigentums-Marker (#1549, DTO-Feld `own`) steht im Label und damit im Accessible
	// Name — Screenreader melden den Unterschied, ohne die Zeile visuell zu scannen (WCAG 1.4.1:
	// nie nur Farbe/Badge). Ist kein Provider aktiv (kein ENV-Key, keine Wahl), bekommt die Gruppe
	// eine passende „inaktiv“-Option — sonst markiert KoliBri nativ die erste Option als gewählt
	// und signalisiert falsch eine Auswahl.
	const options = useMemo(() => {
		const providerOptions = (providers ?? []).map((p) => ({
			label: `${p.model !== '' ? `${p.name} (${p.model})` : p.name} · ${p.own ? t('llmSettings.own') : t('llmSettings.shared')}`,
			value: String(p.id),
		}));
		return activeProvider === null
			? [{ label: t('llmSettings.noProviderOption'), value: '' }, ...providerOptions]
			: providerOptions;
	}, [providers, activeProvider, t]);
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
		if (current === '') return [{ label: t('llmSettings.chooseModel'), value: '' }, ...list];
		return selectedModelInList ? list : [{ label: current, value: current }, ...list];
	}, [models, activeProvider, selectedModelInList, t]);

	return (
		<>
			<KolAccordion
				className="settings-card"
				_label={t('llmSettings.title')}
				_level={2}
				_disabled={!open || disabled}
				{...cardDetails}
			>
				{toastMessage !== null && (
					<KolAlert _type="success" _alert _label={t('mcpInstructions.savedLabel')}>
						{toastMessage}
					</KolAlert>
				)}
				{error !== null && (
					<KolAlert _type="error" _alert _label={t('llmSettings.errorLabel')}>
						{error}
					</KolAlert>
				)}

				{/* Die ganze Karte ist ein Akkordeon (Muster ApiTokensSection): folgt dem Schalter „KI aktivieren" —
			    aus = geschlossen und gesperrt. Darin ohne weitere Klappbereiche erst die Provider-Wahl,
			    dann die Verwaltung. */}
				<div className="settings-card-stack">
					{providers === null ? (
						<p>{t('llmSettings.loading')}</p>
					) : (
						<>
							<KolInputRadio
								_label={t('llmSettings.title')}
								_orientation={isMobile ? 'vertical' : 'horizontal'}
								_options={options}
								_value={radioValue}
								_hint={activeProvider === null ? t('llmSettings.noProviderHint') : t('llmSettings.providerHint')}
								_disabled={disabled}
								_on={{ onChange: handleProviderChange }}
							/>

							{activeProvider !== null && (
								<div className="llm-model-select">
									{models === null && modelsError === null && <p className="hint">{t('llmSettings.modelsLoading')}</p>}
									{modelsError !== null && (
										<p className="hint" role="alert">
											{t('llmSettings.modelsError', { message: modelsError })}
										</p>
									)}
									{/* KoliBri-First (ux-design.md): Bedienelemente kommen aus KoliBri — die
							    Modellwahl ist ein Auswahl-Element und daher KolSingleSelect (wie in
							    TaskForm/DependencyModal), kein natives Select im Eigen-Styling. */}
									{models !== null && (
										<KolSingleSelect
											_label={
												activeProvider.kind === 'builtin'
													? t('llmSettings.modelLabelBuiltin', { name: activeProvider.name })
													: t('llmSettings.modelLabel', { name: activeProvider.name })
											}
											_options={modelOptions}
											_value={activeProvider.model}
											_hint={modelsAreFallback ? t('llmSettings.modelsFallbackHint') : t('llmSettings.modelsLiveHint')}
											_disabled={disabled}
											_on={{
												onChange: (_event, value) => void handleModelChange(readString(value)),
											}}
										/>
									)}
								</div>
							)}

							{/*
							 * Bereitschaft der KI-Features — drei Stufen: Konfiguration (aktiv + Key + Modell)
							 * UND das letzte Test-Ergebnis des aktiven Providers. Ein konfigurierter Provider
							 * kann trotzdem scheitern (z. B. abgelaufenes Abo → HTTP 402): Ohne diese Stufe
							 * behauptete der grüne Hinweis „bereit“, während alle KI-Features rot laufen.
							 */}
							{(() => {
								if (activeProvider === null) return null;
								const configured = activeProvider.model !== '' && activeProvider.hasApiKey;
								const testResult = testResults[activeProvider.id];
								if (configured && testResult?.ok) {
									return (
										<KolAlert _type="success" _label={t('llmSettings.readyLabel')}>
											{t('llmSettings.readyText', {
												name: activeProvider.name,
												model: activeProvider.model,
												latency: testResult.latencyMs ?? 0,
											})}
										</KolAlert>
									);
								}
								if (configured && testResult !== undefined && !testResult.ok) {
									return (
										<KolAlert _type="error" _label={t('llmSettings.failingLabel')}>
											{t('llmSettings.failingText', { name: activeProvider.name, message: testResult.message })}
										</KolAlert>
									);
								}
								if (configured) {
									return (
										<KolAlert _type="info" _label={t('llmSettings.untestedLabel')}>
											{t('llmSettings.untestedText', { name: activeProvider.name, model: activeProvider.model })}
										</KolAlert>
									);
								}
								return (
									<KolAlert _type="warning" _label={t('llmSettings.notUsableLabel')}>
										{!activeProvider.hasApiKey
											? activeProvider.kind === 'builtin'
												? t('llmSettings.noKeyBuiltin', { name: activeProvider.name })
												: t('llmSettings.noKeyCustom', { name: activeProvider.name })
											: t('llmSettings.noModel')}
									</KolAlert>
								);
							})()}
						</>
					)}
				</div>

				{/* Verwaltung: Anlegen + je Custom-Provider Bearbeiten/Löschen; Built-ins sind fix.
			    Das frühere `<p class="llm-provider-admin__heading">` war eine als Überschrift
			    gesetzte Textzeile ohne Überschriften-Semantik — jetzt trägt das Detail-Label
			    den Namen (Design-Lauf 2026-09). */}
				<div className="llm-provider-admin">
					<KolButton
						_label={t('llmSettings.newProvider')}
						class="settings-action-btn"
						_variant="secondary"
						_disabled={disabled}
						_on={{ onClick: () => setDialog({ kind: 'create' }) }}
					/>
					{providers !== null && providers.length > 0 && (
						<ul className="llm-provider-admin__list">
							{providers.map((provider) => (
								<li key={provider.id} className="llm-provider-admin__item">
									<span className="llm-provider-admin__name">
										{provider.name}
										{provider.isActive ? ` ${t('llmSettings.activeMarker')}` : ''}
										{/* Eigentums-Marker als KolBadge (#1549, Text statt nur Farbe — WCAG 1.4.1):
										    „eigen“ = eigene Zeile des Nutzers, „instanzweit“ = Built-in oder geteilt. */}
										<KolBadge
											className="llm-provider-admin__badge"
											_label={provider.own ? t('llmSettings.own') : t('llmSettings.shared')}
										/>
										<span className="llm-provider-admin__meta">
											{provider.kind === 'builtin' ? ` · ${t('llmSettings.builtinMeta')}` : ` · ${provider.endpoint}`}
											{provider.model !== '' ? ` · ${provider.model}` : ` · ${t('llmSettings.noModelMeta')}`}
										</span>
									</span>
									<span className="llm-provider-admin__actions">
										<KolButton
											_label={testingId === provider.id ? t('llmSettings.testing') : t('llmSettings.test')}
											class="settings-action-btn"
											_variant="secondary"
											_disabled={disabled || testingId !== null}
											_on={{ onClick: () => void handleTest(provider) }}
										/>
										{provider.kind === 'custom' && (
											<>
												<KolButton
													_label={t('common:actions.edit')}
													class="settings-action-btn"
													_variant="secondary"
													_disabled={disabled}
													_on={{ onClick: () => setDialog({ kind: 'edit', provider }) }}
												/>
												<KolButton
													ref={provider.id === providers.at(-1)?.id ? deleteTriggerRef : undefined}
													_label={t('common:actions.delete')}
													_icons={{ left: { icon: 'fa-solid fa-trash' } }}
													class="settings-action-btn"
													_variant="danger"
													_disabled={disabled}
													_on={{ onClick: () => setDialog({ kind: 'delete', provider }) }}
												/>
											</>
										)}
									</span>
									{(() => {
										// Test-Ergebnis direkt unter der Zeile: Erfolg mit Latenz/Antwort,
										// Misserfolg mit der konkreten Ursache (Auth/Modell/Abo/Netzwerk).
										const result = testResults[provider.id];
										if (result === undefined) return null;
										return result.ok ? (
											<KolAlert
												_type="success"
												_label={t('llmSettings.testOkLabel', { latency: result.latencyMs ?? 0 })}
											>
												{result.sample !== undefined
													? t('llmSettings.testOkSample', {
															name: provider.name,
															model: result.model,
															sample: result.sample,
														})
													: t('llmSettings.testOk', { name: provider.name, model: result.model })}
											</KolAlert>
										) : (
											<KolAlert _type="error" _label={t('llmSettings.testFailedLabel')}>
												{result.message}
											</KolAlert>
										);
									})()}
								</li>
							))}
						</ul>
					)}
				</div>
			</KolAccordion>

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
