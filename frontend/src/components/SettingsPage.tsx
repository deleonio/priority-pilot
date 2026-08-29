import { KolAlert, KolButton, KolHeading, KolInputCheckbox, KolInputRange, KolTabs } from '@public-ui/react-v19';
import type { GeoConfig, Pillar } from 'client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { requestMicrophonePermission } from '../lib/micPermission';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';
import { useGeolocation, GEO_CONFIG_CHANGED_EVENT } from '../lib/useGeolocation';
import { usePushSubscription } from '../lib/push';
import { useVoiceAutostart } from '../lib/voiceAutostart';
import { useAiPreferences } from '../lib/aiPreferences';
import { AppearanceSetting } from './AppearanceSetting';
import { LlmSettings } from './LlmSettings';
import { PillarList } from './PillarList';
import { PillarWeightsForm } from './PillarWeightsForm';

interface SettingsPageProps {
	pillars: Pillar[];
	/** #1105: Aktiver Tab, von `App` aus der Route `/settings/:tab` abgeleitet (AK4). */
	tab?: number;
	/** #1105: Tab-Wechsel → App navigiert auf `/settings/:tab` (URL ist die Quelle). */
	onTabChange?: (tab: number) => void;
	onBack: () => void;
	onSaved: () => void;
	/** Wird nach PillarList-Mutationen aufgerufen, damit App.tsx seine Pillar-Daten neu lädt (#439). */
	onPillarChanged?: () => void;
}

// Die Tab-Leiste der Settings-Seite (#271). Modulkonstante, damit `KolTabs` nicht bei jedem Render
// eine neue Tab-Liste erhält und die Auswahl zurücksetzt. Reihenfolge: Allgemein (Index 0), Säulen
// (Index 1), KI-Provider (Index 2).
// Reihenfolge: Allgemein (Index 0), Säulen (Index 1), KI-Provider (Index 2).
const SETTINGS_TABS = [{ _label: 'Allgemein' }, { _label: 'Säulen' }, { _label: 'KI-Provider' }];

/** Formatiert den Unix-ms-Zeitstempel der letzten Standortermittlung als „HH:MM" (#933 AK4). */
const formatGeoTimestamp = (updatedAt: number): string => {
	const date = new Date(updatedAt);
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes}`;
};

/** KoliBri `_disabled` ist zur Laufzeit auch als String gültig — nur so setzt der React-Adapter
 * das Prop zusätzlich als Host-Attribut (Booleans nur als Element-Property). Der React-Typ ist
 * enger (`DisabledPropType = boolean`), deshalb genau ein dokumentierter Cast an dieser Stelle
 * statt `as unknown as boolean` am Verwendungsort (#1103 F4). */
type DisabledProp = boolean | string;

const toKolibriDisabled = (value: DisabledProp | undefined): boolean | undefined => value as boolean | undefined;

/**
 * Einstellungen-Seite (#271) mit `KolTabs`-Navigation: „Allgemein" (Platzhalter), „Säulen"
 * (Säulen-Gewichtungs-Editor) und „KI-Provider" (Provider-Auswahl & -Verwaltung). Der aktive Tab wird beim
 * initialen Laden aus der URL abgeleitet: `/settings/general` → Allgemein (0), `/settings/llm` → KI-Provider (2),
 * alles andere → Säulen (1).
 */
export const SettingsPage = ({ pillars, tab, onTabChange, onBack, onSaved, onPillarChanged }: SettingsPageProps) => {
	// #1105: Der aktive Tab wird aus der Route `/settings/:tab` abgeleitet und von `App` als `tab`
	// übergeben (AK4) — `/settings/llm` öffnet damit den KI-Provider-Tab (#886). Ohne Prop (direkte
	// Verwendung in Unit-Tests) gilt der Säulen-Tab als Default; `localTab` hält den letzten Select.
	const [localTab, setLocalTab] = useState(1);
	const activeTab = tab ?? localTab;

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
				setLocalTab(selected);
				onTabChange?.(selected);
			},
		}),
		[onTabChange],
	);

	// #272: Schalter „Sprachaufnahme automatisch starten" (Default aus). Beim Einschalten wird die
	// Mikrofon-Berechtigung angefordert; nur bei erteilter Berechtigung wird die Einstellung aktiviert
	// und persistiert. Wird sie verweigert, bleibt der Schalter aus und ein Hinweis erscheint.
	const { enabled: voiceAutostart, setEnabled: setVoiceAutostart } = useVoiceAutostart();
	// #1080: Hauptschalter „KI-Features aktiv" und die unabhängige Option „Schnellerfassung aktiv".
	const { aiEnabled, quickCaptureEnabled, setPreference: setAiPreference } = useAiPreferences();
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

	// #1098 AK1: Geo-Konfiguration (Anzeige-/Alarm-Entfernung, Intervall) — serverseitig pro User
	// gespeichert (AK7, kein localStorage). Initial die Server-Defaults 5 km / 1 km / 5 Minuten,
	// der GET-Aufruf überschreibt sie mit den gespeicherten Werten.
	const [geoConfig, setGeoConfig] = useState<GeoConfig>({
		displayDistanceKm: 5,
		alarmDistanceKm: 1,
		intervalMinutes: 5,
	});

	// Nutzer-Änderung schlägt den nachlaufenden GET: Löst der Config-Fetch erst nach einer
	// Regler-Bewegung auf (Test-Umgebung, langsames Netz), darf er die Wahl nicht überschreiben.
	const geoUserEditedRef = useRef(false);

	useEffect(() => {
		api
			.getGeoConfig()
			.then((config) => {
				if (
					!geoUserEditedRef.current &&
					config &&
					typeof config.displayDistanceKm === 'number' &&
					typeof config.alarmDistanceKm === 'number' &&
					typeof config.intervalMinutes === 'number'
				) {
					setGeoConfig(config);
				}
			})
			.catch(() => {
				// Netzwerk-/Session-Fehler: Defaults stehen bleiben, Felder bleiben bedienbar.
			});
	}, []);

	/**
	 * #1098 AK2: Wert übernehmen und sofort per PUT speichern. Kreuz-Schranken werden als
	 * dynamische `_min`/`_max` der Regler durchgesetzt (Autoren-Entscheidung: keine Alerts,
	 * keine Inline-Fehler) — der mitgesendete Payload hält die Invarianten zusätzlich ein,
	 * damit der Server nie mit 400 antworten muss. Speichern ist Best-Effort.
	 */
	const applyGeoValue = (key: keyof GeoConfig, value: number): void => {
		geoUserEditedRef.current = true;
		const next = { ...geoConfig, [key]: value };
		if (key === 'displayDistanceKm' && next.alarmDistanceKm > value) {
			next.alarmDistanceKm = value;
		}
		if (key === 'alarmDistanceKm' && next.displayDistanceKm < value) {
			next.displayDistanceKm = value;
		}
		setGeoConfig(next);
		api
			.updateGeoConfig(next)
			.then(() => {
				// #1103 F6: alle Hook-Instanzen (Footer/NearbyCard/hier) laden die Config neu und
				// re-armen ihr laufendes Intervall auf den gespeicherten Wert.
				window.dispatchEvent(new CustomEvent(GEO_CONFIG_CHANGED_EVENT));
			})
			.catch(() => {
				// Best-Effort: UI zeigt den gewählten Wert, der Server hält den letzten gültigen Stand.
			});
	};

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
		positionUpdatedAt,
		toggle: toggleGeo,
		refresh: refreshGeo,
	} = useGeolocation();

	// #1098 AK3: Der KoliBri-React-Adapter übernimmt nur String-Props zusätzlich als Attribut am
	// Host, Booleans nur als Element-Property — im Browser fehlte das `_disabled`-Attribut sonst
	// (jsdom-Tests sahen es, weil React dort den Attribut-Pfad nimmt). Der String 'true' ist für
	// KoliBri truthy-deaktiviert und landet wie `_label`/`_hint` als Attribut am Host (E2E-AK3).
	const geoDisabled = toKolibriDisabled(geoEnabled ? undefined : 'true');

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
					{/* #971: Switch + zugehörige Alerts je in einer `.settings-switch-row` — mobil volle
							Breite im Stack-Layout, desktop eine Zeile (Switch links, Alert rechts). */}
					<div className="settings-switch-row">
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
					</div>
					{pushSupported ? (
						<div className="settings-switch-row">
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
							{/* #971: `pushFailed` gehört zur Switch-Zeile; der „Push testen"-Button und die
								    Test-Push-Ergebnis-Alerts (#932/#886) bleiben eigene Zeilen außerhalb. */}
							{pushFailed && (
								<KolAlert _type="warning" _label="Push-Nachrichten nicht aktiviert">
									Push-Nachrichten konnten nicht aktiviert werden. Bitte erteile die Benachrichtigungs-Berechtigung im
									Browser und versuche es erneut.
								</KolAlert>
							)}
						</div>
					) : (
						<KolAlert _type="info" _label="Push-Nachrichten nicht verfügbar">
							Dieser Browser unterstützt keine Push-Nachrichten. Installiere die App bzw. nutze einen aktuellen Browser,
							um Erinnerungen zu erhalten.
						</KolAlert>
					)}
					{pushEnabled && (
						<KolButton
							_label="Push testen"
							class="settings-action-btn"
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
					{geoSupported ? (
						<div className="settings-switch-row">
							<KolInputCheckbox
								_label="Standort erfassen"
								_variant="switch"
								_checked={geoEnabled}
								_disabled={geoPending}
								_hint={`Ermittle alle ${geoConfig.intervalMinutes} Minuten deine aktuelle Position (z. B. für ortsbezogene Aufgaben-Vorschläge).`}
								_on={{
									onChange: (_event, value) => {
										void toggleGeo(value === true);
									},
								}}
							/>
							{/* #971: `geoDenied` gehört zur Switch-Zeile; der `geoEnabled`-Block
								    (Ermitteln-Button + Adresse, #933) bleibt eigene Zeilen außerhalb. */}
							{geoDenied && (
								<KolAlert _type="warning" _label="Standortzugriff verweigert">
									Der Zugriff auf den Standort wurde verweigert. Die Standorterfassung bleibt deaktiviert. Bitte erteile
									die Berechtigung im Browser und versuche es erneut.
								</KolAlert>
							)}
						</div>
					) : (
						<KolAlert _type="info" _label="Standort nicht verfügbar">
							Dieser Browser unterstützt keine Standortabfrage. Nutze einen aktuellen Browser, um die Position zu
							ermitteln.
						</KolAlert>
					)}
					{geoEnabled && (
						<>
							{/* #933 AK1/AK5: Test-Schalter stößt refresh() an; während der Ermittlung
								    deaktiviert (Re-Entrancy-Guard im Hook). Der key-Wechsel auf geoPending
								    erzwingt einen Remount: Der KoliBri-Adapter setzt Props nach dem Mount als
								    Element-Properties, sodass der `_disabled`-Attributwechsel beim Rerender
								    nicht durchschlägt — der Remount stellt den korrekten Zustand sicher. */}
							<KolButton
								key={geoPending ? 'geo-refresh-pending' : 'geo-refresh-idle'}
								_label="Standort ermitteln"
								class="settings-action-btn"
								_variant="secondary"
								_disabled={geoPending}
								_on={{
									onClick: () => {
										void refreshGeo();
									},
								}}
							/>
							<div aria-live="polite" className="geo-address">
								{addressLoading ? 'Adresse wird ermittelt…' : address || 'Keine Adresse für diesen Standort'}
								{positionUpdatedAt !== null && ` (Stand: ${formatGeoTimestamp(positionUpdatedAt)})`}
							</div>
						</>
					)}
					{geoSupported && (
						<>
							{/* #1098 AK1–AK3: Geo-Regler unterhalb des Standort-Switches. Die Kreuz-Schranken
								    (AK2) wirken als dynamische `_min`/`_max` — kein Fehlerzustand (Autoren-Entscheidung).
								    Der `key`-Wechsel auf `geoEnabled` erzwingt wie beim Ermitteln-Button oben einen Remount:
								    der KoliBri-Adapter setzt Props nach dem Mount als Element-Properties, der
								    `_disabled`-Attributwechsel beim Rerender schlägt sonst nicht durch (AK3). */}
							<div className="geo-range-field">
								<KolInputRange
									key={`geo-display-${geoEnabled}`}
									_label="Anzeige-Entfernung (km)"
									_hint={`Bis zu dieser Entfernung zeigt die „In der Nähe“-Liste Aufgaben. Aktuell ${geoConfig.displayDistanceKm} km.`}
									_value={geoConfig.displayDistanceKm}
									_min={geoConfig.alarmDistanceKm}
									_max={50}
									_step={1}
									_disabled={geoDisabled}
									_on={{
										onChange: (_event, value) => {
											applyGeoValue('displayDistanceKm', Number(value ?? geoConfig.displayDistanceKm));
										},
									}}
								/>
								{/* Sichtbarer aktueller Wert im Light-DOM (KI-UX Regel 4): Slider
								    zeigen den gewählten Wert nicht selbst. */}
								<span className="geo-range-value">{geoConfig.displayDistanceKm} km</span>
							</div>
							<div className="geo-range-field">
								<KolInputRange
									key={`geo-alarm-${geoEnabled}`}
									_label="Alarm-Entfernung (km)"
									_hint={`Ab dieser Entfernung zur Aufgabe erscheint der Alarm-Hinweis. Aktuell ${geoConfig.alarmDistanceKm} km.`}
									_value={geoConfig.alarmDistanceKm}
									_min={1}
									_max={geoConfig.displayDistanceKm}
									_step={1}
									_disabled={geoDisabled}
									_on={{
										onChange: (_event, value) => {
											applyGeoValue('alarmDistanceKm', Number(value ?? geoConfig.alarmDistanceKm));
										},
									}}
								/>
								<span className="geo-range-value">{geoConfig.alarmDistanceKm} km</span>
							</div>
							<div className="geo-range-field">
								<KolInputRange
									key={`geo-interval-${geoEnabled}`}
									_label="Aktualisierungsintervall (Minuten)"
									_hint={`Wie oft die Position im Hintergrund ermittelt wird. Aktuell ${geoConfig.intervalMinutes} Minuten.`}
									_value={geoConfig.intervalMinutes}
									_min={1}
									_max={60}
									_step={1}
									_disabled={geoDisabled}
									_on={{
										onChange: (_event, value) => {
											applyGeoValue('intervalMinutes', Number(value ?? geoConfig.intervalMinutes));
										},
									}}
								/>
								<span className="geo-range-value">{geoConfig.intervalMinutes} Minuten</span>
							</div>
						</>
					)}
				</div>
				{/* Beide Panel-Inhalte bleiben gemountet: `KolTabs` blendet inaktive Panels nur aus dem
					    Layout- und Accessibility-Baum aus. Ein Unmount würde ungespeicherte Formularwerte
					    verwerfen und bei jeder Rückkehr einen erneuten Provider-Fetch auslösen (#886). */}
				<div slot="tab-1">
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
				</div>
				<div slot="tab-2" className="settings-llm">
					{/* KI-Provider: Radio-Auswahl (Custom + fixe Built-ins), Modellwahl, Verwaltung. */}
					<KolHeading _label="KI-Provider" _level={2} />
					{/* #1080: Hauptschalter — blendet die KI-Bedienelemente (Säulen-Berater, Lektorate) aus.
							Muster `.settings-llm-switch-row` wie in „Allgemein" (#971): mobil Stack, desktop Zeile. */}
					<div className="settings-llm-switch-row">
						<KolInputCheckbox
							_label="KI-Features aktiv"
							_variant="switch"
							_hint="Bei deaktivierter KI sind der Säulen-Berater und die Lektorat-Buttons ausgeblendet."
							_checked={aiEnabled}
							_on={{
								onChange: (_event, value) => {
									setAiPreference('aiEnabled', value === true);
								},
							}}
						/>
						{!aiEnabled && (
							<KolAlert _type="info" _label="KI-Features deaktiviert">
								Säulen-Berater und Lektorat-Buttons sind derzeit ausgeblendet. Auch die Schnellerfassung ist inaktiv,
								solange die KI deaktiviert ist (#1085).
							</KolAlert>
						)}
					</div>
					{/* #1085: Schnellerfassung ist ein KI-Feature — bei deaktivierter KI wird der Schalter
							deaktiviert, damit er nicht umschaltbar ist. */}
					<div className="settings-llm-switch-row">
						<KolInputCheckbox
							_label="Schnellerfassung aktiv"
							_variant="switch"
							_hint="Bei deaktivierter Schnellerfassung öffnet „Neuen Task anlegen“ direkt das vollständige Formular. Erfordert aktive KI."
							_checked={quickCaptureEnabled}
							_disabled={!aiEnabled}
							_on={{
								onChange: (_event, value) => {
									setAiPreference('quickCaptureEnabled', value === true);
								},
							}}
						/>
					</div>
					<LlmSettings />
				</div>
			</KolTabs>
		</main>
	);
};
