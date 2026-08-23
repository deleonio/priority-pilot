import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

/** Geolocation-Intervall: 5 Minuten in ms (AK 6). */
export const GEOLOCATION_INTERVAL_MS = 5 * 60 * 1000;

/** Ob der Browser Geolocation unterstützt. */
export const isGeolocationSupported = (): boolean => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Position als Koordinaten-Paar. */
export interface GeolocationPosition {
	latitude: number;
	longitude: number;
}

/** `localStorage`-Schlüssel der gespeicherten Wahl. */
const STORAGE_KEY = 'pp-geolocation-enabled';

/**
 * Liest die gespeicherte Wahl. Fehlt sie, gilt der Default **aus** (`false`).
 */
export const readGeolocationPreference = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
};

/** Speichert die Wahl; Fehler werden ignoriert. */
export const storeGeolocationPreference = (enabled: boolean): void => {
	try {
		localStorage.setItem(STORAGE_KEY, String(enabled));
	} catch {
		// Best-Effort
	}
};

interface UseGeolocationResult {
	/** Ob der Browser Geolocation unterstützt. */
	supported: boolean;
	/** Ob Geolocation aktiviert ist. */
	enabled: boolean;
	/** Ob gerade eine Berechtigungsanfrage läuft. */
	pending: boolean;
	/** Ob die Berechtigung verweigert wurde. */
	permissionDenied: boolean;
	/** Aktuelle Position (oder null). */
	position: GeolocationPosition | null;
	/** Aktuelle Adresse (oder null/leer bei Fehler/Rate-Limit). */
	address: string | null;
	/** Ob gerade eine Adresse abgerufen wird. */
	addressLoading: boolean;
	/** Unix-ms-Zeitstempel der letzten erfolgreichen Positionsermittlung (null: noch keine, #933). */
	positionUpdatedAt: number | null;
	/** Geolocation aktivieren (`true`) oder deaktivieren (`false`). */
	toggle: (next: boolean) => Promise<void>;
	/** Standortermittlung manuell anstoßen: sofort Position + Reverse Geocoding (#933). */
	refresh: () => Promise<void>;
}

/**
 * React-Hook für Geolocation-Tracking (Issue #845).
 * Aktiviert alle 5 Minuten die Positionsermittlung; nutzt `navigator.geolocation`.
 * Bei Verweigerung bleibt der Schalter aus und ein Hinweis wird angezeigt.
 */
export const useGeolocation = (): UseGeolocationResult => {
	const supported = isGeolocationSupported();
	const [enabled, setEnabled] = useState(readGeolocationPreference());
	const [pending, setPending] = useState(false);
	const [permissionDenied, setPermissionDenied] = useState(false);
	const [position, setPosition] = useState<GeolocationPosition | null>(null);
	const [address, setAddress] = useState<string | null>(null);
	const [addressLoading, setAddressLoading] = useState(false);
	const [positionUpdatedAt, setPositionUpdatedAt] = useState<number | null>(null);

	// Re-Entrancy-Guard als Ref (#933 AK5): `pending` als React-State reicht nicht — zwei synchrone
	// Aufrufe (Doppelklick) würden beide noch `false` lesen, bevor ein Re-Render den State übernommen hat.
	const pendingRef = useRef(false);
	// Position-Spiegel als Ref: erlaubt dem Interval-Effekt, auf die aktuelle Position zu prüfen,
	// ohne sie in die Deps aufzunehmen (sonst würde jeder Positions-Update den Effekt neu starten).
	const positionRef = useRef<GeolocationPosition | null>(null);

	/** Position + Zeitstempel der Ermittlung setzen (#933 AK4). */
	const applyPosition = useCallback((pos: GeolocationPosition): void => {
		positionRef.current = pos;
		setPosition(pos);
		setPositionUpdatedAt(Date.now());
	}, []);

	/** Position (und damit Zeitstempel-Anzeige) zurücksetzen. */
	const clearPosition = useCallback((): void => {
		positionRef.current = null;
		setPosition(null);
	}, []);

	/** Einmalige Positionsermittlung (ohne Seiteneffekte auf State). */
	const fetchPosition = useCallback((): Promise<GeolocationPosition> => {
		return new Promise((resolve, reject) => {
			if (!supported) {
				reject(new Error('Geolocation nicht unterstützt'));
				return;
			}
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
				},
				(err) => {
					reject(err);
				},
			);
		});
	}, [supported]);

	/** Intervall starten, wenn enabled=true. */
	useEffect(() => {
		if (!enabled || !supported) {
			return;
		}

		const locate = (): void => {
			fetchPosition()
				.then((p) => applyPosition(p))
				.catch((err) => {
					if (err.code === 1) {
						setPermissionDenied(true);
						setEnabled(false);
						storeGeolocationPreference(false);
					}
				});
		};

		// Initial-Fetch (#933 AK3): Beim Mount mit enabled=true (z. B. nach Reload/Seitenwechsel)
		// sofort die erste Position ermitteln — nicht erst nach Ablauf der 5 Minuten. Hat toggle(true)
		// sie gerade schon geholt, wird übersprungen (Dedup, schont das Nominatim-Rate-Limit 1 req/s).
		if (positionRef.current === null) {
			locate();
		}

		// Danach alle 5 Minuten erneut (Intervall).
		const intervalId = window.setInterval(locate, GEOLOCATION_INTERVAL_MS);

		return () => {
			clearInterval(intervalId);
		};
	}, [enabled, supported, fetchPosition, applyPosition]);

	/** Reverse Geocoding: Position → Adresse (Issue #866). */
	useEffect(() => {
		if (!position || !enabled) {
			setAddress(null);
			return;
		}
		setAddressLoading(true);
		api
			.reverseGeocode({ lat: position.latitude, lon: position.longitude })
			.then(({ address }) => setAddress(address || null))
			.catch(() => setAddress(null)) // Fehler/Rate-Limit → null
			.finally(() => setAddressLoading(false));
	}, [position, enabled]);

	const toggle = useCallback(
		async (next: boolean): Promise<void> => {
			if (pendingRef.current) {
				return;
			}
			pendingRef.current = true;
			setPending(true);
			setPermissionDenied(false);

			try {
				if (next) {
					// Berechtigung anfragen + erste Position ermitteln
					const pos = await fetchPosition();
					applyPosition(pos);
					setPermissionDenied(false);
					setEnabled(true);
					storeGeolocationPreference(true);
				} else {
					// Ausschalten: Intervall stoppt durch useEffect-Cleanup
					setEnabled(false);
					clearPosition();
					setPermissionDenied(false);
					storeGeolocationPreference(false);
				}
			} catch (err: unknown) {
				// Bei Verweigerung bleibt enabled=false
				if (err && typeof err === 'object' && 'code' in err && err.code === 1) {
					setPermissionDenied(true);
				}
				setEnabled(false);
				clearPosition();
				storeGeolocationPreference(false);
			} finally {
				pendingRef.current = false;
				setPending(false);
			}
		},
		[fetchPosition, applyPosition, clearPosition],
	);

	/**
	 * Standortermittlung manuell anstoßen (#933 AK1/AK5): sofort Position holen — die Adresse
	 * liefert der bestehende Reverse-Geocoding-Effekt auf Positions-Änderung. Erneuter Aufruf
	 * während einer laufenden Ermittlung wird ignoriert (Rate-Limit-Schutz analog `toggle`).
	 */
	const refresh = useCallback(async (): Promise<void> => {
		if (pendingRef.current) {
			return;
		}
		pendingRef.current = true;
		setPending(true);

		try {
			const pos = await fetchPosition();
			applyPosition(pos);
		} catch (err: unknown) {
			// Verweigern beim manuellen Stoß → gleiche Denied-Behandlung wie im Intervall (#845).
			if (err && typeof err === 'object' && 'code' in err && err.code === 1) {
				setPermissionDenied(true);
				setEnabled(false);
				storeGeolocationPreference(false);
			}
		} finally {
			pendingRef.current = false;
			setPending(false);
		}
	}, [fetchPosition, applyPosition]);

	return {
		supported,
		enabled,
		pending,
		permissionDenied,
		position,
		address,
		addressLoading,
		positionUpdatedAt,
		toggle,
		refresh,
	};
};
