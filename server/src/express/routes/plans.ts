import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPlansCatalog, type PlansCatalog } from '../../logics/plans.js';

/**
 * Öffentlicher Paket-Katalog (#1456 AK3). Der Router hängt bewusst VOR dem globalen `requireAuth`
 * (siehe express/index.ts, Muster `inviteLinksPublicRouter`): Preise und Feature-Matrix sollen auf
 * einer Landing-/Preisseite ohne Login lesbar sein. Der Inhalt kommt unverändert aus
 * `logics/plans.ts` — hier steht bewusst keine zweite Kopie der Matrix.
 */
export const plansPublicRouter = Router();

// GET /plans — Feature-Matrix und Preise je Paket, ohne Session.
plansPublicRouter.get('/plans', (_req: Request, res: Response<PlansCatalog>) => {
	res.json(getPlansCatalog());
});
