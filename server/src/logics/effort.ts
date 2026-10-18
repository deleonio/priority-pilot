/**
 * Effort-Helfer (#2690) — eine Wahrheit für die Umrechnung von Stundenschätzungen in das
 * Tage-Feld `estimatedEffort`, geteilt von MCP-Werkzeug und Route.
 */

/**
 * Umrechnungsfaktor des Aufwandsfelds: `estimatedEffort` zählt in **Tagen** zu je 14 h regulärer
 * Wachzeit und läuft von 0.1 bis 1 (openapi.yml, Schema `Task.estimatedEffort`).
 */
export const HOURS_PER_EFFORT_DAY = 14;
export const MIN_EFFORT = 0.1;
export const MAX_EFFORT = 1;

/**
 * Rechnet eine Stundenschätzung in das Tage-Feld der API um. Das Kappen an den Rändern ist kein
 * Informationsverlust, sondern die Auflösung der Skala selbst: das Feld beginnt bei 0.1 Tagen
 * (~1,4 h) und endet bei einem Tag. Auf zwei Nachkommastellen gerundet (≙ ~8 min), damit in der
 * Aufwands-Spalte der Oberfläche keine 17-stellige Division steht.
 */
export const effortFromHours = (hours: unknown): number => {
	if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
		throw new Error('estimatedEffortHours must be a finite number > 0.');
	}
	const days = Math.round((hours / HOURS_PER_EFFORT_DAY) * 100) / 100;
	return Math.min(MAX_EFFORT, Math.max(MIN_EFFORT, days));
};
