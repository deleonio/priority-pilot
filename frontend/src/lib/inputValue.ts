/**
 * Hilfsfunktionen, um die als `unknown` typisierten Werte der KoliBri-Eingabe-Callbacks
 * (`_on.onInput`/`_on.onChange`) robust in String bzw. Zahl zu überführen.
 */

/**
 * Liest einen KoliBri-Eventwert als String (leerer String bei `null`/`undefined`).
 * `KolSingleSelect` liefert beim Klick auf den eingebauten Clear-Button `{ value: null }`
 * statt `null` — solche Objekte werden vor dem Stringifizieren einmal entpackt, damit daraus
 * nicht `"[object Object]"` wird.
 */
export const readString = (value: unknown): string => {
	if (typeof value === 'string') {
		return value;
	}
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'object' && 'value' in value) {
		return readString((value as { value: unknown }).value);
	}
	return String(value);
};

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
