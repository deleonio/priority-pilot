import { KolAlert, KolButton, KolInputRange, KolSingleSelect } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import type { DependencyRef } from '../lib/dependencies';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readNumber } from '../lib/inputValue';
import { formatNumber } from '../lib/task';
import { Modal } from './Modal';

interface DependencyModalProps {
	/** Task, dessen Abhängigkeiten (Vorgänger) bearbeitet werden. */
	task: Task;
	/** Alle Tasks — Auswahlquelle für neue Vorgänger. */
	allTasks: Task[];
	/** Aktuelle Vorgänger des Tasks (aus dem Aufgabenwald abgeleitet). */
	dependencies: DependencyRef[];
	onClose: () => void;
	/** Nach Hinzufügen/Entfernen aufgerufen, damit der Aufruf-Kontext Tasks + Wald neu lädt. */
	onChanged: () => void;
}

/**
 * Abhängigkeits-Editor: listet die Vorgänger eines Tasks, fügt neue mit Gewicht hinzu
 * (`POST /tasks/{id}/dependencies`) und entfernt bestehende (`DELETE …/dependencies/{depId}`).
 * Ein Server-`409` (Zyklus) wird verständlich gemeldet.
 */
export const DependencyModal = ({ task, allTasks, dependencies, onClose, onChanged }: DependencyModalProps) => {
	const dependencyIds = new Set(dependencies.map((dependency) => dependency.id));
	const candidates = allTasks.filter((candidate) => candidate.id !== task.id && !dependencyIds.has(candidate.id));
	const options = candidates.map((candidate) => ({
		label: `#${candidate.id} – ${candidate.title}`,
		value: candidate.id,
	}));

	const [selectedId, setSelectedId] = useState<number | null>(null);
	// Ref parallel zum State, damit die Ctrl+Enter-Bedingung die Auswahl synchron (vor dem Re-Render)
	// lesen kann — sonst würde ein Ctrl+Enter direkt nach der Auswahl noch den alten `null`-Wert sehen.
	const selectedIdRef = useRef<number | null>(null);
	// `null` erlaubt: ein geleertes Gewicht-Feld setzt den Ref auf `null`, damit die Validierung
	// greift, statt still den alten Wert weiterzuverwenden.
	const weight = useRef<number | null>(1);
	// State-Mirror für den Range-Slider: `_value` + `_label` müssen den aktuellen Wert erhalten,
	// damit der Slider nicht nach jedem Re-Render auf den Initialwert zurückspringt.
	const [weightState, setWeightState] = useState<number>(1);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const add = async (): Promise<void> => {
		// selectedIdRef statt selectedId lesen: Ctrl+Enter kann direkt nach onChange feuern,
		// bevor React den State-Update durchgeführt hat. Der Ref ist synchron gesetzt.
		const currentSelectedId = selectedIdRef.current;
		if (currentSelectedId === null) {
			setError('Bitte einen Vorgänger-Task auswählen.');
			return;
		}
		const weightValue = weight.current;
		if (weightValue === null || !Number.isFinite(weightValue) || weightValue < 0.1 || weightValue > 1) {
			setError('Das Gewicht muss eine Zahl zwischen 0,1 und 1 sein.');
			return;
		}
		setError(null);
		setBusy(true);
		try {
			await api.addDependency({
				id: task.id,
				dependencyInput: { dependingTaskId: currentSelectedId, weight: weightValue },
			});
			selectedIdRef.current = null;
			setSelectedId(null);
			onChanged();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setBusy(false);
		}
	};

	const remove = async (depId: number): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			await api.removeDependency({ id: task.id, depId });
			onChanged();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setBusy(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA „Hinzufügen" aus — nur wenn er nicht deaktiviert ist
	// (kein laufender Request, ein Vorgänger ausgewählt), analog zu dessen `_disabled`-Bedingung.
	useCtrlEnter(
		() => void add(),
		() => !busy && selectedIdRef.current !== null,
	);

	return (
		<Modal title={`Abhängigkeiten: #${task.id} – ${task.title}`} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label="Aktion fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			<section>
				<h3>Aktuelle Vorgänger</h3>
				{dependencies.length === 0 ? (
					<p>Dieser Task hat keine Vorgänger.</p>
				) : (
					<ul className="dependency-list">
						{dependencies.map((dependency) => (
							<li key={dependency.id}>
								<span>
									#{dependency.id} – {dependency.title}
								</span>
								<KolButton
									_label={`Vorgänger #${dependency.id} – ${dependency.title} entfernen`}
									_hideLabel
									_icons={{ left: { icon: 'kolicon-cross' } }}
									_variant="danger"
									_disabled={busy}
									_on={{ onClick: () => void remove(dependency.id) }}
								/>
							</li>
						))}
					</ul>
				)}
				<p className="hint">
					Hinweis: Die Liste basiert auf dem Aufgabenwald und enthält nur Vorgänger mit Status „Offen"/„In Bearbeitung".
				</p>
			</section>

			<section>
				<h3>Vorgänger hinzufügen</h3>
				{options.length === 0 ? (
					<p>Kein weiterer Task verfügbar, der als Vorgänger hinzugefügt werden könnte.</p>
				) : (
					<div className="form-grid">
						<KolSingleSelect
							_label="Vorgänger-Task"
							_options={options}
							_value={selectedId}
							_on={{
								onChange: (_event, value) => {
									const id = readNumber(value);
									selectedIdRef.current = id;
									setSelectedId(id);
								},
							}}
						/>
						<KolInputRange
							_label={`Gewicht (0,1–1): ${formatNumber(weightState)}`}
							_min={0.1}
							_max={1}
							_step={0.1}
							_value={weightState}
							_on={{
								onInput: (_event, value) => {
									const next = readNumber(value) ?? weightState;
									weight.current = next;
									setWeightState(next);
								},
								onChange: (_event, value) => {
									const next = readNumber(value) ?? weightState;
									weight.current = next;
									setWeightState(next);
								},
							}}
						/>
						<KolButton
							_label="Hinzufügen"
							_variant="primary"
							_disabled={busy || selectedId === null}
							_on={{ onClick: () => void add() }}
						/>
					</div>
				)}
			</section>

			<div className="modal-actions">
				<KolButton _label="Schließen" _variant="secondary" _disabled={busy} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
