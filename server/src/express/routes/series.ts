import { Router } from 'express';
import type { Request, Response } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import { Series } from '../../models/index.js';
import { generateDueInstances } from '../../logics/series.js';
import type { components } from '../../api';

type SeriesDto = components['schemas']['Series'];
type SeriesGenerateResultDto = components['schemas']['SeriesGenerateResult'];
type ErrorDto = components['schemas']['Error'];

/** Im Vertrag erlaubte Wiederholungsfrequenzen. */
const VALID_FREQUENCIES = ['DAILY', 'WEEKLY'] as const;
type SeriesFrequency = (typeof VALID_FREQUENCIES)[number];

/** Validierte Serien-Attribute (Spalten), wie sie an das Sequelize-Modell übergeben werden. */
interface SeriesAttributes {
	frequency?: SeriesFrequency;
	interval?: number;
	byWeekday?: number[] | null;
	startDate?: string;
	defaultPriority?: number;
	active?: boolean;
}

type ValidationResult = { ok: true; attrs: SeriesAttributes } | { ok: false; message: string };

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

const isFrequency = (value: unknown): value is SeriesFrequency =>
	typeof value === 'string' && VALID_FREQUENCIES.some((frequency) => frequency === value);

/** Validiert `byWeekday` strukturell: Liste ganzzahliger Wochentage 0–6 (oder `null`). */
const validateByWeekday = (raw: unknown): { ok: true; value: number[] | null } | { ok: false; message: string } => {
	if (raw === null) {
		return { ok: true, value: null };
	}
	if (!Array.isArray(raw)) {
		return { ok: false, message: 'byWeekday muss eine Liste von Wochentagen (0–6) oder null sein.' };
	}
	for (const tag of raw) {
		if (typeof tag !== 'number' || !Number.isInteger(tag) || tag < 0 || tag > 6) {
			return { ok: false, message: 'byWeekday-Einträge müssen Ganzzahlen zwischen 0 und 6 sein.' };
		}
	}
	return { ok: true, value: raw as number[] };
};

/**
 * Validiert den Request-Body für Anlegen/Aktualisieren einer Serie. `requireCore` erzwingt die
 * Pflichtfelder `frequency` und `startDate` (POST); bei PATCH sind alle Felder optional.
 */
const validateSeriesFields = (body: unknown, requireCore: boolean): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const input = body as Record<string, unknown>;
	const attrs: SeriesAttributes = {};

	if (input.frequency !== undefined) {
		if (!isFrequency(input.frequency)) {
			return { ok: false, message: 'frequency muss "DAILY" oder "WEEKLY" sein.' };
		}
		attrs.frequency = input.frequency;
	} else if (requireCore) {
		return { ok: false, message: 'frequency ist erforderlich.' };
	}

	if (input.interval !== undefined) {
		if (typeof input.interval !== 'number' || !Number.isInteger(input.interval) || input.interval < 1) {
			return { ok: false, message: 'interval muss eine Ganzzahl >= 1 sein.' };
		}
		attrs.interval = input.interval;
	}

	if (input.byWeekday !== undefined) {
		const result = validateByWeekday(input.byWeekday);
		if (!result.ok) {
			return result;
		}
		attrs.byWeekday = result.value;
	}

	if (input.startDate !== undefined) {
		if (typeof input.startDate !== 'string' || Number.isNaN(Date.parse(input.startDate))) {
			return { ok: false, message: 'startDate muss ein gültiges Datum sein.' };
		}
		attrs.startDate = input.startDate;
	} else if (requireCore) {
		return { ok: false, message: 'startDate ist erforderlich.' };
	}

	if (input.defaultPriority !== undefined) {
		if (
			typeof input.defaultPriority !== 'number' ||
			!Number.isInteger(input.defaultPriority) ||
			input.defaultPriority < 1 ||
			input.defaultPriority > 5
		) {
			return { ok: false, message: 'defaultPriority muss eine Ganzzahl zwischen 1 und 5 sein.' };
		}
		attrs.defaultPriority = input.defaultPriority;
	}

	if (input.active !== undefined) {
		if (typeof input.active !== 'boolean') {
			return { ok: false, message: 'active muss ein Boolean sein.' };
		}
		attrs.active = input.active;
	}

	return { ok: true, attrs };
};

/** Wandelt eine Serien-Instanz in die im API-Vertrag definierte Form um. */
export const serializeSeries = (series: Series): SeriesDto => ({
	id: series.id,
	frequency: series.frequency,
	interval: series.interval,
	byWeekday: series.byWeekday ?? null,
	startDate: series.startDate,
	defaultPriority: series.defaultPriority,
	active: series.active,
});

export const seriesRouter = Router();

// GET /series — alle Serien-Vorlagen auflisten
seriesRouter.get('/series', async (_req: Request, res: Response<SeriesDto[] | ErrorDto>) => {
	try {
		const all = await Series.findAll();
		res.json(all.map(serializeSeries));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series — neue Serien-Vorlage anlegen
seriesRouter.post('/series', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const validation = validateSeriesFields(req.body, true);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	try {
		const created = await Series.create({ ...validation.attrs });
		res.status(201).json(serializeSeries(created));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// GET /series/:id — eine Serien-Vorlage abrufen
seriesRouter.get('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	res.json(serializeSeries(series));
});

// PATCH /series/:id — eine Serien-Vorlage teilweise aktualisieren
seriesRouter.patch('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const validation = validateSeriesFields(req.body, false);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	try {
		await series.update(validation.attrs);
		res.json(serializeSeries(series));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// DELETE /series/:id — eine Serien-Vorlage löschen
seriesRouter.delete('/series/:id', async (req: Request, res: Response<ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	await series.destroy();
	res.status(204).send();
});

// POST /series/:id/generate — fällige Instanzen im Horizont materialisieren (idempotent)
seriesRouter.post('/series/:id/generate', async (req: Request, res: Response<SeriesGenerateResultDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	try {
		const created = await generateDueInstances(series, new Date());
		res.status(201).json({ generated: created.length });
	} catch (error) {
		handleWriteError(res, error);
	}
});
