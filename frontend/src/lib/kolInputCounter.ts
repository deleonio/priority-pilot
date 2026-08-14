/**
 * Issue #679: Zeichenzähler für KolInput basierend auf KolInputText/KolTextarea
 * Counter-Funktionalität für KolInput-Komponenten.
 * Wiederverwendet das Character-Counter Pattern aus titleLengthValidation.ts.
 */

/**
 * Gibt den Zeichen-Counter-String für KolInput zurück.
 * Basierend auf getCharacterCounter() aus titleLengthValidation.ts.
 *
 * @param input - Der aktuelle Input-Wert
 * @returns Counter-String mit der Zeichenanzahl (z.B. "5")
 */
export function getKolInputCounter(input: string): string {
	return `${input.length}`;
}
