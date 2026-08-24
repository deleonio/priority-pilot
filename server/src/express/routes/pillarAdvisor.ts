import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar } from '../../models/index.js';
import {
	adviseActivitiesWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ActivityAdvisor,
	type PillarDistribution,
} from '../../llm/llm.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import { validateProviderQuery } from '../llmProviderQuery.js';
import type { components } from '../../api';

type ActivityAdviceDto = components['schemas']['ActivityAdvice'];
type ErrorDto = components['schemas']['Error'];

/** Obergrenze der Fragenlänge (Vertrag: `ActivityAdvisorInput.question` mit `maxLength: 500`). */
const MAX_QUESTION_LENGTH = 500;

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/**
 * Validiert einen einzelnen Verteilungs-Eintrag (`{ pillarId, weight, actualShare }`) gegen den
 * Vertrag `PillarDistributionEntry`: `pillarId` ganzzahlig ≥ 1, `weight` in [0, 100], `actualShare`
 * in [0, 1]. Gibt bei Erfolg den typisierten Eintrag zurück, sonst eine Fehlermeldung.
 */
const validateDistributionEntry = (raw: unknown): { ok: true; entry: PillarDistribution } | { ok: false } => {
	if (typeof raw !== 'object' || raw === null) {
		return { ok: false };
	}
	const { pillarId, weight, actualShare } = raw as Record<string, unknown>;
	if (typeof pillarId !== 'number' || !Number.isInteger(pillarId) || pillarId < 1) {
		return { ok: false };
	}
	if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 100) {
		return { ok: false };
	}
	if (typeof actualShare !== 'number' || !Number.isFinite(actualShare) || actualShare < 0 || actualShare > 1) {
		return { ok: false };
	}
	return { ok: true, entry: { pillarId, weight, actualShare } };
};

/**
 * Validiert den Body von `POST /pillars/advisor`:
 * - `question` ist optional; wenn vorhanden, ein String bis {@link MAX_QUESTION_LENGTH} Zeichen. Eine
 *   leere/whitespace-Frage zählt als „keine Frage" — der Berater schlägt dann Aktivitäten über alle
 *   Säulen hinweg vor.
 * - `distribution` ist optional; wenn vorhanden, ein Array gültiger Verteilungs-Einträge (die
 *   Säulen-Verteilung, so wie sie im Client dargestellt ist — Soll `weight` vs. Ist `actualShare`).
 */
const validateBody = (
	body: unknown,
): { ok: true; question?: string; distribution?: PillarDistribution[] } | { ok: false; message: string } => {
	if (body !== undefined && (typeof body !== 'object' || body === null || Array.isArray(body))) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { question, distribution } = (body ?? {}) as Record<string, unknown>;
	if (question !== undefined && typeof question !== 'string') {
		return { ok: false, message: 'question muss ein String sein.' };
	}
	if (typeof question === 'string' && question.length > MAX_QUESTION_LENGTH) {
		return { ok: false, message: `question darf maximal ${MAX_QUESTION_LENGTH} Zeichen haben.` };
	}
	let parsedDistribution: PillarDistribution[] | undefined;
	if (distribution !== undefined) {
		if (!Array.isArray(distribution)) {
			return { ok: false, message: 'distribution muss ein Array sein.' };
		}
		parsedDistribution = [];
		for (const raw of distribution) {
			const result = validateDistributionEntry(raw);
			if (!result.ok) {
				return { ok: false, message: 'distribution enthält ungültige Einträge.' };
			}
			parsedDistribution.push(result.entry);
		}
	}
	const trimmed = typeof question === 'string' ? question.trim() : '';
	return { ok: true, question: trimmed === '' ? undefined : trimmed, distribution: parsedDistribution };
};

/**
 * Erstellt den Router für `POST /pillars/advisor` — den Aktivitäten-Berater: schlägt per Mistral
 * konkrete Aktivitäten vor und ordnet sie den Säulen zu. Als Rubrik dienen die Kurzbeschreibungen
 * der Säulen aus den Einstellungen (`Pillar.description`). Der Berater ist injizierbar (Default:
 * realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen.
 *
 * Optionaler Query-Parameter `provider` (#749): pinnt die LLM-Kaskade auf den genannten Provider.
 */
export const createPillarAdvisorRouter = (advisor: ActivityAdvisor = adviseActivitiesWithMistral): Router => {
	const router = Router();

	// POST /pillars/advisor — Aktivitäten samt Säulen-Zuordnung vorschlagen (optional zu einer Frage).
	router.post('/pillars/advisor', async (req: Request, res: Response<{ advice: ActivityAdviceDto[] } | ErrorDto>) => {
		const providerValidation = await validateProviderQuery(req.query as Record<string, unknown>);
		if (!providerValidation.ok) {
			sendError(res, 400, providerValidation.message);
			return;
		}

		const validation = validateBody(req.body);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}

		let pillars: Pillar[];
		try {
			pillars = await Pillar.findAll({ where: ownerScope(getUserId(req)), order: [['id', 'ASC']] });
			if (pillars.length === 0) {
				sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
				return;
			}
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}

		// Die vom Client mitgeschickte Verteilung defensiv auf die real konfigurierten Säulen
		// begrenzen (unbekannte pillarIds ignorieren), damit der Prompt nur gültige Säulen nennt.
		const validPillarIds = new Set(pillars.map((pillar) => pillar.id));
		const distribution = validation.distribution?.filter((entry) => validPillarIds.has(entry.pillarId));

		try {
			const advice = await advisor(
				{
					question: validation.question,
					pillars: pillars.map((pillar) => ({ id: pillar.id, name: pillar.name, description: pillar.description })),
					distribution: distribution && distribution.length > 0 ? distribution : undefined,
				},
				providerValidation.provider,
			);
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
