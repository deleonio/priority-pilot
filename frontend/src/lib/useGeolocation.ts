import { useCallback, useEffect, useState } from 'react';
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
	/** Geolocation aktivieren (`true`) oder deaktivieren (`false`). */
	toggle: (next: boolean) => Promise<void>;
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
		let intervalId: number | null = null;

		// Intervall starten (erste Position wurde bereits in toggle geholt)
		intervalId = window.setInterval(() => {
			fetchPosition()
				.then((p) => setPosition(p))
				.catch((err) => {
					if (err.code === 1) {
						setPermissionDenied(true);
						setEnabled(false);
						storeGeolocationPreference(false);
					}
				});
		}, GEOLOCATION_INTERVAL_MS);

		return () => {
			if (intervalId !== null) {
				clearInterval(intervalId);
			}
		};
	}, [enabled, supported, fetchPosition]);

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
			if (pending) {
				return;
			}
			setPending(true);
			setPermissionDenied(false);

			try {
				if (next) {
					// Berechtigung anfragen + erste Position ermitteln
					const pos = await fetchPosition();
					setPosition(pos);
					setPermissionDenied(false);
					setEnabled(true);
					storeGeolocationPreference(true);
				} else {
					// Ausschalten: Intervall stoppt durch useEffect-Cleanup
					setEnabled(false);
					setPosition(null);
					setPermissionDenied(false);
					storeGeolocationPreference(false);
				}
			} catch (err: unknown) {
				// Bei Verweigerung bleibt enabled=false
				if (err && typeof err === 'object' && 'code' in err && err.code === 1) {
					setPermissionDenied(true);
				}
				setEnabled(false);
				setPosition(null);
				storeGeolocationPreference(false);
			} finally {
				setPending(false);
			}
		},
		[pending, fetchPosition],
	);

	return { supported, enabled, pending, permissionDenied, position, address, addressLoading, toggle };
};
