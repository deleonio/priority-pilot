import type { OwnReassignPillarsStatus } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './apiError';

/**
 * Gemeinsame Lauf-Logik der Säulen-Neuberechnung (#1614) für das Nutzer-Modal
 * (`RecalcPillarModal`) und den Admin-Batch (`AdminUsersSection`).
 *
 * Beide Einstiege treiben einen portionierten Server-Lauf bis zum Ende und zeigen daraus den
 * Fortschritt. Die Schleife stand vorher zweimal im Code; der Admin-Batch blieb deshalb bei #1628
 * auf dem alten Stand (200 Aufgaben in einem Request, Anzeige „0 / 0“). Sie lebt jetzt nur hier.
 */

/**
 * Aufgaben je Server-Aufruf. Klein gehalten, weil jede Aufgabe einen LLM-Aufruf kostet: Der Balken
 * springt so alle paar Sekunden weiter, statt bis zum Ende eines einzigen langen Requests auf 0 zu
 * stehen, und kein Request läuft in einen Proxy-Timeout.
 */
const REASSIGN_BATCH_SIZE = 5;

/** Antwort einer Portion — gemeinsamer Nenner von Nutzer- und Admin-Endpunkt. */
interface ReassignPortion {
	updated: number;
	failed: number;
	skipped: number;
	remaining: number;
	quotaExhausted?: boolean;
	failureReasons?: Record<string, number>;
}

export interface ReassignPortionArgs {
	/** Nur die Fehlschläge dieser Serie: Erfolgreich verarbeitete fallen serverseitig aus der Auswahl. */
	offset: number;
	limit: number;
	/** Nur beim ersten Aufruf eines Neustarts `true`. */
	restart: boolean;
	signal: AbortSignal;
}

export interface ReassignRunState {
	phase: 'idle' | 'processing' | 'completed';
	/** Aufgaben der Auswahl insgesamt — erst nach dem ersten Aufruf bekannt (bis dahin 0). */
	total: number;
	processed: number;
	updated: number;
	failed: number;
	skipped: number;
	/** Lauf endete vorzeitig, weil das KI-Kontingent aufgebraucht ist. */
	quotaExhausted: boolean;
	/** Fehlergründe über alle Portionen, Grund → Anzahl. */
	failureReasons: Record<string, number>;
	error: string | null;
}

const IDLE: ReassignRunState = {
	phase: 'idle',
	total: 0,
	processed: 0,
	updated: 0,
	failed: 0,
	skipped: 0,
	quotaExhausted: false,
	failureReasons: {},
	error: null,
};

interface UseReassignRunOptions {
	runPortion: (args: ReassignPortionArgs) => Promise<ReassignPortion>;
	/** Stand des letzten Laufs; neue Identität (z. B. anderer Filter) lädt ihn neu. */
	loadStatus: () => Promise<OwnReassignPillarsStatus>;
	/** Nach einem Lauf, der mindestens eine Aufgabe neu zugeordnet hat. */
	onChanged?: () => void;
}

export const useReassignRun = ({ runPortion, loadStatus, onChanged }: UseReassignRunOptions) => {
	const [run, setRun] = useState<ReassignRunState>(IDLE);
	const [status, setStatus] = useState<OwnReassignPillarsStatus | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	// Aktuelle Callbacks, ohne dass ein laufender Lauf mit veralteten Closures weiterarbeitet.
	const runPortionRef = useRef(runPortion);
	const onChangedRef = useRef(onChanged);
	useEffect(() => {
		runPortionRef.current = runPortion;
		onChangedRef.current = onChanged;
	}, [runPortion, onChanged]);

	// Ein Fehler hier blockiert nichts: Ohne Stand gibt es eben nur den Neustart.
	const refreshStatus = useCallback(async (): Promise<void> => {
		try {
			setStatus(await loadStatus());
		} catch {
			setStatus(null);
		}
	}, [loadStatus]);

	useEffect(() => {
		void refreshStatus();
	}, [refreshStatus]);

	// Beim Unmount den laufenden Aufruf abbrechen, damit die Schleife nicht weiterläuft und keinen
	// Zustand einer ausgehängten Komponente mehr setzt.
	useEffect(() => () => abortRef.current?.abort(), []);

	const start = useCallback(
		async (restart: boolean): Promise<void> => {
			const controller = new AbortController();
			abortRef.current = controller;
			setRun({ ...IDLE, phase: 'processing' });

			let offset = 0;
			let first = true;
			let changed = false;
			const totals = { processed: 0, updated: 0, failed: 0, skipped: 0 };
			const failureReasons: Record<string, number> = {};

			const finish = (error: string | null): void => {
				setRun((prev) => ({ ...prev, phase: 'completed', error }));
				void refreshStatus();
				if (changed) {
					onChangedRef.current?.();
				}
			};

			for (;;) {
				let result: ReassignPortion;
				try {
					result = await runPortionRef.current({
						offset,
						limit: REASSIGN_BATCH_SIZE,
						restart: first && restart,
						signal: controller.signal,
					});
				} catch (reason) {
					if (controller.signal.aborted) {
						return;
					}
					finish((await toApiError(reason)).message);
					return;
				}
				if (controller.signal.aborted) {
					return;
				}
				first = false;

				const consumed = result.updated + result.failed + result.skipped;
				totals.processed += consumed;
				totals.updated += result.updated;
				totals.failed += result.failed;
				totals.skipped += result.skipped;
				for (const [reason, count] of Object.entries(result.failureReasons ?? {})) {
					failureReasons[reason] = (failureReasons[reason] ?? 0) + count;
				}
				offset += result.failed;
				changed = changed || result.updated > 0;

				setRun((prev) => ({
					...prev,
					...totals,
					total: totals.processed + result.remaining,
					failureReasons: { ...failureReasons },
					quotaExhausted: result.quotaExhausted ?? false,
				}));

				// `consumed === 0` bricht ab, auch wenn der Server noch Aufgaben meldet: sonst liefe die
				// Schleife endlos, falls eine Portion nichts mehr verarbeiten kann.
				if (result.remaining === 0 || result.quotaExhausted === true || consumed === 0) {
					finish(null);
					return;
				}
			}
		},
		[refreshStatus],
	);

	const abort = useCallback((): void => {
		abortRef.current?.abort();
	}, []);

	// Fortsetzen lohnt nur, wenn ein Lauf begann und nicht alle Aufgaben durch sind.
	const canResume = status !== null && status.startedAt !== null && status.pending > 0 && status.pending < status.total;

	return { run, status, canResume, start, abort };
};
