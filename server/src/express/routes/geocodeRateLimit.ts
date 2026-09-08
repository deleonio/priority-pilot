import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * Geteilter Rate-Limiter für die Nominatim-Endpunkte (Adresssuche + Reverse-Geocoding, #1280):
 * ersetzt den leakigen Eigenbau-Limiter (Map ohne Cleanup) durch express-rate-limit und bewahrt
 * den Frontend-Fallback-Vertrag — gedrosselte Requests antworten 200 mit leerer Liste bzw.
 * leerer Adresse statt 429 (Nominatim-Policy 1 req/sec, geteilt über beide Endpunkte).
 */
export const geocodeRateLimiter: RequestHandler = rateLimit({
	windowMs: 1000,
	max: 1,
	standardHeaders: true,
	legacyHeaders: false,
	// Kontingent je IP + Session-Token — ein Debounce-Kandidat pro Session, nicht pro IP (Muster des
	// entfernten Eigenbau-Limiters: Key = `${ip}:${session}`). ipKeyGenerator verhindert IPv6-Bypass
	// (ERR_ERL_KEY_GEN_IPV6).
	keyGenerator: (req) => `${ipKeyGenerator(req.ip as string)}:${req.headers['x-session-token'] ?? ''}`,
	handler: (req, res) => {
		// Fallback-Vertrag je Endpunkt (leere Antwort statt 429); der Limiter hängt an beiden Mounts.
		if (req.originalUrl.includes('/reverse-geocode')) {
			res.json({ address: '' });
			return;
		}
		res.json([]);
	},
});
