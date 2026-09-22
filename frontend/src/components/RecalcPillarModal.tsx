import { KolAlert, KolButton, KolInputRadio, KolProgress } from '@public-ui/react-v19';
import type { ReassignStatusFilter } from 'client';
import { useEffect, useRef, useState } from 'react';
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
 */

type Phase = 'selecting' | 'processing' | 'completed';

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
	error: null,
};

const FILTER_OPTIONS: { label: string; value: ReassignStatusFilter }[] = [
	{ label: 'Alle Aufgaben', value: 'all' },
	{ label: 'Nur offene Aufgaben', value: 'open' },
	{ label: 'Nur erledigte Aufgaben', value: 'done' },
];

export const RecalcPillarModal = ({ onClose, onCompleted }: RecalcPillarModalProps) => {
	const [state, setState] = useState<RunState>(INITIAL);
	const abortRef = useRef<AbortController | null>(null);

	// Beim Schließen/Unmount den laufenden Aufruf abbrechen, damit die Schleife nicht weiterläuft
	// und keinen Zustand einer ausgehängten Komponente mehr setzt.
	useEffect(() => () => abortRef.current?.abort(), []);

	const closeRef = useRef<HTMLKolButtonElement>(null);

	const handleStart = async (): Promise<void> => {
		const controller = new AbortController();
		abortRef.current = controller;
		setState((prev) => ({ ...INITIAL, filter: prev.filter, phase: 'processing' }));

		let offset = 0;
		let updated = 0;
		let failed = 0;
		let skipped = 0;
		let changed = false;

		for (;;) {
			if (controller.signal.aborted) {
				return;
			}
			let result;
			try {
				result = await api.reassignOwnTaskPillars({ status: state.filter, offset, signal: controller.signal });
			} catch (reason) {
				if (controller.signal.aborted) {
					return;
				}
				const apiError = await toApiError(reason);
				setState((prev) => ({ ...prev, phase: 'completed', error: apiError.message }));
				if (changed) {
					onCompleted?.();
				}
				return;
			}

			const consumed = result.updated + result.failed + result.skipped;
			updated += result.updated;
			failed += result.failed;
			skipped += result.skipped;
			offset += consumed;
			changed = changed || result.updated > 0;

			setState((prev) => ({
				...prev,
				total: offset + result.remaining,
				processed: offset,
				updated,
				failed,
				skipped,
				quotaExhausted: result.quotaExhausted,
			}));

			// `consumed === 0` bricht ab, auch wenn der Server noch Aufgaben meldet: sonst liefe die
			// Schleife endlos, falls eine Portion nichts mehr verarbeiten kann.
			if (result.remaining === 0 || result.quotaExhausted || consumed === 0) {
				break;
			}
		}

		setState((prev) => ({ ...prev, phase: 'completed' }));
		if (changed) {
			onCompleted?.();
		}
	};

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

					<div className="modal-actions">
						<KolButton ref={closeRef} _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
						<KolButton _label="Start" _variant="primary" _on={{ onClick: () => void handleStart() }} />
					</div>
				</>
			)}

			{state.phase === 'processing' && (
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
						</KolAlert>
					)}

					{state.quotaExhausted && (
						<KolAlert _type="warning" _label="KI-Kontingent aufgebraucht">
							Der Lauf hat angehalten. {state.total - state.processed} Aufgaben sind noch offen — im nächsten
							Abrechnungsmonat oder mit einem größeren Paket lässt er sich fortsetzen.
						</KolAlert>
					)}

					<div className="modal-actions">
						<KolButton ref={closeRef} _label="Schließen" _variant="primary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}
		</Modal>
	);
};
