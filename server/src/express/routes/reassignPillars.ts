import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { classifyPillarsWithMistral, type PillarClassifier } from '../../llm/llm.js';
import { getUserId } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';
import { createAiQuotaCounter, meterAiQuota } from '../aiQuotaMeter.js';
import { hasProviderPin, validateProviderQuery } from '../llmProviderQuery.js';
import { acquireUserRun, releaseUserRun, type ReassignRunKey } from '../../logics/reassignLock.js';
import {
	DEFAULT_REASSIGN_LIMIT,
	parseStatusFilter,
	reassignTaskPillarsForUser,
} from '../../logics/reassignTaskPillars.js';
import type { components } from '../../api';

type OwnReassignPillarsResultDto = components['schemas']['OwnReassignPillarsResult'];

/**
 * Neuberechnung der Säulenverteilung über die EIGENEN Aufgaben (#1614).
 *
 * Gegenstück zum app-weiten Admin-Batch (`routes/admin.ts`): dieselbe Logik, aber auf das Konto
 * des Aufrufers beschränkt und für jeden angemeldeten Nutzer erreichbar. Bewusst KEIN zweiter,
 * clientseitiger Rechenweg — die Verteilung entsteht weiterhin serverseitig über den
 * KI-Klassifikator, damit es für dieselbe fachliche Operation nur eine Semantik gibt.
 *
 * Portionierung wie beim Admin-Batch: ein Aufruf verarbeitet höchstens `limit` Aufgaben, der
 * Aufrufer setzt mit `offset` fort und liest den Fortschritt aus `remaining`.
 */
export const createReassignPillarsRouter = (
	pillarClassifier: PillarClassifier = classifyPillarsWithMistral,
): Router => {
	const router = Router();

	router.post(
		'/tasks/reassign-pillars',
		requirePlanFeature('ai_assist'),
		// Der Zähler der Middleware bucht einen Punkt für den Request; die eigentliche Abrechnung
		// läuft über `createAiQuotaCounter` je Aufgabe. Er bleibt trotzdem stehen: er setzt die
		// 429-Abweisung bei bereits erschöpftem Kontingent, bevor überhaupt ein Lauf startet, und
		// ergänzt `quotaRemaining` in der Antwort.
		meterAiQuota(),
		async (req: Request, res: Response<OwnReassignPillarsResultDto | ErrorDto>) => {
			const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
			if (!providerValidation.ok) {
				sendError(res, 400, providerValidation.message);
				return;
			}
			const query = req.query as Record<string, unknown>;

			const rawLimit = query.limit;
			let limit = DEFAULT_REASSIGN_LIMIT;
			if (rawLimit !== undefined) {
				const parsed = Number(rawLimit);
				if (!Number.isInteger(parsed) || parsed < 1) {
					sendError(res, 400, 'limit muss eine ganze Zahl >= 1 sein.');
					return;
				}
				limit = parsed;
			}

			const rawOffset = query.offset;
			let offset = 0;
			if (rawOffset !== undefined) {
				const parsed = Number(rawOffset);
				if (!Number.isInteger(parsed) || parsed < 0) {
					sendError(res, 400, 'offset muss eine ganze Zahl >= 0 sein.');
					return;
				}
				offset = parsed;
			}

			const status = parseStatusFilter(query.status);
			if (status === null) {
				sendError(res, 400, 'status muss all, open oder done sein.');
				return;
			}

			const userId = getUserId(req);
			const runKey: ReassignRunKey = userId ?? 'passthrough';
			if (!acquireUserRun(runKey)) {
				sendError(res, 409, 'Es läuft bereits eine Neuberechnung — erst deren Ende abwarten.');
				return;
			}
			try {
				const quota = await createAiQuotaCounter(userId, hasProviderPin(query));
				const result = await reassignTaskPillarsForUser(userId, {
					classifier: pillarClassifier,
					provider: providerValidation.provider,
					budget: limit,
					offset,
					status,
					quota,
				});
				const { total, ...rest } = result;
				res.json({
					...rest,
					remaining: Math.max(0, total - offset - (result.updated + result.failed + result.skipped)),
				});
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			} finally {
				releaseUserRun(runKey);
			}
		},
	);

	return router;
};
