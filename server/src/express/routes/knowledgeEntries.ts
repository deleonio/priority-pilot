import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { KnowledgeEntry } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';

/**
 * Wissens-Einträge (#1936): persönliche Hinweise, die in die Säulenzuordnung einfließen. Alle
 * Routen sind Pro-Funktion (`knowledge_entries`, AK2) und arbeiten strikt auf den Einträgen des
 * angemeldeten Nutzers — fremde Zeilen sind unsichtbar (404, Muster `placeFavorites.ts`).
 */

const MAX_TEXT_LENGTH = 500;
const MAX_ENTRIES = 50;

type KnowledgeEntryDto = { id: number; text: string };

const serialize = (entry: KnowledgeEntry): KnowledgeEntryDto => ({ id: entry.id, text: entry.text });

/** Getrimmter Text oder `null`, wenn er leer oder zu lang ist. */
const validText = (body: unknown): string | null => {
	const raw = (body as { text?: unknown } | undefined)?.text;
	const text = typeof raw === 'string' ? raw.trim() : '';
	return text && text.length <= MAX_TEXT_LENGTH ? text : null;
};

const TEXT_ERROR = `Bitte einen Text mit 1 bis ${MAX_TEXT_LENGTH} Zeichen angeben.`;

export const knowledgeEntriesRouter = Router();
const guard = requirePlanFeature('knowledge_entries');

knowledgeEntriesRouter.get(
	'/knowledge-entries',
	guard,
	async (req: Request, res: Response<KnowledgeEntryDto[] | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		try {
			const entries = await KnowledgeEntry.findAll({ where: { userId }, order: [['id', 'ASC']] });
			res.json(entries.map(serialize));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

knowledgeEntriesRouter.post(
	'/knowledge-entries',
	guard,
	async (req: Request, res: Response<KnowledgeEntryDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const text = validText(req.body);
		if (text === null) {
			sendError(res, 400, TEXT_ERROR);
			return;
		}
		try {
			if ((await KnowledgeEntry.count({ where: { userId } })) >= MAX_ENTRIES) {
				sendError(res, 400, `Höchstens ${MAX_ENTRIES} Einträge möglich.`);
				return;
			}
			res.status(201).json(serialize(await KnowledgeEntry.create({ userId, text })));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

knowledgeEntriesRouter.patch(
	'/knowledge-entries/:id',
	guard,
	async (req: Request, res: Response<KnowledgeEntryDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const text = validText(req.body);
		if (text === null) {
			sendError(res, 400, TEXT_ERROR);
			return;
		}
		try {
			const entry = await KnowledgeEntry.findOne({ where: { id: Number(req.params.id) || 0, userId } });
			if (!entry) {
				sendError(res, 404, 'Eintrag nicht gefunden.');
				return;
			}
			res.json(serialize(await entry.update({ text })));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

knowledgeEntriesRouter.delete('/knowledge-entries/:id', guard, async (req: Request, res: Response<ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const deleted = await KnowledgeEntry.destroy({ where: { id: Number(req.params.id) || 0, userId } });
		if (deleted === 0) {
			sendError(res, 404, 'Eintrag nicht gefunden.');
			return;
		}
		res.status(204).end();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
