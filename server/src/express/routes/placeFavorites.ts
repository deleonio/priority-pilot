import { Router } from 'express';
import type { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { parseId, sendError, type ErrorDto } from '../http-error.js';
import { parseCoordinate } from '../../logics/geo.js';
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

/** Vergleichsform für die Duplikatprüfung (#1595 AK4): getrimmt und ohne Groß-/Kleinschreibung. */
const normalizeAddress = (address: string): string => address.trim().toLowerCase();

/** Der bereits gespeicherte Ort des Nutzers mit derselben Adresse — oder `undefined` (#1595 AK4). */
const findExisting = async (userId: number, address: string): Promise<PlaceFavorite | undefined> =>
	(await PlaceFavorite.findAll({ where: { userId } })).find(
		(favorite) => normalizeAddress(favorite.address) === normalizeAddress(address),
	);

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
		// #2553 AK3: abwesende Koordinaten bleiben null (#1342 AK4, Freitext-Ort); anwesende müssen
		// über den zentralen Helfer gültig sein — früher wurden Überschreiter (999) still gespeichert.
		const latitude = body?.latitude === undefined ? null : parseCoordinate(body.latitude, 90);
		const longitude = body?.longitude === undefined ? null : parseCoordinate(body.longitude, 180);
		if ((body?.latitude !== undefined && latitude === null) || (body?.longitude !== undefined && longitude === null)) {
			sendError(res, 400, 'lat und lon müssen Zahlen in gültigem Bereich sein.');
			return;
		}
		try {
			// #1595 (AK4): Dieselbe Adresse existiert genau einmal. Ein zweiter Speicherversuch ist
			// kein Fehler, sondern liefert den bestehenden Eintrag zurück — das Frontend braucht so
			// keinen Sonderfall und der Stern bleibt idempotent.
			const existing = await findExisting(userId, address);
			if (existing) {
				res.status(201).json(serializePlaceFavorite(existing));
				return;
			}
			const created = await PlaceFavorite.create({
				userId,
				address,
				latitude,
				longitude,
			});
			res.status(201).json(serializePlaceFavorite(created));
		} catch (error) {
			// Zwei gleichzeitige POSTs derselben Adresse (Doppelklick auf den Stern) sehen beide noch
			// keinen Eintrag; der Unique-Index `place_favorites_user_id_address` lässt nur den ersten
			// durch. Der Verlierer liefert denselben bestehenden Eintrag zurück wie der Prüfpfad oben
			// — AK4 gilt damit auch nebenläufig, nicht nur im Normalfall.
			if (error instanceof UniqueConstraintError) {
				const existing = await findExisting(userId, address);
				if (existing) {
					res.status(201).json(serializePlaceFavorite(existing));
					return;
				}
			}
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
		const id = parseId(req.params.id);
		if (id === null) {
			sendError(res, 400, 'Ungültige Orts-Id.');
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
