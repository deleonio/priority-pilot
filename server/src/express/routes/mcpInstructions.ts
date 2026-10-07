import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Pro-User Dialog-Vorgaben für die per MCP verbundene KI (#1935): Freitext, getrimmt, höchstens
 * 2000 Zeichen; leer = gelöscht. Der MCP-Endpunkt liefert den Text im `initialize`-Handshake aus
 * (`mcp/server.ts`). Muster: `/care-config` (#1794) — derselbe Nutzer-Auflösungs-Weg.
 */

type McpInstructionsDto = { instructions: string };

/** Obergrenze der Vorgaben in Zeichen (AK1). */
const MAX_INSTRUCTIONS_LENGTH = 2000;

export const mcpInstructionsRouter = Router();

// GET /mcp-instructions — gespeicherte Vorgaben des Users, sonst leerer Text.
mcpInstructionsRouter.get('/mcp-instructions', async (req: Request, res: Response<McpInstructionsDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({ instructions: user.mcpInstructions ?? '' });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /mcp-instructions — getrimmten Text speichern (leer löscht); Nicht-String/zu lang → 400.
mcpInstructionsRouter.put('/mcp-instructions', async (req: Request, res: Response<McpInstructionsDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const raw = (req.body as { instructions?: unknown } | undefined)?.instructions;
		if (typeof raw !== 'string' || raw.trim().length > MAX_INSTRUCTIONS_LENGTH) {
			sendError(res, 400, `Ungültige Dialog-Vorgaben: Text mit höchstens ${MAX_INSTRUCTIONS_LENGTH} Zeichen erwartet.`);
			return;
		}
		const instructions = raw.trim();
		await User.update({ mcpInstructions: instructions === '' ? null : instructions }, { where: { id: user.id } });
		res.json({ instructions });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
