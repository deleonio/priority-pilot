import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar, PillarFeedback } from '../../models/index.js';
import {
	classifyPillarsWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type FeedbackExample,
	type PillarClassifier,
} from '../../llm/llm.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import type { components } from '../../api';

type SuggestPillarsInputDto = components['schemas']['SuggestPillarsInput'];
type PillarSuggestionDto = components['schemas']['PillarSuggestion'];
type PillarFeedbackInputDto = components['schemas']['PillarFeedbackInput'];
type ErrorDto = components['schemas']['Error'];

/**
 * Wie viele der jüngsten Nutzer-Korrekturen als gelernte Few-Shot-Beispiele in den Prompt fließen.
 * Begrenzt, damit der Prompt nicht unbegrenzt wächst (Token-/Kosten-Schutz); die neuesten Samples
 * sind am aussagekräftigsten (siehe #45).
 */
const MAX_FEEDBACK_EXAMPLES = 10;

/**
 * Wie viele jüngste Zeilen maximal aus `pillar_feedback` gescannt werden, um daraus die
 * {@link MAX_FEEDBACK_EXAMPLES} nicht-leeren Beispiele zu gewinnen. Über-Fetch, weil leere
 * Korrektur-Samples (alle Vorschläge verworfen → `pillars: []`) zwar ein gültiger Fall sind,
 * aber als Few-Shot wertlos wären; würden sie das 10er-Fenster belegen, klassifizierte der Loop
 * still ohne die noch vorhandenen, nützlichen Korrekturen (siehe #45). Der Scan bleibt gedeckelt,
 * damit eine voll laufende Tabelle den Endpoint nicht ausbremst.
 */
const FEEDBACK_SCAN_LIMIT = MAX_FEEDBACK_EXAMPLES * 10;

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Validiert den Body von `POST /tasks/suggest-pillars`: `title` Pflicht, `description`/`context` optional. */
const validateBody = (body: unknown): { ok: true; value: SuggestPillarsInputDto } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { title, description, context } = body as Record<string, unknown>;
	if (typeof title !== 'string' || title.trim() === '') {
		return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
	}
	if (description !== undefined && typeof description !== 'string') {
		return { ok: false, message: 'description muss ein String sein.' };
	}
	if (context !== undefined && typeof context !== 'string') {
		return { ok: false, message: 'context muss ein String sein.' };
	}
	return { ok: true, value: { title: title.trim(), description, context } };
};

/**
 * Validiert den Body von `POST /tasks/suggest-pillars/feedback`: `title` Pflicht, `description`
 * optional, `pillars` eine Liste aus `{ pillarId, confidence }`. `validIds` schränkt auf real
 * existierende Säulen ein, damit kein Müll-Sample gespeichert wird.
 */
const validateFeedbackBody = (
	body: unknown,
	validIds: ReadonlySet<number>,
): { ok: true; value: PillarFeedbackInputDto } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { title, description, pillars } = body as Record<string, unknown>;
	if (typeof title !== 'string' || title.trim() === '') {
		return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
	}
	if (description !== undefined && description !== null && typeof description !== 'string') {
		return { ok: false, message: 'description muss ein String sein.' };
	}
	if (!Array.isArray(pillars)) {
		return { ok: false, message: 'pillars muss eine Liste sein.' };
	}
	const seen = new Set<number>();
	const validated: { pillarId: number; confidence: number }[] = [];
	for (const entry of pillars) {
		if (typeof entry !== 'object' || entry === null) {
			return { ok: false, message: 'Jeder pillars-Eintrag muss ein Objekt sein.' };
		}
		const { pillarId, confidence } = entry as Record<string, unknown>;
		if (typeof pillarId !== 'number' || !Number.isInteger(pillarId) || !validIds.has(pillarId)) {
			return { ok: false, message: `Unbekannte oder ungültige pillarId: ${String(pillarId)}.` };
		}
		if (seen.has(pillarId)) {
			return { ok: false, message: `Doppelte pillarId: ${pillarId}.` };
		}
		if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
			return { ok: false, message: 'confidence muss eine Zahl in [0, 100] sein.' };
		}
		seen.add(pillarId);
		validated.push({ pillarId, confidence });
	}
	return {
		ok: true,
		value: {
			title: title.trim(),
			description: typeof description === 'string' ? description : undefined,
			pillars: validated,
		},
	};
};

/**
 * Lädt die jüngsten **nicht-leeren** Korrektur-Samples als gelernte Few-Shot-Beispiele. Leere
 * Samples (Nutzer hat alle Vorschläge verworfen) werden übersprungen, damit sie das Fenster der
 * {@link MAX_FEEDBACK_EXAMPLES} nicht belegen und die noch vorhandenen, nützlichen Korrekturen
 * nicht verdrängen (siehe #45). Dafür wird bis zu {@link FEEDBACK_SCAN_LIMIT} Zeilen über-gefetcht
 * und erst nach dem Filtern auf die ersten N nicht-leeren begrenzt.
 *
 * Seit #430 werden die Samples **pro Nutzer** geladen (`userId`-Scope): Few-Shot-Beispiele eines
 * Nutzers dürfen nicht in die Klassifikation eines anderen Nutzers einsickern. Im Pass-Through-Modus
 * (kein Auth-Kontext → `userId === undefined`, lokale Entwicklung ohne Login) bleibt das Verhalten
 * **global** (Abwärtskompatibilität) — historische Samples ohne `userId` werden dann mit geladen.
 */
const loadFeedbackExamples = async (userId?: number): Promise<FeedbackExample[]> => {
	const rows = await PillarFeedback.findAll({
		...(userId !== undefined ? { where: { userId } } : {}),
		order: [['createdAt', 'DESC']],
		limit: FEEDBACK_SCAN_LIMIT,
	});
	const examples: FeedbackExample[] = [];
	for (const row of rows) {
		if (row.pillars.length === 0) {
			continue;
		}
		examples.push({
			title: row.title,
			description: row.description ?? undefined,
			pillars: row.pillars.map((entry) => ({ pillarId: entry.pillarId, confidence: entry.confidence })),
		});
		if (examples.length >= MAX_FEEDBACK_EXAMPLES) {
			break;
		}
	}
	return examples;
};

/**
 * Erstellt den Router für `POST /tasks/suggest-pillars`. Der Klassifikator ist injizierbar
 * (Default: realer Mistral-Aufruf), damit Tests ohne echten API-Call laufen.
 */
export const createSuggestPillarsRouter = (classifier: PillarClassifier = classifyPillarsWithMistral): Router => {
	const router = Router();

	// POST /tasks/suggest-pillars — Säulen-Klassifikation (mit Konfidenz) für Titel/Beschreibung vorschlagen
	router.post(
		'/tasks/suggest-pillars',
		async (req: Request, res: Response<{ suggestions: PillarSuggestionDto[] } | ErrorDto>) => {
			const validation = validateBody(req.body);
			if (!validation.ok) {
				sendError(res, 400, validation.message);
				return;
			}

			let pillars: Pillar[];
			try {
				pillars = await Pillar.findAll({ where: ownerScope(getUserId(req)), order: [['id', 'ASC']] });
			} catch {
				sendError(res, 500, 'Interner Serverfehler.');
				return;
			}
			if (pillars.length === 0) {
				sendError(res, 503, 'Es sind keine Säulen konfiguriert.');
				return;
			}

			// Feedback ist Best-Effort (#45): die Korrektur-Tabelle ist ein optionales Nice-to-have. Ein
			// Lesefehler (z. B. eine fehlerhafte Altzeile) darf die funktionierende Kern-Klassifikation
			// nicht mit HTTP 500 reißen — in diesem Fall ohne gelernte Beispiele weiterklassifizieren.
			// Seit #430 werden die Few-Shot-Beispiele **pro Nutzer** geladen (datenisoliert); im
			// Pass-Through-Modus ohne Auth-Kontext bleibt das Laden global (Abwärtskompatibilität).
			let examples: FeedbackExample[] = [];
			try {
				examples = await loadFeedbackExamples(getUserId(req));
			} catch (error) {
				console.warn('Feedback-Beispiele konnten nicht geladen werden — klassifiziere ohne sie.', error);
			}

			try {
				const suggestions = await classifier({
					title: validation.value.title,
					description: validation.value.description ?? undefined,
					context: validation.value.context ?? undefined,
					pillars: pillars.map((pillar) => ({
						id: pillar.id,
						name: pillar.name,
						description: pillar.description ?? undefined,
					})),
					examples,
				});
				res.json({ suggestions });
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

	// POST /tasks/suggest-pillars/feedback — bestätigte/korrigierte Säulen-Zuordnung als Sample
	// speichern (Feedback-Loop, #45). Verbessert nachvollziehbar die nachfolgenden Vorschläge.
	router.post('/tasks/suggest-pillars/feedback', async (req: Request, res: Response<{ id: number } | ErrorDto>) => {
		let pillars: Pillar[];
		try {
			pillars = await Pillar.findAll({ where: ownerScope(getUserId(req)), attributes: ['id'] });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		const validIds = new Set(pillars.map((pillar) => pillar.id));

		const validation = validateFeedbackBody(req.body, validIds);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}

		try {
			const created = await PillarFeedback.create({
				title: validation.value.title,
				description: validation.value.description ?? null,
				pillars: validation.value.pillars,
				userId: getUserId(req) ?? null,
			});
			res.status(201).json({ id: created.id });
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	});

	return router;
};
