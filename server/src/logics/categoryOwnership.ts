import { Category } from '../models/index.js';

/**
 * Strukturelle Validierung des `categoryId`-Feldes von Task und Serie: eine Ganzzahl `>= 1` oder
 * `null` (= keine Kategorie). `undefined` bedeutet „Feld nicht gesetzt" und wird vom Aufrufer
 * behandelt (PATCH lässt die Zuordnung dann unverändert).
 */
export const validateCategoryId = (value: unknown): { ok: true; categoryId: number | null } | { ok: false } => {
	if (value === null) {
		return { ok: true, categoryId: null };
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		return { ok: false };
	}
	return { ok: true, categoryId: value };
};

/**
 * DB-gestützte Prüfung, ob die referenzierte Kategorie dem Konto gehört — das Gegenstück zu
 * {@link ../logics/pillarContributions.ts arePillarsExistent} für die 0..1-Beziehung. Kategorien
 * sind nutzer-eigen, deshalb ist der Kontobezug Pflichtparameter: `null` (Datensatz ohne
 * Eigentümer-Konto im Dev-Pass-Through) matcht nur Kategorien ohne `userId`. `null` als
 * `categoryId` (= keine Zuordnung) ist trivial `true`.
 */
export const isCategoryExistent = async (categoryId: number | null, userId: number | null): Promise<boolean> => {
	if (categoryId === null) {
		return true;
	}
	return (await Category.count({ where: { id: categoryId, userId } })) === 1;
};

/**
 * Sucht zu einer Kategorie des bisherigen Eigentümers die gleichnamige Kategorie des Empfängers
 * (Übergabe an ein Gruppenmitglied, Regel der Säulen-Übernahme #1252 AK6). Gibt es keine, ist das
 * Ergebnis `null` — der Datensatz verliert die Zuordnung, statt auf fremde Stammdaten zu zeigen.
 */
export const remapCategoryForRecipient = async (categoryId: number, recipientId: number): Promise<number | null> => {
	const source = await Category.findByPk(categoryId);
	if (!source) {
		return null;
	}
	const replacement = await Category.findOne({ where: { userId: recipientId, name: source.name } });
	return replacement?.id ?? null;
};
