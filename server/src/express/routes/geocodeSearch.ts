import express from 'express';
import type { components } from '../../api.js';
import { isGeocodeRateLimited, NOMINATIM_USER_AGENT } from '../../logics/nominatim.js';

type GeocodeSearchResultDto = components['schemas']['GeocodeSearchResult'];
type ErrorDto = components['schemas']['Error'];

/**
 * OpenStreetMap Nominatim API (kostenlos, keine API-Key erforderlich).
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 * Rate-Limit: 1 req/sec (strict). User-Agent ist Pflicht (Policy).
 */
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

/**
 * Photon API (OSM-Geocoding von Komoot, kostenlos, keine API-Key erforderlich).
 * #1083: Primärquelle, weil Photon typo-tolerant sucht („Hauptbahnof Münche", „munchen") —
 * Nominatim matcht nur auf Substring und lässt Tippfehler leer ausgehen.
 * GeoJSON: Koordinaten sind [lon, lat].
 */
const PHOTON_API = 'https://photon.komoot.io/api';

/** Höchstzahl an Vorschlägen je Suche — reicht für eine Adress-Autovervollständigung. */
const RESULT_LIMIT = 5;

interface NominatimSearchResult {
	display_name?: string;
	lat?: string;
	lon?: string;
}

interface PhotonFeature {
	geometry?: { coordinates?: unknown[] };
	properties?: Record<string, unknown>;
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
	if (isGeocodeRateLimited(ip, session)) {
		res.json([]);
		return;
	}

	try {
		// #1083 AK1: Photon primär — typo-tolerant. 0 Treffer sind ein legitimes Ergebnis (AK3) und
		// lösen bewusst KEINEN Fallback aus (schont das 1-req/sec-Kontingent der OSM-Dienste).
		const photonResults = await searchPhoton(q.trim());
		if (photonResults !== null) {
			res.json(photonResults);
			return;
		}

		// #1083 AK2: Photon nicht erreichbar/abgelehnt → Nominatim-Fallback.
		res.json(await searchNominatim(q.trim()));
	} catch (error) {
		// Timeout, Netzwerkfehler → leere Liste zurückgeben
		console.warn('Adress-Suche-Fehler:', error);
		res.json([]);
	}
});

/** `null` = Photon nicht nutzbar (429/5xx/Timeout/Netzwerkfehler) → Fallback nötig; sonst Trefferliste (auch leer). */
const searchPhoton = async (query: string): Promise<GeocodeSearchResultDto[] | null> => {
	try {
		const url = `${PHOTON_API}?q=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}&accept-language=de`;
		const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

		if (!response.ok) {
			console.warn(`Photon-Suche fehlgeschlagen: ${response.status}`);
			return null;
		}

		const data = (await response.json()) as unknown;
		const features = (data as { features?: unknown })?.features;
		if (!Array.isArray(features)) {
			return null;
		}

		return (features as PhotonFeature[])
			.map((feature) => {
				const coordinates = feature.geometry?.coordinates;
				const properties = feature.properties ?? {};
				if (!Array.isArray(coordinates) || coordinates.length < 2) {
					return undefined;
				}
				const lat = Number(coordinates[1]);
				const lon = Number(coordinates[0]);
				if (isNaN(lat) || isNaN(lon)) {
					return undefined;
				}
				// Zusammensetzung analog Nominatim `display_name`: Name/Straße vor Ort.
				const parts = [
					typeof properties.name === 'string' ? properties.name : undefined,
					[properties.street, properties.housenumber].filter((part) => typeof part === 'string' && part !== ''),
					[properties.postcode, properties.city].filter((part) => typeof part === 'string' && part !== ''),
				].flat();
				return { address: parts.filter(Boolean).join(', '), lat, lon };
			})
			.filter((entry): entry is GeocodeSearchResultDto => entry !== undefined && entry.address !== '');
	} catch (error) {
		console.warn('Photon nicht erreichbar:', error);
		return null;
	}
};

/** Bisheriges Nominatim-Mapping ( unverändert) — Fallback für den Fall, dass Photon nicht antwortet. */
const searchNominatim = async (query: string): Promise<GeocodeSearchResultDto[]> => {
	const url = `${NOMINATIM_API}?format=jsonv2&q=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}&accept-language=de`;
	const response = await fetch(url, {
		headers: { 'User-Agent': NOMINATIM_USER_AGENT },
		signal: AbortSignal.timeout(5000), // 5s Timeout für Nominatim
	});

	if (!response.ok) {
		console.warn(`Nominatim-Suche fehlgeschlagen: ${response.status}`);
		return [];
	}

	const data = (await response.json()) as unknown;
	if (!Array.isArray(data)) {
		return [];
	}

	return (data as NominatimSearchResult[])
		.filter((entry) => typeof entry.display_name === 'string' && entry.lat !== undefined && entry.lon !== undefined)
		.map((entry) => ({
			address: entry.display_name as string,
			lat: parseFloat(entry.lat as string),
			lon: parseFloat(entry.lon as string),
		}))
		.filter((entry) => !isNaN(entry.lat) && !isNaN(entry.lon));
};
