/**
 * Hilfsfunktionen, um die als `unknown` typisierten Werte der KoliBri-Eingabe-Callbacks
 * (`_on.onInput`/`_on.onChange`) robust in String bzw. Zahl zu überführen.
 */

/** Liest einen KoliBri-Eventwert als String (leerer String bei `null`/`undefined`). */
export const readString = (value: unknown): string =>
	typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

/** Liest einen KoliBri-Eventwert als endliche Zahl oder `null`, falls leer/ungültig. */
export const readNumber = (value: unknown): number | null => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};
