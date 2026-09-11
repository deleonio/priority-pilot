import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { ApiToken } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import { generateApiToken, hashApiToken } from '../apiTokenAuth.js';

/**
 * Persönliche API-Tokens für externe Clients (Issue #1352). Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts) und arbeitet strikt auf den Tokens des angemeldeten
 * Nutzers — fremde Zeilen sind über die `userId`-Bedingung schlicht unsichtbar (404 statt 403,
 * Muster der übrigen Pro-User-Ressourcen).
 */

/** Maximale Länge des frei wählbaren Token-Namens (reine Anzeigehilfe in den Einstellungen). */
const MAX_NAME_LENGTH = 60;

/** Erlaubte Werte der Rechtestufe je Token (#1356, AK1). */
const TOKEN_SCOPES = ['read', 'readwrite'] as const;
type TokenScope = (typeof TOKEN_SCOPES)[number];
const isTokenScope = (value: unknown): value is TokenScope => TOKEN_SCOPES.includes(value as TokenScope);

/** Erlaubte Laufzeiten in Tagen beim Anlegen (#1357, AK1) — 365 ist die Höchstlaufzeit (12 Monate). */
const TOKEN_EXPIRY_DAYS = [30, 90, 180, 365] as const;
type TokenExpiryDays = (typeof TOKEN_EXPIRY_DAYS)[number];
const isTokenExpiryDays = (value: unknown): value is TokenExpiryDays =>
	TOKEN_EXPIRY_DAYS.includes(value as TokenExpiryDays);

type ApiTokenDto = {
	id: number;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
	scope: TokenScope;
	expiresAt: string | null;
};
type CreatedApiTokenDto = ApiTokenDto & { token: string };

/** Listen-Repräsentation — enthält bewusst weder Klartext noch Hash (AK1). */
const serializeApiToken = (token: ApiToken): ApiTokenDto => ({
	id: token.id,
	name: token.name,
	createdAt: token.createdAt.toISOString(),
	lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
	scope: token.scope,
	expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
});

export const apiTokensRouter = Router();

// GET /api-tokens — eigene, nicht zurückgezogene Tokens (nur Metadaten).
apiTokensRouter.get('/api-tokens', async (req: Request, res: Response<ApiTokenDto[] | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const tokens = await ApiToken.findAll({ where: { userId, revokedAt: null }, order: [['createdAt', 'ASC']] });
		res.json(tokens.map(serializeApiToken));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /api-tokens — legt einen Token an und liefert den Klartext genau in dieser einen Antwort.
apiTokensRouter.post('/api-tokens', async (req: Request, res: Response<CreatedApiTokenDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const body = req.body as { name?: unknown; expiresInDays?: unknown } | undefined;
	const rawName = body?.name;
	const name = typeof rawName === 'string' ? rawName.trim() : '';
	if (!name || name.length > MAX_NAME_LENGTH) {
		sendError(res, 400, `Bitte einen Namen mit 1 bis ${MAX_NAME_LENGTH} Zeichen angeben.`);
		return;
	}
	const expiresInDays = body?.expiresInDays;
	if (!isTokenExpiryDays(expiresInDays)) {
		sendError(res, 400, `Bitte eine Laufzeit von ${TOKEN_EXPIRY_DAYS.join(', ')} Tagen wählen.`);
		return;
	}
	try {
		const token = generateApiToken();
		const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
		const created = await ApiToken.create({ userId, name, tokenHash: hashApiToken(token), expiresAt });
		res.status(201).json({ ...serializeApiToken(created), token });
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /api-tokens/:id — Soft-Delete über `revokedAt`; fremde/unbekannte Tokens → 404.
apiTokensRouter.delete('/api-tokens/:id', async (req: Request, res: Response<ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const id = Number(req.params.id);
	if (!Number.isInteger(id)) {
		sendError(res, 404, 'Token nicht gefunden.');
		return;
	}
	try {
		const token = await ApiToken.findOne({ where: { id, userId, revokedAt: null } });
		if (!token) {
			sendError(res, 404, 'Token nicht gefunden.');
			return;
		}
		await token.update({ revokedAt: new Date() });
		res.status(204).end();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PATCH /api-tokens/:id — Rechtestufe umschalten (#1356, AK3); fremde/unbekannte Tokens → 404.
apiTokensRouter.patch('/api-tokens/:id', async (req: Request, res: Response<ApiTokenDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const id = Number(req.params.id);
	if (!Number.isInteger(id)) {
		sendError(res, 404, 'Token nicht gefunden.');
		return;
	}
	const rawScope = (req.body as { scope?: unknown } | undefined)?.scope;
	if (!isTokenScope(rawScope)) {
		sendError(res, 400, `scope muss einer von ${TOKEN_SCOPES.join(', ')} sein.`);
		return;
	}
	try {
		const token = await ApiToken.findOne({ where: { id, userId, revokedAt: null } });
		if (!token) {
			sendError(res, 404, 'Token nicht gefunden.');
			return;
		}
		await token.update({ scope: rawScope });
		res.json(serializeApiToken(token));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
