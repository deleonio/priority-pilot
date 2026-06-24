import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction, ValidationError as SequelizeValidationError } from 'sequelize';
import sequelize from '../../database.js';
import { Pillar, ScoreEntry, Task, TaskPillar } from '../../models/index.js';
import { wouldCreateCycle } from '../../logics/cycle.js';
import { berechneScore } from '../../logics/score.js';
import type { components } from '../../api';

type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type TaskStatus = components['schemas']['TaskStatus'];

const VALID_STATUSES: readonly TaskStatus[] = ['Open', 'In process', 'Done'];

/** Soll-Summe der `share`-Werte über die Säulen eines Tasks (100 %-Verteilung). */
const TOTAL_SHARE = 100;
/** Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). */
const SHARE_SUM_EPSILON = 1e-6;
/** Default-Konfidenz (volle Sicherheit), wenn ein Beitrag keine `confidence` mitschickt. */
const DEFAULT_CONFIDENCE = 100;

/** Validierte Task-Attribute (Spalten), wie sie an das Sequelize-Modell übergeben werden. */
interface TaskAttributes {
	title?: string;
	status?: TaskStatus;
	priority?: number;
	estimatedEffort?: number;
	actualEffort?: number | null;
	description?: string | null;
	deadline?: Date | null;
}

/** Ein vollständig normierter Säulen-Beitrag (confidence aufgelöst auf den Default). */
interface PillarContribution {
	pillarId: number;
	share: number;
	confidence: number;
}

type ValidationResult =
	| { ok: true; attrs: TaskAttributes; pillars: PillarContribution[] | undefined }
	| { ok: false; message: string };

const isTaskStatus = (value: unknown): value is TaskStatus =>
	typeof value === 'string' && VALID_STATUSES.some((status) => status === value);

/**
 * Wandelt eine Task-Instanz in die im API-Vertrag definierte Form um. Die Säulen-Beiträge stammen
 * aus der **eager-geladenen** Assoziation `task.Pillars` (`include: [Pillar]`); fehlt sie, gilt
 * „keine Säulen". Die Beiträge sind nach `pillarId` sortiert (deterministische Reihenfolge).
 */
export const serializeTask = (task: Task): TaskDto => ({
	id: task.id,
	title: task.title,
	status: task.status,
	priority: task.priority,
	estimatedEffort: task.estimatedEffort,
	actualEffort: task.actualEffort ?? null,
	description: task.description ?? null,
	deadline: task.deadline ? task.deadline.toISOString() : null,
	seriesId: task.seriesId ?? null,
	isException: task.isException ?? false,
	pillars: (task.Pillars ?? [])
		.map((pillar) => ({
			pillarId: pillar.id,
			share: pillar.TaskPillar.share,
			confidence: pillar.TaskPillar.confidence,
		}))
		.sort((a, b) => a.pillarId - b.pillarId),
});

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Übersetzt Schreibfehler in passende HTTP-Statuscodes (400 bei Validierung, sonst 500). */
const handleWriteError = (res: Response<ErrorDto>, error: unknown): void => {
	if (error instanceof SequelizeValidationError) {
		sendError(res, 400, error.errors.map((item) => item.message).join('; '));
		return;
	}
	sendError(res, 500, 'Interner Serverfehler.');
};

/** Pfad-Parameter als positive Ganzzahl parsen; sonst `null`. */
const parseId = (raw: string): number | null => {
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Validiert die `pillars`-Liste (Säulen-Beiträge) rein strukturell (ohne DB-Zugriff): jede `pillarId`
 * eine Ganzzahl `>= 1` ohne Dubletten, `share`/`confidence` Zahlen in `[0, 100]` (`confidence`
 * optional, Default 100). Bei mindestens einem Beitrag muss die Summe der `share` 100 ergeben.
 */
const validatePillars = (
	raw: unknown,
): { ok: true; pillars: PillarContribution[] } | { ok: false; message: string } => {
	if (!Array.isArray(raw)) {
		return { ok: false, message: 'pillars muss eine Liste sein.' };
	}
	const pillars: PillarContribution[] = [];
	const seen = new Set<number>();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) {
			return { ok: false, message: 'Jeder pillars-Eintrag muss ein Objekt sein.' };
		}
		const { pillarId, share, confidence } = item as Record<string, unknown>;
		if (typeof pillarId !== 'number' || !Number.isInteger(pillarId) || pillarId < 1) {
			return { ok: false, message: 'pillarId muss eine Ganzzahl >= 1 sein.' };
		}
		if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 100) {
			return { ok: false, message: 'share muss eine Zahl zwischen 0 und 100 sein.' };
		}
		let resolvedConfidence = DEFAULT_CONFIDENCE;
		if (confidence !== undefined) {
			if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
				return { ok: false, message: 'confidence muss eine Zahl zwischen 0 und 100 sein.' };
			}
			resolvedConfidence = confidence;
		}
		if (seen.has(pillarId)) {
			return { ok: false, message: `Doppelte pillarId ${pillarId} in pillars.` };
		}
		seen.add(pillarId);
		pillars.push({ pillarId, share, confidence: resolvedConfidence });
	}
	if (pillars.length > 0) {
		const sum = pillars.reduce((acc, entry) => acc + entry.share, 0);
		if (Math.abs(sum - TOTAL_SHARE) > SHARE_SUM_EPSILON) {
			return { ok: false, message: `Die Summe der share-Werte muss ${TOTAL_SHARE} ergeben (aktuell ${sum}).` };
		}
	}
	return { ok: true, pillars };
};

/**
 * Validiert den Request-Body für Anlegen/Aktualisieren eines Tasks.
 * `requireTitle` erzwingt einen Titel (POST); bei PATCH sind alle Felder optional. `pillars` ist
 * `undefined`, wenn das Feld fehlt (PATCH lässt die Beiträge dann unverändert).
 */
const validateTaskFields = (body: unknown, requireTitle: boolean): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const input = body as Record<string, unknown>;
	const attrs: TaskAttributes = {};

	if (input.title !== undefined) {
		if (typeof input.title !== 'string' || input.title.trim() === '') {
			return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
		}
		attrs.title = input.title.trim();
	}
	if (requireTitle && attrs.title === undefined) {
		return { ok: false, message: 'title ist erforderlich.' };
	}

	if (input.status !== undefined) {
		if (!isTaskStatus(input.status)) {
			return { ok: false, message: 'status muss "Open", "In process" oder "Done" sein.' };
		}
		attrs.status = input.status;
	}

	if (input.priority !== undefined) {
		if (
			typeof input.priority !== 'number' ||
			!Number.isInteger(input.priority) ||
			input.priority < 1 ||
			input.priority > 5
		) {
			return { ok: false, message: 'priority muss eine Ganzzahl zwischen 1 und 5 sein.' };
		}
		attrs.priority = input.priority;
	}

	if (input.estimatedEffort !== undefined) {
		if (
			typeof input.estimatedEffort !== 'number' ||
			!Number.isFinite(input.estimatedEffort) ||
			input.estimatedEffort < 0.1 ||
			input.estimatedEffort > 1
		) {
			return { ok: false, message: 'estimatedEffort muss eine Zahl zwischen 0.1 und 1 sein.' };
		}
		attrs.estimatedEffort = input.estimatedEffort;
	}

	if (input.actualEffort !== undefined) {
		if (
			input.actualEffort !== null &&
			(typeof input.actualEffort !== 'number' || !Number.isFinite(input.actualEffort) || input.actualEffort < 0)
		) {
			return { ok: false, message: 'actualEffort muss eine endliche Zahl >= 0 oder null sein.' };
		}
		attrs.actualEffort = input.actualEffort;
	}

	if (input.description !== undefined) {
		if (input.description !== null && typeof input.description !== 'string') {
			return { ok: false, message: 'description muss ein String oder null sein.' };
		}
		attrs.description = input.description;
	}

	if (input.deadline !== undefined) {
		if (input.deadline === null) {
			attrs.deadline = null;
		} else if (typeof input.deadline !== 'string' || Number.isNaN(Date.parse(input.deadline))) {
			return { ok: false, message: 'deadline muss ein gültiges ISO-Datum oder null sein.' };
		} else {
			attrs.deadline = new Date(input.deadline);
		}
	}

	let pillars: PillarContribution[] | undefined;
	if (input.pillars !== undefined) {
		const result = validatePillars(input.pillars);
		if (!result.ok) {
			return result;
		}
		pillars = result.pillars;
	}

	return { ok: true, attrs, pillars };
};

/**
 * Prüft, ob alle referenzierten Säulen existieren. `[]` ist gültig (keine Säule). SQLite erzwingt
 * den Fremdschlüssel nicht selbst, daher hier explizit prüfen (die `pillarId` sind dublettenfrei).
 */
const arePillarsExistent = async (pillars: PillarContribution[]): Promise<boolean> => {
	if (pillars.length === 0) {
		return true;
	}
	const ids = pillars.map((entry) => entry.pillarId);
	const count = await Pillar.count({ where: { id: ids } });
	return count === ids.length;
};

/** Schreibt die Säulen-Beiträge eines Tasks neu (ersetzt vorhandene) — innerhalb einer Transaktion. */
const replaceContributions = (
	taskId: number,
	pillars: PillarContribution[],
	transaction: Transaction,
): Promise<unknown> =>
	TaskPillar.bulkCreate(
		pillars.map((entry) => ({ taskId, pillarId: entry.pillarId, share: entry.share, confidence: entry.confidence })),
		{ transaction, validate: true },
	);

/** Lädt einen Task inkl. seiner Säulen-Beiträge (für die Serialisierung). */
const findTaskWithPillars = (id: number): Promise<Task | null> => Task.findByPk(id, { include: [Pillar] });

/**
 * Vergibt beim Statuswechsel auf `Done` einen Gamification-`ScoreEntry` (Konzept §4.4) — genau
 * **einmal** je Task (`taskId` unique + `findOrCreate` ⇒ idempotent, erneutes „Done" erzeugt keinen
 * zweiten Eintrag). Basis-Value = `estimatedEffort × priority` (Owner-Vorgabe), pünktlich/verspätet
 * gemäß Deadline (siehe `berechneScore`).
 */
const awardScoreOnDone = async (task: Task, transaction: Transaction): Promise<void> => {
	const erledigtAm = new Date();
	const basisPunkte = task.estimatedEffort * task.priority;
	const { punkte, pünktlich } = berechneScore(task.deadline ?? null, erledigtAm, basisPunkte);
	await ScoreEntry.findOrCreate({
		where: { taskId: task.id },
		defaults: { taskId: task.id, punkte, pünktlich, zeitpunkt: erledigtAm },
		transaction,
	});
};

export const tasksRouter = Router();

// GET /tasks — alle Tasks (inkl. Säulen-Beiträge) auflisten
tasksRouter.get('/tasks', async (_req: Request, res: Response<TaskDto[] | ErrorDto>) => {
	try {
		const tasks = await Task.findAll({ include: [Pillar] });
		res.json(tasks.map(serializeTask));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /tasks — neuen Task anlegen
tasksRouter.post('/tasks', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const validation = validateTaskFields(req.body, true);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (validation.pillars !== undefined && !(await arePillarsExistent(validation.pillars))) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		const created = await sequelize.transaction(async (transaction) => {
			const task = await Task.create({ ...validation.attrs }, { transaction });
			if (validation.pillars !== undefined && validation.pillars.length > 0) {
				await replaceContributions(task.id, validation.pillars, transaction);
			}
			return task;
		});
		const withPillars = await findTaskWithPillars(created.id);
		if (!withPillars) {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		res.status(201).json(serializeTask(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// GET /tasks/:id — einen Task abrufen
tasksRouter.get('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const task = id === null ? null : await findTaskWithPillars(id);
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	res.json(serializeTask(task));
});

// PATCH /tasks/:id — einen Task teilweise aktualisieren
tasksRouter.patch('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const task = id === null ? null : await Task.findByPk(id);
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	const validation = validateTaskFields(req.body, false);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (validation.pillars !== undefined && !(await arePillarsExistent(validation.pillars))) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		// Status vor dem Update festhalten, um den echten Übergang nach „Done" zu erkennen.
		const warVorherDone = task.status === 'Done';
		// AK2 (#120): Eine individuelle Änderung an einer generierten Serien-Instanz markiert sie als
		// Ausnahme — der Generator lässt `isException`-Instanzen unangetastet und das Template bleibt
		// unberührt. Bei gewöhnlichen Tasks (kein `seriesId`) bleibt das Feld unverändert.
		const attrs = task.seriesId != null ? { ...validation.attrs, isException: true } : validation.attrs;
		await sequelize.transaction(async (transaction) => {
			await task.update(attrs, { transaction });
			// `pillars` fehlt → Beiträge unverändert lassen; gesetzt (auch `[]`) → komplett ersetzen.
			if (validation.pillars !== undefined) {
				await TaskPillar.destroy({ where: { taskId: task.id }, transaction });
				if (validation.pillars.length > 0) {
					await replaceContributions(task.id, validation.pillars, transaction);
				}
			}
			// Punkte nur beim echten Übergang auf „Done" vergeben (vorher ≠ Done, jetzt Done) — kein
			// überflüssiges findOrCreate bei weiteren PATCHes eines bereits erledigten Tasks.
			if (!warVorherDone && task.status === 'Done') {
				await awardScoreOnDone(task, transaction);
			}
		});
		const withPillars = await findTaskWithPillars(task.id);
		if (!withPillars) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		res.json(serializeTask(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// DELETE /tasks/:id — einen Task löschen
tasksRouter.delete('/tasks/:id', async (req: Request, res: Response<ErrorDto>) => {
	const id = parseId(req.params.id);
	const task = id === null ? null : await Task.findByPk(id);
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	await task.destroy();
	res.status(204).send();
});

// POST /tasks/:id/dependencies — Abhängigkeit (Vorgänger) hinzufügen
tasksRouter.post('/tasks/:id/dependencies', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	if (id === null) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}

	const body: unknown = req.body;
	if (typeof body !== 'object' || body === null) {
		sendError(res, 400, 'Request-Body muss ein Objekt sein.');
		return;
	}
	const input = body as Record<string, unknown>;

	if (
		typeof input.dependingTaskId !== 'number' ||
		!Number.isInteger(input.dependingTaskId) ||
		input.dependingTaskId < 1
	) {
		sendError(res, 400, 'dependingTaskId muss eine Ganzzahl >= 1 sein.');
		return;
	}
	if (
		input.weight !== undefined &&
		(typeof input.weight !== 'number' || !Number.isFinite(input.weight) || input.weight < 0)
	) {
		sendError(res, 400, 'weight muss eine endliche Zahl >= 0 sein.');
		return;
	}
	const weight = typeof input.weight === 'number' ? input.weight : 1;

	const dependentTask = await Task.findByPk(id);
	if (!dependentTask) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	const dependingTask = await Task.findByPk(input.dependingTaskId);
	if (!dependingTask) {
		sendError(res, 404, 'Abhängiger Task (dependingTaskId) nicht gefunden.');
		return;
	}

	if (await wouldCreateCycle(dependentTask, dependingTask)) {
		sendError(res, 409, 'Abhängigkeit kann nicht hinzugefügt werden: Es würde ein Zyklus entstehen.');
		return;
	}

	try {
		// Idempotent: Besteht die Kante bereits, aktualisiert addDependency() nur das Gewicht der
		// vorhandenen Join-Zeile (kein Duplikat, kein Constraint-Fehler) — die Antwort bleibt 201.
		await dependentTask.addDependency(dependingTask, { through: { weight } });
		const withPillars = await findTaskWithPillars(dependentTask.id);
		if (!withPillars) {
			sendError(res, 404, 'Task nicht gefunden.');
			return;
		}
		res.status(201).json(serializeTask(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// DELETE /tasks/:id/dependencies/:depId — Abhängigkeit (Vorgänger) entfernen
tasksRouter.delete('/tasks/:id/dependencies/:depId', async (req: Request, res: Response<ErrorDto>) => {
	const id = parseId(req.params.id);
	const depId = parseId(req.params.depId);
	const task = id === null ? null : await Task.findByPk(id);
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	if (depId === null) {
		sendError(res, 404, 'Abhängigkeit nicht gefunden.');
		return;
	}
	// Existenz der Kante prüfen, damit ein stilles "Löschen" einer nicht vorhandenen Abhängigkeit
	// laut Vertrag mit 404 (statt 204) beantwortet wird.
	const dependencies = await task.getDependencies();
	if (!dependencies.some((dependency) => dependency.id === depId)) {
		sendError(res, 404, 'Abhängigkeit nicht gefunden.');
		return;
	}
	await task.removeDependency(depId);
	res.status(204).send();
});
