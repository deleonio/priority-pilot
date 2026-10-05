import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { JournalEntry, Pillar, ScoreEntry, Task } from '../../models/index.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import {
	berechneBalanceVerlauf,
	istGueltigesDatum,
	zeitraumInTagen,
	type BalanceHistoryEintrag,
} from '../../logics/balanceHistory.js';
import { istGueltigeZeitzone } from '../../logics/streak.js';
import { berechneJournalFenster, fensterListe, type JournalStatsGranularitaet } from '../../logics/journalStats.js';
import type { PillarWithContribution } from '../../models/task.js';

/**
 * Journal (#2212): kurze Einträge mit Freitext, Datum und optionaler eigener Säule. Hängt hinter
 * dem globalen `requireAuth`, fremde Einträge sind über die `userId`-Bedingung unsichtbar (404,
 * Muster `placeFavorites.ts`). Kein Paket-Limit (ADR 0018).
 */

/** Längengrenze wie die Task-Beschreibung (`DESCRIPTION_MAX_LENGTH`, Frontend-Spiegel). */
const MAX_TEXT_LENGTH = 3000;

/** Obergrenze des Statistik-Zeitraums — Spiegel von `MAX_BALANCE_HISTORY_TAGE` (scores.ts). */
const MAX_JOURNAL_STATS_TAGE = 366;

type JournalEntryDto = { id: number; text: string; date: string; pillarId: number | null };

type JournalStatsFensterDto = {
	von: string;
	bis: string;
	proSaeule: { pillarId: number; anzahl: number }[];
	ohneSaeule: number;
	gesamt: number;
};

type JournalStatsDto = { fenster: JournalStatsFensterDto[]; balanceVerlauf: BalanceHistoryEintrag[] };

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

// GET /journal/stats — Journal-Statistik (#2213, docs/spec/issue-2213.md): Eintragsanzahl je
// Säule, ohne Säule und gesamt je Tages- bzw. Wochenfenster (Montag-Beginn) plus Balance-Verlauf
// (#1424) für denselben Zeitraum — der Verlaufsteil spiegelt `GET /scores/balance/history`
// (ownerScope, `tz`-Fallback Serverzone, Obergrenze 366 Tage), Parität per Spec-Test.
journalRouter.get('/journal/stats', async (req: Request, res: Response<JournalStatsDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const { von, bis } = req.query;
		if (typeof von !== 'string' || typeof bis !== 'string') {
			sendError(res, 400, '"von" und "bis" sind Pflichtparameter (Format YYYY-MM-DD).');
			return;
		}
		if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) {
			sendError(res, 400, '"von" und "bis" müssen ein existierendes Datum im Format YYYY-MM-DD angeben.');
			return;
		}
		if (bis < von) {
			sendError(res, 400, '"bis" darf nicht vor "von" liegen.');
			return;
		}
		if (zeitraumInTagen(von, bis) > MAX_JOURNAL_STATS_TAGE) {
			sendError(res, 400, `Der Zeitraum darf höchstens ${MAX_JOURNAL_STATS_TAGE} Tage umfassen.`);
			return;
		}
		const angefragt: string | undefined =
			typeof req.query.granularitaet === 'string' && req.query.granularitaet !== ''
				? req.query.granularitaet
				: undefined;
		if (angefragt !== undefined && angefragt !== 'tag' && angefragt !== 'woche') {
			sendError(res, 400, 'Die Granularität muss "tag" oder "woche" sein.');
			return;
		}
		const granularitaet: JournalStatsGranularitaet = angefragt === 'woche' ? 'woche' : 'tag';

		const [eintraege, saeulen, tasks, entries] = await Promise.all([
			JournalEntry.findAll({ where: { userId }, order: [['date', 'ASC']] }),
			Pillar.findAll({ where: ownerScope(userId), order: [['id', 'ASC']] }),
			Task.findAll({ where: { ...ownerScope(userId), status: 'Done' }, include: [Pillar] }),
			ScoreEntry.findAll({ include: [{ model: Task, where: ownerScope(userId) }] }),
		]);
		const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));

		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		res.json({
			fenster: berechneJournalFenster(
				eintraege.map((eintrag) => ({ date: eintrag.date, pillarId: eintrag.pillarId ?? null })),
				saeulen.map((saeule) => saeule.id),
				fensterListe(von, bis, granularitaet),
			),
			balanceVerlauf: berechneBalanceVerlauf(
				saeulen.map((saeule) => ({ id: saeule.id, key: saeule.key, name: saeule.name, weight: saeule.weight })),
				tasks.map((task) => ({
					status: task.status,
					estimatedEffort: task.estimatedEffort,
					pillars: (task.Pillars ?? []).map((pillar: PillarWithContribution) => ({
						pillarId: pillar.id,
						share: pillar.TaskPillar.share,
					})),
					zeitpunkt: zeitpunktProTask.get(task.id) ?? null,
				})),
				von,
				bis,
				zeitZone,
			),
		});
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
