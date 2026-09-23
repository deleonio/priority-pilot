/**
 * Hintergrundlauf der Säulen-Neuberechnung (#1642).
 *
 * Bis #1614 trieb das Frontend die Portionen selbst: jede Portion war ein eigener Request, und wer
 * Modal oder Seite verließ, hielt den Lauf an. Jetzt startet der POST den Lauf nur noch, dieses
 * Modul holt die Portionen serverseitig nacheinander ab und hält den Fortschritt für den
 * Status-Endpunkt bereit. Die Lauf-Sperre (`reassignLock.ts`) gibt es erst am Lauf-Ende frei —
 * auch bei Fehler oder erschöpftem Kontingent.
 *
 * In-Memory wie die Sperre: nach einem Serverneustart gilt der Lauf als beendet, der persistierte
 * Fortschritt bleibt und „Fortsetzen" setzt dort an.
 */

/** Aufgaben je Portion — der Fortschritt springt so alle paar Aufgaben weiter. */
export const BACKGROUND_PORTION_SIZE = 5;

/** Ergebnis einer Portion — gemeinsamer Nenner von Nutzer- und Admin-Lauf. */
export interface ReassignPortionResult {
	updated: number;
	failed: number;
	skipped: number;
	remaining: number;
	quotaExhausted?: boolean;
	failureReasons?: Record<string, number>;
}

interface ReassignRunResult {
	updated: number;
	failed: number;
	skipped: number;
	quotaExhausted: boolean;
	failureReasons?: Record<string, number>;
}

export interface ReassignRunState {
	running: boolean;
	/** In diesem Lauf abgeschlossene Aufgaben (`updated + failed + skipped`). */
	processed: number;
	/** Erst nach Lauf-Ende gesetzt. */
	result?: ReassignRunResult;
}

const runs = new Map<string, ReassignRunState>();

/** Stand des letzten Laufs unter `key`; `undefined`, wenn seit dem Prozessstart keiner lief. */
export const readBackgroundRun = (key: string): ReassignRunState | undefined => runs.get(key);

/**
 * Startet den Lauf, ohne auf ihn zu warten. `runPortion` erhält den Offset der Fehlschläge (erfolgreich
 * verarbeitete Aufgaben fallen serverseitig aus der Auswahl), `release` gibt die Sperre frei.
 */
export const startBackgroundRun = (
	key: string,
	runPortion: (offset: number) => Promise<ReassignPortionResult>,
	release: () => void,
): void => {
	const state: ReassignRunState = { running: true, processed: 0 };
	runs.set(key, state);
	const totals = { updated: 0, failed: 0, skipped: 0 };
	const failureReasons: Record<string, number> = {};
	let quotaExhausted = false;

	const loop = async (): Promise<void> => {
		let offset = 0;
		for (;;) {
			const portion = await runPortion(offset);
			const consumed = portion.updated + portion.failed + portion.skipped;
			totals.updated += portion.updated;
			totals.failed += portion.failed;
			totals.skipped += portion.skipped;
			for (const [reason, count] of Object.entries(portion.failureReasons ?? {})) {
				failureReasons[reason] = (failureReasons[reason] ?? 0) + count;
			}
			state.processed += consumed;
			offset += portion.failed;
			quotaExhausted = portion.quotaExhausted === true;
			// `consumed === 0` beendet auch bei gemeldetem Rest: sonst liefe die Schleife endlos,
			// falls eine Portion nichts mehr verarbeiten kann.
			if (portion.remaining === 0 || quotaExhausted || consumed === 0) {
				return;
			}
		}
	};

	void loop()
		.catch(() => {
			failureReasons['Interner Serverfehler'] = (failureReasons['Interner Serverfehler'] ?? 0) + 1;
		})
		.finally(() => {
			state.result = {
				...totals,
				quotaExhausted,
				...(Object.keys(failureReasons).length > 0 ? { failureReasons } : {}),
			};
			state.running = false;
			release();
		});
};
