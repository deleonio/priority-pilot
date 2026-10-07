import { Router } from 'express';
import type { Request, Response } from 'express';
import { parseId, sendError } from '../http-error.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';
import { meterAiQuota } from '../aiQuotaMeter.js';
import { sendLlmError, validateProviderQuery } from '../llmProviderQuery.js';
import { draftTaskWithMistral } from '../../llm/llm.js';
import { classifyLlmSuitability } from '../../logics/llmSuitability.js';
import { Task } from '../../models/index.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];
type TaskAiDraftDto = components['schemas']['TaskAiDraft'];

/** Eigene Aufgabe laden; fremde/unbekannte IDs bleiben unauffindbar (404, Muster `findOwnTask`). */
const findOwnTask = (req: Request): Promise<Task | null> => {
	const id = parseId(req.params.id);
	return id === null ? Promise.resolve(null) : Task.findOne({ where: { id, ...ownerScope(getUserId(req)) } });
};

/**
 * Router für den KI-Entwurf einer Aufgabe (#2350). `POST` ruft das LLM erst auf Klick mit dem Auftrag
 * der serverseitig ermittelten KI-Eignung (#2349) auf und legt das Ergebnis in `aiDraft` ab — getrennt
 * von `description`. `DELETE` verwirft den Entwurf und bleibt ohne Paketgrenze (eigene Daten).
 */
export const taskAiDraftRouter = (): Router => {
	const router = Router();

	router.post(
		'/tasks/:id/ai-draft',
		requirePlanFeature('ai_assist'),
		meterAiQuota(),
		async (req: Request, res: Response<TaskAiDraftDto | ErrorDto>) => {
			const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
			if (!providerValidation.ok) {
				sendError(res, 400, providerValidation.message);
				return;
			}
			const task = await findOwnTask(req);
			if (task === null) {
				sendError(res, 404, 'Task nicht gefunden.');
				return;
			}
			const category = classifyLlmSuitability(task.title, task.description);
			if (category === null) {
				sendError(res, 400, 'Die Aufgabe eignet sich nicht für einen KI-Entwurf.');
				return;
			}
			try {
				const aiDraft = await draftTaskWithMistral(
					{ category, title: task.title, description: task.description },
					providerValidation.provider,
					getUserId(req),
				);
				await task.update({ aiDraft });
				res.json({ aiDraft });
			} catch (error) {
				sendLlmError(res, error);
			}
		},
	);

	router.delete('/tasks/:id/ai-draft', async (req: Request, res: Response<ErrorDto>) => {
		const task = await findOwnTask(req);
		if (task === null) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		await task.update({ aiDraft: null });
		res.status(204).end();
	});

	return router;
};
