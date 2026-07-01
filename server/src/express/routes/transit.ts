import { Router } from 'express';
import type { Request, Response } from 'express';

/**
 * Öffentlicher CORS-Proxy für die Transitous/MOTIS-API (Issue #224).
 *
 * Der Browser darf api.transitous.org nicht direkt aufrufen (CORS), daher reichen
 * wir die Query-Parameter serverseitig weiter. Die Endpunkte benötigen bewusst
 * keine Authentifizierung — sie werden in index.ts VOR requireAuth registriert.
 */

const TRANSITOUS_BASE = 'https://api.transitous.org';

/** Baut die Ziel-URL aus Basispfad und den eingehenden Query-Parametern. */
const buildUpstreamUrl = (path: string, req: Request): string => {
	const url = new URL(`${TRANSITOUS_BASE}${path}`);
	for (const [key, value] of Object.entries(req.query)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				url.searchParams.append(key, String(entry));
			}
		} else if (value !== undefined) {
			url.searchParams.append(key, String(value));
		}
	}
	return url.toString();
};

const UPSTREAM_TIMEOUT_MS = 10_000;

/** Leitet den Request an Transitous weiter und reicht Status + JSON durch. */
const proxy = async (path: string, req: Request, res: Response): Promise<void> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
	try {
		const upstream = await fetch(buildUpstreamUrl(path, req), {
			headers: { Accept: 'application/json' },
			signal: controller.signal,
		});
		// Upstream-Fehler (>= 400) werden als 502 (Bad Gateway) signalisiert.
		if (upstream.status >= 400) {
			res.status(502).json({ message: 'Upstream-Fehler bei Transitous.', upstreamStatus: upstream.status });
			return;
		}
		const body: unknown = await upstream.json();
		res.status(upstream.status).json(body);
	} catch {
		res.status(502).json({ message: 'Transitous nicht erreichbar.' });
	} finally {
		clearTimeout(timer);
	}
};

const transitRouter = Router();

// GET /api/transit/geocode — Ortssuche (Transitous v1 geocode).
transitRouter.get('/geocode', (req, res) => proxy('/api/v1/geocode', req, res));

// GET /api/transit/plan — Verbindungssuche (Transitous v3 plan).
transitRouter.get('/plan', (req, res) => proxy('/api/v3/plan', req, res));

export { transitRouter };
