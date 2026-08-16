import { Router } from 'express';
import type { Request, Response } from 'express';
import type { components } from '../../api.js';

type FreeModelDto = components['schemas']['FreeModel'];
type FreeModelsDto = components['schemas']['FreeModels'];

const modelsRouter = Router();

/**
 * GET /models/free — Liste der kostenlosen LLM-Modelle (Issue #742).
 * Rückgabe der Modelle, die ohne API-Key genutzt werden können.
 */
modelsRouter.get('/models/free', (_req: Request, res: Response<FreeModelsDto>) => {
	// TODO: In Zukunft könnte diese Liste aus einer Konfiguration oder einem externen Service kommen.
	const freeModels: FreeModelDto[] = [
		{ id: 'openrouter/free', name: 'OpenRouter Free' },
		{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)' },
		{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)' },
	];

	res.json({ models: freeModels });
});

export { modelsRouter };
