import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar, Task, TaskPillar } from '../../models/index.js';
import {
	adviseActivitiesWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ActivityAdvisor,
} from '../../llm/mistral.js';
import { calculatePillarAttention, type PillarAttentionInput } from '../../logics/pillarAttention.js';
import type { components } from '../../api';

type ActivityAdviceDto = components['schemas']['ActivityAdvice'];
type PillarAttentionDto = components['schemas']['PillarAttentionEntry'];
type ErrorDto = components['schemas']['Error'];

/**
 * Schwellwert, ab dem eine Säule als „vernachlässigt" gilt (#328). Bewusst konservativ: erst wenn
 * mindestens zwei der drei Signale (Unterversorgung, offene Tasks, Staleness) deutlich anschlagen,
 * überschreitet der Score diese Grenze — so bleibt der UI-Hinweis ein echtes Signal, kein Rauschen.
 */
const NEGLECTED_SCORE_THRESHOLD = 0.5;

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
	if (body !== undefined && (typeof body !== 'object' || body === null || Array.isArray(body))) {
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
 * Aggregiert je Säule die Kennzahlen für den Aufmerksamkeits-Score (#328) und berechnet daraus die
 * Attention-Signale. Reine Lese-Aggregation über `task_pillars`/`tasks`:
 * - `actualShare`: Summe der `share`-Beiträge der Säule / Gesamtsumme aller `share`-Beiträge (0–1).
 * - `openCount` / `doneCount`: Anzahl offener (`Open`/`In process`) bzw. erledigter (`Done`) Tasks,
 *   die (über einen beliebigen `share`) auf die Säule einzahlen.
 * - `updatedAt`: jüngstes `Task.updatedAt` unter den Tasks der Säule; Fallback `Pillar.updatedAt`.
 *
 * Die eigentliche Score-Formel und Monotonie liegen in {@link calculatePillarAttention} — hier nur
 * die Daten-Beschaffung. Fehlt jede Aktivität (keine Tasks), bleibt `neglected` überall `false`, und
 * der Aufrufer lässt das `attention`-Feld weg (kein Rauschen).
 */
const computeAttention = async (pillars: Pillar[], now: Date): Promise<PillarAttentionDto[]> => {
	const links = await TaskPillar.findAll();
	const tasks = await Task.findAll();
	const taskById = new Map(tasks.map((task) => [task.id, task]));

	const totalShare = links.reduce((sum, link) => sum + link.share, 0);

	const inputs: PillarAttentionInput[] = pillars.map((pillar) => {
		const pillarLinks = links.filter((link) => link.pillarId === pillar.id);
		const shareSum = pillarLinks.reduce((sum, link) => sum + link.share, 0);
		let openCount = 0;
		let doneCount = 0;
		let latest = pillar.updatedAt;
		for (const link of pillarLinks) {
			const task = taskById.get(link.taskId);
			if (!task) {
				continue;
			}
			if (task.status === 'Done') {
				doneCount += 1;
			} else {
				openCount += 1;
			}
			if (task.updatedAt.getTime() > latest.getTime()) {
				latest = task.updatedAt;
			}
		}
		return {
			pillarId: pillar.id,
			weight: pillar.weight,
			actualShare: totalShare > 0 ? shareSum / totalShare : 0,
			openCount,
			doneCount,
			updatedAt: latest,
		};
	});

	return calculatePillarAttention(inputs, now).map((entry) => ({
		pillarId: entry.pillarId,
		score: entry.score,
		neglected: entry.score > NEGLECTED_SCORE_THRESHOLD,
	}));
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
	router.post(
		'/pillars/advisor',
		async (
			req: Request,
			res: Response<{ advice: ActivityAdviceDto[]; attention?: PillarAttentionDto[] } | ErrorDto>,
		) => {
			const validation = validateBody(req.body);
			if (!validation.ok) {
				sendError(res, 400, validation.message);
				return;
			}

			let pillars: Pillar[];
			let attention: PillarAttentionDto[];
			try {
				pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
				if (pillars.length === 0) {
					sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
					return;
				}
				attention = await computeAttention(pillars, new Date());
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
				return;
			}

			try {
				const advice = await advisor({
					question: validation.question,
					pillars: pillars.map((pillar) => ({ id: pillar.id, name: pillar.name, description: pillar.description })),
					attention: attention
						.filter((entry) => entry.score > NEGLECTED_SCORE_THRESHOLD)
						.map((entry) => ({ pillarId: entry.pillarId, score: entry.score })),
				});
				// Das `attention`-Feld nur anhängen, wenn mindestens eine Säule als vernachlässigt gilt —
				// so bleibt die Antwort ohne echtes Signal frei von Rauschen (und deckungsgleich mit dem
				// bisherigen `{ advice }`-Vertrag).
				if (attention.some((entry) => entry.neglected)) {
					res.json({ advice, attention });
				} else {
					res.json({ advice });
				}
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
		},
	);

	return router;
};
