import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { api } from '../api';
import { GEO_CONFIG_CHANGED_EVENT, GEOLOCATION_INTERVAL_MS, useGeolocation } from './useGeolocation';

// #933: api.reverseGeocode mocken — verhindert Netzwerk-Calls in ALLEN Tests dieser Datei
// (der #845-Block löst den Reverse-Geocoding-Effekt unbeabsichtigt mit aus).
// #1098: getGeoConfig kommt hinzu (konfigurierbares Intervall, AK5) — per Default ohne Config
// (Ablehnung), damit der 5-Minuten-Fallback greift und die Bestands-Tests unverändert gelten.
const { getGeoConfigMock } = vi.hoisted(() => ({ getGeoConfigMock: vi.fn() }));
vi.mock('../api', () => ({
	api: {
		reverseGeocode: vi.fn().mockResolvedValue({ address: 'Musterstraße 1, 10117 Berlin' }),
		getGeoConfig: getGeoConfigMock,
	},
}));

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

	// AK 1: Default aus – Hook liefert enabled=false (Observable Outcome)
	it('AK1: Default ist aus – Hook initialisiert mit enabled=false', () => {
		const { result } = renderHook(() => useGeolocation());
		// Observable Outcome: Hook State prüfen …
		expect(result.current.enabled).toBe(false);
		// … plus der eigentliche Vertrag aus Spec #845 AK1: kein Request im Default
		expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
	});

	// AK 2: Einschalten mit granted Permission → Intervall startet
	it('AK2: Bei granted Permission wird erste Position ermittelt und Intervall gestartet', async () => {
		const setIntervalSpy = vi.spyOn(window, 'setInterval');
		mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
			success({ coords: { latitude: 52.52, longitude: 13.405 } });
		});

		// Toggle simulieren (Hook-Export)
		const { result } = renderHook(() => useGeolocation());
		await result.current.toggle(true);

		// Observable Outcomes: Hook State, Position und gestarteter Intervall
		await waitFor(() => {
			expect(result.current.enabled).toBe(true);
			expect(result.current.position).toEqual({ latitude: 52.52, longitude: 13.405 });
			expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), GEOLOCATION_INTERVAL_MS);
		});
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
		// Observable Outcome: Konstante aus dem Produktivcode, kein Literal gegen Literal
		expect(GEOLOCATION_INTERVAL_MS).toBe(5 * 60 * 1000);
	});
});

/**
 * Rote Spec-Tests für #933 — „Geolokation manuell anstoßen + aktuelle Adresse stets sichtbar".
 *
 * Spec-Bezug: docs/spec/issue-933.md
 *
 * Dedup: toggle (Berechtigung + erste Position), Intervall-Stopp und Denied-Behandlung deckt
 * bereits der #845-Block oben ab. Hier NUR die neuen Verhalten:
 * - AK3: Initial-Fetch beim Mount mit enabled=true (nicht erst nach 5 Minuten Intervall-Tick).
 * - AK1/AK5: öffentliche refresh() mit Re-Entrancy-Guard (pending) — schützt das
 *   Nominatim-Rate-Limit (1 req/s).
 * - AK4: Zeitstempel positionUpdatedAt der letzten Ermittlung (Unix-ms).
 */
describe('useGeolocation – #933: Initial-Fetch, refresh(), Zeitstempel', () => {
	// Rot-Phase: `refresh`/`positionUpdatedAt` existieren im Hook-Typ noch NICHT — daher
	// optional erweitert, damit tsc die roten Tests kompiliert (Implementation folgt in Phase 4).
	type Hook933 = ReturnType<typeof useGeolocation> & {
		refresh?: () => Promise<void>;
		positionUpdatedAt?: number;
	};
	const renderGeoHook = () => renderHook(() => useGeolocation() as Hook933);

	const geoMock = {
		getCurrentPosition: vi.fn(),
		watchPosition: vi.fn(),
		clearWatch: vi.fn(),
	};

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		Object.defineProperty(global.navigator, 'geolocation', {
			value: geoMock,
			writable: true,
		});
	});

	afterEach(() => {
		localStorage.clear();
	});

	// AK3: Mount mit gespeichertem enabled=true (z. B. nach Reload) holt SOFORT eine Position
	// und stößt danach Reverse Geocoding an — ohne toggle-Aufruf, ohne Intervall-Tick.
	it('AK3: Mount mit enabled=true ermittelt sofort Position + Reverse Geocoding (Initial-Fetch)', async () => {
		localStorage.setItem('pp-geolocation-enabled', 'true');
		geoMock.getCurrentPosition.mockImplementationOnce((success) => {
			success({ coords: { latitude: 48.137, longitude: 11.575 } });
		});

		const { result } = renderGeoHook();

		// Kein toggle(), kein advanceTimersByTime: Der Fetch muss allein durch den Mount ausgelöst werden.
		// Mock-Assertions (#945/A AK2): Abfrage wurde angestoßen, Reverse Geocoding mit den Koordinaten.
		await waitFor(() => {
			expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(1);
			expect(api.reverseGeocode).toHaveBeenCalledWith({ lat: 48.137, lon: 11.575 });
		});

		// Observable Outcomes (#945/A AK1, Spec issue-1003.md E1): Der Hook übernimmt Position UND
		// Adresse in seinen State — Mock-Calls allein beweisen nicht, dass die Werte ankommen.
		await waitFor(() => {
			expect(result.current.position).toEqual({ latitude: 48.137, longitude: 11.575 });
			expect(result.current.address).toBe('Musterstraße 1, 10117 Berlin');
		});
	});

	// AK1 + AK5: refresh() holt Position; ein zweiter Aufruf während pending startet KEINE
	// zweite Abfrage (Guard analog toggle — Rate-Limit-Schutz).
	it('AK1/AK5: refresh() ermittelt sofort; Re-Entrancy während pending wird ignoriert', async () => {
		let releasePosition!: () => void;
		geoMock.getCurrentPosition.mockImplementation((success) => {
			releasePosition = () => success({ coords: { latitude: 1.25, longitude: 6.5 } });
		});

		const { result } = renderGeoHook();

		// AK1-Vertrag: Der Hook stellt refresh() öffentlich bereit.
		expect(result.current.refresh).toBeTypeOf('function');

		const first = result.current.refresh!();
		// Zweiter Klick, während die erste Ermittlung noch hängt (pending):
		void result.current.refresh?.();

		// Trotz zweier Aufrufe: nur EINE Abfrage an navigator.geolocation.
		expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(1);

		releasePosition();
		await first;
		await waitFor(() => {
			expect(result.current.position).toEqual({ latitude: 1.25, longitude: 6.5 });
		});
		// Guard ist nur während pending aktiv — danach wäre ein neuer refresh erlaubt:
		expect(result.current.pending).toBe(false);
	});

	// AK4: Nach jeder erfolgreichen Ermittlung steht der Zeitpunkt der Ermittlung bereit,
	// damit die UI „Stand: HH:MM" rendern kann.
	it('AK4: nach refresh() ist positionUpdatedAt gesetzt (Unix-ms)', async () => {
		geoMock.getCurrentPosition.mockImplementationOnce((success) => {
			success({ coords: { latitude: 1.25, longitude: 6.5 } });
		});

		const { result } = renderGeoHook();

		if (typeof result.current.refresh === 'function') {
			await result.current.refresh();
		}

		// Ohne act()-Wrapper flusht renderHook das setPositionUpdatedAt aus applyPosition
		// erst asynchron — wie im AK1/AK5-Test per waitFor auf das übernommene Re-Render warten.
		await waitFor(() => {
			expect(result.current.positionUpdatedAt ?? 0).toBeGreaterThan(0);
		});
	});
});

/**
 * Rote Spec-Tests für #1098 — konfigurierbares Positionsermittlungs-Intervall (AK5).
 *
 * Spec-Bezug: docs/spec/issue-1098.md: `useGeolocation` nutzt das serverseitig gespeicherte
 * `intervalMinutes` statt des fixen `GEOLOCATION_INTERVAL_MS`; ohne Config gilt der
 * 5-Minuten-Fallback. Dedup: Den Fallback deckt der #845-Block oben bereits ab (AK2 testet den
 * 5-Minuten-Intervall, ohne dass eine Config geladen ist) — hier NUR der konfigurierte Fall.
 * Der Re-Entrancy-Guard bleibt (#933): kürzere Intervalle dürfen keine parallelen Fetches
 * erzeugen (Nominatim-Rate-Limit 1 req/s).
 */
describe('useGeolocation – #1098: konfigurierbares Intervall (AK5)', () => {
	const geoMock = {
		getCurrentPosition: vi.fn(),
		watchPosition: vi.fn(),
		clearWatch: vi.fn(),
	};

	beforeEach(() => {
		localStorage.clear();
		vi.clearAllTimers();
		vi.clearAllMocks();
		getGeoConfigMock.mockRejectedValue(new Error('keine Geo-Config'));
		Object.defineProperty(global.navigator, 'geolocation', {
			value: geoMock,
			writable: true,
		});
	});

	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('AK5: der Intervall läuft mit dem gespeicherten intervalMinutes, nicht mit dem fixen 5 Minuten', async () => {
		getGeoConfigMock.mockResolvedValue({ displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 2 });
		localStorage.setItem('pp-geolocation-enabled', 'true');
		geoMock.getCurrentPosition.mockImplementation((success) => {
			success({ coords: { latitude: 52.52, longitude: 13.405 } });
		});

		const setIntervalSpy = vi.spyOn(window, 'setInterval');
		renderHook(() => useGeolocation());

		await waitFor(() => expect(getGeoConfigMock).toHaveBeenCalled());
		await waitFor(() => expect(setIntervalSpy).toHaveBeenCalled());
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2 * 60 * 1000);
		expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), GEOLOCATION_INTERVAL_MS);
	});

	// #1103 F6: Ein Config-PUT (SettingsPage dispatcht GEO_CONFIG_CHANGED_EVENT) erreicht auch
	// bereits laufende Hook-Instanzen — das Intervall re-armt auf den neuen Wert, statt bis zum
	// nächsten Mount beim Mount-Wert zu bleiben.
	it('re-armt das laufende Intervall, nachdem die Geo-Config gespeichert wurde (Event)', async () => {
		getGeoConfigMock.mockResolvedValueOnce({ displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 5 });
		getGeoConfigMock.mockResolvedValue({ displayDistanceKm: 5, alarmDistanceKm: 1, intervalMinutes: 1 });
		localStorage.setItem('pp-geolocation-enabled', 'true');
		geoMock.getCurrentPosition.mockImplementation((success) => {
			success({ coords: { latitude: 52.52, longitude: 13.405 } });
		});

		const setIntervalSpy = vi.spyOn(window, 'setInterval');
		renderHook(() => useGeolocation());

		await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5 * 60 * 1000));

		// Erfolgreiches PUT simulieren: SettingsPage dispatched nach dem Speichern das Event.
		window.dispatchEvent(new CustomEvent(GEO_CONFIG_CHANGED_EVENT));

		await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1 * 60 * 1000));
	});
});
