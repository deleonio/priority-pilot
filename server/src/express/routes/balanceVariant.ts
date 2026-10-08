import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';
import type { createCsrfUtilities } from '../csrf.js';

/**
 * Pro-User Zifferblatt-Auswahl (#2009): welches Bild die Startseite zeichnet, wird am Konto
 * gespeichert statt nur im Gerät — auf jedem angemeldeten Gerät gilt dieselbe Wahl. Muster:
 * `/care-config` (#1794) — derselbe Nutzer-Auflösungs-Weg inkl. Dev-Pass-Through, Validierung
 * → 400 ohne Persistenz, Default im Code.
 *
 * Der GET stellt den CSRF-Token als Antwort-Header bereit: der Client sendet den PUT als
 * einzelnen Fire-and-forget-Aufruf (Best-Effort-Vertrag des Hooks) und kann keinen eigenen
 * Token-Vorab-Fetch fahren.
 */

/** Die vier Bild-Schlüssel (`BALANCE_VARIANTS`, frontend/src/lib/balanceVariant.ts) — Server-Kopie für die Validierung. */
const VARIANTEN: readonly string[] = ['strahlen', 'bluete', 'kristall', 'zeiger'];

/** Default, solange nichts (oder ein inzwischen entferntes Bild) gespeichert ist: die Blüte. */
const DEFAULT_VARIANT = 'bluete';

type BalanceVariantDto = { variant: string };

type CsrfDeps = Pick<ReturnType<typeof createCsrfUtilities>, 'generateCsrfToken'>;

export const createBalanceVariantRouter = (csrf: CsrfDeps): Router => {
	const balanceVariantRouter = Router();

	// GET /balance-variant — gespeicherte Bildwahl des Users; fehlt sie oder ist sie entfernt, der Default `bluete`.
	balanceVariantRouter.get('/balance-variant', async (req: Request, res: Response<BalanceVariantDto | ErrorDto>) => {
		try {
			const user = await resolveGeoUser(req);
			if (!user) {
				sendError(res, 401, 'Anmeldung erforderlich.');
				return;
			}
			res.set('x-csrf-token', csrf.generateCsrfToken(req, res));
			const stored = user.balanceVariant;
			res.json({ variant: stored && VARIANTEN.includes(stored) ? stored : DEFAULT_VARIANT });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	// PUT /balance-variant — Wahl speichern; unbekannter Schlüssel → 400 ohne Persistenz.
	balanceVariantRouter.put('/balance-variant', async (req: Request, res: Response<BalanceVariantDto | ErrorDto>) => {
		try {
			const user = await resolveGeoUser(req);
			if (!user) {
				sendError(res, 401, 'Anmeldung erforderlich.');
				return;
			}
			const variant = (req.body as { variant?: unknown } | undefined)?.variant;
			if (typeof variant !== 'string' || !VARIANTEN.includes(variant)) {
				sendError(res, 400, `Ungültige Bildwahl: erlaubt sind ${VARIANTEN.join(', ')}.`);
				return;
			}
			await User.update({ balanceVariant: variant }, { where: { id: user.id } });
			res.json({ variant });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	return balanceVariantRouter;
};
