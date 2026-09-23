import type { OwnReassignPillarsStatus } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError } from './apiError';

/**
 * Gemeinsame Lauf-Logik der Säulen-Neuberechnung (#1614) für das Nutzer-Modal
 * (`RecalcPillarModal`) und den Admin-Batch (`AdminUsersSection`).
 *
 * Seit #1642 läuft die Neuberechnung als Hintergrundlauf auf dem Server: `start` stößt ihn nur an,
 * danach fragt der Hook den Status ab, bis `running: false` gemeldet wird. Schließen oder Navigieren
 * bricht deshalb nichts mehr ab, und ein beim Mount schon laufender Lauf wird ohne Klick weiterverfolgt.
 */

/** Abstand der Status-Abfragen, solange der Server-Lauf unterwegs ist. */
const POLL_INTERVAL_MS = 1500;

export interface ReassignPortionArgs {
	/** `true` beginnt den Lauf neu, sonst setzt er den letzten fort. */
	restart: boolean;
}

export interface ReassignRunState {
	phase: 'idle' | 'processing' | 'completed';
	/** Aufgaben des Laufs insgesamt — erst nach der ersten Status-Abfrage bekannt (bis dahin 0). */
	total: number;
	processed: number;
	updated: number;
	failed: number;
	skipped: number;
	/** Lauf endete vorzeitig, weil das KI-Kontingent aufgebraucht ist. */
	quotaExhausted: boolean;
	/** Fehlergründe des Laufs, Grund → Anzahl. */
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
	/** Startet den Server-Lauf. */
	runPortion: (args: ReassignPortionArgs) => Promise<unknown>;
	/** Stand des letzten Laufs; neue Identität (z. B. anderer Filter) lädt ihn neu. */
	loadStatus: () => Promise<OwnReassignPillarsStatus>;
	/** Nach einem Lauf, der mindestens eine Aufgabe neu zugeordnet hat. */
	onChanged?: () => void;
}

export const useReassignRun = ({ runPortion, loadStatus, onChanged }: UseReassignRunOptions) => {
	const [run, setRun] = useState<ReassignRunState>(IDLE);
	const [status, setStatus] = useState<OwnReassignPillarsStatus | null>(null);
	// `true`, sobald dieser Hook einen Lauf begleitet — nur dann wird `running: false` zum Abschluss.
	const trackingRef = useRef(false);
	const pollRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	// Aktuelle Callbacks, ohne dass ein laufender Lauf mit veralteten Closures weiterarbeitet.
	const runPortionRef = useRef(runPortion);
	const onChangedRef = useRef(onChanged);
	useEffect(() => {
		runPortionRef.current = runPortion;
		onChangedRef.current = onChanged;
	}, [runPortion, onChanged]);

	// Ein Fehler hier blockiert nichts: Ohne Stand gibt es eben nur den Neustart.
	// Solange der Server-Lauf unterwegs ist, lädt sie sich selbst periodisch nach.
	const refreshStatus = useCallback(async (): Promise<void> => {
		clearTimeout(pollRef.current);
		let next: OwnReassignPillarsStatus;
		try {
			next = await loadStatus();
		} catch {
			setStatus(null);
			return;
		}
		setStatus(next);
		const processed = next.processed ?? 0;
		if (next.running === true) {
			trackingRef.current = true;
			setRun((prev) => ({
				...prev,
				phase: 'processing',
				error: null,
				processed,
				total: Math.max(prev.total, processed + next.pending),
			}));
			pollRef.current = setTimeout(() => void refreshStatusRef.current(), POLL_INTERVAL_MS);
			return;
		}
		if (!trackingRef.current) {
			return;
		}
		trackingRef.current = false;
		const result = next.result;
		setRun((prev) => ({
			...prev,
			phase: 'completed',
			processed,
			total: Math.max(prev.total, processed + (result?.quotaExhausted === true ? next.pending : 0)),
			updated: result?.updated ?? 0,
			failed: result?.failed ?? 0,
			skipped: result?.skipped ?? 0,
			quotaExhausted: result?.quotaExhausted ?? false,
			failureReasons: result?.failureReasons ?? {},
		}));
		if ((result?.updated ?? 0) > 0) {
			onChangedRef.current?.();
		}
	}, [loadStatus]);

	useEffect(() => {
		void refreshStatus();
	}, [refreshStatus]);

	const refreshStatusRef = useRef(refreshStatus);
	useEffect(() => {
		refreshStatusRef.current = refreshStatus;
	}, [refreshStatus]);

	// Beim Unmount endet nur das Abfragen — der Lauf selbst geht auf dem Server weiter.
	useEffect(() => () => clearTimeout(pollRef.current), []);

	const start = useCallback(
		async (restart: boolean): Promise<void> => {
			trackingRef.current = true;
			setRun({ ...IDLE, phase: 'processing' });
			try {
				await runPortionRef.current({ restart });
			} catch (reason) {
				trackingRef.current = false;
				const { message } = await toApiError(reason);
				setRun((prev) => ({ ...prev, phase: 'completed', error: message }));
				void refreshStatus();
				return;
			}
			await refreshStatus();
		},
		[refreshStatus],
	);

	// Fortsetzen lohnt nur, wenn ein Lauf begann und nicht alle Aufgaben durch sind.
	const canResume = status !== null && status.startedAt !== null && status.pending > 0 && status.pending < status.total;

	return { run, status, canResume, start };
};
