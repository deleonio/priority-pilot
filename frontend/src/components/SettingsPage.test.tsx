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
 * - AK1: KolButton „Standort jetzt ermitteln" (secondary) nur bei enabled=true.
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
	// Tab „Allgemein“ aktivieren (Default-Pfad lädt den Säulen-Tab; alle Panels bleiben
	// zwar gemountet, aber der.General-Tab ist der fachliche Kontext der Tests).
	window.history.replaceState({}, '', '/settings/general');
});

afterEach(cleanup);

describe('SettingsPage – #933: Standort-Test-Schalter und Adressanzeige', () => {
	// AK1: Button nur bei aktivierter Standorterfassung, als sekundärer KolButton.
	it('AK1: enabled=true rendert KolButton „Standort jetzt ermitteln“ (secondary)', () => {
		geoState.enabled = true;
		const { container } = render(<SettingsPage {...defaultProps} />);
		const button = container.querySelector('kol-button[_label="Standort jetzt ermitteln"]');
		expect(button).not.toBeNull();
		expect(button?.getAttribute('_variant')).toBe('secondary');
	});

	it('AK1: enabled=false rendert KEINEN Standort-Button', () => {
		const { container } = render(<SettingsPage {...defaultProps} />);
		expect(container.querySelector('kol-button[_label="Standort jetzt ermitteln"]')).toBeNull();
	});

	// AK2: Async-Zustände vollständig (UX-Regel 7): Laden, Erfolg, Leer.
	it('AK2: während der Ermittlung Lade-Text und Button deaktiviert, danach Adresse', () => {
		geoState.enabled = true;
		geoState.pending = true;
		geoState.addressLoading = true;
		const { container, rerender } = render(<SettingsPage {...defaultProps} />);

		const button = container.querySelector('kol-button[_label="Standort jetzt ermitteln"]');
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
		expect(container.querySelector('kol-button[_label="Standort jetzt ermitteln"]')?.hasAttribute('_disabled')).toBe(
			false,
		);
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
	 * Beide Aktions-Buttons („Push testen", „Standort jetzt ermitteln") tragen dieselbe nicht-leere
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
		const geoButton = container.querySelector('kol-button[_label="Standort jetzt ermitteln"]');
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
