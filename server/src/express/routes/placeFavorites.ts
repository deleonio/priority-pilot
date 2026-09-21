import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { PlaceFavorite } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import { requirePlanFeature } from '../planGuard.js';

/**
 * Gespeicherte Orte („Standort-Favoriten", Issue #1342). Der Router hängt hinter dem globalen
 * `requireAuth` (siehe express/index.ts) und arbeitet strikt auf den Favoriten des angemeldeten
 * Nutzers — fremde Zeilen sind über die `userId`-Bedingung unsichtbar (404 statt 403, Muster
 * `apiTokens.ts`). Koordinaten sind optional: ein Freitext-Ort ohne Geocoding-Treffer wird mit
 * `latitude`/`longitude: null` gespeichert (AK4). Seit #1595 hat ein Ort NUR eine Adresse (kein
 * Anzeigename, keine Umbenennen-Route) und dieselbe Adresse existiert je Nutzer genau einmal.
 */

/** Maximale Länge des Adresstexts (Nominatim-`display_name` bleibt deutlich darunter). */
const MAX_ADDRESS_LENGTH = 255;

type PlaceFavoriteDto = {
	id: number;
	address: string;
	latitude: number | null;
	longitude: number | null;
};

const serializePlaceFavorite = (favorite: PlaceFavorite): PlaceFavoriteDto => ({
	id: favorite.id,
	address: favorite.address,
	latitude: favorite.latitude ?? null,
	longitude: favorite.longitude ?? null,
});

/** Koordinaten sind optional; alles außer einer endlichen Zahl gilt als „nicht gesetzt" (AK4). */
const toCoordinate = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Vergleichsform für die Duplikatprüfung (#1595 AK4): getrimmt und ohne Groß-/Kleinschreibung. */
const normalizeAddress = (address: string): string => address.trim().toLowerCase();

export const placeFavoritesRouter = Router();

// GET /place-favorites — eigene Favoriten, älteste zuerst (stabile Reihenfolge im Adressfeld).
placeFavoritesRouter.get('/place-favorites', async (req: Request, res: Response<PlaceFavoriteDto[] | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const favorites = await PlaceFavorite.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
		res.json(favorites.map(serializePlaceFavorite));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /place-favorites — legt einen Favoriten an; Koordinaten dürfen fehlen (AK4).
placeFavoritesRouter.post(
	'/place-favorites',
	requirePlanFeature('location_reminders'),
	async (req: Request, res: Response<PlaceFavoriteDto | ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const body = req.body as { address?: unknown; latitude?: unknown; longitude?: unknown } | undefined;
		const address = typeof body?.address === 'string' ? body.address.trim() : '';
		if (!address || address.length > MAX_ADDRESS_LENGTH) {
			sendError(res, 400, `Bitte eine Adresse mit 1 bis ${MAX_ADDRESS_LENGTH} Zeichen angeben.`);
			return;
		}
		try {
			// #1595 (AK4): Dieselbe Adresse existiert genau einmal. Ein zweiter Speicherversuch ist
			// kein Fehler, sondern liefert den bestehenden Eintrag zurück — das Frontend braucht so
			// keinen Sonderfall und der Stern bleibt idempotent.
			const existing = (await PlaceFavorite.findAll({ where: { userId } })).find(
				(favorite) => normalizeAddress(favorite.address) === normalizeAddress(address),
			);
			if (existing) {
				res.status(201).json(serializePlaceFavorite(existing));
				return;
			}
			const created = await PlaceFavorite.create({
				userId,
				address,
				latitude: toCoordinate(body?.latitude),
				longitude: toCoordinate(body?.longitude),
			});
			res.status(201).json(serializePlaceFavorite(created));
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);

// DELETE /place-favorites/:id — entfernt den Favoriten endgültig; fremde/unbekannte → 404.
placeFavoritesRouter.delete(
	'/place-favorites/:id',
	requirePlanFeature('location_reminders'),
	async (req: Request, res: Response<ErrorDto>) => {
		const userId = getUserId(req);
		if (userId === undefined) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const id = Number(req.params.id);
		if (!Number.isInteger(id)) {
			sendError(res, 404, 'Gespeicherter Ort nicht gefunden.');
			return;
		}
		try {
			const favorite = await PlaceFavorite.findOne({ where: { id, userId } });
			if (!favorite) {
				sendError(res, 404, 'Gespeicherter Ort nicht gefunden.');
				return;
			}
			await favorite.destroy();
			res.status(204).end();
		} catch {
			sendError(res, 500, 'Interner Serverfehler.');
		}
	},
);
