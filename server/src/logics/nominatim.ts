/**
 * Gemeinsame Infrastruktur für die OpenStreetMap-Nominatim-Endpunkte (Reverse-Geocoding #866,
 * Adresssuche/Forward-Geocoding): Policy-Pflichten (User-Agent, Rate-Limit 1 req/sec) an einer
 * Stelle statt je Route dupliziert — https://operations.osmfoundation.org/policies/nominatim/.
 *
 * #1280: Das Rate-Limiting läuft nicht mehr hier (Eigenbau-Map wuchs unbeschränkt), sondern in
 * der Express-Schicht über die geteilte express-rate-limit-Instanz (`express/routes/geocodeRateLimit.ts`).
 */

export const NOMINATIM_USER_AGENT = 'Priority-Pilot (https://github.com/deleonio/priority-pilot)';
