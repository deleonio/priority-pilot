import { useCallback, useEffect, useState } from 'react';

/**
 * Position der Kopfzeile (#1428): über oder unter dem Inhaltsbereich.
 *
 * Die Verschiebung selbst passiert rein per Layout (`.app.header-bottom` in `app.css` — Flex-Order,
 * die DOM-Reihenfolge bleibt), dieses Modul trägt nur die Wahl: Persistenz im Muster von
 * `theme.ts`/`balanceVariant.ts` (reine Funktionen plus kleiner Hook, alle `localStorage`-Zugriffe
 * Best-Effort — gesperrter Storage darf den App-Start nie verhindern). Die Wahl gilt **pro Gerät**
 * und global, weil die Kopfzeile auf allen drei Ansichten steht.
 */

/** Vom Nutzer gewählte Position der Kopfzeile. */
export type HeaderPosition = 'top' | 'bottom';

/** Reihenfolge und Beschriftung für die Auswahl in den Einstellungen. */
export const HEADER_POSITIONS: readonly { value: HeaderPosition; label: string }[] = [
	{ value: 'top', label: 'Oben' },
	{ value: 'bottom', label: 'Unten' },
];

/**
 * Default ist „Oben“: der heutige Aufbau bleibt der Standard — alle bestehenden Header-Verträge
 * (mobile-shell, Home-Schalter, App-Unit) gelten unverändert weiter (AK4).
 */
const DEFAULT_POSITION: HeaderPosition = 'top';

/** `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den Tests übereinstimmen). */
const STORAGE_KEY = 'pp-header-position';

const isHeaderPosition = (value: string | null): value is HeaderPosition => value === 'top' || value === 'bottom';

/** Liest die gespeicherte Wahl; fehlt oder verfälscht sie, gilt der Default. */
export const getStoredHeaderPosition = (): HeaderPosition => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isHeaderPosition(stored) ? stored : DEFAULT_POSITION;
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return DEFAULT_POSITION;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
export const storeHeaderPosition = (position: HeaderPosition): void => {
	try {
		localStorage.setItem(STORAGE_KEY, position);
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

/**
 * Live-Sync zwischen den Hook-Instanzen. Anders als bei `useBalanceVariant` (Auswahl und Verbraucher
 * nie gleichzeitig montiert) sind Auswahl (Einstellungen-Tab) und Verbraucher (App-Layout mit der
 * Kopfzeile) hier gleichzeitig montiert: Die App muss die Wahl ohne Reload umsetzen (UX-Beratung
 * #1428), `setPosition` sendet sie daher an alle angemeldeten Instanzen.
 */
const listeners = new Set<(position: HeaderPosition) => void>();

interface UseHeaderPositionResult {
	/** Aktuell gewählte Position (Default `top`). */
	position: HeaderPosition;
	/** Wahl setzen (persistiert und sofort in allen Instanzen übernommen). */
	setPosition: (position: HeaderPosition) => void;
}

/**
 * React-Hook zur Kopfzeilen-Position — liest initial aus `localStorage`, persistiert bei Änderung
 * und meldet Änderungen an alle Instanzen (siehe `listeners`).
 */
export const useHeaderPosition = (): UseHeaderPositionResult => {
	const [position, setPositionState] = useState<HeaderPosition>(getStoredHeaderPosition);

	useEffect(() => {
		const listener = (next: HeaderPosition) => setPositionState(next);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	const setPosition = useCallback((next: HeaderPosition): void => {
		storeHeaderPosition(next);
		listeners.forEach((listener) => listener(next));
	}, []);

	return { position, setPosition };
};
