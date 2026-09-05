import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

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
	listLlmProviders: [],
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

const defaultProps = {
	pillars: [],
	onBack: vi.fn(),
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
 *   `api.updateProfile` mit dem neuen Namen und stößt über `onSaved` das User-Reload der
 *   Kopfzeile an (Root → checkAuth).
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
