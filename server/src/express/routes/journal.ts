import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { JournalEntry, Pillar } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';

/**
 * Journal (#2212): kurze Einträge mit Freitext, Datum und optionaler eigener Säule. Hängt hinter
 * dem globalen `requireAuth`, fremde Einträge sind über die `userId`-Bedingung unsichtbar (404,
 * Muster `placeFavorites.ts`). Kein Paket-Limit (ADR 0018).
 */

/** Längengrenze wie die Task-Beschreibung (`DESCRIPTION_MAX_LENGTH`, Frontend-Spiegel). */
const MAX_TEXT_LENGTH = 3000;

type JournalEntryDto = { id: number; text: string; date: string; pillarId: number | null };

type JournalInput = { text?: string; date?: string; pillarId?: number | null };

const serializeJournalEntry = (entry: JournalEntry): JournalEntryDto => ({
	id: entry.id,
	text: entry.text,
	date: entry.date,
	pillarId: entry.pillarId ?? null,
});

/** Nur echte Kalendertage im Format `YYYY-MM-DD` (2026-02-30 fällt beim Rückformatieren heraus). */
const isValidDate = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^\d{4}-\d{2}-\d{2}$/.test(value) &&
	!Number.isNaN(Date.parse(value)) &&
	new Date(value).toISOString().slice(0, 10) === value;

/**
 * Prüft die Felder des Bodys; fehlende Felder bleiben ungesetzt (PATCH). Liefert die bereinigte
 * Eingabe oder die Fehlermeldung für 400.
 */
const validateInput = async (body: unknown, userId: number): Promise<JournalInput | string> => {
	const raw = (body ?? {}) as Record<string, unknown>;
	const input: JournalInput = {};
	if ('text' in raw) {
		const text = typeof raw.text === 'string' ? raw.text.trim() : '';
		if (!text || text.length > MAX_TEXT_LENGTH) return `Bitte einen Text mit 1 bis ${MAX_TEXT_LENGTH} Zeichen angeben.`;
		input.text = text;
	}
	if ('date' in raw) {
		if (!isValidDate(raw.date)) return 'Bitte ein gültiges Datum (JJJJ-MM-TT) angeben.';
		input.date = raw.date;
	}
	if ('pillarId' in raw && raw.pillarId !== null) {
		const pillar = Number.isInteger(raw.pillarId)
			? await Pillar.findOne({ where: { id: raw.pillarId as number, userId } })
			: null;
		if (!pillar) return 'Unbekannte Säule.';
		input.pillarId = pillar.id;
	} else if ('pillarId' in raw) {
		input.pillarId = null;
	}
	return input;
};

/** Eigener Eintrag zur `:id` — oder `null` (fremd/unbekannt → 404). */
const findOwn = async (req: Request, userId: number): Promise<JournalEntry | null> => {
	const id = Number(req.params.id);
	return Number.isInteger(id) ? JournalEntry.findOne({ where: { id, userId } }) : null;
};

export const journalRouter = Router();

// GET /journal — eigene Einträge, neuestes Datum zuerst.
journalRouter.get('/journal', async (req: Request, res: Response<JournalEntryDto[] | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const entries = await JournalEntry.findAll({
			where: { userId },
			order: [
				['date', 'DESC'],
				['id', 'DESC'],
			],
		});
		res.json(entries.map(serializeJournalEntry));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /journal — Text Pflicht, Datum Standard heute (UTC), Säule optional.
journalRouter.post('/journal', async (req: Request, res: Response<JournalEntryDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const input = await validateInput({ text: '', ...(req.body as object | undefined) }, userId);
		if (typeof input === 'string') {
			sendError(res, 400, input);
			return;
		}
		const created = await JournalEntry.create({
			userId,
			text: input.text,
			date: input.date ?? new Date().toISOString().slice(0, 10),
			pillarId: input.pillarId ?? null,
		});
		res.status(201).json(serializeJournalEntry(created));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PATCH /journal/:id — ändert nur die mitgeschickten Felder, gleiche Prüfung wie POST.
journalRouter.patch('/journal/:id', async (req: Request, res: Response<JournalEntryDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const entry = await findOwn(req, userId);
		if (!entry) {
			sendError(res, 404, 'Eintrag nicht gefunden.');
			return;
		}
		const input = await validateInput(req.body, userId);
		if (typeof input === 'string') {
			sendError(res, 400, input);
			return;
		}
		await entry.update(input);
		res.json(serializeJournalEntry(entry));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /journal/:id — entfernt den Eintrag endgültig.
journalRouter.delete('/journal/:id', async (req: Request, res: Response<ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const entry = await findOwn(req, userId);
		if (!entry) {
			sendError(res, 404, 'Eintrag nicht gefunden.');
			return;
		}
		await entry.destroy();
		res.status(204).end();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
