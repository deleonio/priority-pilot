/**
 * Serverseitige Durchsetzung der Paket-Matrix (Issue #1457, T2 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`). Die Matrix selbst liegt ausschließlich in
 * `logics/plans.ts` — dieser Guard fragt sie nur ab und kodiert keine Paketliste.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getEntitlements, shouldBlockFeature, type FeatureId } from '../logics/plans.js';
import { sendPlanError } from './http-error.js';
import { getUserId, isAuthActive } from './requireAuth.js';
import { User } from '../models/index.js';
import { hasOwnProviderSelection } from '../llm/llmProviders.js';

/**
 * Lesbare Feature-Namen für die Fehlermeldung — rein sprachlich, keine Paketzuordnung. Exportiert,
 * weil `apiTokenAuth.ts`/`routes/apiTokens.ts` (#1460) denselben Wortlaut für die MCP-Plan-Deckelung
 * brauchen und die Matrix nicht ein zweites Mal kodieren sollen.
 */
export const FEATURE_LABELS: Record<FeatureId, string> = {
	groups: 'Gruppen',
	voice_input: 'Spracheingabe',
	ai_assist: 'KI-Unterstützung',
	graph_write: 'Abhängigkeiten im Aufgabengraph',
	location_reminders: 'Standort-Erinnerungen',
	mcp_readwrite: 'Schreibzugriff über MCP',
	mcp_read: 'Lesezugriff über MCP',
};

/**
 * Ein von {@link requirePlanFeature} erzeugter Handler trägt sein Feature als Eigenschaft — der
 * Abdeckungstest (`plan-gating-coverage.test.ts`, AK8) liest sie aus dem Express-Router-Stack und
 * erkennt so eine neue Schreibroute ohne Guard.
 */
export interface PlanFeatureHandler extends RequestHandler {
	planFeature: FeatureId;
}

/**
 * Middleware-Fabrik: weist eine Anfrage mit 403 und `code: 'plan_required'` ab, wenn das Paket des
 * angemeldeten Nutzers `feature` nicht enthält. Die Entscheidung fällt ausschließlich
 * {@link shouldBlockFeature} — inklusive des Rollout-Schalters `MONETIZATION_ENFORCED`, bei dem
 * ausgeschaltet niemals geblockt wird (AK3).
 *
 * Setzt eine vorangehende `requireAuth`-Prüfung voraus (hier keine erneute 401-Prüfung), damit sich
 * die bestehende 401/403-Semantik nicht verschiebt. Der Plan kommt wie bei `requireRole` frisch aus
 * der DB statt aus dem Session-Snapshot: ein Paketwechsel muss sofort wirken, nicht erst nach
 * Re-Login. Im Pass-Through-Modus (keine Auth konfiguriert) bleibt der Guard wie `requireAuth`
 * deaktiviert.
 */
export const requirePlanFeature = (feature: FeatureId): PlanFeatureHandler => {
	const handler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		if (!isAuthActive()) {
			next();
			return;
		}
		const userId = getUserId(req);
		const plan = typeof userId === 'number' ? (await User.findByPk(userId))?.plan : undefined;
		if (plan === undefined || !shouldBlockFeature(plan, feature)) {
			next();
			return;
		}
		// #1548: KI-Aufrufe über einen eigenen Provider des Nutzers laufen auf dessen Key —
		// dann greift das Paket-Gate nicht, auch Free erhält fachliche Antworten (AK4).
		if (feature === 'ai_assist' && typeof userId === 'number' && (await hasOwnProviderSelection(userId))) {
			next();
			return;
		}
		const { requiredPlan } = getEntitlements(plan)[feature];
		sendPlanError(res, 403, `${FEATURE_LABELS[feature]} ist ab Paket „${requiredPlan}" verfügbar.`, {
			code: 'plan_required',
			feature,
			requiredPlan,
			currentPlan: plan,
		});
	};
	return Object.assign(handler as RequestHandler, { planFeature: feature });
};
