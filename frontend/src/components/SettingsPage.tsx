import { KolAlert, KolButton, KolHeading, KolInputCheckbox, KolTabs } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { requestMicrophonePermission } from '../lib/micPermission';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';
import { useGeolocation } from '../lib/useGeolocation';
import { usePushSubscription } from '../lib/push';
import { useVoiceAutostart } from '../lib/voiceAutostart';
import { AppearanceSetting } from './AppearanceSetting';
import { LlmSettingsForm } from './LlmSettingsForm';
import { PillarList } from './PillarList';
import { PillarWeightsForm } from './PillarWeightsForm';

interface SettingsPageProps {
	pillars: Pillar[];
	onBack: () => void;
	onSaved: () => void;
	/** Wird nach PillarList-Mutationen aufgerufen, damit App.tsx seine Pillar-Daten neu lädt (#439). */
	onPillarChanged?: () => void;
}

// Die Tab-Leiste der Settings-Seite (#271). Modulkonstante, damit `KolTabs` nicht bei jedem Render
// eine neue Tab-Liste erhält und die Auswahl zurücksetzt. Reihenfolge: Allgemein (Index 0), Säulen
// (Index 1), LLM (Index 2, #640).
const SETTINGS_TABS = [{ _label: 'Allgemein' }, { _label: 'Säulen' }, { _label: 'LLM' }];

/**
 * Einstellungen-Seite (#271) mit `KolTabs`-Navigation: „Allgemein" (Platzhalter), „Säulen"
 * (Säulen-Gewichtungs-Editor) und „LLM" (Provider-Konfiguration, #640). Der aktive Tab wird beim
 * initialen Laden aus der URL abgeleitet: `/settings/general` → Allgemein (0), alles andere
 * (inkl. `/settings/pillars`) → Säulen (1).
 */
export const SettingsPage = ({ pillars, onBack, onSaved, onPillarChanged }: SettingsPageProps) => {
	// Aktiven Tab als kontrollierten State führen. Initialwert aus der URL; `setActiveTab` wird bei
	// manuellem Tab-Wechsel (onSelect) aufgerufen, damit Re-Renders den gewählten Tab nicht zurücksetzen.
	const [activeTab, setActiveTab] = useState(() => {
		const path = window.location.pathname;
		if (path.startsWith('/settings/general')) return 0;
		// `/settings/llm` muss den LLM-Tab öffnen — sonst zeigt der Direktaufruf den Säulen-Editor
		// und das Provider-Formular bleibt im inaktiven Panel unsichtbar (#886).
		if (path.startsWith('/settings/llm')) return 2;
		return 1;
	});

	// #843: Ref für Settings-General Container
	const settingsGeneralRef = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(
		settingsGeneralRef,
		'kol-input-checkbox, kol-button',
		'[role="switch"], button:not([type="button"]):not([class*="icon"])',
	);

	// Stabile Callback-Identität, damit KolTabs nicht bei jedem Render neu verdrahtet (#323).
	const tabsCallbacks = useMemo(
		() => ({
			onSelect: (_event: Event, selected: number): void => {
				setActiveTab(selected);
			},
		}),
		[],
	);

	// #272: Schalter „Sprachaufnahme automatisch starten" (Default aus). Beim Einschalten wird die
	// Mikrofon-Berechtigung angefordert; nur bei erteilter Berechtigung wird die Einstellung aktiviert
	// und persistiert. Wird sie verweigert, bleibt der Schalter aus und ein Hinweis erscheint.
	const { enabled: voiceAutostart, setEnabled: setVoiceAutostart } = useVoiceAutostart();
	const [micDenied, setMicDenied] = useState(false);
	const [permissionPending, setPermissionPending] = useState(false);

	const onToggleVoiceAutostart = async (next: boolean): Promise<void> => {
		if (!next) {
			setVoiceAutostart(false);
			setMicDenied(false);
			return;
		}
		if (permissionPending) return;
		setPermissionPending(true);
		try {
			const granted = await requestMicrophonePermission();
			if (granted) {
				setVoiceAutostart(true);
				setMicDenied(false);
			} else {
				// Berechtigung verweigert → Einstellung nicht aktivieren, Hinweis zeigen.
				setVoiceAutostart(false);
				setMicDenied(true);
			}
		} finally {
			setPermissionPending(false);
		}
	};

	// #355: Schalter „Push-Nachrichten aktivieren". Beim Einschalten wird die Berechtigung angefragt
	// und eine Subscription erstellt/ans Backend gemeldet; beim Ausschalten wird sie ab-/gekündigt.
	const {
		supported: pushSupported,
		enabled: pushEnabled,
		pending: pushPending,
		failed: pushFailed,
		toggle: togglePush,
	} = usePushSubscription();

	const [pushTestResult, setPushTestResult] = useState<'success' | 'error' | null>(null);

	// #845: Schalter „Standort erfassen" (Default aus). Beim Einschalten wird die
	// Geolocation-Berechtigung angefragt; nur bei erteilter Berechtigung wird die Einstellung
	// aktiviert und alle 5 Minuten die Position ermittelt. Bei Verweigerung bleibt der Schalter aus.
	const {
		supported: geoSupported,
		enabled: geoEnabled,
		pending: geoPending,
		permissionDenied: geoDenied,
		address,
		addressLoading,
		toggle: toggleGeo,
	} = useGeolocation();

	return (
		<main className="settings-page">
			<header className="settings-page-header">
				<KolButton
					_label="Zurück"
					_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
					_variant="secondary"
					_on={{ onClick: onBack }}
				/>
				<KolHeading _label="Priority Pilot" _level={1} />
			</header>

			<KolTabs
				className="settings-tabs"
				_label="Einstellungen"
				_tabs={SETTINGS_TABS}
				_selected={activeTab}
				_on={tabsCallbacks}
			>
				<div slot="tab-0" className="settings-general" ref={settingsGeneralRef}>
					<AppearanceSetting />
					<KolInputCheckbox
						_label="Sprachaufnahme automatisch starten"
						_variant="switch"
						_checked={voiceAutostart}
						_hint="Beim Öffnen der Formulare zum Anlegen und Bearbeiten von Tasks und Serien wird das erste Eingabefeld fokussiert und dessen Mikrofon automatisch gestartet."
						_on={{
							onChange: (_event, value) => {
								void onToggleVoiceAutostart(value === true);
							},
						}}
					/>
					{micDenied && (
						<KolAlert _type="warning" _label="Mikrofon-Zugriff verweigert">
							Der Zugriff auf das Mikrofon wurde verweigert. Die automatische Sprachaufnahme bleibt deaktiviert. Bitte
							erteile die Berechtigung im Browser und versuche es erneut.
						</KolAlert>
					)}
					{pushSupported ? (
						<KolInputCheckbox
							_label="Push-Nachrichten aktivieren"
							_variant="switch"
							_checked={pushEnabled}
							_disabled={pushPending}
							_hint="Erlaube Priority Pilot, dir Erinnerungen (z. B. an fällige Aufgaben) als Push-Nachricht zu senden – auch wenn die App gerade nicht geöffnet ist."
							_on={{
								onChange: (_event, value) => {
									void togglePush(value === true);
								},
							}}
						/>
					) : (
						<KolAlert _type="info" _label="Push-Nachrichten nicht verfügbar">
							Dieser Browser unterstützt keine Push-Nachrichten. Installiere die App bzw. nutze einen aktuellen Browser,
							um Erinnerungen zu erhalten.
						</KolAlert>
					)}
					{pushEnabled && (
						<KolButton
							_label="Push testen"
							_variant="secondary"
							_on={{
								onClick: () => {
									api
										.sendTestPush()
										.then(() => {
											setPushTestResult('success');
										})
										.catch(() => {
											setPushTestResult('error');
										});
								},
							}}
						/>
					)}
					{pushTestResult === 'success' && (
						<KolAlert _type="success" _label="Test-Push gesendet">
							Zitat unterwegs.
						</KolAlert>
					)}
					{pushTestResult === 'error' && (
						<KolAlert _type="error" _label="Fehler">
							Push fehlgeschlagen.
						</KolAlert>
					)}
					{pushFailed && (
						<KolAlert _type="warning" _label="Push-Nachrichten nicht aktiviert">
							Push-Nachrichten konnten nicht aktiviert werden. Bitte erteile die Benachrichtigungs-Berechtigung im
							Browser und versuche es erneut.
						</KolAlert>
					)}
					{geoSupported ? (
						<KolInputCheckbox
							_label="Standort erfassen"
							_variant="switch"
							_checked={geoEnabled}
							_disabled={geoPending}
							_hint="Ermittle alle 5 Minuten deine aktuelle Position (z. B. für ortsbezogene Aufgaben-Vorschläge)."
							_on={{
								onChange: (_event, value) => {
									void toggleGeo(value === true);
								},
							}}
						/>
					) : (
						<KolAlert _type="info" _label="Standort nicht verfügbar">
							Dieser Browser unterstützt keine Standortabfrage. Nutze einen aktuellen Browser, um die Position zu
							ermitteln.
						</KolAlert>
					)}
					{geoEnabled && (
						<div aria-live="polite" className="geo-address">
							{addressLoading ? 'Adresse wird ermittelt…' : address || 'Keine Adresse für diesen Standort'}
						</div>
					)}
					{geoDenied && (
						<KolAlert _type="warning" _label="Standortzugriff verweigert">
							Der Zugriff auf den Standort wurde verweigert. Die Standorterfassung bleibt deaktiviert. Bitte erteile die
							Berechtigung im Browser und versuche es erneut.
						</KolAlert>
					)}
				</div>
				{/* Panel-Inhalte nur für den aktiven Tab rendern (#886): `KolTabs` blendet inaktive Panels
					    lediglich aus, ihre Inhalte blieben aber im DOM. Beide Formulare tragen einen
					    „Speichern"-Button — der unsichtbare Zwilling machte den sichtbaren nicht mehr
					    eindeutig adressierbar (Tests wie assistive Technik). */}
				<div slot="tab-1">
					{activeTab === 1 && (
						<>
							{/* Überschrift „Säulen-Gewichtung" ist Teil des #270-Vertrags (settings-page.spec.ts):
								    die Route /settings/pillars rendert den Säulen-Editor mit dieser Überschrift. */}
							<KolHeading _label="Säulen-Gewichtung" _level={2} />
							{/* Säulen-Verwaltungs-Komponente (#439): Anlegen, Bearbeiten und Löschen von Säulen
								    (jeweils als eigener Modal-Dialog, KoliBri-Komponenten). */}
							<PillarList onPillarChanged={onPillarChanged} />
							{/* Beim Direktaufruf von /settings/pillars mountet die Seite, BEVOR die Säulen geladen
								    sind. Das Formular hält seine Rohwerte in einem beim Mount initialisierten Ref —
								    per `key` neu mounten, sobald die Säulen eintreffen, damit die geladenen Gewichte
								    übernommen werden. */}
							<PillarWeightsForm key={pillars.length} pillars={pillars} onSaved={onSaved} />
						</>
					)}
				</div>
				<div slot="tab-2">
					{activeTab === 2 && (
						<>
							{/* LLM-Provider-Konfiguration (#640): Keys/Modell der Mistral/OpenRouter-Kaskade. */}
							<KolHeading _label="LLM-Provider" _level={2} />
							<LlmSettingsForm />
						</>
					)}
				</div>
			</KolTabs>
		</main>
	);
};
