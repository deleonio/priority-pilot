import express, { Router } from 'express';
import type { Request, Response } from 'express';
import type { components } from '../../api';
import { parseCsv } from '../../logics/csv.js';
import { Category, Pillar, Task, TaskPillar } from '../../models/index.js';
import { getUserId, ownerScope } from '../requireAuth.js';

type ErrorDto = components['schemas']['Error'];
type ImportInput = components['schemas']['TaskImportInput'];
type Mapping = NonNullable<ImportInput['mapping']>;
type PreviewDto = components['schemas']['TaskImportPreview'];
type ResultDto = components['schemas']['TaskImportResult'];

/** Grenzen (Spec `docs/spec/issue-1969.md`, AK5): geprüft VOR jeder Verarbeitung/Schreibzugriff. */
const MAX_CSV_LENGTH = 10 * 1024 * 1024;
const MAX_DATA_ROWS = 5000;
const MAX_TITLE_LENGTH = 65;

/**
 * Body-Parser der Import-Endpunkte (#1969): Das globale `express.json()` hängt am Default-Limit
 * von 100 KB und würde jeden realistischen CSV-Body als 413 abweisen. Bewusst einen Hauch über
 * der 10-MB-CSV-Grenze, damit übergroße Dateien als 400 mit verständlicher Meldung aus der Route
 * kommen (Spec: bewusst 400, nicht 413) — und bewusst auf `/tasks/import` gescoped, damit alle
 * übrigen Bodies beim knappen Default-Limit bleiben.
 */
export const taskImportBodyParser = express.json({ limit: '11mb' });

/** Todoist-Prioritäten (4 = höchste) auf die interne Skala 1–5 (5 = höchste) gemappt (AK1). */
const TODOIST_PRIORITY: Record<string, number> = { '1': 2, '2': 3, '3': 4, '4': 5 };

const DEFAULT_PRIORITY = 3;

interface PreparedRow {
	row: number;
	title: string;
	deadline: Date | null;
	priority: number;
	categoryId: number | null;
	pillarId: number | null;
}

interface RowError {
	row: number;
	reason: string;
}

interface UnmappedEntry {
	row: number;
	field: 'category' | 'pillar';
	value: string;
}

/** ISO-Datum (JJJJ-MM-TT) als UTC-Mitternacht — `null` bei ungültigem, `undefined` bei leerem Feld. */
const parseDeadline = (raw: string): Date | null | undefined => {
	if (raw === '') return undefined;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
	if (match === null) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	// Rundgang-Prüfung fängt Kalender-Unsinn wie 2026-13-45 ab (Date rollt sonst still über).
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		return null;
	}
	return date;
};

/** Spaltenindizes je Modus: mit `mapping` Allgemein-Spaltennamen, ohne Todoist-Auto-Erkennung. */
const resolveColumns = (header: string[], mapping: Mapping | undefined) => {
	if (mapping !== undefined) {
		const byName = (name: string | undefined): number =>
			name === undefined ? -1 : header.findIndex((column) => column === name.trim());
		return {
			todoist: false,
			type: -1,
			title: byName(mapping.title),
			deadline: byName(mapping.deadline),
			priority: byName(mapping.priority),
			category: byName(mapping.category),
			pillar: byName(mapping.pillar),
		};
	}
	const byTodoistName = (name: string): number =>
		header.findIndex((column) => column.toLowerCase() === name.toLowerCase());
	return {
		todoist: true,
		type: byTodoistName('TYPE'),
		title: byTodoistName('CONTENT'),
		deadline: byTodoistName('DATE'),
		priority: byTodoistName('PRIORITY'),
		category: -1,
		pillar: -1,
	};
};

/**
 * Parst und validiert den CSV-Body in übernehmbare Zeilen plus Fehler-/Unmapped-Listen. Gemeinsame
 * Basis beider Endpunkte — der Unterschied ist nur Schreibzugriff (Import) vs. reine Vorschau.
 * Grenzen (10 MB / 5000 Zeilen) sind VOR jedem Datenzugriff geprüft (AK5).
 */
const analyze = async (
	req: Request,
): Promise<{ ok: true; result: Awaited<ReturnType<typeof analyzeRows>> } | { ok: false; message: string }> => {
	const body = (req.body ?? {}) as { csv?: unknown; mapping?: unknown };
	if (typeof body.csv !== 'string' || body.csv.trim() === '') {
		return { ok: false, message: 'csv muss ein nicht-leerer String sein.' };
	}
	if (body.csv.length > MAX_CSV_LENGTH) {
		return { ok: false, message: 'Die CSV-Datei ist größer als 10 MB.' };
	}
	const mapping = typeof body.mapping === 'object' && body.mapping !== null ? (body.mapping as Mapping) : undefined;
	const rows = parseCsv(body.csv);
	if (rows.length === 0) {
		return { ok: false, message: 'Die CSV-Datei enthält keine Zeilen.' };
	}
	const [header, ...dataRows] = rows;
	if (dataRows.length > MAX_DATA_ROWS) {
		return { ok: false, message: 'Die CSV-Datei hat mehr als 5000 Datenzeilen.' };
	}

	const userId = getUserId(req);
	const [categories, pillars] = await Promise.all([
		Category.findAll({ where: ownerScope(userId) }),
		Pillar.findAll({ where: ownerScope(userId) }),
	]);
	const categoryByName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category.id]));
	const pillarByName = new Map(pillars.map((pillar) => [pillar.name.trim().toLowerCase(), pillar.id]));

	return { ok: true, result: await analyzeRows(dataRows, header, mapping, categoryByName, pillarByName) };
};

const analyzeRows = async (
	dataRows: string[][],
	header: string[],
	mapping: Mapping | undefined,
	categoryByName: Map<string, number>,
	pillarByName: Map<string, number>,
): Promise<{
	prepared: PreparedRow[];
	errors: RowError[];
	unmapped: UnmappedEntry[];
	skippedNonTask: number;
	columns: string[];
}> => {
	const columns = resolveColumns(
		header.map((column) => column.trim()),
		mapping,
	);
	const prepared: PreparedRow[] = [];
	const errors: RowError[] = [];
	const unmapped: UnmappedEntry[] = [];
	let skippedNonTask = 0;

	dataRows.forEach((cells, index) => {
		const row = index + 1;
		const cell = (column: number): string => (column >= 0 && column < cells.length ? cells[column].trim() : '');

		// Todoist-Modus: nur TYPE=task-Zeilen sind Aufgaben, alles andere (z. B. note) zählt als
		// übersprungen — ohne Fehler, ohne Beispiel (AK1/AK2).
		if (columns.todoist && cell(columns.type).toLowerCase() !== 'task') {
			skippedNonTask++;
			return;
		}

		const title = cell(columns.title);
		if (title === '') {
			errors.push({ row, reason: 'Titel fehlt.' });
			return;
		}
		if (title.length > MAX_TITLE_LENGTH) {
			errors.push({ row, reason: `Titel ist mit ${title.length} Zeichen länger als ${MAX_TITLE_LENGTH}.` });
			return;
		}

		const priorityRaw = cell(columns.priority);
		let priority = DEFAULT_PRIORITY;
		if (priorityRaw !== '') {
			const mapped = columns.todoist ? TODOIST_PRIORITY[priorityRaw] : undefined;
			const direct = !columns.todoist && /^\d+$/.test(priorityRaw) ? Number(priorityRaw) : undefined;
			const value = mapped ?? (direct !== undefined && direct >= 1 && direct <= 5 ? direct : undefined);
			if (value === undefined) {
				errors.push({ row, reason: `Priorität "${priorityRaw}" ist ungültig.` });
				return;
			}
			priority = value;
		}

		const deadline = parseDeadline(cell(columns.deadline));
		if (deadline === null) {
			errors.push({ row, reason: 'Datum ist ungültig (erwartet JJJJ-MM-TT).' });
			return;
		}

		const categoryRaw = cell(columns.category);
		let categoryId: number | null = null;
		if (categoryRaw !== '') {
			categoryId = categoryByName.get(categoryRaw.toLowerCase()) ?? null;
			if (categoryId === null) unmapped.push({ row, field: 'category', value: categoryRaw });
		}
		const pillarRaw = cell(columns.pillar);
		let pillarId: number | null = null;
		if (pillarRaw !== '') {
			pillarId = pillarByName.get(pillarRaw.toLowerCase()) ?? null;
			if (pillarId === null) unmapped.push({ row, field: 'pillar', value: pillarRaw });
		}

		prepared.push({ row, title, deadline: deadline ?? null, priority, categoryId, pillarId });
	});

	return { prepared, errors, unmapped, skippedNonTask, columns: header.map((column) => column.trim()) };
};

/**
 * CSV-Import zweistufig (#1969): `POST /tasks/import/preview` validiert ohne Schreibzugriff,
 * `POST /tasks/import` legt die übernehmbaren Zeilen als Aufgaben des eingeloggten Nutzers an
 * (Kategorie-/Säulen-Zuordnung nur gegen Bestand per Name-Match). Der Body-Parser mit erhöhtem
 * Limit wird separat in `express/index.ts` früh gemountet (siehe `taskImportBodyParser`).
 */
export const createTaskImportRouter = (): Router => {
	const router = Router();

	router.post('/tasks/import/preview', async (req: Request, res: Response<PreviewDto | ErrorDto>) => {
		const analysis = await analyze(req);
		if (!analysis.ok) {
			res.status(400).json({ message: analysis.message });
			return;
		}
		const { prepared, errors, unmapped, skippedNonTask, columns } = analysis.result;
		res.json({
			total: analysis.result.prepared.length + errors.length + skippedNonTask,
			valid: prepared.length,
			skippedNonTask,
			samples: prepared.slice(0, 5).map((task) => ({
				row: task.row,
				title: task.title,
				deadline: task.deadline === null ? null : task.deadline.toISOString(),
				priority: task.priority,
			})),
			errors,
			unmapped,
			columns,
		});
	});

	router.post('/tasks/import', async (req: Request, res: Response<ResultDto | ErrorDto>) => {
		const analysis = await analyze(req);
		if (!analysis.ok) {
			res.status(400).json({ message: analysis.message });
			return;
		}
		const { prepared, errors, skippedNonTask } = analysis.result;
		if (prepared.length === 0) {
			res.status(400).json({ message: 'Die CSV-Datei enthält keine übernehmbaren Zeilen.' });
			return;
		}

		const userId = getUserId(req);
		for (const task of prepared) {
			const created = await Task.create({
				title: task.title,
				priority: task.priority,
				deadline: task.deadline,
				categoryId: task.categoryId,
				userId,
			});
			// Genau eine Säule mit vollem Anteil (AK4) — direkt am Join-Modell, wie routes/tasks.ts.
			if (task.pillarId !== null) {
				await TaskPillar.create({ taskId: created.id, pillarId: task.pillarId, share: 100, confidence: 100 });
			}
		}

		res.json({ created: prepared.length, skippedNonTask, errors });
	});

	return router;
};
