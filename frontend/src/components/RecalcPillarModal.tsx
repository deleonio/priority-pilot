import { KolAlert, KolButton, KolInputRadio, KolProgress } from '@public-ui/react-v19';
import type { OwnReassignPillarsStatus, ReassignStatusFilter } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface RecalcPillarModalProps {
	onClose: () => void;
	/** Nach einem Lauf, der etwas verändert hat — die Aufrufer laden ihre Aufgaben neu. */
	onCompleted?: () => void;
}

/**
 * Neuberechnung der Säulenverteilung über die eigenen Aufgaben (#1614).
 *
 * Die Verteilung entsteht serverseitig über den KI-Klassifikator (`POST /tasks/reassign-pillars`) —
 * dieselbe Semantik wie beim app-weiten Admin-Batch. Das Modal rechnet bewusst NICHTS selbst: ein
 * zweiter, clientseitiger Rechenweg hätte für dieselbe fachliche Operation eine abweichende
 * Semantik ergeben (Review-Finding #5 zu PR #1615).
 *
 * Der Server verarbeitet je Aufruf höchstens eine Portion und meldet über `remaining`, wie viele
 * Aufgaben noch offen sind. Diese Komponente ruft so lange nach, bis nichts mehr offen ist, und
 * speist daraus den Fortschritt — das ist die „iterative Verarbeitung“ aus dem Ticket, ohne dass
 * der Nutzer „Fortsetzen“ klicken muss.
 *
 * Fortsetzbar über Sitzungen hinweg: Der Server merkt sich den Laufstart und je Aufgabe, wann ihre
 * Verteilung neu bestimmt wurde. Das Modal zeigt diesen Stand (`GET /tasks/reassign-pillars`) und
 * bietet „Fortsetzen“ an — dann laufen nur fehlgeschlagene und nicht erreichte Aufgaben, nicht noch
 * einmal alle.
 */

type Phase = 'selecting' | 'processing' | 'completed';

/**
 * Aufgaben je Server-Aufruf. Klein gehalten, weil jede Aufgabe einen LLM-Aufruf kostet: Der Balken
 * springt so alle paar Sekunden weiter, statt bis zum Ende eines einzigen langen Requests auf 0 zu
 * stehen, und kein Request läuft in einen Proxy-Timeout.
 */
const RECALC_BATCH_SIZE = 5;

interface RunState {
	phase: Phase;
	filter: ReassignStatusFilter;
	/** Aufgaben der Auswahl insgesamt — erst nach dem ersten Aufruf bekannt. */
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

const INITIAL: RunState = {
	phase: 'selecting',
	filter: 'all',
	total: 0,
	processed: 0,
	updated: 0,
	failed: 0,
	skipped: 0,
	quotaExhausted: false,
	failureReasons: {},
	error: null,
};

const mergeReasons = (
	into: Record<string, number>,
	from: Record<string, number> | undefined,
): Record<string, number> => {
	const merged = { ...into };
	for (const [reason, count] of Object.entries(from ?? {})) {
		merged[reason] = (merged[reason] ?? 0) + count;
	}
	return merged;
};

const formatStartedAt = (iso: string): string =>
	new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

const describeReason = (reason: string): string =>
	reason === 'HTTP 429' ? 'HTTP 429 (Rate-Limit des KI-Anbieters)' : reason;

const FILTER_OPTIONS: { label: string; value: ReassignStatusFilter }[] = [
	{ label: 'Alle Aufgaben', value: 'all' },
	{ label: 'Nur offene Aufgaben', value: 'open' },
	{ label: 'Nur erledigte Aufgaben', value: 'done' },
];

export const RecalcPillarModal = ({ onClose, onCompleted }: RecalcPillarModalProps) => {
	const [state, setState] = useState<RunState>(INITIAL);
	const [runStatus, setRunStatus] = useState<OwnReassignPillarsStatus | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// Stand des letzten Laufs zur gewählten Auswahl. Ein Fehler hier ist nicht blockierend: Ohne
	// Stand bietet das Modal eben nur den Neustart an.
	const loadRunStatus = useCallback(async (filter: ReassignStatusFilter): Promise<void> => {
		try {
			setRunStatus(await api.getOwnReassignPillarsStatus({ status: filter }));
		} catch {
			setRunStatus(null);
		}
	}, []);

	useEffect(() => {
		void loadRunStatus(state.filter);
	}, [loadRunStatus, state.filter]);

	// Beim Schließen/Unmount den laufenden Aufruf abbrechen, damit die Schleife nicht weiterläuft
	// und keinen Zustand einer ausgehängten Komponente mehr setzt.
	useEffect(() => () => abortRef.current?.abort(), []);

	const closeRef = useRef<HTMLKolButtonElement>(null);

	/** `restart`: neuer Lauf über alle Aufgaben; sonst nur die seit dem letzten Start noch offenen. */
	const handleStart = async (restart: boolean): Promise<void> => {
		const controller = new AbortController();
		abortRef.current = controller;
		setState((prev) => ({ ...INITIAL, filter: prev.filter, phase: 'processing' }));

		// `offset` zählt nur die in dieser Serie fehlgeschlagenen Aufgaben: Erfolgreich verarbeitete
		// fallen serverseitig aus der Auswahl, die fehlgeschlagenen bleiben vorn in ihr stehen.
		let offset = 0;
		let processed = 0;
		let first = true;
		let updated = 0;
		let failed = 0;
		let skipped = 0;
		let failureReasons: Record<string, number> = {};
		let changed = false;

		for (;;) {
			if (controller.signal.aborted) {
				return;
			}
			let result;
			try {
				result = await api.reassignOwnTaskPillars({
					status: state.filter,
					limit: RECALC_BATCH_SIZE,
					offset,
					restart: first && restart,
					signal: controller.signal,
				});
				first = false;
			} catch (reason) {
				if (controller.signal.aborted) {
					return;
				}
				const apiError = await toApiError(reason);
				setState((prev) => ({ ...prev, phase: 'completed', error: apiError.message }));
				void loadRunStatus(state.filter);
				if (changed) {
					onCompleted?.();
				}
				return;
			}

			const consumed = result.updated + result.failed + result.skipped;
			updated += result.updated;
			failed += result.failed;
			skipped += result.skipped;
			failureReasons = mergeReasons(failureReasons, result.failureReasons);
			offset += result.failed;
			processed += consumed;
			changed = changed || result.updated > 0;

			setState((prev) => ({
				...prev,
				total: processed + result.remaining,
				processed,
				updated,
				failed,
				skipped,
				failureReasons,
				quotaExhausted: result.quotaExhausted,
			}));

			// `consumed === 0` bricht ab, auch wenn der Server noch Aufgaben meldet: sonst liefe die
			// Schleife endlos, falls eine Portion nichts mehr verarbeiten kann.
			if (result.remaining === 0 || result.quotaExhausted || consumed === 0) {
				break;
			}
		}

		setState((prev) => ({ ...prev, phase: 'completed' }));
		void loadRunStatus(state.filter);
		if (changed) {
			onCompleted?.();
		}
	};

	// Fortsetzen lohnt nur, wenn ein Lauf begann und nicht alle Aufgaben durch sind.
	const canResume =
		runStatus !== null && runStatus.startedAt !== null && runStatus.pending > 0 && runStatus.pending < runStatus.total;

	const handleClose = (): void => {
		abortRef.current?.abort();
		onClose();
	};

	return (
		<Modal title="Säulen-Verteilung neu berechnen" onClose={handleClose} initialFocusRef={closeRef}>
			{state.phase === 'selecting' && (
				<>
					<p>
						Die Säulen-Beiträge der gewählten Aufgaben werden anhand von Titel und Beschreibung per KI neu bestimmt.
						Status, Punkte und Streak bleiben unverändert.
					</p>
					<KolAlert _type="info" _label="Verbraucht KI-Kontingent">
						Jede Aufgabe wird einzeln klassifiziert und zählt gegen dein monatliches KI-Kontingent. Ist es aufgebraucht,
						hält der Lauf an und meldet, was noch offen ist.
					</KolAlert>

					<div className="form-grid">
						<KolInputRadio
							_label="Filter"
							_options={FILTER_OPTIONS}
							_value={state.filter}
							_on={{
								onChange: (_event, value) => {
									const next = FILTER_OPTIONS.find((option) => option.value === value);
									if (next !== undefined) {
										setState((prev) => ({ ...prev, filter: next.value }));
									}
								},
							}}
						/>
					</div>

					{runStatus?.startedAt != null && runStatus.total > 0 && (
						<KolAlert _type={runStatus.pending > 0 ? 'warning' : 'success'} _label="Stand des letzten Laufs">
							<p data-testid="recalc-run-status">
								Gestartet am {formatStartedAt(runStatus.startedAt)}:{' '}
								<strong>
									{runStatus.total - runStatus.pending} von {runStatus.total}
								</strong>{' '}
								Aufgaben neu berechnet
								{runStatus.pending > 0 ? `, ${runStatus.pending} noch offen.` : '.'}
							</p>
							{runStatus.pending > 0 && (
								<p>„Fortsetzen“ verarbeitet nur die offenen, darunter die zuvor fehlgeschlagenen.</p>
							)}
						</KolAlert>
					)}

					<div className="modal-actions">
						<KolButton ref={closeRef} _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
						{canResume ? (
							<>
								<KolButton
									_label={`Alle ${runStatus.total} neu starten`}
									_variant="secondary"
									_on={{ onClick: () => void handleStart(true) }}
								/>
								<KolButton
									_label={`Fortsetzen (${runStatus.pending} offen)`}
									_variant="primary"
									_on={{ onClick: () => void handleStart(false) }}
								/>
							</>
						) : (
							<KolButton _label="Start" _variant="primary" _on={{ onClick: () => void handleStart(true) }} />
						)}
					</div>
				</>
			)}

			{state.phase === 'processing' && (
				<>
					{state.total === 0 ? (
						// Vor der ersten Antwort ist die Gesamtzahl unbekannt — kein „0 / 0“, das wie ein
						// hängender Lauf aussieht.
						<p>Ermittle Aufgaben und verarbeite die erste Portion…</p>
					) : (
						<>
							<p>
								Verarbeite Aufgaben…{' '}
								<strong>
									{state.processed} / {state.total}
								</strong>
							</p>
							<KolProgress
								_variant="bar"
								_max={state.total}
								_value={state.processed}
								_label="Fortschritt der Neuberechnung"
							/>
						</>
					)}
					<div className="modal-actions">
						<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}

			{state.phase === 'completed' && (
				<>
					{state.error !== null ? (
						<KolAlert _type="error" _label="Neuberechnung fehlgeschlagen">
							{state.error}
						</KolAlert>
					) : (
						<KolAlert _type={state.failed === 0 ? 'success' : 'warning'} _label="Abgeschlossen">
							{state.total === 0 ? (
								<p>Mit dem gewählten Filter gab es keine Aufgaben zu bearbeiten.</p>
							) : (
								<p>
									<strong>{state.updated}</strong> Aufgaben neu zugeordnet, {state.skipped} unverändert gelassen,{' '}
									{state.failed} fehlgeschlagen.
								</p>
							)}
							{state.failed > 0 && (
								<ul>
									{Object.entries(state.failureReasons).map(([reason, count]) => (
										<li key={reason}>
											{describeReason(reason)}: {count}
										</li>
									))}
								</ul>
							)}
						</KolAlert>
					)}

					{state.quotaExhausted && (
						<KolAlert _type="warning" _label="KI-Kontingent aufgebraucht">
							Der Lauf hat angehalten. {state.total - state.processed} Aufgaben sind noch offen — im nächsten
							Abrechnungsmonat oder mit einem größeren Paket lässt er sich fortsetzen.
						</KolAlert>
					)}

					{canResume && (
						<p data-testid="recalc-pending-hint">
							{runStatus.pending} Aufgaben sind noch offen. „Fortsetzen“ verarbeitet nur diese, auch später nach einem
							Neuladen.
						</p>
					)}

					<div className="modal-actions">
						{canResume && (
							<KolButton
								_label={`Fortsetzen (${runStatus.pending} offen)`}
								_variant="secondary"
								_on={{ onClick: () => void handleStart(false) }}
							/>
						)}
						<KolButton ref={closeRef} _label="Schließen" _variant="primary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}
		</Modal>
	);
};
