/**
 * Geteilte Request-Validierung der Routen (#2691, Muster `pillarContributions.ts`): reine
 * Feld-Helfer ohne DB-Zugriff, die vorher dupliziert in `routes/tasks.ts`/`routes/series.ts`
 * (Body-Guard zusätzlich in weiteren Routen) standen. Die Meldungen sind wortgleich mit dem
 * Bestand — die Routen komponieren die Helfer in ihrer jeweiligen Prüfreihenfolge, damit die
 * Fehler-Präzedenz bei mehrfach ungültigem Body unverändert bleibt.
 */

import { istGueltigesDatum, zeitraumInTagen } from './balanceHistory.js';
import { MAX_EFFORT, MIN_EFFORT } from './effort.js';

/** Generischer Erfolgs-/Fehler-Kanal der Body-Validierung; der Erfolgs-Shape bleibt beim Aufrufer. */
export type ValidationResult<T extends { ok: true }> = T | { ok: false; message: string };

/** Rückgabeform der Feld-Helfer: normierter Wert oder wortgleiche Fehlermeldung. */
export type FieldResult<T> = ValidationResult<{ ok: true; value: T }>;

/**
 * Body-Objekt-Guard: der Request-Body muss ein Objekt sein. Mit `rejectArrays` werden zusätzlich
 * Arrays abgelehnt (Semantik von `llmProviders`/`pillarAdvisor`).
 */
export const validateRequestBody = (
	body: unknown,
	options: { rejectArrays?: boolean } = {},
): FieldResult<Record<string, unknown>> => {
	if (typeof body !== 'object' || body === null || (options.rejectArrays === true && Array.isArray(body))) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	return { ok: true, value: body as Record<string, unknown> };
};

/**
 * Titel: Trim; im Pflicht-Modus (`required`) ist ein Wert erforderlich. Der Typ-/Leer-Check läuft
 * vor dem Pflicht-Check, damit ein ungültiger Wert unabhängig vom Modus dieselbe Meldung liefert.
 * Overload: bei `required: true` ist der Erfolgswert garantiert ein String (nie undefined).
 */
export function validateTitle(value: unknown, required: true): FieldResult<string>;
export function validateTitle(value: unknown, required: boolean): FieldResult<string | undefined>;
export function validateTitle(value: unknown, required: boolean): FieldResult<string | undefined> {
	if (value !== undefined) {
		if (typeof value !== 'string' || value.trim() === '') {
			return { ok: false, message: 'title muss ein nicht-leerer String sein.' };
		}
		return { ok: true, value: value.trim() };
	}
	if (required) {
		return { ok: false, message: 'title ist erforderlich.' };
	}
	return { ok: true, value: undefined };
}

/** Priorität: Ganzzahl 1–5. */
export const validatePriority = (value: unknown): FieldResult<number> => {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
		return { ok: false, message: 'priority muss eine Ganzzahl zwischen 1 und 5 sein.' };
	}
	return { ok: true, value };
};

/** Geschätzter Aufwand: endliche Zahl 0.1–1. */
export const validateEstimatedEffort = (value: unknown): FieldResult<number> => {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_EFFORT || value > MAX_EFFORT) {
		return { ok: false, message: 'estimatedEffort muss eine Zahl zwischen 0.1 und 1 sein.' };
	}
	return { ok: true, value };
};

/** Beschreibung: String oder null. */
export const validateDescription = (value: unknown): FieldResult<string | null> => {
	if (value !== null && typeof value !== 'string') {
		return { ok: false, message: 'description muss ein String oder null sein.' };
	}
	return { ok: true, value };
};

/** Adresse: String (max. 255 Zeichen) oder null; Trim, Leer/Whitespace → null. */
export const validateAddress = (value: unknown): FieldResult<string | null> => {
	if (value !== null && (typeof value !== 'string' || value.length > 255)) {
		return { ok: false, message: 'address muss ein String (max. 255 Zeichen) oder null sein.' };
	}
	return { ok: true, value: value === null || value.trim() === '' ? null : value.trim() };
};

/**
 * Koordinaten-Paar (#1066): `latitude` −90/90, `longitude` −180/180. `null` auf einer Seite (oder
 * eine Einzel-Koordinate) leert BEIDE Werte paarweise zu null.
 */
export const validateCoordinates = (
	input: Record<string, unknown>,
): FieldResult<{ latitude: number | null; longitude: number | null }> => {
	if (
		input.latitude !== null &&
		input.latitude !== undefined &&
		(typeof input.latitude !== 'number' ||
			!Number.isFinite(input.latitude) ||
			input.latitude < -90 ||
			input.latitude > 90)
	) {
		return { ok: false, message: 'latitude muss eine Zahl zwischen -90 und 90 oder null sein.' };
	}
	if (
		input.longitude !== null &&
		input.longitude !== undefined &&
		(typeof input.longitude !== 'number' ||
			!Number.isFinite(input.longitude) ||
			input.longitude < -180 ||
			input.longitude > 180)
	) {
		return { ok: false, message: 'longitude muss eine Zahl zwischen -180 und 180 oder null sein.' };
	}
	const latitude = input.latitude ?? null;
	const longitude = input.longitude ?? null;
	return {
		ok: true,
		value: {
			latitude: latitude !== null && longitude !== null ? latitude : null,
			longitude: latitude !== null && longitude !== null ? longitude : null,
		},
	};
};

/**
 * ISO-Datumsfeld: `null` nur bei `allowNull` erlaubt; die Meldung folgt dem Feld (`deadline` mit
 * „oder null", `startDate` ohne) — als Wortliterale, damit der Dedup-Spiegel sie zuordnen kann.
 * Overload: bei `allowNull: false` ist der Erfolgswert garantiert ein Date (nie null).
 */
export function validateIsoDate(value: unknown, field: 'deadline' | 'startDate', allowNull: false): FieldResult<Date>;
export function validateIsoDate(
	value: unknown,
	field: 'deadline' | 'startDate',
	allowNull: boolean,
): FieldResult<Date | null>;
export function validateIsoDate(
	value: unknown,
	field: 'deadline' | 'startDate',
	allowNull: boolean,
): FieldResult<Date | null> {
	if (value === null && allowNull) {
		return { ok: true, value: null };
	}
	if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
		return {
			ok: false,
			message:
				field === 'deadline'
					? 'deadline muss ein gültiges ISO-Datum oder null sein.'
					: 'startDate muss ein gültiges ISO-Datum sein.',
		};
	}
	return { ok: true, value: new Date(value) };
}

/**
 * Query-Zeitraum `von`/`bis` (YYYY-MM-DD): Pflicht, existierende Daten, `bis` nicht vor `von`,
 * Dauer höchstens `maxTage` Tage. Ersetzt den wortgleichen Guard aus `routes/journal.ts` und
 * `routes/scores.ts`; die Meldungen bleiben identisch (API-Vertrag der 400er-Antworten).
 */
export const validateZeitraum = (
	query: Record<string, unknown>,
	maxTage: number,
): FieldResult<{ von: string; bis: string }> => {
	const { von, bis } = query;
	if (typeof von !== 'string' || typeof bis !== 'string') {
		return { ok: false, message: '"von" und "bis" sind Pflichtparameter (Format YYYY-MM-DD).' };
	}
	if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) {
		return { ok: false, message: '"von" und "bis" müssen ein existierendes Datum im Format YYYY-MM-DD angeben.' };
	}
	if (bis < von) {
		return { ok: false, message: '"bis" darf nicht vor "von" liegen.' };
	}
	if (zeitraumInTagen(von, bis) > maxTage) {
		return { ok: false, message: `Der Zeitraum darf höchstens ${maxTage} Tage umfassen.` };
	}
	return { ok: true, value: { von, bis } };
};
