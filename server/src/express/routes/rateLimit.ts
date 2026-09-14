import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { getUserId } from '../requireAuth.js';

/**
 * Limiter-Fabrik für die Stammdaten-CRUD-Endpunkte (Säulen, Kategorien) — CodeQL
 * `js/missing-rate-limiting`. Jeder Router bekommt eine eigene Instanz und damit ein eigenes
 * Kontingent; geteilt wird nur die Konfiguration (Muster: `geocodeRateLimit.ts`).
 *
 * Fenster und Schlüssel folgen #1479: Ein Seitenaufbau der App kostet 14 Anfragen in unter einer
 * Sekunde, gedrosselt werden soll nur ein durchdrehender Client. Das kurze Fenster begrenzt die
 * Dauerlast (6 Anfragen/Sekunde) und lässt einen gedrosselten Nutzer nach zehn Sekunden statt
 * nach einer Minute weiterarbeiten. Der Schlüssel enthält die User-Id, damit sich Geräte hinter
 * derselben IP (Mobilfunk-NAT, gemeinsames WLAN) kein Kontingent teilen; `ipKeyGenerator`
 * verhindert dabei den IPv6-Bypass (ERR_ERL_KEY_GEN_IPV6).
 *
 * Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
 */
/**
 * Antwortkörper einer gedrosselten Anfrage — Form wie `sendError` (`{ message }`), damit
 * Frontend und MCP-Clients die Meldung lesen können. Den Wartehinweis mit konkreter Sekundenzahl
 * baut das Frontend aus dem `Retry-After`-Header (`lib/apiError.ts`).
 */
export const THROTTLED_MESSAGE = { message: 'Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten.' };

export const createCrudRateLimiter = (): RequestHandler =>
	rateLimit({
		windowMs: 10_000,
		max: 60,
		standardHeaders: true,
		legacyHeaders: false,
		// Antwortkörper nach dem Fehlervertrag (`{ message }`), statt des Klartext-Defaults von
		// express-rate-limit — Clients lesen die Meldung sonst nicht (#1479).
		message: THROTTLED_MESSAGE,
		keyGenerator: (req) => `${ipKeyGenerator(req.ip as string)}:${getUserId(req) ?? ''}`,
		skip: () => process.env.NODE_ENV !== 'production',
	});
