/**
 * Gerätelokaler Spiegel des letzten Server-Balance-Stands (GET /scores/balance, Kadenz-Modell):
 * Das Zifferblatt startet beim wiederholten Öffnen sofort auf dem zuletzt bekannten Stand und
 * lässt ihn im Hintergrund auffrischen (Stale-While-Revalidate), statt bis zur Netzantwort
 * unsichtbar zu bleiben (#2676). Muster `usePlan.ts`: Schlüssel **je Konto** und Räumung beim
 * Abmelden — auf einem geteilten Gerät darf das nächste Konto den Stand des vorigen nicht sehen.
 */

/** `localStorage`-Schlüssel des Spiegels je Konto (muss mit den Tests übereinstimmen). */
export const balanceStatusCacheKey = (userId: number): string => `pp-balance-status-${userId}`;

interface CachedBalanceStatus {
	/** Füllstand 0–1 (`fuellstandProzent / 100`). */
	fuellstand: number;
	/** Urteilsreife (#2645) — nur gesetzt, wenn der Server beide Felder geliefert hat. */
	urteilsreif?: boolean;
}

/** Liest den zuletzt bekannten Stand des Kontos; ohne (lesbaren) Spiegel `undefined`. */
export const readBalanceStatusCache = (userId: number): CachedBalanceStatus | undefined => {
	try {
		const raw = localStorage.getItem(balanceStatusCacheKey(userId));
		if (raw === null) {
			return undefined;
		}
		const parsed = JSON.parse(raw) as Partial<CachedBalanceStatus>;
		if (typeof parsed.fuellstand !== 'number' || !Number.isFinite(parsed.fuellstand)) {
			return undefined;
		}
		return {
			fuellstand: parsed.fuellstand,
			...(typeof parsed.urteilsreif === 'boolean' ? { urteilsreif: parsed.urteilsreif } : {}),
		};
	} catch {
		// Kaputter oder gesperrter Storage — der erste Start läuft wie bisher über die Netzantwort.
		return undefined;
	}
};

/** Schreibt die Server-Antwort in den Spiegel des Kontos; die Urteilsreife folgt der Dashboard-Logik (#2645). */
export const storeBalanceStatusCache = (
	userId: number,
	status: {
		fuellstandProzent: number;
		erledigungenImFenster?: number;
		mindestErledigungen?: number;
	},
): void => {
	const eintrag: CachedBalanceStatus = {
		fuellstand: status.fuellstandProzent / 100,
		...(status.erledigungenImFenster !== undefined && status.mindestErledigungen !== undefined
			? { urteilsreif: status.erledigungenImFenster >= status.mindestErledigungen }
			: {}),
	};
	try {
		localStorage.setItem(balanceStatusCacheKey(userId), JSON.stringify(eintrag));
	} catch {
		// Storage gesperrt — der Spiegel bleibt leer, die Antwort gilt weiter nur für diese Sitzung.
	}
};

/** Räumt den Spiegel des Kontos weg (Abmeldung, Muster `clearPlanMirror`). */
export const clearBalanceStatusCache = (userId: number): void => {
	try {
		localStorage.removeItem(balanceStatusCacheKey(userId));
	} catch {
		// Storage gesperrt — nichts zu räumen.
	}
};
