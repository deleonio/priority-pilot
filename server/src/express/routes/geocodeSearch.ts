import express from 'express';
import type { components } from '../../api.js';
import { createNominatimRateLimiter, NOMINATIM_USER_AGENT } from '../../logics/nominatim.js';

type GeocodeSearchResultDto = components['schemas']['GeocodeSearchResult'];
type ErrorDto = components['schemas']['Error'];

/**
 * OpenStreetMap Nominatim API (kostenlos, keine API-Key erforderlich).
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 * Rate-Limit: 1 req/sec (strict). User-Agent ist Pflicht (Policy).
 */
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

/** Höchstzahl an Vorschlägen je Suche — reicht für eine Adress-Autovervollständigung. */
const RESULT_LIMIT = 5;

const isRateLimited = createNominatimRateLimiter();

interface NominatimSearchResult {
	display_name?: string;
	lat?: string;
	lon?: string;
}

export const geocodeSearchRouter = express.Router();

/**
 * GET /api/v1/geocode-search?q={query}
 * Forward Geocoding: Adress-Suchtext → Vorschlagsliste (Adresssuche für Aufgaben).
 * Rate-Limit: Aufrufer sollte max. 1 req/sec (Frontend debouncen).
 * Fallback: Bei Fehler/Timeout/Rate-Limit wird eine leere Liste zurückgegeben.
 */
geocodeSearchRouter.get('/', async (req, res: express.Response<GeocodeSearchResultDto[] | ErrorDto>) => {
	const q = req.query.q;
	if (typeof q !== 'string' || q.trim() === '') {
		res.status(400).json({ message: 'q als nicht-leerer Query-Parameter erforderlich.' });
		return;
	}

	// Rate-Limit: 1 req/sec (Nominatim Policy)
	const ip = req.ip || 'unknown';
	const session = (req.headers['x-session-token'] as string) || '';
	if (isRateLimited(ip, session)) {
		res.json([]);
		return;
	}

	try {
		const url = `${NOMINATIM_API}?format=jsonv2&q=${encodeURIComponent(q.trim())}&limit=${RESULT_LIMIT}&accept-language=de`;
		const response = await fetch(url, {
			headers: { 'User-Agent': NOMINATIM_USER_AGENT },
			signal: AbortSignal.timeout(5000), // 5s Timeout für Nominatim
		});

		if (!response.ok) {
			console.warn(`Nominatim-Suche fehlgeschlagen: ${response.status}`);
			res.json([]);
			return;
		}

		const data = (await response.json()) as unknown;
		if (!Array.isArray(data)) {
			res.json([]);
			return;
		}

		const results = (data as NominatimSearchResult[])
			.filter((entry) => typeof entry.display_name === 'string' && entry.lat !== undefined && entry.lon !== undefined)
			.map((entry) => ({
				address: entry.display_name as string,
				lat: parseFloat(entry.lat as string),
				lon: parseFloat(entry.lon as string),
			}))
			.filter((entry) => !isNaN(entry.lat) && !isNaN(entry.lon));

		res.json(results);
	} catch (error) {
		// Timeout, Netzwerkfehler → leere Liste zurückgeben
		console.warn('Adress-Suche-Fehler:', error);
		res.json([]);
	}
});
