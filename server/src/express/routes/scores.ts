import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { Pillar, ScoreEntry, Task } from '../../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from '../../logics/score.js';
import { berechneStreak, istGueltigeZeitzone } from '../../logics/streak.js';
import { berechneMeilensteine } from '../../logics/milestones.js';
import type { PillarWithContribution } from '../../models/task.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];
type ScoreEntryDto = components['schemas']['ScoreEntry'];
type PillarScoreDto = components['schemas']['PillarScore'];
type StreakDto = components['schemas']['Streak'];
type MilestoneDto = components['schemas']['Milestone'];

export const scoresRouter = Router();

// GET /scores — vergebene Gamification-Punkte je erledigtem Task.
scoresRouter.get('/scores', async (_req: Request, res: Response<ScoreEntryDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({ order: [['id', 'ASC']] });
		res.json(
			entries.map((entry) => ({
				taskId: entry.taskId,
				punkte: entry.punkte,
				pünktlich: entry.pünktlich,
				zeitpunkt: entry.zeitpunkt.toISOString(),
			})),
		);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/by-pillar — Punkte anteilig (über `share`) je Säule aggregiert (Balance-Stand).
// Nur Tasks des eingeloggten Nutzers (AK5, #422).
scoresRouter.get('/scores/by-pillar', async (req: Request, res: Response<PillarScoreDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)), include: [Pillar] }],
		});
		const beitraege: PunkteBeitrag[] = entries.map((entry) => {
			const pillars: PillarWithContribution[] = entry.Task?.Pillars ?? [];
			return {
				punkte: entry.punkte,
				beitraege: pillars.map((pillar) => ({ pillarId: pillar.id, share: pillar.TaskPillar.share })),
			};
		});
		const summen = aggregierePunkteProSaeule(beitraege);
		res.json([...summen.entries()].map(([pillarId, punkte]) => ({ pillarId, punkte })));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/streak — Kalendertage in Folge mit mindestens einer Erledigung plus Bestmarke (#1360).
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/by-pillar); `GET /scores` ist
// ungescopet und deshalb bewusst NICHT die Quelle.
scoresRouter.get('/scores/streak', async (req: Request, res: Response<StreakDto | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)) }],
		});
		// Der Client schickt seine IANA-Zeitzone mit (`?tz=`); ohne oder mit unbekanntem Wert wertet
		// der Server in seiner eigenen Zeitzone aus — die Anzeige verschiebt sich, es gibt keinen Fehler.
		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { aktuell, best, aktiveTage } = berechneStreak(
			entries.map((entry) => entry.zeitpunkt),
			new Date(),
			zeitZone,
		);
		res.json({ aktuell, best, letzterTag: aktiveTage[aktiveTage.length - 1] ?? null });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /scores/milestones — feste Streak-/Punkte-Stufen, rückwirkend aus Bestandsdaten (#1362).
// Nur Tasks des eingeloggten Nutzers (`ownerScope`, Muster /scores/streak); `GET /scores` ist
// ungescopet und deshalb bewusst NICHT die Quelle.
scoresRouter.get('/scores/milestones', async (req: Request, res: Response<MilestoneDto[] | ErrorDto>) => {
	try {
		const entries = await ScoreEntry.findAll({
			include: [{ model: Task, where: ownerScope(getUserId(req)) }],
		});

		const angefragteZone = typeof req.query.tz === 'string' ? req.query.tz : undefined;
		const zeitZone = istGueltigeZeitzone(angefragteZone)
			? angefragteZone
			: Intl.DateTimeFormat().resolvedOptions().timeZone;

		const { best } = berechneStreak(
			entries.map((entry) => entry.zeitpunkt),
			new Date(),
			zeitZone,
		);
		const punkteSumme = entries.reduce((summe, entry) => summe + entry.punkte, 0);

		res.json(berechneMeilensteine({ bestStreak: best, punkteSumme }));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
