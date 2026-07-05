import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar } from '../../models/index.js';
import {
	adviseActivitiesWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ActivityAdvisor,
} from '../../llm/mistral.js';
import type { components } from '../../api';

type ActivityAdviceDto = components['schemas']['ActivityAdvice'];
type ErrorDto = components['schemas']['Error'];

/** Obergrenze der Fragenlänge (Vertrag: `ActivityAdvisorInput.question` mit `maxLength: 500`). */
const MAX_QUESTION_LENGTH = 500;

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/**
 * Validiert den Body von `POST /pillars/advisor`: `question` ist optional; wenn vorhanden, ein
 * String bis {@link MAX_QUESTION_LENGTH} Zeichen. Eine leere/whitespace-Frage zählt als „keine
 * Frage" — der Berater schlägt dann Aktivitäten über alle Säulen hinweg vor.
 */
const validateBody = (body: unknown): { ok: true; question?: string } | { ok: false; message: string } => {
	if (body !== undefined && (typeof body !== 'object' || body === null)) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { question } = (body ?? {}) as Record<string, unknown>;
	if (question !== undefined && typeof question !== 'string') {
		return { ok: false, message: 'question muss ein String sein.' };
	}
	if (typeof question === 'string' && question.length > MAX_QUESTION_LENGTH) {
		return { ok: false, message: `question darf maximal ${MAX_QUESTION_LENGTH} Zeichen haben.` };
	}
	const trimmed = typeof question === 'string' ? question.trim() : '';
	return { ok: true, question: trimmed === '' ? undefined : trimmed };
};

/**
 * Erstellt den Router für `POST /pillars/advisor` — den Aktivitäten-Berater: schlägt per Mistral
 * konkrete Aktivitäten vor und ordnet sie den Säulen zu. Als Rubrik dienen die Kurzbeschreibungen
 * der Säulen aus den Einstellungen (`Pillar.description`). Der Berater ist injizierbar (Default:
 * realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createPillarAdvisorRouter = (advisor: ActivityAdvisor = adviseActivitiesWithMistral): Router => {
	const router = Router();

	// POST /pillars/advisor — Aktivitäten samt Säulen-Zuordnung vorschlagen (optional zu einer Frage).
	router.post('/pillars/advisor', async (req: Request, res: Response<{ advice: ActivityAdviceDto[] } | ErrorDto>) => {
		const validation = validateBody(req.body);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}

		let pillars: Pillar[];
		try {
			pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		if (pillars.length === 0) {
			sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
			return;
		}

		try {
			const advice = await advisor({
				question: validation.question,
				pillars: pillars.map((pillar) => ({ id: pillar.id, name: pillar.name, description: pillar.description })),
			});
			res.json({ advice });
		} catch (error) {
			if (error instanceof MissingApiKeyError) {
				sendError(res, 503, error.message);
				return;
			}
			if (error instanceof MistralRequestError) {
				sendError(res, 502, error.message);
				return;
			}
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	return router;
};
