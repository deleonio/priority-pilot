import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import sequelize from '../../database.js';
import { Pillar, TaskPillar, SeriesPillar } from '../../models/index.js';
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

/** Validierter Input für POST /pillars (AK1). */
interface CreatePillarInput {
	name: string;
	description: string;
}

/** Validierter Input für PATCH /pillars/:id (AK2). */
interface UpdatePillarInput {
	name?: string;
	description?: string;
}

type ValidationResult = { ok: true; entries: WeightEntry[] } | { ok: false; message: string };

/** Wandelt eine Pillar-Instanz in die im API-Vertrag definierte Form um. */
const serializePillar = (pillar: Pillar): PillarDto => ({
	id: pillar.id,
	name: pillar.name,
	description: pillar.description,
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

/**
 * Validiert den Body von POST /pillars: `{ name: string, description: string }`.
 * Name muss nicht leer sein.
 */
const validateCreatePillarBody = (
	body: unknown,
): { ok: true; input: CreatePillarInput } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { name, description } = body as Record<string, unknown>;

	if (typeof name !== 'string' || name.trim().length === 0) {
		return { ok: false, message: 'name muss ein nicht-leerer String sein.' };
	}
	if (description !== undefined && typeof description !== 'string') {
		return { ok: false, message: 'description muss ein String sein (falls gesetzt).' };
	}

	return { ok: true, input: { name: name.trim(), description: description?.trim() ?? '' } };
};

/**
 * Validiert den Body von PATCH /pillars/:id: `{ name?: string, description?: string }`.
 * Mindestens eines der Felder muss gesetzt sein; wenn gesetzt, darf name nicht leer sein.
 */
const validateUpdatePillarBody = (
	body: unknown,
): { ok: true; input: UpdatePillarInput } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { name, description } = body as Record<string, unknown>;

	const hasName = name !== undefined;
	const hasDescription = description !== undefined;

	if (!hasName && !hasDescription) {
		return { ok: false, message: 'Mindestens eines der Felder (name, description) muss gesetzt sein.' };
	}

	if (hasName) {
		if (typeof name !== 'string' || name.trim().length === 0) {
			return { ok: false, message: 'name muss ein nicht-leerer String sein (falls gesetzt).' };
		}
	}
	if (hasDescription && typeof description !== 'string') {
		return { ok: false, message: 'description muss ein String sein (falls gesetzt).' };
	}

	const input: UpdatePillarInput = {};
	if (hasName) input.name = name.trim();
	if (hasDescription) input.description = description.trim();

	return { ok: true, input };
};

export const pillarsRouter = Router();

// Rate-Limit auf die Säulen-CRUD-Endpunkte (CodeQL js/missing-rate-limiting), nach dem Muster des
// Transit-Limiters. Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
const pillarsLimiter = rateLimit({
	windowMs: 60_000,
	max: 120,
	standardHeaders: true,
	legacyHeaders: false,
	skip: () => process.env.NODE_ENV !== 'production',
});
pillarsRouter.use(pillarsLimiter);

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

// ── POST /pillars (AK1) ───────────────────────────────────────────────────────────────

/**
 * POST /pillars — legt eine neue Säule für den eingeloggten Nutzer an (Teil 2, #428, AK1).
 * Neue Säulen starten mit weight = 0 (Epic-Entscheidung 4). Die Summe der Gewichte bleibt
 * technisch erhalten (100 + 0 = 100), aber faktisch wächst die Anzahl der Säulen → der
 * Nutzer muss die Gewichte später über PUT /pillars/weights neu verteilen.
 */
pillarsRouter.post('/pillars', requireAuth, async (req: Request, res: Response<PillarDto | ErrorDto>) => {
	const validation = validateCreatePillarBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const { name, description } = validation.input;

	try {
		const userId = getUserId(req);

		// Prüfen, ob der Name für diesen Nutzer bereits existiert (Unique-Constraint auf (name, userId)).
		const existing = await Pillar.findOne({ where: { name, ...ownerScope(userId) } });
		if (existing) {
			sendError(res, 409, 'Eine Säule mit diesem Namen existiert bereits.');
			return;
		}

		// Neue Säule mit weight = 0 anlegen.
		const pillar = await Pillar.create({
			name,
			description,
			weight: 0,
			userId,
		});

		res.status(201).json(serializePillar(pillar));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// ── PATCH /pillars/:id (AK2) ───────────────────────────────────────────────────────────

/**
 * PATCH /pillars/:id — benennt eine Säule um oder ändert ihre Beschreibung (Teil 2, #428, AK2).
 * Nur der Besitzer der Säule darf sie ändern (ownerScope). Bei Erfolg 200 mit dem aktualisierten
 * Objekt; bei fremder Säule 404 (nicht 403, um existierende Säulen nicht preiszugeben).
 */
pillarsRouter.patch('/pillars/:id', requireAuth, async (req: Request, res: Response<PillarDto | ErrorDto>) => {
	const validation = validateUpdatePillarBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const { input } = validation;

	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id < 1) {
		sendError(res, 400, 'id muss eine Ganzzahl >= 1 sein.');
		return;
	}

	try {
		const userId = getUserId(req);

		// Säule suchen (nur eigene Säulen → 404 bei fremder ID).
		const pillar = await Pillar.findOne({ where: { id, ...ownerScope(userId) } });
		if (!pillar) {
			sendError(res, 404, 'Säule nicht gefunden.');
			return;
		}

		// Wenn name geändert wird: Prüfen, ob der neue Name für diesen Nutzer bereits existiert.
		if (input.name && input.name !== pillar.name) {
			const existing = await Pillar.findOne({
				where: { name: input.name, ...ownerScope(userId) },
			});
			if (existing && existing.id !== id) {
				sendError(res, 409, 'Eine Säule mit diesem Namen existiert bereits.');
				return;
			}
		}

		// Aktualisieren (nur die gesetzten Felder).
		await pillar.update(input);

		res.json(serializePillar(pillar));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// ── DELETE /pillars/:id (AK3) ───────────────────────────────────────────────────────────

/**
 * DELETE /pillars/:id — löscht eine Säule inklusive aller Beiträge (Teil 2, #428, AK3).
 * Renormiert verbleibende Beiträge pro Task/Serie auf 100% und verteilt die Gewichte der
 * übrigen Säulen proportional auf 100%. Nur der Besitzer darf löschen.
 */
pillarsRouter.delete('/pillars/:id', requireAuth, async (req: Request, res: Response<ErrorDto>) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id < 1) {
		sendError(res, 400, 'id muss eine Ganzzahl >= 1 sein.');
		return;
	}

	try {
		const userId = getUserId(req);

		// Säule suchen (nur eigene Säulen → 404 bei fremder ID).
		const pillar = await Pillar.findOne({ where: { id, ...ownerScope(userId) } });
		if (!pillar) {
			sendError(res, 404, 'Säule nicht gefunden.');
			return;
		}

		await sequelize.transaction(async (transaction) => {
			// 1. Beiträge der Säule aus task_pillars und series_pillars entfernen.
			await TaskPillar.destroy({ where: { pillarId: id }, transaction });
			await SeriesPillar.destroy({ where: { pillarId: id }, transaction });

			// 2. Verbleibende Beiträge pro Task renormieren (Summe → 100%).
			// Alle Tasks finden, die noch Beiträge haben (Gruppierung nach taskId).
			const tasksWithContributions = await TaskPillar.findAll({
				attributes: ['taskId'],
				group: ['taskId'],
				having: sequelize.where(sequelize.fn('count', sequelize.col('taskId')), '>', 0),
				transaction,
			});

			for (const { taskId } of tasksWithContributions) {
				// Alle verbleibenden Beiträge dieses Tasks laden.
				const remaining = await TaskPillar.findAll({
					where: { taskId },
					transaction,
				});

				if (remaining.length > 0) {
					// Summe der aktuellen shares berechnen.
					const totalShare = remaining.reduce((sum, c) => sum + c.share, 0);

					// Falls die Summe nicht 0: proportional auf 100 renormieren.
					if (totalShare > 0) {
						const factor = 100 / totalShare;
						for (const contribution of remaining) {
							await contribution.update({ share: contribution.share * factor }, { transaction });
						}
					}
				}
			}

			// 3. Verbleibende Beiträge pro Serie renormieren (Summe → 100%).
			// Analog zu Schritt 2, aber auf SeriesPillar-Ebene: Serien-Vorlagen kopieren
			// ihre Shares via `generateDueInstances` direkt in neue Task-Instanzen, ohne
			// die API-Summenvalidierung zu durchlaufen (#422).
			const seriesWithContributions = await SeriesPillar.findAll({
				attributes: ['seriesId'],
				group: ['seriesId'],
				having: sequelize.where(sequelize.fn('count', sequelize.col('seriesId')), '>', 0),
				transaction,
			});

			for (const { seriesId } of seriesWithContributions) {
				const remaining = await SeriesPillar.findAll({
					where: { seriesId },
					transaction,
				});

				if (remaining.length > 0) {
					const totalShare = remaining.reduce((sum, c) => sum + c.share, 0);

					if (totalShare > 0) {
						const factor = 100 / totalShare;
						for (const contribution of remaining) {
							await contribution.update({ share: contribution.share * factor }, { transaction });
						}
					}
				}
			}

			// 4. Säule selbst löschen.
			await pillar.destroy({ transaction });

			// 5. Rest-Gewichte der übrigen Säulen proportional auf 100 renormieren.
			const remainingPillars = await Pillar.findAll({
				where: ownerScope(userId),
				transaction,
			});

			if (remainingPillars.length > 0) {
				const totalWeight = remainingPillars.reduce((sum, p) => sum + p.weight, 0);

				if (totalWeight > 0) {
					const factor = 100 / totalWeight;
					for (const p of remainingPillars) {
						await p.update({ weight: p.weight * factor }, { transaction });
					}
				}
			}
		});

		res.status(204).send();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
