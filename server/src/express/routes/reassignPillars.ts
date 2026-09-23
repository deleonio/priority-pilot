import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, sendPlanError, type ErrorDto } from '../http-error.js';
import { classifyPillarsWithMistral, type PillarClassifier } from '../../llm/llm.js';
import { getUserId } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';
import { createAiQuotaCounter, markAiQuotaMetered } from '../aiQuotaMeter.js';
import { hasProviderPin, validateProviderQuery } from '../llmProviderQuery.js';
import { acquireUserRun, releaseUserRun, type ReassignRunKey } from '../../logics/reassignLock.js';
import {
	DEFAULT_REASSIGN_LIMIT,
	countPendingTasks,
	parseStatusFilter,
	reassignTaskPillarsForUser,
} from '../../logics/reassignTaskPillars.js';
import { User } from '../../models/index.js';
import type { components } from '../../api';

type OwnReassignPillarsResultDto = components['schemas']['OwnReassignPillarsResult'];
type OwnReassignPillarsStatusDto = components['schemas']['OwnReassignPillarsStatus'];

/**
 * Laufstart im Pass-Through-Modus (ohne Konto, lokale Entwicklung) — dort gibt es keine
 * `users`-Zeile, in der er stehen könnte. Geht bei einem Neustart verloren; das ist lokal hinnehmbar.
 */
let passthroughRunStartedAt: Date | null = null;

const readRunStart = async (userId: number | undefined): Promise<Date | null> => {
	if (userId === undefined) {
		return passthroughRunStartedAt;
	}
	const user = await User.findByPk(userId, { attributes: ['id', 'pillarRecalcStartedAt'] });
	return user?.pillarRecalcStartedAt ?? null;
};

const writeRunStart = async (userId: number | undefined, startedAt: Date): Promise<void> => {
	if (userId === undefined) {
		passthroughRunStartedAt = startedAt;
		return;
	}
	await User.update({ pillarRecalcStartedAt: startedAt }, { where: { id: userId } });
};

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
				res.json({ startedAt: startedAt?.toISOString() ?? null, total, pending });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			}
		},
	);

	router.post(
		'/tasks/reassign-pillars',
		requirePlanFeature('ai_assist'),
		// Bewusst OHNE `meterAiQuota()`: die Middleware bucht einen Punkt je Request und storniert
		// ihn nur bei Status >= 400. Zusammen mit der Buchung je Aufgabe kostete eine Portion über
		// N Aufgaben N+1 Punkte, und das von ihr ergänzte `quotaRemaining` stammte von VOR dem Lauf
		// und läge um bis zu N zu hoch. Diese Route bucht deshalb ausschließlich selbst, weist bei
		// erschöpftem Kontingent mit demselben 429 ab und liest `quotaRemaining` am Ende frisch.
		// `markAiQuotaMetered` hält sie für den Abdeckungstest (AK5) trotzdem als gezählt sichtbar.
		markAiQuotaMetered(async (req: Request, res: Response<OwnReassignPillarsResultDto | ErrorDto>) => {
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
				let since = rawRestart === 'true' ? null : await readRunStart(userId);
				if (since === null) {
					since = new Date();
					await writeRunStart(userId, since);
				}
				const quota = await createAiQuotaCounter(userId, hasProviderPin(query));
				const result = await reassignTaskPillarsForUser(userId, {
					classifier: pillarClassifier,
					provider: providerValidation.provider,
					budget: limit,
					offset,
					status,
					since,
					quota,
				});
				const consumed = result.updated + result.failed + result.skipped;

				// Schon vor dem ersten Provider-Aufruf erschöpft: derselbe 429 wie in der Middleware,
				// statt einer 200 mit einem Lauf, der nichts getan hat.
				if (result.quotaExhausted && consumed === 0 && quota !== undefined) {
					sendPlanError(res, 429, `Das monatliche KI-Kontingent von ${quota.monthlyLimit} Anfragen ist aufgebraucht.`, {
						code: 'quota_exhausted',
						feature: 'ai_assist',
						currentPlan: quota.plan,
					});
					return;
				}

				const { total, ...rest } = result;
				res.json({
					...rest,
					remaining: Math.max(0, total - offset - consumed),
					// Erst hier frisch gelesen — die N Buchungen des Laufs sind darin enthalten.
					...(quota === undefined ? {} : { quotaRemaining: await quota.remaining() }),
				});
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
			} finally {
				releaseUserRun(runKey);
			}
		}),
	);

	return router;
};
