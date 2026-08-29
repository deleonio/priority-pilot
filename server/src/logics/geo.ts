/** Geo-Helfer (Issues #1066/#1101) — eine Wahrheit für die Distanzberechnung. */
const EARTH_RADIUS_KM = 6371;

/** Großkreis-Distanz zweier Punkte in km (Haversine-Formel). */
export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
	const toRad = (value: number): number => (value * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};
