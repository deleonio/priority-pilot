import { Router } from 'express';
import type { Request, Response } from 'express';
import sequelize from '../../database.js';
import { Pillar } from '../../models/index.js';
import type { components } from '../../api';

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

type ValidationResult = { ok: true; entries: WeightEntry[] } | { ok: false; message: string };

/** Wandelt eine Pillar-Instanz in die im API-Vertrag definierte Form um. */
const serializePillar = (pillar: Pillar): PillarDto => ({
	id: pillar.id,
	name: pillar.name,
	weight: pillar.weight,
});

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

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

// GET /pillars — alle Säulen (inkl. weight) auflisten
pillarsRouter.get('/pillars', async (_req: Request, res: Response<PillarDto[] | ErrorDto>) => {
	try {
		const pillars = await Pillar.findAll({ order: [['id', 'ASC']] });
		res.json(pillars.map(serializePillar));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /pillars/weights — die 100 %-Verteilung über alle Säulen setzen
pillarsRouter.put('/pillars/weights', async (req: Request, res: Response<PillarDto[] | ErrorDto>) => {
	const validation = validateWeightsBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const { entries } = validation;

	try {
		const pillars = await Pillar.findAll({ order: [['id', 'ASC']] });

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
