import express from 'express';
import type { components } from '../../api.js';
import { isNominatimRateLimited, NOMINATIM_USER_AGENT } from '../../logics/nominatim.js';

type ReverseGeocodeDto = components['schemas']['ReverseGeocodeResponse'];
type ErrorDto = components['schemas']['Error'];

/**
 * OpenStreetMap Nominatim API (kostenlos, keine API-Key erforderlich).
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 * Rate-Limit: 1 req/sec (strict), max.几千/Tag.
 * User-Agent ist Pflicht (Policy).
 */
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Baut eine Adresse aus dem Nominatim-Response-Objekt.
 * Fallback: Stadt oder Region, wenn Straße/Hausnummer fehlt.
 */
const buildAddress = (data: {
	address?: { [key: string]: string | undefined };
	city?: string;
	town?: string;
	village?: string;
	county?: string;
	state?: string;
	country?: string;
}): string => {
	const addr = data.address || {};
	const parts: string[] = [];

	// Straßenebene bevorzugen (Hausnummer nur, wenn Straße da)
	if (addr.road) {
		parts.push(addr.road);
		if (addr.house_number) {
			parts.push(addr.house_number);
		}
	}

	// Postleitzahl + Stadt
	if (addr.postcode) parts.push(addr.postcode);
	const city = addr.city || addr.town || addr.village || data.city || data.town || data.village;
	if (city) parts.push(city);

	// Fallback: Staat/Region, wenn nichts da
	if (parts.length === 0) {
		if (addr.state || data.state) parts.push(addr.state || data.state || '');
		if (addr.country || data.country) parts.push(addr.country || data.country || '');
	}

	return parts.filter(Boolean).join(', ') || 'Unbekannter Ort';
};

export const reverseGeocodeRouter = express.Router();

/**
 * GET /api/v1/reverse-geocode?lat={lat}&lon={lon}
 * Reverse Geocoding: Koordinaten → Adresse (Issue #866).
 * Rate-Limit: Aufrufer sollte max. 1 req/sec (Frontend debouncen).
 * Fallback: Bei Fehler/Timeout wird leere Adresse zurückgegeben (Position anzeigen ohne Adresse).
 */
reverseGeocodeRouter.get('/', async (req, res: express.Response<ReverseGeocodeDto | ErrorDto>) => {
	// Rate-Limit: 1 req/sec (Nominatim Policy)
	const ip = req.ip || 'unknown';
	const session = (req.headers['x-session-token'] as string) || '';
	if (isNominatimRateLimited(ip, session)) {
		// Rate-Limit verletzt → leere Adresse (Fallback)
		res.json({ address: '' });
		return;
	}

	const lat = req.query.lat;
	const lon = req.query.lon;

	if (typeof lat !== 'string' || typeof lon !== 'string') {
		res.status(400).json({ message: 'lat und lon als Query-Parameter erforderlich.' });
		return;
	}

	const latNum = parseFloat(lat);
	const lonNum = parseFloat(lon);
	if (isNaN(latNum) || isNaN(lonNum)) {
		res.status(400).json({ message: 'lat und lon müssen gültige Zahlen sein.' });
		return;
	}

	try {
		const url = `${NOMINATIM_API}?format=jsonv2&lat=${latNum}&lon=${lonNum}&accept-language=de`;
		const response = await fetch(url, {
			headers: { 'User-Agent': NOMINATIM_USER_AGENT },
			signal: AbortSignal.timeout(5000), // 5s Timeout für Nominatim
		});

		if (!response.ok) {
			// Rate-Limit (429) oder Serverfehler → leere Adresse zurückgeben
			console.warn(`Nominatim fehlgeschlagen: ${response.status}`);
			res.json({ address: '' });
			return;
		}

		const data = await response.json();
		if (!data || data.error) {
			// Kein Ergebnis (z.B. Ozean) → leere Adresse
			res.json({ address: '' });
			return;
		}

		const address = buildAddress(data);
		res.json({ address });
	} catch (error) {
		// Timeout, Netzwerkfehler → leere Adresse zurückgeben
		console.warn('Reverse-Geocoding-Fehler:', error);
		res.json({ address: '' });
	}
});
