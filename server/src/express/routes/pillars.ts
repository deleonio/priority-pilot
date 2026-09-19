import { Router } from 'express';
import type { Request, Response } from 'express';
import { createCrudRateLimiter } from './rateLimit.js';
import { sendError } from '../http-error.js';
import sequelize from '../../database.js';
import { Pillar } from '../../models/index.js';
import type { components } from '../../api';
import { getUserId, ownerScope, requireAuth } from '../requireAuth.js';

type PillarDto = components['schemas']['Pillar'];
type ErrorDto = components['schemas']['Error'];

/** Soll-Summe der Gewichte über alle Säulen (100 %-Verteilung). */
const TOTAL_WEIGHT = 100;
/** Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). */
const SUM_EPSILON = 1e-6;

/** Ein einzelner, validierter Gewichtungs-Eintrag aus dem Request-Body. */
interface WeightEntry {
	id: number;
	weight: number;
}

/**
 * Sperr-Antwort für die festen Säulen (#1573): Die fünf Lebensbalance-Säulen sind per Definition
 * fest — Anlegen, Umbenennen und Löschen sind serverseitig gesperrt. 403 (nicht 404/405), damit
 * klar ist: der Endpunkt existiert, die Operation ist fachlich nicht mehr erlaubt.
 */
const sendPillarsLocked = (res: Response<ErrorDto>): void => {
	sendError(res, 403, 'Die fünf Säulen sind fest und gelten stets. Anlegen, Umbenennen und Löschen sind gesperrt.');
};

type ValidationResult = { ok: true; entries: WeightEntry[] } | { ok: false; message: string };

/** Wandelt eine Pillar-Instanz in die im API-Vertrag definierte Form um. */
const serializePillar = (pillar: Pillar): PillarDto => ({
	id: pillar.id,
	name: pillar.name,
	description: pillar.description,
	weight: pillar.weight,
});

/**
 * Validiert den Body von `PUT /pillars/weights` rein strukturell (ohne DB-Zugriff):
 * `weights` muss eine nicht-leere Liste aus `{ id, weight }` sein, mit ganzzahliger
 * `id >= 1`, endlichem `weight >= 0` und ohne doppelte `id`. Fachliche Prüfungen
 * (vollständige Abdeckung, Summe = 100) erfolgen anschließend gegen den DB-Stand.
 */
const validateWeightsBody = (body: unknown): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { weights } = body as Record<string, unknown>;
	if (!Array.isArray(weights) || weights.length === 0) {
		return { ok: false, message: 'weights muss eine nicht-leere Liste sein.' };
	}

	const entries: WeightEntry[] = [];
	const seen = new Set<number>();
	for (const item of weights) {
		if (typeof item !== 'object' || item === null) {
			return { ok: false, message: 'Jeder weights-Eintrag muss ein Objekt sein.' };
		}
		const { id, weight } = item as Record<string, unknown>;
		if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
			return { ok: false, message: 'id muss eine Ganzzahl >= 1 sein.' };
		}
		if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
			return { ok: false, message: 'weight muss eine endliche Zahl >= 0 sein.' };
		}
		if (seen.has(id)) {
			return { ok: false, message: `Doppelte id ${id} in weights.` };
		}
		seen.add(id);
		entries.push({ id, weight });
	}

	return { ok: true, entries };
};

export const pillarsRouter = Router();

// Rate-Limit auf die Säulen-CRUD-Endpunkte (CodeQL js/missing-rate-limiting), Konfiguration siehe
// `rateLimit.ts`. Der Pfad `/pillars` ist Pflicht (#1479): Dieser Router hängt per
// `app.use(pillarsRouter)` an der Wurzel, pfadlose Middleware liefe deshalb für jede Anfrage mit
// und würde auch fremde Endpunkte (`/scores`, `/series`, …) aus diesem Kontingent bedienen.
pillarsRouter.use('/pillars', createCrudRateLimiter());

// ── Auth-Middleware für alle Säulen-Endpunkte (Teil 2, #428) ────────────────────────────
// Alle Endpunkte benötigen eine gültige Session (requireAuth). Der Scoping erfolgt über
// getUserId(req) und ownerScope(userId) → Pass-Through-Modus bleibt abwärtskompatibel.

// GET /pillars — alle Säulen des eingeloggten Nutzers auflisten (Teil 2, #428, AK4).
// Früher globale Stammdaten (unscoped); jetzt nutzer-eigen über ownerScope(userId).
pillarsRouter.get('/pillars', requireAuth, async (req: Request, res: Response<PillarDto[] | ErrorDto>) => {
	try {
		const userId = getUserId(req);
		const pillars = await Pillar.findAll({
			where: ownerScope(userId),
			order: [['id', 'ASC']],
		});
		res.json(pillars.map(serializePillar));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /pillars/weights — die 100 %-Verteilung über alle Säulen des Nutzers setzen (Teil 2, #428).
// Früher global; jetzt auf userId eingeschränkt (ownerScope).
pillarsRouter.put('/pillars/weights', requireAuth, async (req: Request, res: Response<PillarDto[] | ErrorDto>) => {
	const validation = validateWeightsBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const { entries } = validation;

	try {
		const userId = getUserId(req);
		const pillars = await Pillar.findAll({
			where: ownerScope(userId),
			order: [['id', 'ASC']],
		});

		// Die Verteilung muss genau alle Säulen abdecken — sonst wäre die Summe nicht aussagekräftig.
		const knownIds = new Set(pillars.map((pillar) => pillar.id));
		if (entries.length !== knownIds.size || !entries.every((entry) => knownIds.has(entry.id))) {
			sendError(
				res,
				400,
				'weights muss genau alle existierenden Säulen enthalten (keine fehlenden oder unbekannten ids).',
			);
			return;
		}

		const sum = entries.reduce((acc, entry) => acc + entry.weight, 0);
		if (Math.abs(sum - TOTAL_WEIGHT) > SUM_EPSILON) {
			sendError(res, 400, `Die Summe der Gewichte muss ${TOTAL_WEIGHT} ergeben (aktuell ${sum}).`);
			return;
		}

		const weightById = new Map(entries.map((entry) => [entry.id, entry.weight]));
		// Sequenziell (statt parallel) aktualisieren: garantiert eine konsistente Sperrreihenfolge
		// (pillars ist nach id sortiert) und engt zugleich den Map-Lookup auf `number` ein.
		await sequelize.transaction(async (transaction) => {
			for (const pillar of pillars) {
				const weight = weightById.get(pillar.id);
				if (weight !== undefined) {
					await pillar.update({ weight }, { transaction });
				}
			}
		});

		res.json(pillars.map(serializePillar));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// ── POST /pillars — gesperrt (#1573) ──────────────────────────────────────────────────
pillarsRouter.post('/pillars', requireAuth, async (_req: Request, res: Response<PillarDto | ErrorDto>) => {
	sendPillarsLocked(res);
});

// ── PATCH /pillars/:id — gesperrt (#1573) ─────────────────────────────────────────────
pillarsRouter.patch('/pillars/:id', requireAuth, async (_req: Request, res: Response<PillarDto | ErrorDto>) => {
	sendPillarsLocked(res);
});

// ── DELETE /pillars/:id — gesperrt (#1573) ────────────────────────────────────────────
pillarsRouter.delete('/pillars/:id', requireAuth, async (_req: Request, res: Response<ErrorDto>) => {
	sendPillarsLocked(res);
});
