import { cleanup, render } from '@testing-library/react';
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
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: () => vi.fn().mockResolvedValue(undefined),
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
