/**
 * Gemeinsame Infrastruktur für die OpenStreetMap-Nominatim-Endpunkte (Reverse-Geocoding #866,
 * Adresssuche/Forward-Geocoding): Policy-Pflichten (User-Agent, Rate-Limit 1 req/sec) an einer
 * Stelle statt je Route dupliziert — https://operations.osmfoundation.org/policies/nominatim/.
 */

export const NOMINATIM_USER_AGENT = 'Priority-Pilot (https://github.com/deleonio/priority-pilot)';

/** Rate-Limit: In-Memory, Key=IP+Session, Window=1s — geteilt über ALLE Nominatim-Routen
 *  (Suche + Reverse-Geocoding), damit das 1-req/sec-Limit der Policy nicht pro Route erneut vergeben wird. */
const rateLimitMap = new Map<string, number[]>();

/** `true`, wenn der Aufrufer (IP+Session) das 1-req/sec-Limit gerade verletzt. */
export const isGeocodeRateLimited = (ip: string, session: string): boolean => {
	const now = Date.now();
	const key = `${ip}:${session}`;
	const timestamps = rateLimitMap.get(key) ?? [];
	const recent = timestamps.filter((ts) => now - ts < 1000);
	if (recent.length > 0) {
		return true;
	}
	recent.push(now);
	rateLimitMap.set(key, recent);
	return false;
};
