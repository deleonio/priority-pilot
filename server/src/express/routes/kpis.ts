import { Router } from 'express';
import type { Request, Response } from 'express';
import { getUserId } from '../requireAuth.js';
import { protokolliereKpiEreignis } from '../../logics/kpiKennzahlen.js';

/**
 * KPI-Protokollierung (#1989): Client-Ping für geteilte Wochen-Karten. Der Router hängt hinter
 * dem globalen `requireAuth` (siehe express/index.ts) — ohne Session gibt es 401. Gespeichert
 * wird nur eine anonyme Ereigniszeile (`logics/kpiKennzahlen.ts`), kein Karteninhalt.
 */
export const kpisRouter = Router();

// POST /kpis/wochenkarte — Share je Konto und Woche höchstens einmal zählen (Dedup im Logik-Layer);
// Antwort immer 204, damit ein Protokollierfehler den erfolgreichen Share nicht stört.
kpisRouter.post('/kpis/wochenkarte', async (req: Request, res: Response) => {
	await protokolliereKpiEreignis(getUserId(req) ?? 0, 'wochenkarte');
	res.status(204).send();
});
