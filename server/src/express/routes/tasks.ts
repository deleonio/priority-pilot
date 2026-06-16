import { Router } from 'express';
import type { Request, Response } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import { Pillar, Task } from '../../models/index.js';
import { wouldCreateCycle } from '../../logics/cycle.js';
import type { components } from '../../api';

type TaskDto = components['schemas']['Task'];
type ErrorDto = components['schemas']['Error'];
type TaskStatus = components['schemas']['TaskStatus'];

const VALID_STATUSES: readonly TaskStatus[] = ['Open', 'In process', 'Done'];

/** Validierte Task-Attribute, wie sie an das Sequelize-Modell übergeben werden. */
interface TaskAttributes {
	title?: string;
	status?: TaskStatus;
	priority?: number;
	estimatedEffort?: number;
	actualEffort?: number | null;
	description?: string | null;
	deadline?: Date | null;
	pillarId?: number | null;
}

type ValidationResult = { ok: true; attrs: TaskAttributes } | { ok: false; message: string };

const isTaskStatus = (value: unknown): value is TaskStatus =>
	typeof value === 'string' && VALID_STATUSES.some((status) => status === value);

/** Wandelt eine Task-Instanz in die im API-Vertrag definierte Form um. */
export const serializeTask = (task: Task): TaskDto => ({
	id: task.id,
	title: task.title,
	status: task.status,
	priority: task.priority,
	estimatedEffort: task.estimatedEffort,
	actualEffort: task.actualEffort ?? null,
	description: task.description ?? null,
	deadline: task.deadline ? task.deadline.toISOString() : null,
	pillarId: task.pillarId ?? null,
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
 * Validiert den Request-Body für Anlegen/Aktualisieren eines Tasks.
 * `requireTitle` erzwingt einen Titel (POST); bei PATCH sind alle Felder optional.
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
		if (typeof input.priority !== 'number' || !Number.isInteger(input.priority) || input.priority < 1) {
			return { ok: false, message: 'priority muss eine Ganzzahl >= 1 sein.' };
		}
		attrs.priority = input.priority;
	}

	if (input.estimatedEffort !== undefined) {
		if (
			typeof input.estimatedEffort !== 'number' ||
			!Number.isFinite(input.estimatedEffort) ||
			input.estimatedEffort < 0.1
		) {
			return { ok: false, message: 'estimatedEffort muss eine endliche Zahl >= 0.1 sein.' };
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

	if (input.pillarId !== undefined) {
		if (input.pillarId === null) {
			attrs.pillarId = null;
		} else if (typeof input.pillarId !== 'number' || !Number.isInteger(input.pillarId) || input.pillarId < 1) {
			return { ok: false, message: 'pillarId muss eine Ganzzahl >= 1 oder null sein.' };
		} else {
			attrs.pillarId = input.pillarId;
		}
	}

	return { ok: true, attrs };
};

/**
 * Prüft, ob die (gesetzte) Säulen-Zuordnung gültig ist. `null`/`undefined` sind erlaubt
 * (keine Säule). Eine gesetzte, aber nicht existierende `pillarId` ist ungültig — SQLite
 * erzwingt den Fremdschlüssel nicht selbst, daher hier explizit prüfen.
 */
const isPillarReferenceValid = async (pillarId: number | null | undefined): Promise<boolean> => {
	if (typeof pillarId !== 'number') {
		return true;
	}
	return (await Pillar.findByPk(pillarId)) !== null;
};

export const tasksRouter = Router();

// GET /tasks — alle Tasks auflisten
tasksRouter.get('/tasks', async (_req: Request, res: Response<TaskDto[] | ErrorDto>) => {
	try {
		const tasks = await Task.findAll();
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
	if (!(await isPillarReferenceValid(validation.attrs.pillarId))) {
		sendError(res, 400, 'pillarId verweist auf keine existierende Säule.');
		return;
	}
	try {
		const task = await Task.create({ ...validation.attrs });
		res.status(201).json(serializeTask(task));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// GET /tasks/:id — einen Task abrufen
tasksRouter.get('/tasks/:id', async (req: Request, res: Response<TaskDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const task = id === null ? null : await Task.findByPk(id);
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
	if (!(await isPillarReferenceValid(validation.attrs.pillarId))) {
		sendError(res, 400, 'pillarId verweist auf keine existierende Säule.');
		return;
	}
	try {
		await task.update(validation.attrs);
		res.json(serializeTask(task));
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
		res.status(201).json(serializeTask(dependentTask));
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
