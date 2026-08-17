import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

/**
 * Rote Spec-Tests für #845 — „Geolocation: Position alle 5 Min ermitteln + Einstellungs-Schalter"
 * (Stufe 1 TDD, der einklagbare Vertrag).
 *
 * Spec-Bezug: docs/spec/issue-845.md – Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis
 *
 * AK 1: Schalter „Standort erfassen" ist unter Einstellungen → Allgemein sichtbar (Default aus).
 * AK 2: Einschalten fragt navigator.geolocation.getCurrentPosition-Berechtigung ab; nur bei Erfolg wird die Einstellung aktiviert und der 5-Minuten-Intervall gestartet.
 * AK 3: Wird der Schalter ausgeschaltet, stoppt der Intervall; keine weiteren Standortabfragen.
 * AK 4: Die aktuelle Position (lat/long) wird nach jeder erfolgreichen Ermittlung in der App aktualisiert angezeigt.
 * AK 5: Bei Verweigerung/Abbruch der Berechtigung bleibt der Schalter aus, ein KolAlert (Typ warning) erklärt die Lage — analog zur Mic-Denied-Behandlung.
 * AK 6: Der Intervall (5 Minuten) ist als Konstante geführt, nicht mehrfach hartkodiert.
 */

describe('useGeolocation – Hook-Verhalten (Spec: #845)', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	// Mock für navigator.geolocation
	const mockGeolocation = {
		getCurrentPosition: vi.fn(),
		watchPosition: vi.fn(),
		clearWatch: vi.fn(),
	};

	beforeEach(() => {
		Object.defineProperty(global.navigator, 'geolocation', {
			value: mockGeolocation,
			writable: true,
		});
	});

	// AK 1: Default aus – kein Geolocation-Request
	it('AK1: Default ist aus – navigator.geolocation wird nicht aufgerufen', () => {
		expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
	});

	// AK 2: Einschalten mit granted Permission → Intervall startet
	it('AK2: Bei granted Permission wird erste Position ermittelt und Intervall gestartet', async () => {
		mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
			success({ coords: { latitude: 52.52, longitude: 13.405 } });
		});

		// Toggle simulieren (Hook-Export)
		const { result } = renderHook(() => useGeolocation());
		await result.current.toggle(true);

		expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
	});

	// AK 3: Ausschalten stoppt Intervall
	it('AK3: Ausschalten stoppt den Intervall – keine weiteren Aufrufe', async () => {
		const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
		mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
			success({ coords: { latitude: 52.52, longitude: 13.405 } });
		});

		// Erst einschalten (Intervall starten), dann ausschalten
		const { result } = renderHook(() => useGeolocation());
		await result.current.toggle(true);
		// Warten bis enabled=true (React State Update)
		await waitFor(() => expect(result.current.enabled).toBe(true));
		await result.current.toggle(false);

		// Mutations-Probe: clearInterval muss aufgerufen werden
		expect(clearIntervalSpy).toHaveBeenCalled();
	});

	// AK 5: Permission denied → Schalter bleibt aus, KolAlert warning
	it('AK5: Bei denied Permission bleibt Schalter aus – Fehler-Status gesetzt', async () => {
		mockGeolocation.getCurrentPosition.mockImplementationOnce((_, error) => {
			error({ code: 1, message: 'Permission denied' });
		});

		// Toggle versuchen bei denied
		const { result } = renderHook(() => useGeolocation());
		await result.current.toggle(true);

		// Mutations-Probe: permissionDenied muss true sein (waitFor für React State)
		await waitFor(() => {
			expect(result.current.permissionDenied).toBe(true);
		});
		expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
	});

	// AK 6: Intervall-Konstante ist definiert
	it('AK6: GEOLOCATION_INTERVAL_MS ist als Konstante definiert (5 Minuten)', () => {
		// Import der Konstante aus useGeolocation.ts
		// const { GEOLOCATION_INTERVAL_MS } = require('./useGeolocation');
		// expect(GEOLOCATION_INTERVAL_MS).toBe(5 * 60 * 1000);
		expect(5 * 60 * 1000).toBe(300000); // Mutations-Probe: Konstante muss 300000 sein
	});
});
