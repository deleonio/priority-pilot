import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { PlanProvider } from '../lib/usePlan';
import type { EntitlementMap } from '../lib/planOffers';

/**
 * Rote Spec-Tests für #933 — „Geolokation manuell anstoßen + aktuelle Adresse stets sichtbar".
 *
 * Spec-Bezug: docs/spec/issue-933.md
 *
 * Der Geolocation-Hook wird wie in Footer.test.tsx per `vi.mock` ersetzt; die Hook-Logik
 * selbst (Initial-Fetch, refresh-Guard) testet useGeolocation.test.ts (#933-Block). Hier
 * geht es um den UI-Vertrag des Abschnitts „Standort erfassen":
 * - AK1: KolButton „Standort ermitteln" (secondary) nur bei enabled=true.
 * - AK2: Lade- und Ergebnis-Anzeige („Adresse wird ermittelt…", Adresse, Fallback).
 * - AK4: Zeitstempel „Stand: HH:MM" in der Adressanzeige (aus positionUpdatedAt).
 */

/** Überschreibbares Hook-Ergebnis: Jeder Test mutiert nur die relevanten Felder. */
const geoState = {
	supported: true,
	enabled: false,
	pending: false,
	permissionDenied: false,
	position: null as { latitude: number; longitude: number } | null,
	address: null as string | null,
	addressLoading: false,
	positionUpdatedAt: null as number | null,
	toggle: vi.fn(),
	refresh: vi.fn(),
};

vi.mock('../lib/useGeolocation', () => ({
	useGeolocation: () => geoState,
}));

// api-Double: Proxy beantwortet jede Methode mit einem leeren Promise — verhindert
// Netzwerk-Calls aus SettingsPage und eingebetteten Formularen (PillarList, LlmSettings).
// Methoden mit strukturierten Rückgaben bekommen typ-passende Leerwerte, damit die
// Produktionskomponenten keine Defensive gegen `undefined` brauchen (#1103 F3-Rückbau).
// Seit #1098 wird der Mock gecacht: wiederholter Zugriff auf dieselbe Methode liefert
// dieselbe Mock-Funktion, damit Einzeltests sie gezielt stemmen können (getGeoConfig).
const apiDefaults: Record<string, unknown> = {
	listPillars: [],
	listCategories: [],
	listLlmProviders: [],
	getAdminUsers: [],
};
const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(apiDefaults[prop])),
		},
	),
}));

// Neben-Hooks der Seite durch no-op-Doubles ersetzen (jsdom hat kein ServiceWorker/Mic).
// Push-Zustand als überschreibbares Objekt (#1017): Default bleibt leer wie bisher
// (kein `enabled` → Push-Sektion unsichtbar), der #1017-Test aktiviert den Button gezielt.
const pushState: Record<string, unknown> = {};
vi.mock('../lib/push', () => ({ usePushSubscription: () => pushState }));
vi.mock('../lib/voiceAutostart', () => ({ useVoiceAutostart: () => ({}) }));
vi.mock('../lib/useShadowDOMLayout', () => ({ useShadowDOMLayout: () => ({}) }));
vi.mock('../lib/micPermission', () => ({ requestMicrophonePermission: vi.fn() }));

// #1320: `onBack` entfällt — der „Zurück"-Button der Seite ist weg, der Rückweg läuft über den
// aktiven Toolbar-Button im App-Header.
const defaultProps = {
	pillars: [],
	onSaved: vi.fn(),
};

beforeEach(() => {
	pushState.enabled = false;
	geoState.supported = true;
	geoState.enabled = false;
	geoState.pending = false;
	geoState.permissionDenied = false;
	geoState.position = null;
	geoState.address = null;
	geoState.addressLoading = false;
	geoState.positionUpdatedAt = null;
	// #1151: Die Geo-Einstellungen leben im Tab „Standort" (`/settings/standort`) — der fachliche
	// Kontext aller Geo-Tests dieser Datei. (Die Panels bleiben gemountet, die URL steuert hier
	// nur den fachlichen Kontext.)
	window.history.replaceState({}, '', '/settings/standort');
});

afterEach(cleanup);

describe('SettingsPage – #933: Standort-Test-Schalter und Adressanzeige', () => {
	// AK1: Button nur bei aktivierter Standorterfassung, als sekundärer KolButton.
	it('AK1: enabled=true rendert KolButton „Standort ermitteln" (secondary)', () => {
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);
		const button = container.querySelector('kol-button[_label="Standort ermitteln"]');
		expect(button).not.toBeNull();
		expect(button?.getAttribute('_variant')).toBe('secondary');
	});

	it('AK1: enabled=false rendert KEINEN Standort-Button', () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		expect(container.querySelector('kol-button[_label="Standort ermitteln"]')).toBeNull();
	});

	// AK2: Async-Zustände vollständig (UX-Regel 7): Laden, Erfolg, Leer.
	it('AK2: während der Ermittlung Lade-Text und Button deaktiviert, danach Adresse', () => {
		geoState.enabled = true;
		geoState.pending = true;
		geoState.addressLoading = true;
		const { container, rerender } = render(<SettingsPage {...defaultProps} />);

		const button = container.querySelector('kol-button[_label="Standort ermitteln"]');
		expect(container.querySelector('.geo-address')?.textContent).toContain('Adresse wird ermittelt…');
		// Re-Entrancy am Button sichtbar (AK5/UX: Touch-Response < 100 ms):
		expect(button?.hasAttribute('_disabled')).toBe(true);

		// Ermittlung abgeschlossen → Adresse statt Lade-Text, Button wieder bedienbar.
		geoState.pending = false;
		geoState.addressLoading = false;
		geoState.address = 'Musterstraße 1, 10117 Berlin';
		rerender(<SettingsPage {...defaultProps} />);
		expect(container.querySelector('.geo-address')?.textContent).toContain('Musterstraße 1');
		expect(container.querySelector('.geo-address')?.textContent).not.toContain('Adresse wird ermittelt');
		expect(container.querySelector('kol-button[_label="Standort ermitteln"]')?.hasAttribute('_disabled')).toBe(false);
	});

	it('AK2: ohne Adresse Fallback „Keine Adresse für diesen Standort“', () => {
		geoState.enabled = true;
		geoState.address = null;
		const { container } = render(<SettingsPage {...defaultProps} />);
		expect(container.querySelector('.geo-address')?.textContent).toContain('Keine Adresse für diesen Standort');
	});

	// AK4: Zeitstempel der letzten Ermittlung in der Adressanzeige — aus positionUpdatedAt
	// des Hooks abgeleitet (HH:MM), nicht hartkodiert.
	it('AK4: Adressanzeige enthält „Stand: HH:MM“ aus positionUpdatedAt', () => {
		geoState.enabled = true;
		geoState.address = 'Musterstraße 1, 10117 Berlin';
		geoState.positionUpdatedAt = new Date('2026-08-23T14:05:00').getTime();
		const { container } = render(<SettingsPage {...defaultProps} />);
		expect(container.querySelector('.geo-address')?.textContent).toMatch(/Stand:\s*14:05/);
	});
});

describe('SettingsPage – #1017: Vereinheitlichtes Layout der Aktions-Buttons', () => {
	/**
	 * Roter Spec-Test — Spec-Bezug: docs/spec/issue-1017.md AK1.
	 *
	 * Beide Aktions-Buttons („Push testen", „Standort ermitteln") tragen dieselbe nicht-leere
	 * Layout-Klasse; die heutige Einzelregel `.push-test-btn` (nur Push-Button) wird durch die
	 * gemeinsame Regel ersetzt. Spiegel-Test: Der Sollwert (Klasse des Push-Buttons) wird aus der
	 * führenden Quelle gelesen und auf den Geo-Button gespiegelt — kein Klassen-Literal im Test,
	 * damit die Implementierung den Klassennamen frei wählen kann.
	 *
	 * Rot heute: Der Geo-Button trägt gar keine Klasse, der Push-Button `push-test-btn`.
	 */
	it('AK1: beide Aktions-Buttons tragen dieselbe nicht-leere Layout-Klasse', () => {
		pushState.enabled = true;
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const pushButton = container.querySelector('kol-button[_label="Push testen"]');
		const geoButton = container.querySelector('kol-button[_label="Standort ermitteln"]');
		expect(pushButton).not.toBeNull();
		expect(geoButton).not.toBeNull();

		const pushClass = pushButton?.getAttribute('class') ?? '';
		// Nicht leer — sonst wäre der Gleichheits-Spiegel über eine leere Menge grün.
		expect(pushClass.trim().length).toBeGreaterThan(0);
		expect(geoButton?.getAttribute('class')).toBe(pushClass);
	});
});

/**
 * Rote Spec-Tests für #1098 — Geo-Einstellungen (Anzeige-/Alarm-Entfernung, Intervall).
 *
 * Spec-Bezug: docs/spec/issue-1098.md. Der Geolocation-Hook bleibt gemockt (oben); die drei
 * Geo-Werte kommen aus `api.getGeoConfig` (serverseitig pro User, AK7 — kein localStorage).
 *
 * - AK1: drei KolInputRange unterhalb des Standort-Switches, Defaults 5 km / 1 km / 5 min,
 *   sichtbarer aktueller Wert mit Einheit.
 * - AK2: dynamische Kreuz-Schranken — `_max` der Alarm-Entfernung folgt dem Anzeige-Wert,
 *   `_min` der Anzeige-Entfernung folgt dem Alarm-Wert, sofort bei Änderung; kein Error-State.
 * - AK3: Standort aus → alle drei Felder `_disabled`, Werte bleiben sichtbar; der Wechsel
 *   wirkt nach dem Mount (rerender, key-Remount-Muster SettingsPage.tsx:266-272).
 */
describe('SettingsPage – #1098: Geo-Einstellungen (Anzeige-/Alarm-Entfernung, Intervall)', () => {
	const LABELS = {
		display: 'Anzeige-Entfernung (km)',
		alarm: 'Alarm-Entfernung (km)',
		interval: 'Aktualisierungsintervall (Minuten)',
	};

	const field = (container: HTMLElement, label: string): HTMLElement | null =>
		container.querySelector(`kol-input-range[_label="${label}"]`);

	/** KoliBri-Adapter setzt numerische Props je nach Adapter als Property oder Attribut. */
	const bound = (el: Element, name: string): string => {
		const value = (el as unknown as Record<string, unknown>)[name] ?? el.getAttribute(name);
		return value === null || value === undefined ? '' : String(value);
	};

	beforeEach(() => {
		apiMocks.getGeoConfig?.mockResolvedValue({
			displayDistanceKm: 5,
			alarmDistanceKm: 1,
			intervalMinutes: 5,
		});
	});

	it('AK1: drei InputRanges unterhalb des Standort-Switches mit Defaults 5 km / 1 km / 5 min', () => {
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const display = field(container, LABELS.display);
		const alarm = field(container, LABELS.alarm);
		const interval = field(container, LABELS.interval);
		// Guard gegen einen dauerhaft grünen Test über eine leere Menge:
		expect(display, 'Anzeige-Entfernung fehlt').not.toBeNull();
		expect(alarm, 'Alarm-Entfernung fehlt').not.toBeNull();
		expect(interval, 'Intervall fehlt').not.toBeNull();

		expect(bound(display!, '_value')).toBe('5');
		expect(bound(alarm!, '_value')).toBe('1');
		expect(bound(interval!, '_value')).toBe('5');
		expect(bound(interval!, '_min')).toBe('1');
		expect(bound(interval!, '_max')).toBe('60');
		expect(bound(interval!, '_step')).toBe('1');

		// Unterhalb des Standort-Switches (Reihenfolge im Allgemein-Panel):
		const geoSwitch = container.querySelector('kol-input-checkbox[_label="Standort erfassen"]');
		expect(geoSwitch).not.toBeNull();
		expect(display!.compareDocumentPosition(geoSwitch!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

		// Sichtbarer aktueller Wert mit Einheit (KI-UX Regel 4: Zustand ohne Antippen sichtbar):
		const text = container.textContent ?? '';
		expect(text).toContain('5 km');
		expect(text).toContain('1 km');
		expect(text).toContain('5 Minuten');
	});

	it('AK2: _max der Alarm-Entfernung folgt dem Anzeige-Wert, _min der Anzeige-Entfernung dem Alarm-Wert', async () => {
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const display = field(container, LABELS.display)!;
		const alarm = field(container, LABELS.alarm)!;
		expect(bound(alarm, '_max')).toBe('5');
		expect(bound(display, '_min')).toBe('1');

		// Anzeige-Entfernung auf 20 km → Alarm-_max sofort 20:
		await act(async () => {
			(display as unknown as { _on: { onChange: (e: unknown, v: number) => void } })._on.onChange(
				{ target: display },
				20,
			);
		});
		expect(bound(alarm, '_max'), 'Alarm-_max folgt der Anzeige-Entfernung').toBe('20');

		// Alarm-Entfernung auf 3 km → Anzeige-_min sofort 3:
		await act(async () => {
			(alarm as unknown as { _on: { onChange: (e: unknown, v: number) => void } })._on.onChange({ target: alarm }, 3);
		});
		expect(bound(display, '_min'), 'Anzeige-_min folgt der Alarm-Entfernung').toBe('3');

		// Kein Fehlerzustand (Autoren-Entscheidung: Schranken statt Alerts):
		expect(container.textContent ?? '').not.toContain('muss kleiner als die Anzeige-Entfernung');
	});

	it('AK3: Standort aus → alle drei Felder _disabled, Werte bleiben sichtbar; Wechsel wirkt nach dem Mount', () => {
		geoState.enabled = true;
		const { container, rerender } = render(<SettingsPage {...defaultProps} />);
		const labels = Object.values(LABELS);
		for (const label of labels) {
			expect(field(container, label)?.hasAttribute('_disabled'), `${label} enabled`).toBe(false);
		}

		// Switch aus (Hook-State kippt → rerender, wie beim key-Remount nach dem Mount):
		geoState.enabled = false;
		rerender(<SettingsPage {...defaultProps} />);
		for (const label of labels) {
			const el = field(container, label);
			expect(el, `${label} bleibt gerendert, nicht versteckt`).not.toBeNull();
			expect(el?.hasAttribute('_disabled'), `${label} disabled`).toBe(true);
		}
		// Werte bleiben sichtbar erhalten (disabled, nicht entfernt):
		expect(bound(field(container, LABELS.display)!, '_value')).toBe('5');
		expect(bound(field(container, LABELS.alarm)!, '_value')).toBe('1');
	});
});

/**
 * Rote Spec-Tests für #1151 — „Eigener Settings-Tab ‚Standort'".
 *
 * Spec-Bezug: docs/spec/issue-1151.md
 *
 * Der komplette Geo-Block (Standort-Switch inkl. Alerts, Ermitteln-Button, Addressanzeige,
 * drei Slider) wandert aus dem Tab „Allgemein" (`slot="tab-0"`) in einen neuen vierten Slot
 * (`slot="tab-3"`, Route `/settings/standort`). „Allgemein" behält Darstellung → Sprachaufnahme
 * → Push in unveränderter Reihenfolge.
 *
 * jsdom rendert `<kol-tabs>` als unbekanntes Element ohne Slot-Zuordnung — alle Panels bleiben
 * im DOM. Der Slot-Vertrag lässt sich deshalb direkt über die `slot="tab-N"`-Container prüfen.
 * Die URL-/Tab-Auswahl-Interaktion (AK1 „Direktaufruf wählt ihn aus", AK4) ist e2e-Vertrag
 * (settings-tabs.spec.ts), hier liegt der Fokus auf der DOM-Zuordnung.
 */
describe('SettingsPage – #1151: Standort-Tab (Tab-Umzug der Geo-Einstellungen)', () => {
	/** Slot-Container eines Tabs (KolTabs-Panel-Host). */
	const panel = (container: HTMLElement, slot: string): HTMLElement | null =>
		container.querySelector(`[slot="${slot}"]`);

	it('AK1: es gibt ein viertes Panel slot="tab-3" und der Geo-Switch lebt darin', () => {
		geoState.enabled = false;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const tab3 = panel(container, 'tab-3');
		expect(tab3, 'vierter Slot tab-3 existiert').not.toBeNull();
		expect(
			tab3?.querySelector('kol-input-checkbox[_label="Standort erfassen"]'),
			'Standort-Switch ist im tab-3-Panel',
		).toBeTruthy();
	});

	it('AK2: der komplette Geo-Block ist aus tab-0 („Allgemein") entfernt', () => {
		geoState.enabled = true;
		geoState.permissionDenied = true;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const tab0 = panel(container, 'tab-0');
		expect(tab0).not.toBeNull();
		// Switch inkl. Berechtigungs-Alert:
		expect(tab0?.querySelector('kol-input-checkbox[_label="Standort erfassen"]')).toBeNull();
		expect(tab0?.querySelector('kol-alert[_label="Standortzugriff verweigert"]')).toBeNull();
		// Ermitteln-Button + Addressanzeige:
		expect(tab0?.querySelector('kol-button[_label="Standort ermitteln"]')).toBeNull();
		expect(tab0?.querySelector('.geo-address')).toBeNull();
		// Die drei Slider:
		expect(tab0?.querySelectorAll('kol-input-range').length, 'keine Geo-Regler im Allgemein-Tab').toBe(0);
	});

	it('AK2: der Geo-Block (Switch, Button, Adresse, drei Slider) ist vollständig in tab-3', () => {
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);

		const tab3 = panel(container, 'tab-3');
		expect(tab3, 'vierter Slot tab-3 existiert').not.toBeNull();
		expect(tab3?.querySelector('kol-input-checkbox[_label="Standort erfassen"]')).toBeTruthy();
		expect(tab3?.querySelector('kol-button[_label="Standort ermitteln"]')).toBeTruthy();
		expect(tab3?.querySelector('.geo-address')).toBeTruthy();
		const labels = ['Anzeige-Entfernung (km)', 'Alarm-Entfernung (km)', 'Aktualisierungsintervall (Minuten)'];
		for (const label of labels) {
			expect(tab3?.querySelector(`kol-input-range[_label="${label}"]`), `${label} im tab-3-Panel`).toBeTruthy();
		}
	});

	it('AK3: tab-0 behält Darstellung, Sprachaufnahme und Push in bisheriger Reihenfolge', () => {
		pushState.enabled = true;
		pushState.supported = true; // ohne `supported` rendert die Komponente die Push-Sektion gar nicht
		const { container } = render(<SettingsPage {...defaultProps} />);

		const tab0 = panel(container, 'tab-0');
		expect(tab0, 'Allgemein-Panel existiert').not.toBeNull();
		expect(tab0?.querySelector('kol-input-radio[_label="Darstellung"]')).toBeTruthy();

		// Reihenfolge via DOM-Position (compareDocumentPosition), wie bisher: Sprachaufnahme
		// vor Push-Nachrichten; keine Geo-Elemente dazwischen (durch AK2-Test gesichert).
		const voice = tab0?.querySelector('kol-input-checkbox[_label="Sprachaufnahme automatisch starten"]');
		const push = tab0?.querySelector('kol-input-checkbox[_label="Push-Nachrichten aktivieren"]');
		expect(voice).not.toBeNull();
		expect(push).not.toBeNull();
		expect(voice!.compareDocumentPosition(push!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

/**
 * Rote Spec-Tests für #1183 — „Animationen zentral in den Einstellungen schaltbar".
 *
 * Spec-Bezug: docs/spec/issue-1183.md (AK1/AK3).
 *
 * Der Master-Schalter „Animationen" (localStorage `pp-animations-enabled`, Default aus)
 * lebt als KolInputCheckbox im Panel „Allgemein" (`slot="tab-0"`), Muster: Voice-Autostart
 * (#272). Der Hook useAnimationsEnabled wird NICHT gemockt — der localStorage-Vertrag
 * (Initial-Zustand + Toggle schreibt Key) ist hier Teil der Prüfung.
 */
describe('SettingsPage – #1183: Master-Schalter „Animationen" im Tab Allgemein', () => {
	const KEY = 'pp-animations-enabled';

	/** KoliBri-Adapter setzt numerische/boolesche Props je nach Adapter als Property oder Attribut. */
	const bound = (el: Element, name: string): string => {
		const value = (el as unknown as Record<string, unknown>)[name] ?? el.getAttribute(name);
		return value === null || value === undefined ? '' : String(value);
	};

	beforeEach(() => {
		localStorage.removeItem(KEY);
	});

	afterEach(() => {
		localStorage.removeItem(KEY);
	});

	it('AK1: der Schalter „Animationen" rendert im Panel Allgemein (tab-0)', () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		const tab0 = container.querySelector('[slot="tab-0"]');
		expect(tab0, 'Allgemein-Panel existiert').not.toBeNull();
		expect(
			tab0?.querySelector('kol-input-checkbox[_label="Animationen"]'),
			'Animationen-Schalter fehlt',
		).not.toBeNull();
	});

	it('AK3: ohne Key ist der Schalter initial aus (Default false)', () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		const toggle = container.querySelector('kol-input-checkbox[_label="Animationen"]');
		expect(toggle).not.toBeNull();
		expect(bound(toggle!, '_checked')).toBe('false');
	});

	it('AK1: Toggle schreibt den localStorage-Key und übernimmt den Zustand', async () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		const toggle = container.querySelector('kol-input-checkbox[_label="Animationen"]');
		expect(toggle).not.toBeNull();

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
		});
		expect(localStorage.getItem(KEY)).toBe('true');
		expect(bound(toggle!, '_checked')).toBe('true');

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				false,
			);
		});
		expect(localStorage.getItem(KEY)).toBe('false');
	});
});

describe('SettingsPage – #1187: Info-Meldung „Bewegung reduzieren" im Tab Allgemein', () => {
	const KEY = 'pp-animations-enabled';

	/** KoliBri-Adapter setzt boolesche Props je nach Adapter als Property oder Attribut. */
	const bound = (el: Element, name: string): string => {
		const value = (el as unknown as Record<string, unknown>)[name] ?? el.getAttribute(name);
		return value === null || value === undefined ? '' : String(value);
	};

	/**
	 * matchMedia-Stub (Muster `confetti.test.ts:17-31`): nur die reduced-motion-Query
	 * liefert eine Präferenz, alles andere (z. B. color-scheme aus AppearanceSetting)
	 * bleibt neutral. Der Hook `usePrefersReducedMotion` existiert noch nicht → die
	 * Banner-Assertions laufen rot, bis `frontend/src/lib/reducedMotion.ts` + Banner
	 * existieren (docs/spec/issue-1187.md).
	 */
	const stubReducedMotion = (reduce: boolean): void => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockImplementation((query: string) => ({
				matches: reduce && query.includes('prefers-reduced-motion'),
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				addListener: vi.fn(),
				removeListener: vi.fn(),
				onchange: null,
				dispatchEvent: vi.fn().mockReturnValue(false),
			})),
		);
	};

	/** Info-Alerts im Panel „Allgemein" (u. a. Push-Banner) — Grundmenge für den Themen-Filter. */
	const reducedMotionAlerts = (container: HTMLElement): NodeListOf<Element> =>
		container.querySelectorAll('[slot="tab-0"] kol-alert[_type="info"]');

	/** Filtert die Info-Alerts auf die, deren Label ODER Text „Bewegung reduzieren" nennen. */
	const alertsMentioningReducedMotion = (container: HTMLElement): Element[] =>
		Array.from(reducedMotionAlerts(container)).filter(
			(alert) =>
				(alert.getAttribute('_label') ?? '').includes('Bewegung reduzieren') ||
				(alert.textContent ?? '').includes('Bewegung reduzieren'),
		);

	beforeEach(() => {
		localStorage.removeItem(KEY);
	});

	afterEach(() => {
		localStorage.removeItem(KEY);
		vi.unstubAllGlobals();
	});

	it('AK1: bei aktiver Systemeinstellung erscheint im Panel Allgemein eine Info-Meldung', () => {
		stubReducedMotion(true);
		const { container } = render(<SettingsPage {...defaultProps} />);
		const alerts = alertsMentioningReducedMotion(container);
		expect(alerts.length, 'Info-Meldung zu „Bewegung reduzieren" fehlt').toBeGreaterThan(0);
		expect(alerts[0]?.getAttribute('_type')).toBe('info');
	});

	it('AK1: ohne die Systemeinstellung erscheint die Info-Meldung nicht', () => {
		stubReducedMotion(false);
		const { container } = render(<SettingsPage {...defaultProps} />);
		expect(alertsMentioningReducedMotion(container)).toHaveLength(0);
	});

	it('AK4: bei reduce bleibt der gespeicherte Gerätewert sichtbar, aber der Schalter ist deaktiviert', () => {
		stubReducedMotion(true);
		localStorage.setItem(KEY, 'true');
		const { container } = render(<SettingsPage {...defaultProps} />);
		const toggle = container.querySelector('kol-input-checkbox[_label="Animationen"]');
		expect(toggle, 'Animationen-Schalter fehlt').not.toBeNull();

		// Zeigt den gespeicherten Wert …
		expect(bound(toggle!, '_checked')).toBe('true');
		// … ist aber deaktiviert, weil die Systemeinstellung Vorrang hat.
		expect(toggle!.hasAttribute('_disabled')).toBe(true);
	});

	it('AK4: ohne reduce ist der Schalter umschaltbar und schreibt den localStorage-Key', async () => {
		stubReducedMotion(false);
		const { container } = render(<SettingsPage {...defaultProps} />);
		const toggle = container.querySelector('kol-input-checkbox[_label="Animationen"]');
		expect(toggle, 'Animationen-Schalter fehlt').not.toBeNull();
		expect(toggle!.hasAttribute('_disabled')).toBe(false);

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
		});
		expect(localStorage.getItem(KEY)).toBe('true');
	});
});

/**
 * Rote Spec-Tests für #1219 — Anzeigename selbst festlegen (Spec docs/spec/issue-1219.md).
 *
 * - AK6: Im Allgemein-Tab gibt es ein Feld „Anzeigename" (KolInputText), mit dem aktuellen
 *   Wert aus `api.getProfile` vorbelegt; Speichern (KolButton „Anzeigename speichern") ruft
 *   `api.updateProfile` mit dem neuen Namen und löst `notifyProfileChanged` aus — Root hört
 *   auf `PROFILE_CHANGED_EVENT` und aktualisiert die Kopfzeile ohne `/auth/me`-Roundtrip.
 *
 * Der api-Proxy (oben) liefert gecachte Mocks — `apiMocks.getProfile`/`updateProfile` werden
 * hier gezielt gestemmt. Rot, bis Feld + Speichern-Logik existieren (KEIN Produktivcode).
 */
describe('SettingsPage – #1219: Anzeigename (Allgemein)', () => {
	beforeEach(() => {
		apiMocks.getProfile?.mockResolvedValue({
			displayName: 'Bisheriger Name',
			email: 'profile@example.com',
			avatarUrl: null,
		});
		apiMocks.updateProfile?.mockReset();
		apiMocks.updateProfile?.mockResolvedValue({
			displayName: 'Neuer Name',
			email: 'profile@example.com',
			avatarUrl: null,
		});
	});

	it('AK6: Feld „Anzeigename" im Allgemein-Tab zeigt den aktuellen Wert', async () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		await act(async () => {}); // getProfile-Nachladen abwarten

		const field = container.querySelector('kol-input-text[_label="Anzeigename"]');
		expect(field, 'Feld „Anzeigename" fehlt im Allgemein-Tab').not.toBeNull();
		const value = (field as unknown as Record<string, unknown>)._value ?? field!.getAttribute('_value');
		expect(String(value)).toBe('Bisheriger Name');
	});

	it('AK6: Speichern ruft updateProfile mit dem neuen Namen und danach onSaved (Kopfzeilen-Reload)', async () => {
		const onSaved = vi.fn();
		const { container } = render(<SettingsPage {...defaultProps} onSaved={onSaved} />);
		await act(async () => {});

		const field = container.querySelector('kol-input-text[_label="Anzeigename"]')!;
		expect(field, 'Feld „Anzeigename" fehlt').not.toBeNull();
		await act(async () => {
			(field as unknown as { _on: { onInput: (e: unknown, v: string) => void } })._on.onInput(
				{ target: field },
				'Neuer Name',
			);
		});

		const save = container.querySelector('kol-button[_label="Anzeigename speichern"]');
		expect(save, 'Speichern-Button „Anzeigename speichern" fehlt').not.toBeNull();
		await act(async () => {
			(save as unknown as { _on: { onClick: (e: unknown) => void } })._on.onClick({});
		});

		expect(apiMocks.updateProfile).toHaveBeenCalledTimes(1);
		expect(apiMocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Neuer Name' });
		expect(onSaved, 'onSaved muss das User-Reload der Kopfzeile anstoßen').toHaveBeenCalled();
	});
});

/**
 * Rote Spec-Tests für Review #1306 Finding 2 — Remount-Key von `PillarWeightsForm`
 * (`SettingsPage.tsx:511`, `key={pillars.map((pillar) => pillar.id).join('-')}`).
 *
 * `PillarWeightsForm` hält seine Rohwerte in einem beim Mount initialisierten Ref
 * (`weights.current`, siehe PillarWeightsForm.tsx:43) — ohne Remount übernimmt es geänderte
 * `pillar.weight`-Werte NICHT. Der Key ist bewusst die ID-*Folge*, nicht die Anzahl: gleiche
 * Anzahl mit anderen IDs muss remounten, identische IDs dürfen es nicht (sonst überschreibt
 * ein Remount unbeabsichtigt laufende Nutzereingaben).
 */
describe('SettingsPage – Remount-Key PillarWeightsForm (Review #1306 Finding 2)', () => {
	const sliderFor = (container: HTMLElement, namePrefix: string): Element | undefined =>
		Array.from(container.querySelectorAll('kol-input-range')).find((el) =>
			el.getAttribute('_label')?.startsWith(`${namePrefix}:`),
		);

	const rawValue = (el: Element): string =>
		String((el as unknown as Record<string, unknown>)._value ?? el.getAttribute('_value'));

	it('identische ID-Folge (nur Gewicht geändert) remountet NICHT — Ref-Wert bleibt der alte', () => {
		const { container, rerender } = render(
			<SettingsPage {...defaultProps} pillars={[{ id: 1, name: 'Körper', description: '', weight: 20 }]} />,
		);
		expect(rawValue(sliderFor(container, 'Körper')!)).toBe('0.2');

		rerender(<SettingsPage {...defaultProps} pillars={[{ id: 1, name: 'Körper', description: '', weight: 50 }]} />);
		// Ohne Remount bleibt der Ref-Rohwert unverändert bei 0,2 (Anzeige folgt nicht dem neuen Prop).
		expect(rawValue(sliderFor(container, 'Körper')!)).toBe('0.2');
	});

	it('gleiche Anzahl, andere ID-Folge remountet — Ref-Wert übernimmt das neue Gewicht', () => {
		const { container, rerender } = render(
			<SettingsPage {...defaultProps} pillars={[{ id: 1, name: 'Körper', description: '', weight: 20 }]} />,
		);
		expect(rawValue(sliderFor(container, 'Körper')!)).toBe('0.2');

		rerender(<SettingsPage {...defaultProps} pillars={[{ id: 2, name: 'Geist', description: '', weight: 50 }]} />);
		// Andere ID-Folge → neuer `key` → Remount → Ref initialisiert sich aus dem neuen Prop (0,5).
		expect(sliderFor(container, 'Körper')).toBeUndefined();
		expect(rawValue(sliderFor(container, 'Geist')!)).toBe('0.5');
	});
});

/**
 * Rote Spec-Tests für Fixup PR #1300 (Finding #2) — Tab-Gating „Nutzerverwaltung" (Rollensystem
 * admin/member). Ohne `isAdmin` taucht der Tab weder in der Tab-Liste noch als Panel auf (#1080-
 * Muster: nicht nur ausgeblendet, sondern gar nicht erst aufgenommen); mit `isAdmin` erscheint er
 * als letzter Tab (Index 8 seit #1529, ans Ende angehängt) mit `AdminUsersSection` im Panel
 * `slot="tab-8"`.
 */
describe('SettingsPage – Rollensystem admin/member: Tab-Gating „Nutzerverwaltung"', () => {
	// Test-Pflege #1352: Seit dem Tab „Zugriff" (letzter Tab) ist der letzte Slot ohne Admin-Rolle vom
	// API-Token-Panel belegt. Der #1300-Vertrag bleibt derselbe — geprüft wird jetzt die Abwesenheit
	// der `AdminUsersSection` statt die des Slots.
	it('ohne isAdmin fehlt der Tab „Nutzerverwaltung" in der Tab-Liste und es gibt kein Panel mit AdminUsersSection', () => {
		const { container } = render(<SettingsPage {...defaultProps} />);

		const tabsEl = container.querySelector('kol-tabs') as unknown as { _tabs?: { _label: string }[] } | null;
		expect(tabsEl?._tabs?.map((t) => t._label)).not.toContain('Nutzerverwaltung');
		expect(container.querySelector('.admin-users')).toBeNull();
	});

	// Test-Pflege #1529: „Pakete"/„Abo" hängen zwischen „Kategorien" und den rollenabhängigen
	// Reitern — „Nutzerverwaltung" rückt damit von Index 6 auf 8. Der geprüfte Vertrag (#1300:
	// Admin-Reiter am Ende, AdminUsersSection in seinem Panel) bleibt unverändert.
	it('mit isAdmin erscheint „Nutzerverwaltung" als letzter Tab mit AdminUsersSection im Panel slot="tab-8"', () => {
		const { container } = render(<SettingsPage {...defaultProps} isAdmin />);

		const tabsEl = container.querySelector('kol-tabs') as unknown as { _tabs?: { _label: string }[] } | null;
		expect(tabsEl?._tabs?.map((t) => t._label)).toEqual([
			'Allgemein',
			'Säulen',
			'KI-Provider',
			'Standort',
			'Gruppen',
			'Kategorien',
			'Pakete',
			'Abo',
			'Nutzerverwaltung',
			// Test-Pflege #1526: Tab-Label „Zugriff" → „Access-Token" (AK1); Route/Index unverändert,
			// Index 8 bleibt Nutzerverwaltung.
			'Access-Token',
		]);
		const adminPanel = container.querySelector('[slot="tab-8"]');
		expect(adminPanel, 'letzter Slot tab-8 existiert').not.toBeNull();
		expect(adminPanel?.querySelector('.admin-users'), 'AdminUsersSection ist im tab-8-Panel').toBeTruthy();
	});
});

/**
 * Rote Spec-Tests für #1352 (Spec docs/spec/issue-1352.md) — AK8: Tab „Zugriff" erzeugt/zeigt
 * einen Klartext-Token genau einmal und entfernt ihn nach „Zurückziehen" aus der Liste.
 *
 * Panel bleibt gemountet unabhängig vom aktiven Tab (siehe Kommentar SettingsPage.tsx:531) — Zugriff
 * per `container.querySelector`, kein `tab`-Prop nötig. Ohne `isAdmin` liegt „Zugriff" auf
 * `slot="tab-8"` (letzter Tab; Test-Pflege #1529: vorher `tab-6`, seit den Reitern „Pakete"/„Abo"
 * um zwei Positionen verschoben).
 */
describe('SettingsPage – #1352: Tab „Zugriff" (API-Tokens)', () => {
	beforeEach(() => {
		delete apiMocks.listApiTokens;
		delete apiMocks.createApiToken;
		delete apiMocks.deleteApiToken;
	});

	const panel = (container: HTMLElement) => container.querySelector('[slot="tab-8"] [data-testid="api-tokens-panel"]');

	it('AK8: „Token erzeugen" zeigt den Klartext genau einmal an', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		apiMocks.createApiToken = vi.fn().mockResolvedValue({
			id: 1,
			name: 'CLI',
			token: 'pp_plaintext-once-1234567890',
			createdAt: new Date().toISOString(),
			lastUsedAt: null,
		});
		const { container } = render(<SettingsPage {...defaultProps} />);

		expect(panel(container), 'Panel „Zugriff" (tab-8) fehlt').not.toBeNull();

		const createButton = container.querySelector(
			'[data-testid="api-tokens-panel"] kol-button[_label="Token erzeugen"]',
		);
		expect(createButton, 'Button „Token erzeugen" fehlt').not.toBeNull();

		// Seit #1357 ist die Laufzeit ein Pflichtfeld ohne Vorauswahl (AK6) — ohne diese Auswahl bliebe
		// der Klick wirkungslos.
		const durationSelect = container.querySelector('[data-testid="api-token-duration-select"]');
		await act(async () => {
			(durationSelect as unknown as { _on: { onChange: (e: unknown, v: string) => void } })._on.onChange(
				{ target: durationSelect },
				'365',
			);
			await Promise.resolve();
		});

		await act(async () => {
			createButton?.dispatchEvent(new Event('click', { bubbles: true }));
			await Promise.resolve();
		});

		const plaintext = container.querySelector('[data-testid="api-token-plaintext"]');
		expect(plaintext, 'Klartext-Anzeige nach Erzeugen fehlt').not.toBeNull();
		expect(plaintext?.textContent).toContain('pp_plaintext-once-1234567890');
	});

	it('AK8: „Zurückziehen" entfernt die Zeile aus der Liste', async () => {
		apiMocks.listApiTokens = vi
			.fn()
			.mockResolvedValue([{ id: 5, name: 'Zu löschen', createdAt: new Date().toISOString(), lastUsedAt: null }]);
		apiMocks.deleteApiToken = vi.fn().mockResolvedValue(undefined);
		const { container } = render(<SettingsPage {...defaultProps} />);

		await act(async () => {
			await Promise.resolve();
		});

		const rowsBefore = container.querySelectorAll('[data-testid="api-tokens-panel"] [data-testid="api-token-row"]');
		expect(rowsBefore.length, 'bestehender Token muss initial gelistet sein').toBe(1);

		const revokeButton = container.querySelector(
			'[data-testid="api-tokens-panel"] [data-testid="api-token-row"] kol-button[_label*="Zurückziehen"]',
		);
		expect(revokeButton, 'Button „Zurückziehen" fehlt').not.toBeNull();

		await act(async () => {
			revokeButton?.dispatchEvent(new Event('click', { bubbles: true }));
			await Promise.resolve();
		});
		// Sequenzielle Bestätigung (UX-Block): zweiter Klick auf den Bestätigen-Button im Dialog.
		const confirmButton = container.querySelector('[data-testid="api-token-revoke-confirm"]');
		if (confirmButton) {
			await act(async () => {
				confirmButton.dispatchEvent(new Event('click', { bubbles: true }));
				await Promise.resolve();
			});
		}

		const rowsAfter = container.querySelectorAll('[data-testid="api-tokens-panel"] [data-testid="api-token-row"]');
		expect(rowsAfter.length, 'Token muss nach Zurückziehen aus der Liste verschwinden').toBe(0);
	});
});

/**
 * #1458 AK11: Sekundärbereich „Pakete" in den Einstellungen. Feature-Matrix und Preise kommen
 * vollständig aus `GET /plans` — im Frontend steht keine Preisliste, deshalb prüft der Test, dass
 * genau die gemockten Server-Werte gerendert werden. Die Tab-Panels bleiben gemountet (siehe
 * `beforeEach`), die Karte ist also unabhängig vom aktiven Tab im DOM.
 */
describe('SettingsPage – #1458 AK11: Bereich „Pakete"', () => {
	const catalog = {
		features: [
			{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] },
			{ feature: 'graph_write', allowedPlans: ['max', 'ultimate'] },
		],
		prices: {
			free: { monthly: 0, yearly: 0 },
			pro: { monthly: 4, yearly: 40 },
		},
	};

	beforeEach(() => {
		// Den gecachten Proxy-Mock gezielt ersetzen, damit `getPlansCatalog` einen gültigen Katalog
		// liefert statt des `undefined`-Defaults (das landet bewusst im Fehlerzustand der Karte).
		apiMocks.getPlansCatalog = vi.fn().mockResolvedValue(catalog);
	});

	/*
	 * Test-Pflege #1529 (Spec docs/spec/issue-1529.md AK1/AK2/AK3): Die Sektion liegt seit #1529 im
	 * eigenen Reiter „Pakete" (`slot="tab-6"`) statt im Allgemein-Tab, und die Matrix ist keine
	 * handgebaute `.plans-matrix`-Tabelle mehr, sondern eine `KolTableStateful`. In JSDOM hydriert
	 * die Web Component nicht — ihre Zeilen stehen deshalb nicht im DOM, sondern im `_data`-Prop
	 * (Muster `kol-tabs`/`_tabs` weiter oben in dieser Datei). Der geprüfte #1458-AK11-Vertrag
	 * bleibt derselbe: Preise und Feature-Zeilen kommen ausschließlich aus `GET /plans`.
	 */
	it('rendert die Karte „Pakete" mit Matrix und Preisen aus GET /plans', async () => {
		const { container } = render(<SettingsPage {...defaultProps} />);

		await waitFor(() => expect(container.querySelector('[data-testid="plans-section"]')).not.toBeNull());

		expect(container.querySelector('[slot="tab-6"] [data-testid="plans-section"]')).not.toBeNull();
		expect(container.querySelector('kol-card[_label="Pakete im Vergleich"]')).not.toBeNull();
		expect(apiMocks.getPlansCatalog).toHaveBeenCalled();

		const matrix = container.querySelector('kol-table-stateful') as unknown as {
			_data?: (Record<string, unknown> & { _kind?: string })[];
		} | null;
		expect(matrix).not.toBeNull();
		const rows = matrix?._data ?? [];
		// Preise: exakt die Server-Werte, keine im Frontend hinterlegte Liste.
		const monthlyPrices = rows.find((row) => row._kind === 'price' && row.label === 'Preis monatlich');
		expect(monthlyPrices?.free).toBe('0,00 €');
		expect(monthlyPrices?.pro).toBe('0,04 €');
		// Matrixzeilen: je Feature eine Zeile mit „enthalten"/„—" je Paket.
		const featureRows = rows.filter((row) => row._kind === 'feature');
		expect(featureRows).toHaveLength(2);
		expect(featureRows[0]?.pro).toBe('enthalten');
		expect(featureRows[0]?.free).toBe('—');
	});

	it('zeigt den Ladefehler, wenn GET /plans scheitert — statt halber Daten', async () => {
		apiMocks.getPlansCatalog = vi.fn().mockRejectedValue(new Error('boom'));

		const { container } = render(<SettingsPage {...defaultProps} />);

		await waitFor(() => expect(container.querySelector('kol-alert[_label="Pakete"]')).not.toBeNull());
		expect(container.querySelector('[data-testid="plans-section"]')).toBeNull();
	});
});

// ── #1525 (TF1/TF2, Spec docs/spec/issue-1525.md AK1/AK2) ──────────────────────────────────────

/**
 * Rote Spec-Tests für #1525 — „KI-Schalter an Paket-Freischaltung koppeln" (AK1/AK2).
 *
 * Ohne `ai_assist`-Berechtigung und ohne eigenen Provider ist der Schalter „KI-Features aktiv"
 * deaktiviert; darüber steht ein `KolAlert` mit dem Paketnamen aus `requiredPlan` und einem
 * `KolButton`, der auf den Pakete-Reiter springt (Muster `SubscriptionSection.tsx` →
 * `tabsCallbacks.onSelect(new Event('select'), PLANS_TAB_INDEX)`, hier über `onTabChange`
 * nachgewiesen). Mit `allowed:true` bleibt der Schalter bedienbar wie bisher, ohne Alert.
 *
 * Heute rot: `SettingsPage` liest den Schalterzustand ausschließlich aus `useAiPreferences()`
 * (`aiEnabled`), es existiert weder `_disabled` noch ein Paket-Alert an dieser Stelle.
 */
describe('SettingsPage – #1525: KI-Schalter Paket-Sperre (AK1/AK2)', () => {
	/** KoliBri-Adapter setzt numerische/boolesche Props je nach Adapter als Property oder Attribut. */
	const bound = (el: Element, name: string): string => {
		const value = (el as unknown as Record<string, unknown>)[name] ?? el.getAttribute(name);
		return value === null || value === undefined ? '' : String(value);
	};

	const renderKiTab = (allowed: boolean, onTabChange = vi.fn()) => {
		const entitlements: EntitlementMap = {
			ai_assist: { allowed, requiredPlan: 'pro' } as EntitlementMap['ai_assist'],
		};
		const result = render(
			<PlanProvider value={{ plan: 'free', entitlements }}>
				<SettingsPage {...defaultProps} onTabChange={onTabChange} />
			</PlanProvider>,
		);
		return { ...result, onTabChange };
	};

	afterEach(() => {
		localStorage.removeItem('pp-ai-enabled');
	});

	it('AK1: allowed=false → Schalter deaktiviert, Paket-Alert mit Paketname "Pro" und Sprung-CTA', async () => {
		const { container, onTabChange } = renderKiTab(false);

		const toggle = container.querySelector('kol-input-checkbox[_label="KI-Features aktiv"]');
		expect(toggle, 'KI-Schalter fehlt').not.toBeNull();
		await waitFor(() => expect(bound(toggle!, '_disabled')).toBe('true'));

		const row = toggle!.closest('.settings-llm-switch-row');
		expect(row, 'Zeile .settings-llm-switch-row fehlt').not.toBeNull();
		const planAlert = row!.querySelector('kol-alert[_label*="Pro"]') ?? row!.querySelector('kol-alert');
		expect(planAlert, 'Paket-Alert fehlt').not.toBeNull();
		expect(planAlert!.textContent).toContain('Pro');

		const cta = planAlert!.querySelector('kol-button');
		expect(cta, 'CTA-Button im Alert fehlt').not.toBeNull();
		await act(async () => {
			(cta as unknown as { _on: { onClick: (e: unknown) => void } })._on.onClick({});
		});
		expect(onTabChange).toHaveBeenCalledWith(6);
	});

	it('AK2: allowed=true → Schalter bedienbar, kein Paket-Alert, Umlegen persistiert weiterhin', async () => {
		const { container } = renderKiTab(true);

		const toggle = container.querySelector('kol-input-checkbox[_label="KI-Features aktiv"]');
		expect(toggle, 'KI-Schalter fehlt').not.toBeNull();
		await waitFor(() => expect(bound(toggle!, '_disabled')).not.toBe('true'));

		const row = toggle!.closest('.settings-llm-switch-row');
		expect(row?.querySelector('kol-alert')).toBeNull();

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				false,
			);
		});
		expect(localStorage.getItem('pp-ai-enabled')).toBe('false');
	});

	it('AK4: eigener Custom-Provider hebt die Sperre auf, obwohl allowed=false → kein Paket-Alert', async () => {
		// `useHasCustomLlmProvider` cached das Ergebnis von `listLlmProviders` modulweit
		// (`aiPreferences.ts`) — AK1/AK2 oben haben den Cache bereits mit dem Leer-Default (kein
		// Custom-Provider) gefüllt. Frischer Modul-Graph + eigener Mock-Rückgabewert stellen sicher,
		// dass DIESER Test wirklich `hasCustomProvider: true` durchläuft statt den alten Cache-Wert.
		vi.resetModules();
		apiMocks.listLlmProviders = vi.fn().mockResolvedValue([{ id: 1, kind: 'custom' }]);
		const { SettingsPage: FreshSettingsPage } = await import('./SettingsPage');
		const { PlanProvider: FreshPlanProvider } = await import('../lib/usePlan');

		const entitlements: EntitlementMap = {
			ai_assist: { allowed: false, requiredPlan: 'pro' } as EntitlementMap['ai_assist'],
		};
		const { container } = render(
			<FreshPlanProvider value={{ plan: 'free', entitlements }}>
				<FreshSettingsPage {...defaultProps} />
			</FreshPlanProvider>,
		);

		// Re-query bei jedem Poll: der `key`-Wechsel (Finding #1 dieser Runde) remountet den Schalter
		// beim Kippen von `hasCustomProvider`, eine einmal eingesammelte Referenz bliebe stehen.
		const queryToggle = () => container.querySelector('kol-input-checkbox[_label="KI-Features aktiv"]');
		await waitFor(() => {
			const toggle = queryToggle();
			expect(toggle, 'KI-Schalter fehlt').not.toBeNull();
			expect(bound(toggle!, '_disabled')).not.toBe('true');
		});

		const row = queryToggle()!.closest('.settings-llm-switch-row');
		expect(row?.querySelector('kol-alert')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #1555 — Hinweis bei stark unausgewogener Säulen-Gewichtung
 * (Spec: docs/spec/issue-1555.md).
 *
 * Der Hinweis ist ein `KolAlert _type="warning"` im Säulen-Panel (`slot="tab-1"`), friendly und
 * NICHT blockierend: er erscheint bei ungleicher Verteilung (Anteil > 2× oder < ½ des
 * gleichmäßigen Anteils), live bei jedem Reglerzug und schon beim Laden einer gespeicherten
 * ungleichen Verteilung; Speichern bleibt möglich. Die Grenzfälle der Formel selbst testet
 * `pillar.test.ts` (#1555-Block) — hier der UI-Vertrag des Formulars.
 */
describe('SettingsPage – #1555: Hinweis bei unausgewogener Säulen-Gewichtung', () => {
	const unbalancedPillars = [45, 5, 20, 15, 15].map((weight, index) => ({
		id: index + 1,
		name: `S${index + 1}`,
		description: '',
		weight,
	}));
	const balancedPillars = [20, 20, 20, 20, 20].map((weight, index) => ({
		id: index + 1,
		name: `S${index + 1}`,
		description: '',
		weight,
	}));

	/** Warn-Alert im Säulen-Panel (nur dort suchen: die Settings-Seite zeigt weitere Alerts). */
	const warningAlert = (container: HTMLElement): Element | null =>
		container.querySelector('.settings-pillars kol-alert[_type="warning"]');

	const slider = (container: HTMLElement, index: number): Element =>
		container.querySelectorAll('.pillar-weights-grid kol-input-range')[index];

	const input = async (el: Element, value: string): Promise<void> => {
		await act(async () => {
			(el as unknown as { _on: { onInput: (_event: unknown, value: string) => void } })._on.onInput({}, value);
		});
	};

	beforeEach(() => {
		delete apiMocks.setPillarWeights;
	});

	// AK1 (positiv) + AK3: gespeicherte ungleiche Verteilung (45/5/20/15/15) zeigt den Hinweis
	// direkt beim Öffnen des Formulars — ohne jegliche Nutzerinteraktion (Remount-Key nimmt die
	// Gewichtswerte aus `pillars` auf).
	it('AK1+AK3: ungleiche gespeicherte Verteilung zeigt Warn-Alert sofort, ohne Interaktion', () => {
		const { container } = render(<SettingsPage {...defaultProps} pillars={unbalancedPillars} />);
		expect(warningAlert(container), 'Warn-Alert fehlt bei 45/5/20/15/15').not.toBeNull();
	});

	// AK1 (negativ): ausgewogene Verteilung (5 × 20 %) zeigt keinen Hinweis.
	it('AK1: ausgewogene Verteilung (5 × 20 %) zeigt KEINEN Warn-Alert', () => {
		const { container } = render(<SettingsPage {...defaultProps} pillars={balancedPillars} />);
		expect(warningAlert(container)).toBeNull();
	});

	// AK2: Live-Umschlag in beide Richtungen — derselbe Event-Kanal, der bereits `setSum` feuert.
	it('AK2: Reglerzug ausgewogen → unausgewogen zeigt den Alert, Rückkehr entfernt ihn', async () => {
		const { container } = render(<SettingsPage {...defaultProps} pillars={balancedPillars} />);
		expect(warningAlert(container)).toBeNull();

		// Erste Säule auf Maximum (Rohwert 1,0): 100 % > 2 × 20 % → Hinweis erscheint.
		await input(slider(container, 0), '1');
		expect(warningAlert(container), 'Alert erscheint nicht nach Reglerzug').not.toBeNull();

		// Zurück auf 0,2 (wieder 5 × 20 %) → Hinweis verschwindet.
		await input(slider(container, 0), '0.2');
		expect(warningAlert(container), 'Alert verschwindet nicht bei Rückkehr zur Balance').toBeNull();
	});

	// AK4: Der Hinweis blockiert nicht — Speichern-Button bleibt aktiv und der API-Aufruf
	// (normieren → PUT /pillars/weights) erfolgt unverändert.
	it('AK4: trotz Hinweis bleibt Speichern aktiv und ruft api.setPillarWeights auf', async () => {
		const { container } = render(<SettingsPage {...defaultProps} pillars={unbalancedPillars} />);
		expect(warningAlert(container)).not.toBeNull();

		const save = container.querySelector('.settings-pillars kol-button[_label="Speichern"]');
		expect(save, 'Speichern-Button fehlt').not.toBeNull();
		expect(save?.hasAttribute('_disabled'), 'Speichern darf durch den Hinweis NICHT deaktiviert werden').toBe(false);

		await act(async () => {
			(save as unknown as { _on: { onClick: (event: unknown) => void } })._on.onClick({});
		});
		await waitFor(() => {
			expect(apiMocks.setPillarWeights).toHaveBeenCalledTimes(1);
		});
		// Rohwerte [0.45, 0.05, 0.2, 0.15, 0.15] normieren auf genau die gespeicherten Prozente zurück.
		expect(apiMocks.setPillarWeights).toHaveBeenCalledWith({
			pillarWeightsInput: {
				weights: [
					{ id: 1, weight: 45 },
					{ id: 2, weight: 5 },
					{ id: 3, weight: 20 },
					{ id: 4, weight: 15 },
					{ id: 5, weight: 15 },
				],
			},
		});
	});
});
