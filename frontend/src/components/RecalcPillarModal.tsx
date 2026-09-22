import { KolAlert, KolButton, KolInputRadio } from '@public-ui/react-v19';
import type { Pillar, Task, TaskStatus } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { fillContributions } from '../lib/pillar';
import { Modal } from './Modal';

interface RecalcPillarModalProps {
	onClose: () => void;
	tasks: Task[];
	pillars: Pillar[];
	onCompleted?: () => void;
}

type FilterType = 'all' | 'open' | 'done';

interface ProcessingState {
	status: 'idle' | 'selecting' | 'processing' | 'completed';
	filter: FilterType;
	total: number;
	processed: number;
	successful: number;
	failed: number;
	errors: Array<{ taskId: number; message: string }>;
}

export const RecalcPillarModal = ({ onClose, tasks, pillars, onCompleted }: RecalcPillarModalProps) => {
	const [state, setState] = useState<ProcessingState>({
		status: 'selecting',
		filter: 'all',
		total: 0,
		processed: 0,
		successful: 0,
		failed: 0,
		errors: [],
	});

	const abortControllerRef = useRef<AbortController | null>(null);

	// Gefilterte Tasks bestimmen
	const getFilteredTasks = (filter: FilterType): Task[] => {
		if (filter === 'all') {
			return tasks;
		}
		const openStatuses: TaskStatus[] = ['Open' as TaskStatus, 'InProcess' as TaskStatus];
		if (filter === 'open') {
			return tasks.filter((t) => openStatuses.includes(t.status as TaskStatus));
		}
		// filter === 'done'
		return tasks.filter((t) => t.status === 'Done');
	};

	const handleFilterChange = (newFilter: FilterType) => {
		setState((prev: ProcessingState) => ({ ...prev, filter: newFilter }));
	};

	const handleStart = async () => {
		const filtered = getFilteredTasks(state.filter);
		if (filtered.length === 0) {
			setState((prev: ProcessingState) => ({
				...prev,
				status: 'completed',
				total: 0,
				successful: 0,
				failed: 0,
				processed: 0,
			}));
			return;
		}

		setState((prev: ProcessingState) => ({
			...prev,
			status: 'processing',
			total: filtered.length,
			processed: 0,
			successful: 0,
			failed: 0,
			errors: [],
		}));

		abortControllerRef.current = new AbortController();

		// Iterative Verarbeitung
		let successful = 0;
		let failed = 0;
		const errors: Array<{ taskId: number; message: string }> = [];

		for (let i = 0; i < filtered.length; i += 1) {
			// Abort-Prüfung
			if (abortControllerRef.current.signal.aborted) {
				break;
			}

			const task = filtered[i];
			try {
				// Neue Pillar-Verteilung berechnen
				const newContributions = fillContributions(pillars, task.pillars);

				// Task mit neuen Pillars speichern
				await api.updateTask({
					id: task.id,
					taskUpdate: {
						pillars: newContributions,
					},
				});

				successful += 1;
			} catch (reason) {
				failed += 1;
				const apiError = await toApiError(reason);
				errors.push({
					taskId: task.id,
					message: apiError.message,
				});
			}

			// Fortschritt aktualisieren
			setState((prev: ProcessingState) => ({
				...prev,
				processed: i + 1,
				successful,
				failed,
				errors,
			}));
		}

		// Abschluss
		setState((prev: ProcessingState) => ({
			...prev,
			status: 'completed',
		}));

		onCompleted?.();
	};

	const handleClose = () => {
		// Abort bei laufender Verarbeitung
		if (state.status === 'processing' && abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		onClose();
	};

	const progress = state.total === 0 ? 0 : Math.round((state.processed / state.total) * 100);

	const closeRef = useRef<HTMLKolButtonElement>(null);

	return (
		<Modal title="Säulen-Verteilung neu berechnen" onClose={handleClose} initialFocusRef={closeRef}>
			{state.status === 'selecting' && (
				<>
					<p>
						Wähle die Aufgaben aus, deren Säulen-Verteilung neu berechnet werden soll. Der Prozess geht jede Aufgabe
						durch und berechnet die Anteile neu.
					</p>

					<div className="form-grid">
						<KolInputRadio
							_label="Filter"
							_options={[
								{ label: 'Alle Aufgaben', value: 'all' },
								{ label: 'Nur offene Aufgaben', value: 'open' },
								{ label: 'Nur erledigte Aufgaben', value: 'done' },
							]}
							_value={state.filter}
							_on={{
								onChange: (_event, value) => {
									if (value === 'all' || value === 'open' || value === 'done') {
										handleFilterChange(value);
									}
								},
							}}
						/>
					</div>

					{getFilteredTasks(state.filter).length === 0 ? (
						<KolAlert _type="warning" _label="Keine Aufgaben">
							Mit dem gewählten Filter gibt es keine Aufgaben zu bearbeiten.
						</KolAlert>
					) : (
						<p>
							<strong>
								{getFilteredTasks(state.filter).length} Aufgabe
								{getFilteredTasks(state.filter).length === 1 ? '' : 'n'}
							</strong>{' '}
							werden bearbeitet.
						</p>
					)}

					<div className="modal-actions">
						<KolButton ref={closeRef} _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
						<KolButton
							_label="Start"
							_variant="primary"
							_disabled={getFilteredTasks(state.filter).length === 0}
							_on={{ onClick: () => void handleStart() }}
						/>
					</div>
				</>
			)}

			{state.status === 'processing' && (
				<>
					<p>
						Verarbeite Aufgaben…{' '}
						<strong>
							{state.processed} / {state.total}
						</strong>
					</p>

					{/* Fortschrittsbalken */}
					<div className="progress-container" style={{ marginBottom: '1rem' }}>
						<div
							className="progress-bar"
							style={{
								width: `${progress}%`,
								height: '24px',
								backgroundColor: '#4CAF50',
								borderRadius: '4px',
								transition: 'width 0.3s ease',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'white',
								fontSize: '12px',
							}}
						>
							{progress}%
						</div>
					</div>

					{state.errors.length > 0 && (
						<KolAlert _type="warning" _label={`${state.errors.length} Fehler`}>
							<ul>
								{state.errors.slice(0, 5).map((error) => (
									<li key={error.taskId}>
										Task #{error.taskId}: {error.message}
									</li>
								))}
								{state.errors.length > 5 && <li>… und {state.errors.length - 5} weitere</li>}
							</ul>
						</KolAlert>
					)}

					<div className="modal-actions">
						<KolButton _label="Schließen" _variant="secondary" _disabled _on={{ onClick: handleClose }} />
					</div>
				</>
			)}

			{state.status === 'completed' && (
				<>
					<KolAlert _type={state.failed === 0 ? 'success' : 'warning'} _label="Abgeschlossen">
						{state.total === 0 ? (
							<p>Keine Aufgaben bearbeitet (Filter ergab 0 Aufgaben).</p>
						) : (
							<p>
								<strong>{state.successful}</strong> erfolgreich bearbeitet
								{state.failed > 0 && `, ${state.failed} Fehler`}.
							</p>
						)}
					</KolAlert>

					{state.errors.length > 0 && (
						<KolAlert _type="warning" _label="Fehler-Details">
							<ul>
								{state.errors.map((error) => (
									<li key={error.taskId}>
										Task #{error.taskId}: {error.message}
									</li>
								))}
							</ul>
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
