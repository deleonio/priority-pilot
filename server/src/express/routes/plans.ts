import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPlansCatalog, type PlansCatalog } from '../../logics/plans.js';
import { getPaypalSandboxAccount, type PaypalSandboxAccount } from '../../logics/paypal.js';

/**
 * Öffentlicher Paket-Katalog (#1456 AK3). Der Router hängt bewusst VOR dem globalen `requireAuth`
 * (siehe express/index.ts, Muster `inviteLinksPublicRouter`): Preise und Feature-Matrix sollen auf
 * einer Landing-/Preisseite ohne Login lesbar sein. Der Inhalt kommt unverändert aus
 * `logics/plans.ts` — hier steht bewusst keine zweite Kopie der Matrix. Das PayPal-Sandbox-
 * Testkonto liegt nur bei, wenn der Server selbst gegen die Sandbox läuft; im LIVE-Default fällt
 * das Feld (`undefined`) aus der JSON-Antwort weg.
 */
export const plansPublicRouter = Router();

// GET /plans — Feature-Matrix und Preise je Paket, ohne Session.
plansPublicRouter.get(
	'/plans',
	(_req: Request, res: Response<PlansCatalog & { paypalSandboxAccount?: PaypalSandboxAccount }>) => {
		res.json({ ...getPlansCatalog(), paypalSandboxAccount: getPaypalSandboxAccount() });
	},
);
