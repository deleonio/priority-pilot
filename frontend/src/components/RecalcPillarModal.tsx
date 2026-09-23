import { KolAlert, KolButton, KolInputRadio } from '@public-ui/react-v19';
import type { ReassignStatusFilter } from 'client';
import { useCallback, useRef, useState } from 'react';
import { api } from '../api';
import { useReassignRun, type ReassignPortionArgs } from '../lib/useReassignRun';
import { Modal } from './Modal';
import { ReassignFailureList, ReassignProgressView, ReassignStatusText } from './ReassignRunViews';

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
 * Den portionierten Lauf, den Fortschritt und das Fortsetzen über Sitzungen hinweg übernimmt
 * `useReassignRun` — gemeinsam mit dem Admin-Batch. Den Stand des letzten Laufs liefert
 * `GET /tasks/reassign-pillars/status`; „Fortsetzen“ verarbeitet nur fehlgeschlagene und nicht
 * erreichte Aufgaben, nicht noch einmal alle.
 */

const FILTER_OPTIONS: { label: string; value: ReassignStatusFilter }[] = [
	{ label: 'Alle Aufgaben', value: 'all' },
	{ label: 'Nur offene Aufgaben', value: 'open' },
	{ label: 'Nur erledigte Aufgaben', value: 'done' },
];

export const RecalcPillarModal = ({ onClose, onCompleted }: RecalcPillarModalProps) => {
	const [filter, setFilter] = useState<ReassignStatusFilter>('all');
	const closeRef = useRef<HTMLKolButtonElement>(null);

	const runPortion = useCallback(
		(args: ReassignPortionArgs) => api.reassignOwnTaskPillars({ status: filter, ...args }),
		[filter],
	);
	const loadStatus = useCallback(() => api.getOwnReassignPillarsStatus({ status: filter }), [filter]);
	const { run, status, canResume, start, abort } = useReassignRun({ runPortion, loadStatus, onChanged: onCompleted });

	const handleClose = (): void => {
		abort();
		onClose();
	};

	return (
		<Modal title="Säulen-Verteilung neu berechnen" onClose={handleClose} initialFocusRef={closeRef}>
			{run.phase === 'idle' && (
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
							_value={filter}
							_on={{
								onChange: (_event, value) => {
									const next = FILTER_OPTIONS.find((option) => option.value === value);
									if (next !== undefined) {
										setFilter(next.value);
									}
								},
							}}
						/>
					</div>

					{status !== null && status.startedAt !== null && status.total > 0 && (
						<KolAlert _type={status.pending > 0 ? 'warning' : 'success'} _label="Stand des letzten Laufs">
							<ReassignStatusText status={status} testId="recalc-run-status" />
							{status.pending > 0 && (
								<p>„Fortsetzen“ verarbeitet nur die offenen, darunter die zuvor fehlgeschlagenen.</p>
							)}
						</KolAlert>
					)}

					<div className="modal-actions">
						<KolButton ref={closeRef} _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
						{canResume && status !== null ? (
							<>
								<KolButton
									_label={`Alle ${status.total} neu starten`}
									_variant="secondary"
									_on={{ onClick: () => void start(true) }}
								/>
								<KolButton
									_label={`Fortsetzen (${status.pending} offen)`}
									_variant="primary"
									_on={{ onClick: () => void start(false) }}
								/>
							</>
						) : (
							<KolButton _label="Start" _variant="primary" _on={{ onClick: () => void start(true) }} />
						)}
					</div>
				</>
			)}

			{run.phase === 'processing' && (
				<>
					<ReassignProgressView run={run} />
					<div className="modal-actions">
						<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}

			{run.phase === 'completed' && (
				<>
					{run.error !== null ? (
						<KolAlert _type="error" _label="Neuberechnung fehlgeschlagen">
							{run.error}
						</KolAlert>
					) : (
						<KolAlert _type={run.failed === 0 ? 'success' : 'warning'} _label="Abgeschlossen">
							{run.total === 0 ? (
								<p>Mit dem gewählten Filter gab es keine Aufgaben zu bearbeiten.</p>
							) : (
								<p>
									<strong>{run.updated}</strong> Aufgaben neu zugeordnet, {run.skipped} unverändert gelassen,{' '}
									{run.failed} fehlgeschlagen.
								</p>
							)}
							{run.failed > 0 && <ReassignFailureList reasons={run.failureReasons} />}
						</KolAlert>
					)}

					{run.quotaExhausted && (
						<KolAlert _type="warning" _label="KI-Kontingent aufgebraucht">
							Der Lauf hat angehalten. {run.total - run.processed} Aufgaben sind noch offen — im nächsten
							Abrechnungsmonat oder mit einem größeren Paket lässt er sich fortsetzen.
						</KolAlert>
					)}

					{canResume && status !== null && (
						<p data-testid="recalc-pending-hint">
							{status.pending} Aufgaben sind noch offen. „Fortsetzen“ verarbeitet nur diese, auch später nach einem
							Neuladen.
						</p>
					)}

					<div className="modal-actions">
						{canResume && status !== null && (
							<KolButton
								_label={`Fortsetzen (${status.pending} offen)`}
								_variant="secondary"
								_on={{ onClick: () => void start(false) }}
							/>
						)}
						<KolButton ref={closeRef} _label="Schließen" _variant="primary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}
		</Modal>
	);
};
