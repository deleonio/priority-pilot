import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, sendPlanError, type ErrorDto } from '../http-error.js';
import { classifyPillarsWithMistral, type PillarClassifier } from '../../llm/llm.js';
import { getUserId } from '../requireAuth.js';
import { isMonetizationEnforced } from '../../logics/plans.js';
import { requirePlanFeature } from '../planGuard.js';
import { createAiQuotaCounter, markAiQuotaMetered } from '../aiQuotaMeter.js';
import { hasProviderPin, validateProviderQuery } from '../llmProviderQuery.js';
import { acquireUserRun, releaseUserRun, type ReassignRunKey } from '../../logics/reassignLock.js';
import { BACKGROUND_PORTION_SIZE, readBackgroundRun, startBackgroundRun } from '../../logics/reassignBackgroundRun.js';
import {
	countPendingTasks,
	ensureRunStart,
	parseStatusFilter,
	readRunStart,
	reassignTaskPillarsForUser,
} from '../../logics/reassignTaskPillars.js';
import type { components } from '../../api';

type ReassignRunStartedDto = components['schemas']['ReassignRunStarted'];
type OwnReassignPillarsStatusDto = components['schemas']['OwnReassignPillarsStatus'];

/**
 * Neuberechnung der Säulenverteilung über die EIGENEN Aufgaben (#1614).
 *
 * Gegenstück zum app-weiten Admin-Batch (`routes/admin.ts`): dieselbe Logik, aber auf das Konto
 * des Aufrufers beschränkt und für jeden angemeldeten Nutzer erreichbar. Bewusst KEIN zweiter,
 * clientseitiger Rechenweg — die Verteilung entsteht weiterhin serverseitig über den
 * KI-Klassifikator, damit es für dieselbe fachliche Operation nur eine Semantik gibt.
 *
 * Hintergrundlauf (#1642): POST startet den Lauf und antwortet sofort, der Server holt die
 * Portionen zu je `limit` Aufgaben selbst ab. Fortschritt und Ergebnis liefert der Status-Endpunkt.
 */
export const createReassignPillarsRouter = (
	pillarClassifier: PillarClassifier = classifyPillarsWithMistral,
): Router => {
	const router = Router();

	// Stand des letzten Laufs (#1614): Das Modal zeigt damit, ob und wie viele Aufgaben noch offen
	// sind, und bietet „Fortsetzen" an. Liest nur — kein Provider-Aufruf, kein Kontingent.
	// Eigener Unterpfad: `GET /tasks/reassign-pillars` finge `GET /tasks/:id` aus routes/tasks.ts ab.
	router.get(
		'/tasks/reassign-pillars/status',
		async (req: Request, res: Response<OwnReassignPillarsStatusDto | ErrorDto>) => {
			const status = parseStatusFilter((req.query as Record<string, unknown>).status);
			if (status === null) {
				sendError(res, 400, 'status muss all, open oder done sein.');
				return;
			}
			try {
				const userId = getUserId(req);
				const startedAt = await readRunStart(userId);
				const [total, pending] = await Promise.all([
					countPendingTasks(userId, status, undefined),
					countPendingTasks(userId, status, startedAt ?? undefined),
				]);
				const run = readBackgroundRun(`user:${userId ?? 'passthrough'}`);
				res.json({
					startedAt: startedAt?.toISOString() ?? null,
					total,
					pending,
					running: run?.running ?? false,
					processed: run?.processed ?? 0,
					...(run?.result === undefined ? {} : { result: run.result }),
				});
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	router.post(
		'/tasks/reassign-pillars',
		requirePlanFeature('ai_assist'),
		// Bewusst OHNE `meterAiQuota()`: die Middleware bucht einen Punkt je Request und storniert
		// ihn nur bei Status >= 400. Zusammen mit der Buchung je Aufgabe kostete ein Lauf über
		// N Aufgaben N+1 Punkte. Diese Route bucht deshalb ausschließlich selbst (je Aufgabe im
		// Hintergrundlauf) und weist bei schon erschöpftem Kontingent mit demselben 429 ab.
		// `markAiQuotaMetered` hält sie für den Abdeckungstest (AK5) trotzdem als gezählt sichtbar.
		markAiQuotaMetered(async (req: Request, res: Response<ReassignRunStartedDto | ErrorDto>) => {
			const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
			if (!providerValidation.ok) {
				sendError(res, 400, providerValidation.message);
				return;
			}
			const query = req.query as Record<string, unknown>;

			const rawLimit = query.limit;
			let limit = BACKGROUND_PORTION_SIZE;
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

			const rawRestart = query.restart;
			if (rawRestart !== undefined && rawRestart !== 'true' && rawRestart !== 'false') {
				sendError(res, 400, 'restart muss true oder false sein.');
				return;
			}

			const userId = getUserId(req);
			const runKey: ReassignRunKey = userId ?? 'passthrough';
			if (!acquireUserRun(runKey)) {
				sendError(res, 409, 'Es läuft bereits eine Neuberechnung — erst deren Ende abwarten.');
				return;
			}
			try {
				// `restart=true` beginnt einen neuen Lauf: Ab jetzt gilt jede Aufgabe wieder als offen.
				// Sonst setzt der Aufruf den letzten Lauf fort; gab es noch keinen, beginnt er einen.
				const since = await ensureRunStart(userId, rawRestart === 'true');
				const quota = await createAiQuotaCounter(userId, hasProviderPin(query));

				// Schon vor dem Start erschöpft: derselbe 429 wie in der Middleware, statt eines
				// Laufs, der nichts tun kann.
				if (quota !== undefined && isMonetizationEnforced() && (await quota.remaining()) === 0) {
					releaseUserRun(runKey);
					sendPlanError(res, 429, `Das monatliche KI-Kontingent von ${quota.monthlyLimit} Anfragen ist aufgebraucht.`, {
						code: 'quota_exhausted',
						feature: 'ai_assist',
						currentPlan: quota.plan,
					});
					return;
				}

				startBackgroundRun(
					`user:${runKey}`,
					async (failedOffset) => {
						const { total, ...rest } = await reassignTaskPillarsForUser(userId, {
							classifier: pillarClassifier,
							provider: providerValidation.provider,
							budget: limit,
							offset: offset + failedOffset,
							status,
							since,
							quota,
						});
						const consumed = rest.updated + rest.failed + rest.skipped;
						return { ...rest, remaining: Math.max(0, total - offset - failedOffset - consumed) };
					},
					() => releaseUserRun(runKey),
				);
				res.status(202).json({ running: true, processed: 0 });
			} catch {
				releaseUserRun(runKey);
				sendError(res, 500, 'Interner Serverfehler.');
			}
		}),
	);

	return router;
};
