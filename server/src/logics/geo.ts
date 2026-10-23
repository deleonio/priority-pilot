/** Geo-Helfer (Issues #1066/#1101/#2553) — eine Wahrheit für Koordinaten-Parsing und Distanzberechnung. */
const EARTH_RADIUS_KM = 6371;

/**
 * Parst eine Koordinate (#2553): endliche Zahl oder numerischer, getrimmter, nicht-leerer String
 * (Query-Parameter kommen immer als String), sonst `null` — auch für `""` (die `Number("") === 0`-Falle,
 * #1101 F1), NaN, Infinity und Arrays. Erzwingt `[-limit, limit]` (90 Breite, 180 Länge).
 */
export const parseCoordinate = (value: unknown, limit: number): number | null => {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
	if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) return null;
	return parsed;
};

/** Großkreis-Distanz zweier Punkte in km (Haversine-Formel). */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
	const toRad = (value: number): number => (value * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

/** Großkreis-Distanz in km, auf 0,1 km gerundet. */
export const roundedDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number =>
	Math.round(haversineKm(lat1, lon1, lat2, lon2) * 10) / 10;
