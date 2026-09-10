import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import sequelize from '../../database.js';
import { Category, Series, Task } from '../../models/index.js';
import { CATEGORY_COLORS, isCategoryColor } from '../../models/categoryColors.js';
import type { components } from '../../api';
import { getUserId, ownerScope, requireAuth } from '../requireAuth.js';

type CategoryDto = components['schemas']['Category'];
type CategoryColorDto = components['schemas']['CategoryColor'];
type ErrorDto = components['schemas']['Error'];

/** Maximale Namenslänge (Spiegel von `models/category.ts` und `openapi.yml`). */
const NAME_MAX_LENGTH = 40;

/** Validierter Input für POST /categories. */
interface CreateCategoryInput {
	name: string;
	color: CategoryColorDto;
}

/** Validierter Input für PATCH /categories/:id. */
interface UpdateCategoryInput {
	name?: string;
	color?: CategoryColorDto;
}

/**
 * Compile-Zeit-Abgleich der Palette gegen den API-Vertrag: Weicht ein Wert in
 * `models/categoryColors.ts` vom `CategoryColor`-Enum in `openapi.yml` ab, schlägt hier die
 * Zuweisung fehl — sonst würde der Server eine dokumentierte Farbe erst zur Laufzeit mit 400
 * ablehnen (oder umgekehrt eine undokumentierte annehmen).
 */
const PALETTE: readonly CategoryColorDto[] = CATEGORY_COLORS;

/** Fehlermeldung bei ungültiger Farbe — nennt die erlaubten Werte, statt nur „ungültig" zu sagen. */
const COLOR_ERROR_MESSAGE = `color muss eine Farbe aus der Palette sein (${PALETTE.join(', ')}).`;

/** Wandelt eine Kategorie-Instanz in die im API-Vertrag definierte Form um. */
const serializeCategory = (category: Category): CategoryDto => ({
	id: category.id,
	name: category.name,
	// Die Spalte ist ein String; gültig sind nur Palettenwerte (Modell-Validierung + isCategoryColor),
	// und `PALETTE` sichert oben, dass die Palette dem Vertrags-Enum entspricht.
	color: category.color as CategoryColorDto,
});

/** Prüft einen Namen strukturell: nicht leer, höchstens {@link NAME_MAX_LENGTH} Zeichen. */
const validateName = (value: unknown): { ok: true; name: string } | { ok: false; message: string } => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return { ok: false, message: 'name muss ein nicht-leerer String sein.' };
	}
	const name = value.trim();
	if (name.length > NAME_MAX_LENGTH) {
		return { ok: false, message: `name darf höchstens ${NAME_MAX_LENGTH} Zeichen haben.` };
	}
	return { ok: true, name };
};

/** Validiert den Body von POST /categories: `{ name: string, color: <Palette> }`. */
const validateCreateBody = (
	body: unknown,
): { ok: true; input: CreateCategoryInput } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { name, color } = body as Record<string, unknown>;
	const validatedName = validateName(name);
	if (!validatedName.ok) {
		return validatedName;
	}
	if (!isCategoryColor(color)) {
		return { ok: false, message: COLOR_ERROR_MESSAGE };
	}
	return { ok: true, input: { name: validatedName.name, color } };
};

/**
 * Validiert den Body von PATCH /categories/:id: `{ name?: string, color?: <Palette> }`.
 * Mindestens eines der Felder muss gesetzt sein (Muster `validateUpdatePillarBody`).
 */
const validateUpdateBody = (
	body: unknown,
): { ok: true; input: UpdateCategoryInput } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { name, color } = body as Record<string, unknown>;
	if (name === undefined && color === undefined) {
		return { ok: false, message: 'Mindestens eines der Felder (name, color) muss gesetzt sein.' };
	}

	const input: UpdateCategoryInput = {};
	if (name !== undefined) {
		const validatedName = validateName(name);
		if (!validatedName.ok) {
			return validatedName;
		}
		input.name = validatedName.name;
	}
	if (color !== undefined) {
		if (!isCategoryColor(color)) {
			return { ok: false, message: COLOR_ERROR_MESSAGE };
		}
		input.color = color;
	}
	return { ok: true, input };
};

export const categoriesRouter = Router();

// Rate-Limit auf die Kategorie-CRUD-Endpunkte (CodeQL js/missing-rate-limiting), identisch zum
// Säulen-Limiter. Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
const categoriesLimiter = rateLimit({
	windowMs: 60_000,
	max: 120,
	standardHeaders: true,
	legacyHeaders: false,
	skip: () => process.env.NODE_ENV !== 'production',
});
categoriesRouter.use(categoriesLimiter);

// GET /categories — alle Kategorien des eingeloggten Nutzers auflisten.
categoriesRouter.get('/categories', requireAuth, async (req: Request, res: Response<CategoryDto[] | ErrorDto>) => {
	try {
		// `name ASC` macht die Antwort deterministisch, ist aber KEINE deutsche Sortierung: SQLite
		// vergleicht mit der BINARY-Kollation byteweise, Kleinschreibung landet hinter der
		// Großschreibung und Umlaute ganz am Ende. `COLLATE NOCASE` deckt davon nur den ASCII-Teil ab.
		// Die anzeigetaugliche Reihenfolge stellt der Client her (`frontend/src/lib/categories.ts`).
		const categories = await Category.findAll({
			where: ownerScope(getUserId(req)),
			order: [['name', 'ASC']],
		});
		res.json(categories.map(serializeCategory));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /categories — neue Kategorie anlegen. Der Name ist pro Nutzer eindeutig (409 bei Dublette).
categoriesRouter.post('/categories', requireAuth, async (req: Request, res: Response<CategoryDto | ErrorDto>) => {
	const validation = validateCreateBody(req.body);
	if (!validation.ok) {
		sendError(res, 400, validation.message);
		return;
	}
	const { name, color } = validation.input;

	try {
		const userId = getUserId(req);
		const existing = await Category.findOne({ where: { name, ...ownerScope(userId) } });
		if (existing) {
			sendError(res, 409, 'Eine Kategorie mit diesem Namen existiert bereits.');
			return;
		}

		const category = await Category.create({ name, color, userId: userId ?? null });
		res.status(201).json(serializeCategory(category));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PATCH /categories/:id — Name und/oder Farbe ändern. Fremde ID → 404 (nicht 403, damit die
// Existenz fremder Kategorien nicht preisgegeben wird; Muster PATCH /pillars/:id).
categoriesRouter.patch('/categories/:id', requireAuth, async (req: Request, res: Response<CategoryDto | ErrorDto>) => {
	const validation = validateUpdateBody(req.body);
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
		const category = await Category.findOne({ where: { id, ...ownerScope(userId) } });
		if (!category) {
			sendError(res, 404, 'Kategorie nicht gefunden.');
			return;
		}

		if (input.name !== undefined && input.name !== category.name) {
			const existing = await Category.findOne({ where: { name: input.name, ...ownerScope(userId) } });
			if (existing && existing.id !== id) {
				sendError(res, 409, 'Eine Kategorie mit diesem Namen existiert bereits.');
				return;
			}
		}

		await category.update(input);
		res.json(serializeCategory(category));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /categories/:id — Kategorie löschen. Anders als beim Löschen einer Säule gibt es nichts zu
// renormieren: Aufgaben und Serien behalten alles außer der Zuordnung, `categoryId` fällt auf null.
categoriesRouter.delete('/categories/:id', requireAuth, async (req: Request, res: Response<ErrorDto>) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id < 1) {
		sendError(res, 400, 'id muss eine Ganzzahl >= 1 sein.');
		return;
	}

	try {
		const userId = getUserId(req);
		const category = await Category.findOne({ where: { id, ...ownerScope(userId) } });
		if (!category) {
			sendError(res, 404, 'Kategorie nicht gefunden.');
			return;
		}

		await sequelize.transaction(async (transaction) => {
			// Zuordnungen lösen, BEVOR die Zeile verschwindet — sonst zeigten Aufgaben und Serien auf
			// eine nicht mehr existierende Kategorie und das Badge bliebe dauerhaft leer.
			await Task.update({ categoryId: null }, { where: { categoryId: id }, transaction });
			await Series.update({ categoryId: null }, { where: { categoryId: id }, transaction });
			await category.destroy({ transaction });
		});

		res.status(204).send();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
