import { Router } from 'express';
import type { Request, Response } from 'express';
import { Transaction, ValidationError as SequelizeValidationError } from 'sequelize';
import sequelize from '../../database.js';
import { Pillar, Series, SeriesPillar } from '../../models/index.js';
import type { SeriesRhythm } from '../../models/series.js';
import { generateDueInstances, materializeDueSeries } from '../../logics/series.js';
import { arePillarsExistent, validatePillars, type PillarContribution } from '../../logics/pillarContributions.js';
import { getUserId } from '../requireAuth.js';
import { serializeTask } from './tasks.js';
import type { components } from '../../api';

type SeriesDto = components['schemas']['Series'];
type TaskDto = components['schemas']['Task'];
type SeriesGenerateAllResultDto = components['schemas']['SeriesGenerateAllResult'];
type ErrorDto = components['schemas']['Error'];

const VALID_RHYTHMS: readonly SeriesRhythm[] = [
	'daily',
	'weekly',
	'monthly',
	'weekdays',
	'weekend',
	'mon',
	'tue',
	'wed',
	'thu',
	'fri',
	'sat',
	'sun',
];

/**
 * Ziel-UTC-Wochentag je `mon`…`sun`-Rhythmus (0=So … 6=Sa). `undefined` für alle anderen Rhythmen,
 * die keinen festen Wochentag implizieren (`daily`/`weekly`/`monthly`/`weekdays`/`weekend`).
 *
 * Wird benutzt, um sicherzustellen, dass bei `mon`…`sun` das `startDate` tatsächlich auf dem
 * benannten Wochentag liegt — sonst würde `nextOccurrence` (das schlicht +7 Tage addiert) die
 * Termine auf den Wochentag des Start-Datums legen, nicht auf den suggerierten Namen.
 */
const RHYTHM_WEEKDAY: ReadonlyMap<SeriesRhythm, number> = new Map([
	['sun', 0],
	['mon', 1],
	['tue', 2],
	['wed', 3],
	['thu', 4],
	['fri', 5],
	['sat', 6],
]);

/**
 * Produktpolicy: maximale Vorlauf-Horizont in Tagen, den `/series/generate-all`
 * materialisiert. Verhindert, dass bei jedem Cron-Lauf ein unbegrenztes Fenster
 * erzeugt wird — es wird nur bis "heute + N Tage" vorlaufend angelegt.
 */
const GENERATE_HORIZON_DAYS = 30;

/** Validierte Template-Attribute, wie sie an das Sequelize-Modell übergeben werden. */
interface SeriesAttributes {
	title?: string;
	rhythm?: SeriesRhythm;
	priority?: number;
	estimatedEffort?: number;
	active?: boolean;
	startDate?: Date;
	description?: string | null;
	autoDeleteAfterDeadline?: boolean;
}

type ValidationResult =
	{ ok: true; attrs: SeriesAttributes; pillars: PillarContribution[] | undefined } | { ok: false; message: string };

const isRhythm = (value: unknown): value is SeriesRhythm =>
	typeof value === 'string' && VALID_RHYTHMS.some((rhythm) => rhythm === value);

const sendError = (res: Response<ErrorDto>, status: number, message: string): void => {
	res.status(status).json({ message });
};

/** Übersetzt Schreibfehler in passende HTTP-Statuscodes (400 bei Validierung, sonst 500). */
const handleWriteError = (res: Response<ErrorDto>, error: unknown): void => {
	if (error instanceof SequelizeValidationError) {
		sendError(res, 400, error.errors.map((item) => item.message).join('; '));
		return;
	}
	console.error('Unerwarteter Fehler in Series-Route:', error);
	sendError(res, 500, 'Interner Serverfehler.');
};

/** Pfad-Parameter als positive Ganzzahl parsen; sonst `null`. */
const parseId = (raw: string | string[]): number | null => {
	const id = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Wandelt ein Serien-Template in die im API-Vertrag definierte Form um. Die Säulen-Vorlage stammt
 * aus der **eager-geladenen** Assoziation `series.Pillars` (`include: [Pillar]`); fehlt sie, gilt
 * „keine Säulen". Die Beiträge sind nach `pillarId` sortiert (deterministische Reihenfolge).
 */
const serializeSeries = (series: Series): SeriesDto => ({
	id: series.id,
	title: series.title,
	rhythm: series.rhythm,
	priority: series.priority,
	estimatedEffort: series.estimatedEffort,
	active: series.active,
	startDate: series.startDate.toISOString(),
	description: series.description ?? null,
	autoDeleteAfterDeadline: series.autoDeleteAfterDeadline ?? false,
	pillars: (series.Pillars ?? [])
		.map((pillar) => ({
			pillarId: pillar.id,
			share: pillar.SeriesPillar.share,
			confidence: pillar.SeriesPillar.confidence,
		}))
		.sort((a, b) => a.pillarId - b.pillarId),
});

/**
 * Validiert den Request-Body für Anlegen/Aktualisieren eines Templates. `isPost` signalisiert
 * einen POST-Request (erzwingt title + startDate als Pflichtfelder); bei einer Teil-Aktualisierung sind alle Felder optional.
 *
 * `existing` (nur bei PATCH gesetzt) liefert die in der DB gespeicherten `rhythm`/`startDate`-Werte,
 * damit die Wochentag-Konsistenz-Prüfung auch bei einem Teil-PATCH greift, der nur eines der beiden
 * Felder enthält (z. B. nur `rhythm` oder nur `startDate`): die Prüfung bildet dann die effektiven
 * Werte (`gesendet ?? gespeichert`) und verhindert so eine inkonsistente Kombination.
 */
const validateSeriesFields = (
	body: unknown,
	isPost: boolean,
	existing?: Pick<Series, 'rhythm' | 'startDate'>,
): ValidationResult => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const input = body as Record<string, unknown>;
	const attrs: SeriesAttributes = {};

	if (input.title !== undefined) {
		if (typeof input.title !== 'string' || input.title.trim() === '') {
			return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
		}
		attrs.title = input.title.trim();
	}
	if (isPost && attrs.title === undefined) {
		return { ok: false, message: 'title ist erforderlich.' };
	}

	if (input.rhythm !== undefined) {
		if (!isRhythm(input.rhythm)) {
			return {
				ok: false,
				message:
					'rhythm muss "daily", "weekly", "monthly", "weekdays", "weekend", "mon", "tue", "wed", "thu", "fri", "sat" oder "sun" sein.',
			};
		}
		attrs.rhythm = input.rhythm;
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
	if (isPost && attrs.priority === undefined) {
		return { ok: false, message: 'priority ist erforderlich.' };
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
	if (isPost && attrs.estimatedEffort === undefined) {
		return { ok: false, message: 'estimatedEffort ist erforderlich.' };
	}

	if (input.active !== undefined) {
		if (typeof input.active !== 'boolean') {
			return { ok: false, message: 'active muss ein Boolean sein.' };
		}
		attrs.active = input.active;
	}

	if (input.startDate !== undefined) {
		if (typeof input.startDate !== 'string' || Number.isNaN(Date.parse(input.startDate))) {
			return { ok: false, message: 'startDate muss ein gültiges ISO-Datum sein.' };
		}
		attrs.startDate = new Date(input.startDate);
	}
	if (isPost && attrs.startDate === undefined) {
		return { ok: false, message: 'startDate ist erforderlich.' };
	}

	if (input.description !== undefined) {
		if (input.description !== null && typeof input.description !== 'string') {
			return { ok: false, message: 'description muss ein String oder null sein.' };
		}
		attrs.description = input.description;
	}

	if (input.autoDeleteAfterDeadline !== undefined) {
		if (typeof input.autoDeleteAfterDeadline !== 'boolean') {
			return { ok: false, message: 'autoDeleteAfterDeadline muss ein Boolean sein.' };
		}
		attrs.autoDeleteAfterDeadline = input.autoDeleteAfterDeadline;
	}

	// Konsistenz-Prüfung für wochentag-basierte Rhythmen (`mon`…`sun`): der Rhythmus-Name
	// suggeriert einen festen Wochentag. Da `nextOccurrence` für diese Rhythmen schlicht +7 Tage
	// addiert (Anker liegt „definitionsgemäß" auf dem Tag), würde ein `startDate` auf einem
	// *anderen* Wochentag die Termine stillschweigend auf den falschen Tag legen — der Name
	// bestimmte dann nicht den Wochentag. Wir lehnen diese Kombination daher explizit ab (400),
	// statt eine irreführende Serie zu speichern.
	//
	// Bei POST sind beide Felder Pflicht. Bei PATCH kann nur eines der beiden gesendet werden;
	// in dem Fall ziehen wir den jeweils anderen Wert aus der bestehenden DB-Instanz (`existing`),
	// damit auch ein Teil-PATCH keine inkonsistente Kombination hinterlässt (z. B. nur
	// `rhythm: "wed"` auf einer Serie mit `startDate`=Montag).
	const effRhythm = attrs.rhythm ?? existing?.rhythm;
	const effStartDate = attrs.startDate ?? existing?.startDate;
	const targetWeekday = effRhythm !== undefined ? RHYTHM_WEEKDAY.get(effRhythm) : undefined;
	if (targetWeekday !== undefined && effStartDate !== undefined) {
		if (effStartDate.getUTCDay() !== targetWeekday) {
			const weekdayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
			return {
				ok: false,
				message: `rhythm "${effRhythm}" erfordert ein startDate an einem ${weekdayNames[targetWeekday]}.`,
			};
		}
	}

	let pillars: PillarContribution[] | undefined;
	if (input.pillars !== undefined) {
		if (!Array.isArray(input.pillars)) {
			return { ok: false, message: 'pillars muss eine Liste sein.' };
		}
		const result = validatePillars(input.pillars);
		if (!result.ok) {
			return { ok: false, message: 'pillars ist ungültig (Beiträge, Summe der share oder Duplikate).' };
		}
		pillars = result.pillars;
	}

	return { ok: true, attrs, pillars };
};

/** Lädt ein Serien-Template inkl. seiner Säulen-Vorlage (für die Serialisierung). */
const findSeriesWithPillars = (id: number): Promise<Series | null> => Series.findByPk(id, { include: [Pillar] });

/** Schreibt die Säulen-Vorlage einer Serie neu (ersetzt vorhandene) — innerhalb einer Transaktion. */
const replaceContributions = (
	seriesId: number,
	pillars: PillarContribution[],
	transaction: Transaction,
): Promise<unknown> =>
	SeriesPillar.bulkCreate(
		pillars.map((entry) => ({
			seriesId,
			pillarId: entry.pillarId,
			share: entry.share,
			confidence: entry.confidence,
		})),
		{ transaction, validate: true },
	);

export const seriesRouter = Router();

// GET /series — alle Serien-Templates auflisten
seriesRouter.get('/series', async (_req: Request, res: Response<SeriesDto[] | ErrorDto>) => {
	try {
		const all = await Series.findAll({ order: [['id', 'ASC']], include: [Pillar] });
		res.json(all.map(serializeSeries));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series — neues Serien-Template anlegen
seriesRouter.post('/series', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const validation = validateSeriesFields(req.body, true);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (
		validation.pillars !== undefined &&
		!(await arePillarsExistent(validation.pillars.map((entry) => entry.pillarId)))
	) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		const created = await sequelize.transaction(async (transaction) => {
			const series = await Series.create({ ...validation.attrs, userId: getUserId(req) ?? null }, { transaction });
			if (validation.pillars !== undefined && validation.pillars.length > 0) {
				await replaceContributions(series.id, validation.pillars, transaction);
			}
			return series;
		});
		const withPillars = await findSeriesWithPillars(created.id);
		if (!withPillars) {
			sendError(res, 500, 'Interner Serverfehler.');
			return;
		}
		res.status(201).json(serializeSeries(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series/generate-all — fällige Instanzen aller aktiven Serien materialisieren (idempotent).
// MUSS vor den `/series/:id`-Routen stehen, damit `generate-all` nicht als `:id` gematcht wird.
seriesRouter.post(
	'/series/generate-all',
	async (req: Request, res: Response<SeriesGenerateAllResultDto | ErrorDto>) => {
		const userId = getUserId(req);
		try {
			const until = new Date();
			until.setUTCDate(until.getUTCDate() + GENERATE_HORIZON_DAYS);
			const created = await materializeDueSeries(userId, until);
			res.json({ created: created.length });
		} catch (error) {
			handleWriteError(res, error);
		}
	},
);

// GET /series/:id — ein Serien-Template abrufen
seriesRouter.get('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await findSeriesWithPillars(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	res.json(serializeSeries(series));
});

// PATCH /series/:id — ein Serien-Template teilweise aktualisieren (gilt nur für künftige Instanzen)
seriesRouter.patch('/series/:id', async (req: Request, res: Response<SeriesDto | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id, { include: [Pillar] });
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const validation = validateSeriesFields(req.body, false, series);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	if (
		validation.pillars !== undefined &&
		!(await arePillarsExistent(validation.pillars.map((entry) => entry.pillarId)))
	) {
		sendError(res, 400, 'pillars verweist auf eine nicht existierende Säule.');
		return;
	}
	try {
		await sequelize.transaction(async (transaction) => {
			await series.update(validation.attrs, { transaction });
			// `pillars` fehlt → Vorlage unverändert lassen; gesetzt (auch `[]`) → komplett ersetzen.
			if (validation.pillars !== undefined) {
				await SeriesPillar.destroy({ where: { seriesId: series.id }, transaction });
				if (validation.pillars.length > 0) {
					await replaceContributions(series.id, validation.pillars, transaction);
				}
			}
		});
		const withPillars = await findSeriesWithPillars(series.id);
		if (!withPillars) {
			sendError(res, 404, 'Serie nicht gefunden.');
			return;
		}
		res.json(serializeSeries(withPillars));
	} catch (error) {
		handleWriteError(res, error);
	}
});

// DELETE /series/:id — ein Serien-Template löschen
seriesRouter.delete('/series/:id', async (req: Request, res: Response<ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	try {
		await series.destroy();
		res.status(204).send();
	} catch (error) {
		handleWriteError(res, error);
	}
});

// POST /series/:id/generate — fällige Instanzen bis `until` materialisieren (idempotent)
seriesRouter.post('/series/:id/generate', async (req: Request, res: Response<TaskDto[] | ErrorDto>) => {
	const id = parseId(req.params.id);
	const series = id === null ? null : await Series.findByPk(id);
	if (!series) {
		sendError(res, 404, 'Serie nicht gefunden.');
		return;
	}
	const body: unknown = req.body;
	if (typeof body !== 'object' || body === null) {
		sendError(res, 400, 'Request-Body muss ein Objekt sein.');
		return;
	}
	const until = (body as Record<string, unknown>).until;
	if (typeof until !== 'string' || Number.isNaN(Date.parse(until))) {
		sendError(res, 400, 'until muss ein gültiges ISO-Datum sein.');
		return;
	}
	try {
		const instances = await generateDueInstances(series, { until: new Date(until) });
		res.status(201).json(instances.map(serializeTask));
	} catch (error) {
		handleWriteError(res, error);
	}
});
