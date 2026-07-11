import { Router } from 'express';
import type { Request, Response } from 'express';
import { Pillar, ScoreEntry, Task } from '../../models/index.js';
import { aggregierePunkteProSaeule, type PunkteBeitrag } from '../../logics/score.js';
import type { PillarWithContribution } from '../../models/task.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import type { components } from '../../api';

type ErrorDto = components['schemas']['Error'];
type ScoreEntryDto = components['schemas']['ScoreEntry'];
type PillarScoreDto = components['schemas']['PillarScore'];

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
		res.status(500).json({ message: 'Interner Serverfehler.' });
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
		res.status(500).json({ message: 'Interner Serverfehler.' });
	}
});
