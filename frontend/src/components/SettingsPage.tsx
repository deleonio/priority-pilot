import {
	KolAccordion,
	KolAlert,
	KolButton,
	KolCard,
	KolDetails,
	KolInputCheckbox,
	KolInputRange,
	KolInputText,
	KolTabs,
} from '@public-ui/react-v19';
import type { GeoConfig, Pillar } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAnimationsEnabled } from '../lib/animations';
import { useHeartAnimationEnabled } from '../lib/heartAnimation';
import { useDoneAnimationEnabled } from '../lib/doneAnimation';
import { usePrefersReducedMotion } from '../lib/reducedMotion';
import { requestMicrophonePermission } from '../lib/micPermission';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';
import { useGeolocation, GEO_CONFIG_CHANGED_EVENT } from '../lib/useGeolocation';
import { notifyProfileChanged } from '../lib/profileChanged';
import { usePushSubscription } from '../lib/push';
import { useVoiceAutostart } from '../lib/voiceAutostart';
import { useAiFeaturesEnabled } from '../lib/aiPreferences';
import { useExpertMode } from '../lib/expertMode';
import { dismissBalanceHint, readBalancePreferences, storeBalancePreferences } from '../lib/balancePreferences';
import { planLabel } from '../lib/planOffers';
import { setupTabsFocusRing } from '../lib/tabsFocusRing';
import { AppearanceSetting } from './AppearanceSetting';
import { HeaderPositionSetting } from './HeaderPositionSetting';
import { BalanceVariantSetting } from './BalanceVariantSetting';
import { LanguageSetting } from './LanguageSetting';
import { AdminUsersSection } from './AdminUsersSection';
import { McpInstructionsSection } from './McpInstructionsSection';
import { ApiTokensSection } from './ApiTokensSection';
import { CalendarSourcesSection } from './CalendarSourcesSection';
import { PlaceFavoritesSection } from './PlaceFavoritesSection';
import { KnowledgeEntriesSection } from './KnowledgeEntriesSection';
import { CategoryList } from './CategoryList';
import { DeleteAccountButton } from './DeleteAccount';
import { GroupsSection } from './GroupsSection';
import { FeaturePopoverButton } from './FeaturePopoverButton';
import { useFollowingOpen } from '../lib/useFollowingOpen';
import { LlmSettings } from './LlmSettings';
import { TaskExportCard } from './TaskExportCard';
import { OwnPlanCard } from './OwnPlanCard';
import { PillarList } from './PillarList';
import { PillarWeightsForm } from './PillarWeightsForm';
import { RecalcPillarModal } from './RecalcPillarModal';
import { PlansSection } from './PlansSection';
import { SubscriptionSection } from './SubscriptionSection';
import { TaskImportCard } from './TaskImportCard';

interface SettingsPageProps {
	pillars: Pillar[];
	/** #1105: Aktiver Tab, von `App` aus der Route `/settings/:tab` abgeleitet (AK4). */
	tab?: number;
	/** #1105: Tab-Wechsel → App navigiert auf `/settings/:tab` (URL ist die Quelle). */
	onTabChange?: (tab: number) => void;
	onSaved: () => void;
	/** Analog zu `onSaved` für die Kategorien (Formulare und Filter halten sie im State). */
	onCategoryChanged?: () => void;
	/** Rollensystem admin/member: blendet den Tab „Nutzerverwaltung" ein (Server erzwingt, UI blendet nur aus). */
	isAdmin?: boolean;
	/** #1566: Rolle tester — sieht die eigene Paket-Karte wie ein Admin, aber NICHT die Nutzerverwaltung. */
	isTester?: boolean;
	/** #1565: Id des eingeloggten Nutzers — Ziel des eigenen Paket-Wechsels (App → hier → OwnPlanCard). */
	currentUserId?: number;
}

// Die Tab-Leiste der Settings-Seite (#271). Reihenfolge nach Paketstufe (#1904): Allgemein (Index 0), Säulen (Index 1),
// Kategorien (Index 2), Ortung (Index 3: Standort #1151 + gespeicherte Orte #1894), KI (Index 4, #1903: Provider und
// Access-Token), Gruppen (Index 5, #1211), „Pakete & Abo" (Index 6, #1529/#1902), Import (Index 7, #1969) und optional
// Nutzerverwaltung (Index 8, nur für Admins). Muss index-paritätisch mit
// `SETTINGS_PATH_SEGMENTS` in `App.tsx` bleiben — die rollenabhängigen Tabs werden deshalb ans Ende
// angehängt statt eingeschoben, damit sich die Indizes der übrigen Tabs für Member nie verschieben.
const BASE_SETTINGS_TABS = ['general', 'pillars', 'categories', 'geo', 'ai', 'groups', 'plans', 'data'] as const;

/** Index des Reiters „Pakete & Abo" — unabhängig von der Rolle, weil er vor den rollenabhängigen
 * Reitern liegt. */
const PLANS_TAB_INDEX = 6;

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
 * Einstellungen-Seite (#271) mit `KolTabs`-Navigation: „Allgemein" (Konto, Darstellung, Bewegung,
 * Benachrichtigungen), „Säulen" (Verwaltung + Gewichtungs-Editor), „KI" (Schalter, Provider,
 * Access-Token, #1903), „Ortung" (Standort #1151 + Orte #1894), „Gruppen" (#1211) und
 * optional „Nutzerverwaltung". Der aktive Tab wird beim initialen Laden aus der URL abgeleitet:
 * `/settings/general` → Allgemein (0), `/settings/llm` und `/settings/zugriff` → KI (4), `/settings/ortung` →
 * Ortung (3), alles andere → Säulen (1).
 *
 * Alle Panels teilen sich ein Layout-Rezept (`.settings-panel`) und dieselben zwei
 * Gruppierungsflächen: `KolCard` für dauerhaft offene Gruppen, `KolAccordion` für aufklappbare.
 * Kein Panel wiederholt den Tab-Namen als Überschrift.
 */
export const SettingsPage = ({
	pillars,
	tab,
	onTabChange,
	onSaved,
	onCategoryChanged,
	isAdmin = false,
	isTester = false,
	currentUserId,
}: SettingsPageProps) => {
	// #1080-Muster: Ohne Admin-Rolle wird der Tab gar nicht erst in die Liste aufgenommen (nicht nur
	// ausgeblendet), damit er weder fokussierbar noch per Accessibility-Baum auffindbar ist.
	const { t } = useTranslation(['settings', 'common', 'forms']);
	const settingsTabs = useMemo(
		() =>
			[...BASE_SETTINGS_TABS, ...(isAdmin ? ['adminUsers' as const] : [])].map((key) => ({
				_label: t(`settingsPage.tabs.${key}`),
			})),
		[isAdmin, t],
	);
	// #1105: Der aktive Tab wird aus der Route `/settings/:tab` abgeleitet und von `App` als `tab`
	// übergeben (AK4) — `/settings/llm` öffnet damit den KI-Tab (#886, #1903). Ohne Prop (direkte
	// Verwendung in Unit-Tests) gilt der Säulen-Tab als Default; `localTab` hält den letzten Select.
	const [localTab, setLocalTab] = useState(1);
	const activeTab = tab ?? localTab;

	// #1614: Modal für Säulen-Neuberechnung
	const [recalcPillarModalOpen, setRecalcPillarModalOpen] = useState(false);

	// #843: Ref für Settings-General Container
	const settingsGeneralRef = useRef<HTMLDivElement>(null);
	// #1151: eigener Ref für den Geo-Tab — der Layout-Hook wirkt nur innerhalb des Ref-Containers.
	const settingsGeoRef = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(
		settingsGeneralRef,
		'kol-input-checkbox, kol-button',
		'[role="switch"], button:not([type="button"]):not([class*="icon"])',
	);
	// #1151: derselbe Alignment-Hook für den „Standort"-Tab (F2: Geo-Controls liegen außerhalb von tab-0).
	useShadowDOMLayout(
		settingsGeoRef,
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

	// #1336: sichtbarer Fokus-Ring für die Shadow-DOM-Tab-Buttons; Callback-Ref, damit die Injektion
	// zuverlässig läuft, sobald `kol-tabs` mountet (Muster analog App.tsx).
	const settingsTabsRef = useCallback((node: HTMLKolTabsElement | null) => setupTabsFocusRing(node), []);

	// #272: Schalter „Sprachaufnahme automatisch starten" (Default aus). Beim Einschalten wird die
	// Mikrofon-Berechtigung angefordert; nur bei erteilter Berechtigung wird die Einstellung aktiviert
	// und persistiert. Wird sie verweigert, bleibt der Schalter aus und ein Hinweis erscheint.
	const { enabled: voiceAutostart, setEnabled: setVoiceAutostart } = useVoiceAutostart();
	// #1792: Balance-Priorisierung — spiegelt denselben localStorage-Key wie der Ansichts-Schalter
	// in der Aufgabenliste (Default **an**).
	const [balancePriority, setBalancePriority] = useState(() => readBalancePreferences().balancePriority);
	const changeBalancePriority = useCallback((checked: boolean): void => {
		setBalancePriority(checked);
		storeBalancePreferences({ balancePriority: checked });
		// Explizites Abschalten ist die getroffene Wahl — der Einmal-Hinweis kehrt nicht zurück (AK4).
		if (!checked) {
			dismissBalanceHint();
		}
	}, []);
	// #1183: Master-Schalter „Animationen" (Default aus, pro Gerät über localStorage). Konfetti
	// (#1169) ist der erste Konsument — das Gate sitzt in `launchConfetti`, nicht hier.
	const { enabled: animationsEnabled, setEnabled: setAnimationsEnabled } = useAnimationsEnabled();
	// #1984: Expertenmodus-Schalter (Default aus, pro Gerät über localStorage) — Gate für die
	// Säulen-Gewichtungs-Karte in diesem Tab und die Regler in TaskForm/DependencyModal.
	const { expertMode, setExpertMode } = useExpertMode();
	// #1984: Klappzustand des Accordion „Was umfasst der Expertenmodus?" — folgt dem Schalter
	// (initial offen bei eingeschaltetem Expertenmodus, sonst zu), manuelles Klappen bleibt
	// möglich (Muster „Einzelne Animationen").
	const [expertDetailsOpen, setExpertDetailsOpen] = useState(expertMode);
	// #1552: Klappzustand des Accordion „Einzelne Animationen" — bewusst app-seitig geführt. Das
	// Accordion folgt dem Master (AK9), darf sich aber durch Header-Klick auch unabhängig davon
	// zu-/aufklappen lassen: ein rein gesteuertes `_open={animationsEnabled}` ohne Handler wird vom
	// nächsten unbeteiligten Re-Render wieder zurückreconciliert (CI-Rennen zweimal rot).
	const [animationsOpen, setAnimationsOpen] = useState(animationsEnabled);
	// Feinschalter „Herz animieren“ — gilt nur gemeinsam mit dem Master (das Herz im HeartBalance).
	const { enabled: heartAnimationEnabled, setEnabled: setHeartAnimationEnabled } = useHeartAnimationEnabled();
	// Feinschalter „Erledigt animieren“ — gilt nur gemeinsam mit dem Master (Konfetti, #1169).
	const { enabled: doneAnimationEnabled, setEnabled: setDoneAnimationEnabled } = useDoneAnimationEnabled();
	// #1187: OS-Einstellung „Bewegung reduzieren" live überwachen — deaktiviert den
	// Schalter aus #1183 und zeigt den Info-Hinweis (die Systemeinstellung hat Vorrang).
	const prefersReducedMotion = usePrefersReducedMotion();
	// #1080/#1335: der eine Schalter „KI aktivieren" (#1903). #1525: zusätzlich an die Paket-Freischaltung
	// gekoppelt — ohne Berechtigung `ai_assist` ist der Schalter gesperrt, seit #1903 auch mit eigenem Provider.
	const { aiEnabled, aiFeaturesEnabled, setAiEnabled, entitlementAllowed, requiredPlan } = useAiFeaturesEnabled();
	// Gesperrt, solange die Berechtigung nicht explizit vorliegt (auch während des Ladens, AK5) —
	// unabhängig vom aktuellen Schalterwert selbst, sonst wäre die Sperre zirkulär.
	const aiSwitchLocked = entitlementAllowed !== true;
	// Der Angebots-Alert erscheint erst, wenn die Ablehnung feststeht (nicht während `undefined`);
	// dann sperrt er auch Provider-Einstellungen (#1903 AK6).
	const showAiPlanAlert = entitlementAllowed === false;
	const aiSwitchDisabled = toKolibriDisabled(aiSwitchLocked ? 'true' : undefined);
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

	const [pushTestResult, setPushTestResult] = useState<'success' | 'none' | 'error' | null>(null);

	// #1794 AK7: Fürsorge-Schalter — serverseitig pro User gespeichert und unabhängig vom
	// Push-Hauptschalter bedienbar (er stoppt nur den Fürsorge-Push, nicht die Frist-Erinnerungen).
	const [carePushEnabled, setCarePushEnabled] = useState(true);
	const [careFailed, setCareFailed] = useState(false);

	useEffect(() => {
		api
			.getCareConfig()
			.then((config) => {
				if (config && typeof config.carePushEnabled === 'boolean') {
					setCarePushEnabled(config.carePushEnabled);
				}
			})
			.catch(() => {
				// Netzwerk-/Session-Fehler: Default (ein) steht bleiben, Schalter bleibt bedienbar.
			});
	}, []);

	/** #1794 AK7: Optimistic-Toggle mit sofortigem PUT; scheiterndes Speichern zeigt den Zeilen-Alert. */
	const toggleCarePush = (value: boolean): void => {
		setCarePushEnabled(value);
		api
			.updateCareConfig({ carePushEnabled: value, zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone })
			.then(() => setCareFailed(false))
			.catch(() => {
				setCareFailed(true);
				setCarePushEnabled(!value);
			});
	};

	// #1994 AK6: Schalter „Hinweis zum Aufteilen“ — serverseitig pro User, Muster wie der Fürsorge-Schalter.
	const [splitHintEnabled, setSplitHintEnabled] = useState(true);
	const [splitHintFailed, setSplitHintFailed] = useState(false);

	useEffect(() => {
		api
			.getSplitHintConfig()
			.then((config) => {
				if (config && typeof config.splitHintEnabled === 'boolean') {
					setSplitHintEnabled(config.splitHintEnabled);
				}
			})
			.catch(() => {
				// Netzwerk-/Session-Fehler: Default (ein) steht bleiben, Schalter bleibt bedienbar.
			});
	}, []);

	const toggleSplitHint = (value: boolean): void => {
		setSplitHintEnabled(value);
		api
			.updateSplitHintConfig({ splitHintEnabled: value })
			.then(() => setSplitHintFailed(false))
			.catch(() => {
				setSplitHintFailed(true);
				setSplitHintEnabled(!value);
			});
	};

	// #1219 AK6: Anzeigename (Tab „Allgemein") — Server ist die Quelle (Spalte `users.displayName`),
	// initial per GET /profile nachgeladen. Nutzer-Eingabe schlägt den nachlaufenden GET
	// (dieselbe Absicherung wie bei der Geo-Konfiguration unten).
	const [displayName, setDisplayName] = useState('');
	const nameUserEditedRef = useRef(false);

	useEffect(() => {
		api
			.getProfile()
			.then((profile) => {
				if (!nameUserEditedRef.current && profile && typeof profile.displayName === 'string') {
					setDisplayName(profile.displayName);
				}
			})
			.catch(() => {
				// Netzwerk-/Session-Fehler: Feld bleibt leer, aber bedienbar.
			});
	}, []);

	/** #1219 AK2: Anzeigenamen speichern; Root aktualisiert die Kopfzeile über das Profil-Event. */
	const saveDisplayName = (): void => {
		const trimmed = displayName.trim();
		// Leer lässt der Server ohnehin mit 400 ab — den vergeblichen Roundtrip sparen.
		if (trimmed.length === 0) return;
		api
			.updateProfile({ displayName: trimmed })
			.then((profile) => {
				// Server-Echo vorziehen, aber defensiv bleiben (fehlendes/leeres Body-Feld nicht crashing).
				const savedName = typeof profile?.displayName === 'string' ? profile.displayName : trimmed;
				setDisplayName(savedName);
				notifyProfileChanged(savedName);
				onSaved();
			})
			.catch(() => {
				// Best-Effort wie die Geo-Werte: UI zeigt den eingegebenen Namen, 400/Netzwerk bleibt ohne Alert.
			});
	};

	// #1098 AK1: Geo-Konfiguration (Anzeige-/Alarm-Entfernung, Intervall) — serverseitig pro User
	// gespeichert (AK7, kein localStorage). Initial die Server-Defaults 5 km / 1 km / 5 Minuten,
	// der GET-Aufruf überschreibt sie mit den gespeicherten Werten.
	const [geoConfig, setGeoConfig] = useState<GeoConfig>({
		displayDistanceKm: 5,
		alarmDistanceKm: 1,
		intervalMinutes: 5,
	});
	// Entwurf der drei Regler: Änderungen wirken erst über „Speichern", „Zurücksetzen" verwirft sie.
	const [geoDraft, setGeoDraft] = useState<GeoConfig>(geoConfig);

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
					setGeoDraft(config);
				}
			})
			.catch(() => {
				// Netzwerk-/Session-Fehler: Defaults stehen bleiben, Felder bleiben bedienbar.
			});
	}, []);

	/**
	 * #1098 AK2: Regler-Änderung im Entwurf vermerken (gespeichert wird erst über „Speichern"). Kreuz-Schranken
	 * werden als dynamische `_min`/`_max` der Regler durchgesetzt (Autoren-Entscheidung: keine Alerts,
	 * keine Inline-Fehler) — der Entwurf hält die Invarianten zusätzlich ein, damit der Server nie mit
	 * 400 antworten muss.
	 */
	const applyGeoValue = (key: keyof GeoConfig, value: number): void => {
		geoUserEditedRef.current = true;
		setGeoDraft((previous) => {
			const next = { ...previous, [key]: value };
			if (key === 'displayDistanceKm' && next.alarmDistanceKm > value) {
				next.alarmDistanceKm = value;
			}
			if (key === 'alarmDistanceKm' && next.displayDistanceKm < value) {
				next.displayDistanceKm = value;
			}
			return next;
		});
	};

	const geoDraftChanged =
		geoDraft.displayDistanceKm !== geoConfig.displayDistanceKm ||
		geoDraft.alarmDistanceKm !== geoConfig.alarmDistanceKm ||
		geoDraft.intervalMinutes !== geoConfig.intervalMinutes;

	/** Entwurf per PUT speichern; Best-Effort, der Server hält sonst den letzten gültigen Stand. */
	const saveGeoDraft = (): void => {
		const next = geoDraft;
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
	// Beide Akkordeons der Ortung folgen „Standort erfassen", bleiben aber von Hand umschaltbar.
	const geoRangeAccordion = useFollowingOpen(geoEnabled);
	const geoActionsDisabled = toKolibriDisabled(geoDraftChanged && geoEnabled ? undefined : 'true');

	return (
		// #1320: Seiteninhalt INNERHALB der App-Shell — kein eigenes `<main>` und keine eigene `<h1>`
		// mehr (beides trägt seit #1320 das App-Layout, AK7), und kein „Zurück"-Button (AK3): Header
		// und Kopf-Aktionen bleiben sichtbar, der Rückweg läuft über den aktiven Toolbar-Button.
		<div className="settings-page">
			<KolTabs
				ref={settingsTabsRef}
				className="settings-tabs"
				_label={t('settingsPage.tabsLabel')}
				_tabs={settingsTabs}
				_selected={activeTab}
				_on={tabsCallbacks}
			>
				{/*
				 * Vereinheitlichte Tab-Struktur (Design-Lauf 2026-09): Jedes Panel trägt `.settings-panel`
				 * (ein Stapel-Rhythmus, ein Außenabstand für alle sechs Tabs) und gruppiert seinen Inhalt
				 * in `KolCard` (dauerhaft offene Gruppen) bzw. `KolAccordion` (aufklappbare Gruppen).
				 * Kein Panel trägt mehr eine Überschrift, die den Tab-Namen wiederholt — der Tab-Reiter
				 * ist der Name des Abschnitts (WCAG 1.3.1: eine Überschrift pro Sache).
				 */}
				<div slot="tab-0" className="settings-general settings-panel" ref={settingsGeneralRef}>
					{/* #1219 AK6/AK7: Anzeigename — Feld + Speichern im Stapel-Layout der Karte (mobil volle
							Breite, kein horizontales Scrollen). Der `.settings-profile`-Wrapper hält den
							16dp-Rhythmus innerhalb der Karte. */}
					<KolCard className="settings-card" _label={t('settingsPage.account.card')} _level={2}>
						<div className="settings-profile">
							<KolInputText
								_label={t('forms:labels.displayName')}
								_value={displayName}
								_maxLength={60}
								_on={{
									onInput: (_event, value) => {
										nameUserEditedRef.current = true;
										setDisplayName(
											typeof value === 'string' ? value : String((_event.target as HTMLInputElement)?.value ?? ''),
										);
									},
								}}
							/>
							<KolButton
								className="settings-action-btn"
								_label={t('settingsPage.account.saveDisplayName')}
								_variant="secondary"
								_on={{ onClick: saveDisplayName }}
							/>
						</div>
					</KolCard>

					{/* Darstellung und Spracheingabe teilen sich eine Karte: beide beschreiben, wie die App
							sich beim Bedienen verhält. Das Karten-Label wiederholt bewusst keinen der beiden
							Control-Namen („Darstellung", „Sprachaufnahme automatisch starten"). */}
					<KolCard className="settings-card" _label={t('settingsPage.appearanceCard')} _level={2}>
						<div className="settings-card-stack">
							<AppearanceSetting />
							{/* #1428: Kopfzeile oben/unten — ebenfalls eine Darstellungsfrage der App-Shell. */}
							<HeaderPositionSetting />
							<LanguageSetting />
							{/* Bildwahl für die Lebensbalance auf der Startseite — gehört zur Darstellung, nicht
									zu den Animationen: Sie gilt auch, wenn gar nichts animiert wird. */}
							<BalanceVariantSetting />
							{/* #1792: Sortierverhalten der Aufgabenliste — schreibt denselben localStorage-Key
									wie der Ansichts-Schalter „Balance-Priorisierung“ in der Aufgabenansicht.
									#971-Muster: Switch je in einer `.settings-switch-row` — mobil volle Breite im
									Stack-Layout, desktop eine Zeile. */}
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('settingsPage.balancePriority.label')}
									_variant="switch"
									_hint={t('settingsPage.balancePriority.hint')}
									_checked={balancePriority}
									_on={{
										onChange: (_event, value) => {
											changeBalancePriority(value === true);
										},
									}}
								/>
							</div>
							{/* #1984: Expertenmodus — Säulen-Prozente (Aufgabendialog), Gewichte
							    (Abhängigkeits-Dialog), die Säulen-Gewichtungspflege (Tab Säulen) und die
							    Standort-Regler (Tab Standort) sind Experteninhalt. Ausblenden ist reine
							    UI-Ausblendung; gespeicherte Werte bleiben. */}
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('settingsPage.expertMode.label')}
									_variant="switch"
									_checked={expertMode}
									_hint={t('settingsPage.expertMode.hint')}
									_on={{
										onChange: (_event, value) => {
											setExpertMode(value === true);
											// Das Inhalts-Accordion folgt dem Schalter (Muster „Einzelne Animationen").
											setExpertDetailsOpen(value === true);
										},
									}}
								/>
							</div>
							{/* #1984: Aufklappbare Liste der Experten-Bereiche — der Nutzer soll verstehen,
							    was der Schalter einschaltet, bevor er ihn nutzt. Folgt dem Schalterzustand
							    (`_open`), eigenes Klappen bleibt über den Click-Handler möglich. #2015: `KolDetails`, weil der Block in der Karte liegt (Regel 1). */}
							<KolDetails
								className="settings-accordion"
								_label={t('settingsPage.expertMode.detailsLabel')}
								_level={3}
								_open={expertDetailsOpen}
								_on={{
									onClick: (_event, open) => setExpertDetailsOpen(open === true),
								}}
							>
								<ul className="settings-expert-list">
									<li>{t('settingsPage.expertMode.itemPillarShares')}</li>
									<li>{t('settingsPage.expertMode.itemWeights')}</li>
									<li>{t('settingsPage.expertMode.itemPillarWeights')}</li>
									<li>{t('settingsPage.expertMode.itemGeoRange')}</li>
								</ul>
							</KolDetails>
							{/* #971: Switch + zugehörige Alerts je in einer `.settings-switch-row` — mobil volle
									Breite im Stack-Layout, desktop eine Zeile (Switch links, Alert rechts). */}
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('forms:labels.autoStartRecording')}
									_variant="switch"
									_checked={voiceAutostart}
									_hint={t('settingsPage.voiceAutostart.hint')}
									_on={{
										onChange: (_event, value) => {
											void onToggleVoiceAutostart(value === true);
										},
									}}
								/>
								{micDenied && (
									<KolAlert _type="warning" _label={t('settingsPage.voiceAutostart.deniedLabel')}>
										{t('settingsPage.voiceAutostart.deniedText')}
									</KolAlert>
								)}
							</div>
						</div>
					</KolCard>

					{/* #1183: Master-Schalter „Animationen" — steuert zentral alle dekorativen Animationen
							(erster Konsument: Konfetti aus #1169). Muster wie die Switch-Zeilen oben (#971). */}
					<KolCard className="settings-card" _label={t('settingsPage.motion.card')} _level={2}>
						<div className="settings-card-stack">
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('settingsPage.motion.animationsLabel')}
									_variant="switch"
									_checked={animationsEnabled}
									_disabled={prefersReducedMotion}
									_hint={t('settingsPage.motion.animationsHint')}
									_on={{
										onChange: (_event, value) => {
											setAnimationsEnabled(value === true);
											// #1552: Master-Schalter klappt das Accordion mit auf/zu
											// (AK9) — der lokale Klappzustand läuft synchron mit.
											setAnimationsOpen(value === true);
										},
									}}
								/>
								{/* #1187: Die Systemeinstellung hat Vorrang — sie deaktiviert den Schalter
										(deshalb `_disabled` oben) und erklärt den Zustand. */}
								{prefersReducedMotion && (
									<KolAlert _type="info" _label={t('settingsPage.motion.reducedLabel')}>
										{t('settingsPage.motion.reducedText')}
									</KolAlert>
								)}
							</div>
							{/* Feinschalter unter dem Master-Schalter: ein `KolDetails` in der Karte (Regel 1 —
									davor `KolAccordion`, davor eigene Zeilen). Öffnet synchron mit dem Master,
									ausgegraut solange der Master zu ist bzw. das OS Bewegung reduziert
									(docs/ux-pattern-master-detail-settings.md). */}
							<KolDetails
								className="settings-accordion"
								_label={t('settingsPage.motion.singleAnimations')}
								_level={3}
								_open={animationsOpen}
								_on={{
									onClick: (_event, open) => setAnimationsOpen(open === true),
								}}
							>
								<div className="settings-card-stack">
									<div className="settings-switch-row">
										<KolInputCheckbox
											_label={t('settingsPage.motion.heartLabel')}
											_variant="switch"
											_checked={heartAnimationEnabled}
											_disabled={!animationsEnabled || prefersReducedMotion}
											_hint={t('settingsPage.motion.heartHint')}
											_on={{
												onChange: (_event, value) => {
													setHeartAnimationEnabled(value === true);
												},
											}}
										/>
									</div>
									<div className="settings-switch-row">
										<KolInputCheckbox
											_label={t('settingsPage.motion.doneLabel')}
											_variant="switch"
											_checked={doneAnimationEnabled}
											_disabled={!animationsEnabled || prefersReducedMotion}
											_hint={t('settingsPage.motion.doneHint')}
											_on={{
												onChange: (_event, value) => {
													setDoneAnimationEnabled(value === true);
												},
											}}
										/>
									</div>
								</div>
							</KolDetails>
						</div>
					</KolCard>

					<KolCard className="settings-card" _label={t('settingsPage.notifications.card')} _level={2}>
						<div className="settings-card-stack">
							{pushSupported ? (
								<div className="settings-switch-row">
									<KolInputCheckbox
										_label={t('settingsPage.notifications.pushLabel')}
										_variant="switch"
										_checked={pushEnabled}
										_disabled={pushPending}
										_hint={t('settingsPage.notifications.pushHint')}
										_on={{
											onChange: (_event, value) => {
												void togglePush(value === true);
											},
										}}
									/>
									{/* #971: `pushFailed` gehört zur Switch-Zeile; der „Push testen"-Button und die
										    Test-Push-Ergebnis-Alerts (#932/#886) bleiben eigene Zeilen außerhalb. */}
									{pushFailed && (
										<KolAlert _type="warning" _label={t('settingsPage.notifications.pushFailedLabel')}>
											{t('settingsPage.notifications.pushFailedText')}
										</KolAlert>
									)}
								</div>
							) : (
								<KolAlert _type="info" _label={t('settingsPage.notifications.pushUnavailableLabel')}>
									{t('settingsPage.notifications.pushUnavailableText')}
								</KolAlert>
							)}
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('settingsPage.notifications.careLabel')}
									_variant="switch"
									_checked={carePushEnabled}
									_hint={t('settingsPage.notifications.careHint')}
									_on={{
										onChange: (_event, value) => {
											toggleCarePush(value === true);
										},
									}}
								/>
								{/* #1794: `careFailed` gehört zur Switch-Zeile (#971-Muster wie `pushFailed`). */}
								{careFailed && (
									<KolAlert _type="warning" _label={t('settingsPage.notifications.saveFailedLabel')}>
										{t('settingsPage.notifications.saveFailedText')}
									</KolAlert>
								)}
							</div>
							<div className="settings-switch-row">
								<KolInputCheckbox
									_label={t('settingsPage.notifications.splitHintLabel')}
									_variant="switch"
									_checked={splitHintEnabled}
									_hint={t('settingsPage.notifications.splitHintHint')}
									_on={{
										onChange: (_event, value) => {
											toggleSplitHint(value === true);
										},
									}}
								/>
								{splitHintFailed && (
									<KolAlert _type="warning" _label={t('settingsPage.notifications.saveFailedLabel')}>
										{t('settingsPage.notifications.saveFailedText')}
									</KolAlert>
								)}
							</div>
							{pushEnabled && (
								<KolButton
									_label={t('settingsPage.notifications.pushTest')}
									class="settings-action-btn"
									_variant="secondary"
									_on={{
										onClick: () => {
											api
												.sendTestPush()
												.then(({ sent }) => {
													setPushTestResult(sent > 0 ? 'success' : 'none');
												})
												.catch(() => {
													setPushTestResult('error');
												});
										},
									}}
								/>
							)}
							{pushTestResult === 'success' && (
								<KolAlert _type="success" _label={t('settingsPage.notifications.testSuccessLabel')}>
									{t('settingsPage.notifications.testSuccessText')}
								</KolAlert>
							)}
							{pushTestResult === 'none' && (
								<KolAlert _type="warning" _label={t('settingsPage.notifications.testNoneLabel')}>
									{t('settingsPage.notifications.testNoneText')}
								</KolAlert>
							)}
							{pushTestResult === 'error' && (
								<KolAlert _type="error" _label={t('settingsPage.notifications.testErrorLabel')}>
									{t('settingsPage.notifications.testErrorText')}
								</KolAlert>
							)}
						</div>
					</KolCard>

					{/* #2210: ICS-Kalender verbinden — die Termine erscheinen in der Wochenansicht. */}
					<CalendarSourcesSection />

					{/* #1802: „Konto löschen“ gehört zu den folgereichen, selten genutzten Aktionen — der
					    Auslöser sitzt deshalb zugeklappt am Ende des Allgemein-Tabs, damit das Durchsehen
					    der Einstellungen nichts versehentlich auslöst. Neutrale Überschrift: der Klapp-
					    Toggle ist selbst ein Button und darf nicht „Konto löschen“ heißen; Rot erscheint
					    erst im Bestätigungsdialog (docs/ux-pattern-sequential-confirmation.md). */}
					<KolAccordion className="settings-accordion" _label={t('settingsPage.accountData')} _level={2}>
						<DeleteAccountButton userId={currentUserId} />
					</KolAccordion>
				</div>
				{/* Beide Panel-Inhalte bleiben gemountet: `KolTabs` blendet inaktive Panels nur aus dem
					    Layout- und Accessibility-Baum aus. Ein Unmount würde ungespeicherte Formularwerte
					    verwerfen und bei jeder Rückkehr einen erneuten Provider-Fetch auslösen (#886). */}
				{/*
				 * Der Tab „Säulen" trägt zwei getrennte Aufgaben: die Stammdaten-Ansicht und die
				 * Gewichtung. Beide sind genau EINE Karte mit genau EINER Überschrift — die
				 * Vertragsüberschrift „Säulen-Gewichtung" (#270, settings-page.spec.ts) ist das
				 * Karten-Label der Gewichtungskarte.
				 */}
				<div slot="tab-1" className="settings-pillars settings-panel">
					{/* #1573: Die fünf Säulen sind fest — durchgehender Info-Hinweis statt der früheren
					    CRUD-Verwaltung (KoliBri-Info-Alert, Muster wie die übrigen Settings-Hinweise). */}
					<KolAlert _type="info" _label={t('settingsPage.pillars.fixedLabel')}>
						<p>{t('settingsPage.pillars.fixedText')}</p>
					</KolAlert>
					{/* Säulen-Ansicht (#439 → #1573): reine Leseansicht, Gewichtung siehe unten. */}
					<KolCard className="settings-card" _label={t('settingsPage.pillars.manageCard')} _level={2}>
						<PillarList />
						<div className="form-actions" style={{ marginTop: '1rem' }}>
							<KolButton
								_label={t('settingsPage.pillars.recalc')}
								_variant="secondary"
								_on={{ onClick: () => setRecalcPillarModalOpen(true) }}
							/>
						</div>
					</KolCard>
					{/* Alle Gewichts-Regler liegen in EINER gemeinsamen Karte (KoliBri-Karte als
					    Gruppierungsfläche, Muster wie die Dashboard-Karten); die Slider-Zeilen selbst
					    tragen bewusst keinen eigenen Kartenrahmen (keine verschachtelten Karten). */}
					{/* #1984: Die Säulen-Gewichtungspflege ist Experteninhalt — im Standardmodus bleibt
					    die Karte weg (bedingtes Rendern, kein CSS-Hide); gespeicherte Gewichte bleiben. */}
					{expertMode && (
						<KolCard className="settings-card" _label={t('settingsPage.pillars.weightsCard')} _level={2}>
							{/* Beim Direktaufruf von /settings/pillars mountet die Seite, BEVOR die Säulen geladen
						    sind. Das Formular hält seine Rohwerte in einem beim Mount initialisierten Ref —
						    per `key` neu mounten, sobald die Säulen eintreffen, damit die geladenen Gewichte
						    übernommen werden. Der Key ist die ID-Folge, nicht die Anzahl: Löschen + Anlegen
						    zwischen zwei Renders lässt die Anzahl gleich, ordnete die Rohwerte im Ref aber
						    den falschen Säulen zu. */}
							<PillarWeightsForm
								key={pillars.map((pillar) => pillar.id).join('-')}
								pillars={pillars}
								onSaved={onSaved}
							/>
						</KolCard>
					)}
				</div>
				{/* #1903: Tab „KI" — Schalter oben, darunter die Karten „KI-Provider" und „Access-Token".
				    Deren `KolDetails` folgen dem Schalter (eingeklappt, nicht entfernt; Regel 2). */}
				{/* Kategorien: thematische Ordnungsebene neben den Säulen (Route /settings/kategorien).
				    Panel-Rezept wie die übrigen Tabs (Design-Lauf 2026-09): `.settings-panel` plus eine
				    `KolCard` als Gruppierungsfläche. */}
				<div slot="tab-2" className="settings-categories settings-panel">
					<KolCard className="settings-card" _label={t('settingsPage.categoriesCard')} _level={2}>
						<CategoryList onCategoryChanged={onCategoryChanged} />
					</KolCard>
				</div>
				{/* #1151: Die Geo-Einstellungen bekommen einen eigenen Tab „Standort" (Index 3, Route
				        /settings/standort) — der Tab „Allgemein" bleibt frei von Standort-Settings. Reihenfolge
				        wie bisher: Switch (+ Alerts), Ermitteln-Button, Addressanzeige, drei Slider — letztere
				        seit #1984 Experteninhalt (siehe unten). Die Remount-Keys ziehen mit um (KI-UX: der
				        React-Adapter setzt Props erst nach dem Mount). */}
				<div slot="tab-3" className="settings-geo settings-panel" ref={settingsGeoRef}>
					<KolCard className="settings-card" _label={t('settingsPage.geo.card')} _level={2}>
						<div className="settings-card-stack">
							{geoSupported ? (
								<div className="settings-switch-row">
									<KolInputCheckbox
										_label={t('settingsPage.geo.label')}
										_variant="switch"
										_checked={geoEnabled}
										_disabled={geoPending}
										_hint={t('settingsPage.geo.hint', { minutes: geoConfig.intervalMinutes })}
										_on={{
											onChange: (_event, value) => {
												void toggleGeo(value === true);
											},
										}}
									/>
									{/* #971: `geoDenied` gehört zur Switch-Zeile; der `geoEnabled`-Block
										    (Ermitteln-Button + Adresse, #933) bleibt eigene Zeilen außerhalb. */}
									{geoDenied && (
										<KolAlert _type="warning" _label={t('settingsPage.geo.deniedLabel')}>
											{t('settingsPage.geo.deniedText')}
										</KolAlert>
									)}
								</div>
							) : (
								<KolAlert _type="info" _label={t('settingsPage.geo.unavailableLabel')}>
									{t('settingsPage.geo.unavailableText')}
								</KolAlert>
							)}
							{geoEnabled && (
								<>
									{/* #1972: PWA-Grenze direkt am Aktivierungspunkt erklären (Positionsmuster geoDenied);
										    Text-Empfehlung statt zweitem Install-Button — die Aktion bleibt im InstallPrompt. */}
									<KolAlert _type="warning" _label={t('settingsPage.geo.pwaLabel')}>
										{t('settingsPage.geo.pwaText')}
									</KolAlert>
									{/* #933 AK1/AK5: Test-Schalter stößt refresh() an; während der Ermittlung
										    deaktiviert (Re-Entrancy-Guard im Hook). Der key-Wechsel auf geoPending
										    erzwingt einen Remount: Der KoliBri-Adapter setzt Props nach dem Mount als
										    Element-Properties, sodass der `_disabled`-Attributwechsel beim Rerender
										    nicht durchschlägt — der Remount stellt den korrekten Zustand sicher. */}
									<KolButton
										key={geoPending ? 'geo-refresh-pending' : 'geo-refresh-idle'}
										_label={t('settingsPage.geo.refresh')}
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
										{addressLoading ? t('settingsPage.geo.addressLoading') : address || t('settingsPage.geo.noAddress')}
										{positionUpdatedAt !== null &&
											` ${t('settingsPage.geo.updatedAt', { time: formatGeoTimestamp(positionUpdatedAt) })}`}
									</div>
								</>
							)}
						</div>
					</KolCard>
					{geoSupported && expertMode && (
						/* #1098 AK1–AK3: Geo-Regler als eigenes `KolAccordion` unter der Karte „Standorterfassung“ (Formular ohne
						   weitere Klappbereiche), synchron mit dem Standort-Switch.
						   (Master-/Unter-Settings-Pattern, docs/ux-pattern-master-detail-settings.md).
						   Die Kreuz-Schranken (AK2) wirken als dynamische `_min`/`_max` — kein Fehlerzustand
						   (Autoren-Entscheidung). Der `key`-Wechsel auf `geoEnabled` erzwingt wie beim
						   Ermitteln-Button oben einen Remount: der KoliBri-Adapter setzt Props nach dem Mount
						   als Element-Properties, der `_disabled`-Attributwechsel beim Rerender schlägt sonst
						   nicht durch (AK3). */
						/* #1984: Die Reichweiten-/Intervall-Regler sind Experteninhalt — im Standardmodus
						   bleibt der Details-Block weg (bedingtes Rendern, kein CSS-Hide); gespeicherte
						   Werte bleiben und wirken weiter (NearbyCard, Push-Hinweis). */
						<KolAccordion
							className="settings-accordion"
							_label={t('settingsPage.geo.rangeAccordion')}
							_level={2}
							{...geoRangeAccordion}
						>
							<div className="settings-card-stack">
								<div className="geo-range-field">
									<KolInputRange
										key={`geo-display-${geoEnabled}`}
										_label={t('settingsPage.geo.displayLabel')}
										_hint={t('settingsPage.geo.displayHint', { km: geoDraft.displayDistanceKm })}
										_value={geoDraft.displayDistanceKm}
										_min={geoDraft.alarmDistanceKm}
										_max={50}
										_step={1}
										_disabled={geoDisabled}
										_on={{
											onChange: (_event, value) => {
												applyGeoValue('displayDistanceKm', Number(value ?? geoDraft.displayDistanceKm));
											},
										}}
									/>
									{/* Sichtbarer aktueller Wert im Light-DOM (KI-UX Regel 4): Slider
									    zeigen den gewählten Wert nicht selbst. */}
									<span className="geo-range-value">
										{t('settingsPage.geo.valueKm', { km: geoDraft.displayDistanceKm })}
									</span>
								</div>
								<div className="geo-range-field">
									<KolInputRange
										key={`geo-alarm-${geoEnabled}`}
										_label={t('settingsPage.geo.alarmLabel')}
										_hint={t('settingsPage.geo.alarmHint', { km: geoDraft.alarmDistanceKm })}
										_value={geoDraft.alarmDistanceKm}
										_min={1}
										_max={geoDraft.displayDistanceKm}
										_step={1}
										_disabled={geoDisabled}
										_on={{
											onChange: (_event, value) => {
												applyGeoValue('alarmDistanceKm', Number(value ?? geoDraft.alarmDistanceKm));
											},
										}}
									/>
									<span className="geo-range-value">
										{t('settingsPage.geo.valueKm', { km: geoDraft.alarmDistanceKm })}
									</span>
								</div>
								<div className="geo-range-field">
									<KolInputRange
										key={`geo-interval-${geoEnabled}`}
										_label={t('settingsPage.geo.intervalLabel')}
										_hint={t('settingsPage.geo.intervalHint', { minutes: geoDraft.intervalMinutes })}
										_value={geoDraft.intervalMinutes}
										_min={1}
										_max={60}
										_step={1}
										_disabled={geoDisabled}
										_on={{
											onChange: (_event, value) => {
												applyGeoValue('intervalMinutes', Number(value ?? geoDraft.intervalMinutes));
											},
										}}
									/>
									<span className="geo-range-value">
										{t('settingsPage.geo.valueMinutes', { minutes: geoDraft.intervalMinutes })}
									</span>
								</div>

								<div className="settings-button-row">
									<KolButton
										key={`geo-save-${geoDraftChanged}-${geoEnabled}`}
										_label={t('common:actions.save')}
										class="settings-action-btn"
										_variant="primary"
										_disabled={geoActionsDisabled}
										_on={{ onClick: saveGeoDraft }}
									/>
									<KolButton
										key={`geo-reset-${geoDraftChanged}-${geoEnabled}`}
										_label={t('settingsPage.geo.reset')}
										class="settings-action-btn"
										_variant="secondary"
										_disabled={geoActionsDisabled}
										_on={{ onClick: () => setGeoDraft(geoConfig) }}
									/>
								</div>
							</div>
						</KolAccordion>
					)}
					{/* #1894: Gespeicherte Orte (#1342) gehören zur Ortung — unabhängig vom Geo-Schalter; sie erscheinen im
					    Adressfeld von Aufgabe und Serie. */}
					<PlaceFavoritesSection open={geoEnabled} />
				</div>
				<div slot="tab-4" className="settings-llm settings-panel">
					{/* #1080/#1335: der eine Schalter — blendet die KI-Bedienelemente (KI-Anlege-Dialog mit
							Berater, Lektorate) aus. Der frühere Feinschalter „Schnellerfassung aktiv" samt
							Accordion „Einzelne KI-Funktionen" ist mit #1335 entfallen: Schnellerfassung und
							Berater sind ein einziger Dialog und damit kein eigenständig schaltbares Feature mehr.
							Muster `.settings-llm-switch-row` wie in „Allgemein" (#971): mobil Stack, desktop Zeile.
							#1525: ohne Paket-Freischaltung ist der Schalter gesperrt; der Angebots-Alert steht
							VOR dem Schalter im DOM (nicht nur per CSS), damit die 375px-Stapelreihenfolge (AK6)
							und die Fokus-/Lesereihenfolge (WCAG 1.3.2) übereinstimmen. */}
					<KolCard className="settings-card" _label={t('settingsPage.ai.card')} _level={2}>
						<div className="settings-card-stack">
							<div className="settings-llm-switch-row">
								{showAiPlanAlert && (
									<FeaturePopoverButton
										label={t('settingsPage.ai.planRequired', { plan: requiredPlan ? planLabel(requiredPlan) : '' })}
										onShowPlans={() => tabsCallbacks.onSelect(new Event('select'), PLANS_TAB_INDEX)}
									>
										{t('settingsPage.ai.planText', { plan: requiredPlan ? planLabel(requiredPlan) : '' })}
									</FeaturePopoverButton>
								)}
								<KolInputCheckbox
									key={aiSwitchLocked ? 'ai-switch-locked' : 'ai-switch-unlocked'}
									_label={t('settingsPage.ai.switchLabel')}
									_variant="switch"
									_hint={t('settingsPage.ai.switchHint')}
									_checked={aiFeaturesEnabled}
									_disabled={aiSwitchDisabled}
									_on={{
										onChange: (_event, value) => {
											setAiEnabled(value === true);
										},
									}}
								/>
								{!showAiPlanAlert && !aiEnabled && (
									<KolAlert _type="info" _label={t('settingsPage.ai.disabledLabel')}>
										{t('settingsPage.ai.disabledText')}
									</KolAlert>
								)}
							</div>
						</div>
					</KolCard>
					<LlmSettings open={aiFeaturesEnabled} disabled={showAiPlanAlert} />
					<ApiTokensSection open={aiFeaturesEnabled} />
					<KnowledgeEntriesSection />
					<McpInstructionsSection open={aiFeaturesEnabled} />
				</div>
				{/* #1211: Gruppen-Verwaltung (AK6–AK8) — eigener Tab „Gruppen" (Index 5, Route
				        /settings/gruppen). Liste als Accordions mit Rolle + Mitgliederzahl, Anlegen/Bearbeiten
				        per Modal, Löschen mit sequenzieller Bestätigung. */}
				<div slot="tab-5" className="settings-groups settings-panel">
					<GroupsSection />
				</div>
				{/* #1902: „Pakete" und „Abo" (#1529) als EIN Reiter mit zwei Karten untereinander — oben das
				    laufende Abo, unten die buchbaren Pakete (Regel 1: Karten nur oberste Ebene). */}
				<div slot="tab-6" className="settings-plans settings-panel">
					{/* #1565 AK1: kostenfreier Paket-Selbst-Wechsel in eigener Karte ÜBER dem Abo —
					        die Bedienaktion vor dem Lesestoff. Gating um die KARTE (nicht den Tab), damit
					        spätere Rollen sie ohne Tab-Umbau aufnehmen können (AK4): Tester (#1566) sieht
					        dieselbe Karte, der Server begrenzt sie auf die eigene Id. */}
					{(isAdmin || isTester) && typeof currentUserId === 'number' && <OwnPlanCard userId={currentUserId} />}
					<KolCard className="settings-card" _label={t('settingsPage.plans.subscriptionCard')} _level={2}>
						<SubscriptionSection />
					</KolCard>
					<KolCard className="settings-card" _label={t('settingsPage.plans.plansCard')} _level={2}>
						<PlansSection />
					</KolCard>
				</div>
				{/* #1969: Tab „Daten" (Index 7, Route /settings/daten): CSV-Import (Datei wählen → Vorschau mit
				    Spalten-Mapping → Übernehmen) und CSV-Export aller Aufgaben. */}
				<div slot="tab-7" className="settings-import settings-panel">
					<KolCard className="settings-card" _label={t('settingsPage.data.importCard')} _level={2}>
						<TaskImportCard />
					</KolCard>
					<KolCard className="settings-card" _label={t('settingsPage.data.exportCard')} _level={2}>
						<TaskExportCard />
					</KolCard>
				</div>
				{isAdmin && (
					<div slot="tab-8" className="settings-admin-users settings-panel">
						<KolCard className="settings-card" _label={t('settingsPage.adminUsersCard')} _level={2}>
							<AdminUsersSection currentUserId={currentUserId} />
						</KolCard>
					</div>
				)}
			</KolTabs>

			{/* #1614: Modal für Säulen-Neuberechnung */}
			{recalcPillarModalOpen && (
				<RecalcPillarModal
					onClose={() => setRecalcPillarModalOpen(false)}
					// Schließt bewusst NICHT: `onCompleted` heißt „Daten neu laden", nicht „fertig, weg
					// damit". Schlösse es das Modal, unmountete die Komponente im selben Commit, in dem
					// sie ihr Ergebnis rendert — Erfolgsmeldung, Fehler und die Warnung über das
					// aufgebrauchte KI-Kontingent wären nie sichtbar. Geschlossen wird über den Button.
					// `onCategoryChanged` lädt nur neu; `onSaved` navigierte zurück zur Hauptansicht.
					onCompleted={onCategoryChanged}
				/>
			)}
		</div>
	);
};
