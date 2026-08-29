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
 * Fenster-Event nach erfolgreichem `PUT /geo-config` (#1098 AK5, #1103 F6): Der Hook läuft als
 * eigene Instanz in SettingsPage/NearbyCard/Footer — ein PUT allein re-armt nur die speichernde
 * Instanz. Mit dem Event laden alle Instanzen die Config neu und ihr laufendes Intervall
 * übernimmt sofort das neue `intervalMinutes` (`intervalMs` ist Dep des Intervall-Effekts).
 */
export const GEO_CONFIG_CHANGED_EVENT = 'pp-geo-config-changed';

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
	/** Ob die letzte Positionsermittlung technisch scheiterte (Timeout/nicht verfügbar) — das Intervall retryt. */
	unavailable: boolean;
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
	const [unavailable, setUnavailable] = useState(false);
	const [position, setPosition] = useState<GeolocationPosition | null>(null);
	const [address, setAddress] = useState<string | null>(null);
	const [addressLoading, setAddressLoading] = useState(false);
	const [positionUpdatedAt, setPositionUpdatedAt] = useState<number | null>(null);

	// #1098 AK5: Intervall kommt aus der serverseitigen Geo-Konfiguration (`null` = noch nicht
	// geladen). Erst nach dem Config-Fetch wird das Intervall gestartet — ohne Config (Fehler,
	// keine Werte) gilt der 5-Minuten-Fallback `GEOLOCATION_INTERVAL_MS`. Nach einem Config-PUT
	// (GEO_CONFIG_CHANGED_EVENT, #1103 F6) wird erneut geladen, damit laufende Intervalle
	// aller Hook-Instanzen sofort das neue Intervall übernehmen.
	const [intervalMs, setIntervalMs] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		const loadInterval = (): void => {
			Promise.resolve(api.getGeoConfig())
				.then((config) => {
					const minutes = config?.intervalMinutes;
					if (!cancelled) {
						setIntervalMs(
							typeof minutes === 'number' && minutes >= 1 && minutes <= 60
								? minutes * 60 * 1000
								: GEOLOCATION_INTERVAL_MS,
						);
					}
				})
				.catch(() => {
					// Keine Config (z. B. 401/Netzwerk) → fixer 5-Minuten-Fallback (#845-Vertrag bleibt).
					if (!cancelled) {
						setIntervalMs(GEOLOCATION_INTERVAL_MS);
					}
				});
		};
		loadInterval();
		window.addEventListener(GEO_CONFIG_CHANGED_EVENT, loadInterval);
		return () => {
			cancelled = true;
			window.removeEventListener(GEO_CONFIG_CHANGED_EVENT, loadInterval);
		};
	}, []);

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

	/** Position und Zeitstempel-Anzeige zurücksetzen. */
	const clearPosition = useCallback((): void => {
		positionRef.current = null;
		setPosition(null);
		setPositionUpdatedAt(null);
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
		if (!enabled || !supported || intervalMs === null) {
			return;
		}

		const locate = (): void => {
			// Gleicher Re-Entrancy-Guard wie toggle/refresh (#933 AK5): kein paralleler Fetch
			// zum manuellen Stoß — sonst lösen beide Positions-Updates je einen reverseGeocode
			// aus und laufen ins Nominatim-Rate-Limit (1 req/s).
			if (pendingRef.current) {
				return;
			}
			pendingRef.current = true;
			fetchPosition()
				.then((p) => {
					applyPosition(p);
					setUnavailable(false);
				})
				.catch((err: GeolocationPositionError) => {
					if (err.code === 1) {
						setPermissionDenied(true);
						setEnabled(false);
						storeGeolocationPreference(false);
					} else {
						// Timeout (3) / Position nicht verfügbar (2): Präferenz bleibt an und das Intervall
						// retryt — die Card zeigt bis dahin einen Hinweis statt endlosem Ladezustand (AK4).
						setUnavailable(true);
					}
				})
				.finally(() => {
					pendingRef.current = false;
				});
		};

		// Initial-Fetch (#933 AK3): Beim Mount mit enabled=true (z. B. nach Reload/Seitenwechsel)
		// sofort die erste Position ermitteln — nicht erst nach Ablauf der 5 Minuten. Hat toggle(true)
		// sie gerade schon geholt, wird übersprungen (Dedup, schont das Nominatim-Rate-Limit 1 req/s).
		if (positionRef.current === null) {
			locate();
		}

		// Danach im konfigurierten Intervall erneut (#1098 AK5; Default 5 Minuten).
		const intervalId = window.setInterval(locate, intervalMs);

		return () => {
			clearInterval(intervalId);
		};
	}, [enabled, supported, intervalMs, fetchPosition, applyPosition]);

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
		permissionDenied,
		unavailable,
		pending,
		position,
		address,
		addressLoading,
		positionUpdatedAt,
		toggle,
		refresh,
	};
};
