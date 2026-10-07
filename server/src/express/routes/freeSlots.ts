import { Router } from 'express';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { sendError, type ErrorDto } from '../http-error.js';
import { CalendarEvent, CalendarSource, User } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import { resolveGeoUser } from './geoConfig.js';
import { bewerteKandidaten } from '../../logics/find.js';
import { findFreeSlots, fitTasksToSlots } from '../../logics/freeSlots.js';

/**
 * Freie Zeit (#1990): Mindestdauer der Lücken pro Nutzer (Muster `geoConfig.ts`) und die Vorschläge
 * „Lücke → passende Aufgaben" aus dem verbundenen Kalender. Ohne Kalender oder bei Fehlern liefert
 * `/tasks/free-slots` eine leere Liste — das Dashboard bleibt dann wie gewohnt. Wird VOR dem
 * Task-Router gemountet, sonst fängt `/tasks/:id` den Pfad ab.
 */

type FreeSlotConfigDto = { freeSlotMinMinutes: number };
type FreeSlotDto = { start: string; end: string; tasks: { id: number; title: string }[] };

const FREE_SLOT_MIN_MINUTES_DEFAULT = 30;
/** Höchstens so viele Lücken auf der Karte (KI-UX: sonst wird sie bei 375 px zu lang). */
const MAX_SLOTS = 3;

export const freeSlotsRouter = Router();

// GET /free-slot-config — gespeicherte Mindestdauer, sonst der Default.
freeSlotsRouter.get('/free-slot-config', async (req: Request, res: Response<FreeSlotConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({ freeSlotMinMinutes: user.freeSlotMinMinutes ?? FREE_SLOT_MIN_MINUTES_DEFAULT });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /free-slot-config — ganze Zahl in [10, 240], sonst 400 ohne Persistenz.
freeSlotsRouter.put('/free-slot-config', async (req: Request, res: Response<FreeSlotConfigDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const value = (req.body as { freeSlotMinMinutes?: unknown } | undefined)?.freeSlotMinMinutes;
		if (typeof value !== 'number' || !Number.isInteger(value) || value < 10 || value > 240) {
			sendError(res, 400, 'Ungültige Mindestdauer: freeSlotMinMinutes ∈ [10, 240] (ganze Zahl).');
			return;
		}
		await User.update({ freeSlotMinMinutes: value }, { where: { id: user.id } });
		res.json({ freeSlotMinMinutes: value });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /tasks/free-slots — heutige Lücken bis 22:00 mit passenden offenen Aufgaben (find.ts-Reihenfolge).
freeSlotsRouter.get('/tasks/free-slots', async (req: Request, res: Response<FreeSlotDto[]>) => {
	const userId = getUserId(req);
	try {
		if (userId === undefined || (await CalendarSource.count({ where: { userId } })) === 0) {
			res.json([]);
			return;
		}
		const now = new Date();
		const user = await User.findByPk(userId);
		const events = await CalendarEvent.findAll({ where: { userId, end: { [Op.gt]: now } } });
		const slots = findFreeSlots({
			events,
			now,
			minMinutes: user?.freeSlotMinMinutes ?? FREE_SLOT_MIN_MINUTES_DEFAULT,
		});
		if (slots.length === 0) {
			res.json([]);
			return;
		}
		const tasks = (await bewerteKandidaten(userId, now)).map(({ task }) => task);
		res.json(
			fitTasksToSlots(slots, tasks)
				.slice(0, MAX_SLOTS)
				.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString(), tasks: slot.tasks })),
		);
	} catch {
		res.json([]);
	}
});
