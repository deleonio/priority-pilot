import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction, ValidationError as SequelizeValidationError } from 'sequelize';
import sequelize from '../../database.js';
import { Pillar, ScoreEntry, Task, TaskPillar } from '../../models/index.js';
import { wouldCreateCycle } from '../../logics/cycle.js';
import { berechneScore } from '../../logics/score.js';
import { PillarContribution, validatePillars, arePillarsExistent } from '../../logics/pillarContributions.js';
import { getUserId, ownerScope } from '../requireAuth.js';
import type { components } from '../../api';

type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type TaskStatus = components['schemas']['TaskStatus'];

const VALID_STATUSES: readonly TaskStatus[] = ['Open', 'In process', 'Done'];

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

type ValidationResult =
	{ ok: true; attrs: TaskAttributes; pillars: PillarContribution[] | undefined } | { ok: false; message: string };

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
const parseId = (raw: string | string[]): number | null => {
	const id = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Lädt einen Task nur, wenn er dem Nutzer gehört (bzw. im Pass-Through-Modus uneingeschränkt).
 * Ein fremder Task ist damit nicht auffindbar → die Route antwortet mit 404 (statt 403), was den
 * Vertrag „403 oder 404" erfüllt und zugleich keine Existenz fremder Tasks preisgibt.
 */
const findOwnTask = (id: number, userId: number | undefined): Promise<Task | null> =>
	Task.findOne({ where: { id, ...ownerScope(userId) } });

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
		if (!Array.isArray(input.pillars)) {
			return { ok: false, message: 'pillars muss eine Liste sein.' };
		}
		const result = validatePillars(input.pillars);
		if (!result.ok) {
			return { ok: false, message: 'Ungültige Säulen-Beiträge.' };
		}
		pillars = result.pillars;
	}

	return { ok: true, attrs, pillars };
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
tasksRouter.get('/tasks', async (req: Request, res: Response<TaskDto[] | ErrorDto>) => {
	try {
		const tasks = await Task.findAll({ where: ownerScope(getUserId(req)), include: [Pillar] });
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
	const userId = getUserId(req);
	if (validation.pillars !== undefined && !(await arePillarsExistent(validation.pillars.map((p) => p.pillarId)))) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		const created = await sequelize.transaction(async (transaction) => {
			// Neuen Task an den eingeloggten Nutzer binden (Datenisolation, #207); `null` im Pass-Through.
			const task = await Task.create({ ...validation.attrs, userId: userId ?? null }, { transaction });
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
	const userId = getUserId(req);
	// Nur eigene Tasks sind auffindbar (Datenisolation, #207) — fremde → 404.
	const task = id === null ? null : await Task.findOne({ where: { id, ...ownerScope(userId) }, include: [Pillar] });
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	res.json(serializeTask(task));
});

// PATCH /tasks/:id — einen Task teilweise aktualisieren
tasksRouter.patch('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	// Fremde Tasks sind nicht auffindbar → 404 (Datenisolation, #207, AK5).
	const task = id === null ? null : await findOwnTask(id, getUserId(req));
	if (!task) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	const validation = validateTaskFields(req.body, false);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (validation.pillars !== undefined && !(await arePillarsExistent(validation.pillars.map((p) => p.pillarId)))) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	// Unteraufgaben-Done-Guard (#246, AK5): Ein Task darf nur auf „Done" wechseln, wenn keine seiner
	// direkten Unteraufgaben (Dependents) offen ist.
	if (validation.attrs.status === 'Done') {
		const dependents = await task.getDependents();
		const hasOpenSubtask = dependents.some((dep) => dep.status !== 'Done');
		if (hasOpenSubtask) {
			sendError(
				res,
				409,
				'Der Task kann nicht auf „Erledigt" gesetzt werden, solange noch offene Unteraufgaben existieren.',
			);
			return;
		}
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
			// Score-Rücknahme beim Wiedereröffnen (#228, AK-5): War der Task vorher „Done" und ist er
			// jetzt nicht mehr erledigt, wird der beim Erledigen vergebene ScoreEntry wieder entfernt.
			// Ein erneutes „Done" vergibt dann genau einen neuen Eintrag (keine Doppelzählung).
			if (warVorherDone && task.status !== 'Done') {
				await ScoreEntry.destroy({ where: { taskId: task.id }, transaction });
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
	// Fremde Tasks sind nicht auffindbar → 404 (Datenisolation, #207, AK5).
	const task = id === null ? null : await findOwnTask(id, getUserId(req));
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

	// Beide Enden müssen dem Nutzer gehören (Datenisolation, #207) — fremde Tasks → 404.
	const userId = getUserId(req);
	const dependentTask = await findOwnTask(id, userId);
	if (!dependentTask) {
		sendError(res, 404, 'Task nicht gefunden.');
		return;
	}
	const dependingTask = await findOwnTask(input.dependingTaskId, userId);
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
	const task = id === null ? null : await findOwnTask(id, getUserId(req));
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
