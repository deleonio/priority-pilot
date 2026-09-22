import { KolAlert, KolButton, KolInputRadio, KolProgress } from '@public-ui/react-v19';
import { TaskStatus } from 'client';
import type { Pillar, Task } from 'client';
import { useEffect, useRef, useState } from 'react';
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

	// Beim Schließen/Unmount den laufenden Request abbrechen, damit die Schleife nicht
	// weiterläuft und keinen Zustand einer ausgehängten Komponente mehr setzt.
	useEffect(() => () => abortControllerRef.current?.abort(), []);

	// Gefilterte Tasks bestimmen
	const getFilteredTasks = (filter: FilterType): Task[] => {
		if (filter === 'all') {
			return tasks;
		}
		if (filter === 'open') {
			return tasks.filter((t) => t.status === TaskStatus.Open || t.status === TaskStatus.InProcess);
		}
		// filter === 'done'
		return tasks.filter((t) => t.status === TaskStatus.Done);
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

		const controller = new AbortController();
		abortControllerRef.current = controller;

		// Iterative Verarbeitung
		let successful = 0;
		let failed = 0;
		const errors: Array<{ taskId: number; message: string }> = [];

		for (let i = 0; i < filtered.length; i += 1) {
			if (controller.signal.aborted) {
				return;
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
					signal: controller.signal,
				});

				successful += 1;
			} catch (reason) {
				// Der Abbruch bricht den laufenden Request ab — das ist kein Fehler der Aufgabe.
				if (controller.signal.aborted) {
					return;
				}
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

					<KolProgress
						_variant="bar"
						_max={state.total}
						_value={state.processed}
						_label="Fortschritt der Neuberechnung"
					/>

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
						<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: handleClose }} />
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
