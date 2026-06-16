import {
	KolAlert,
	KolButton,
	KolInputDate,
	KolInputNumber,
	KolInputText,
	KolSingleSelect,
	KolTextarea,
} from '@public-ui/react-v19';
import type { Task, TaskCreate, TaskUpdate } from 'client';
import { TaskStatus } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber, readString } from '../lib/inputValue';
import { STATUS_OPTIONS, deadlineToDateInput } from '../lib/task';
import { Modal } from './Modal';

interface TaskFormModalProps {
	/** Zu bearbeitender Task; `null` legt einen neuen Task an. */
	task: Task | null;
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

export const TaskFormModal = ({ task, onClose, onSaved }: TaskFormModalProps) => {
	const isEdit = task !== null;

	// Eingaben in Refs halten: KoliBri-Inputs verwalten ihren Anzeigewert selbst, daher kein
	// erneutes Rendern (und kein Cursor-Springen) pro Tastendruck. Validierung beim Absenden.
	// `priority`/`estimatedEffort` dürfen `null` sein: ein geleertes Zahlenfeld setzt den Ref auf
	// `null`, damit die Validierung greift (statt still den alten Wert weiterzuverwenden).
	const form = useRef<{
		title: string;
		status: TaskStatus;
		priority: number | null;
		estimatedEffort: number | null;
		description: string;
		deadline: string;
	}>({
		title: task?.title ?? '',
		status: task?.status ?? TaskStatus.Open,
		priority: task?.priority ?? 3,
		estimatedEffort: task?.estimatedEffort ?? 0.5,
		description: task?.description ?? '',
		deadline: deadlineToDateInput(task?.deadline),
	});

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const submit = async (): Promise<void> => {
		const title = form.current.title.trim();
		if (title === '') {
			setError('Bitte einen Titel angeben.');
			return;
		}
		const priority = form.current.priority;
		if (priority === null || !Number.isInteger(priority) || priority < 1) {
			setError('Priorität muss eine Ganzzahl ≥ 1 sein.');
			return;
		}
		const estimatedEffort = form.current.estimatedEffort;
		if (estimatedEffort === null || !Number.isFinite(estimatedEffort) || estimatedEffort < 0.1) {
			setError('Geschätzter Aufwand muss eine Zahl ≥ 0,1 sein.');
			return;
		}
		const description = form.current.description.trim();
		// Datum explizit als UTC interpretieren (`Z`), damit die Serialisierung (toISOString) den
		// Kalendertag zeitzonenunabhängig erhält.
		const deadline = form.current.deadline.trim() === '' ? null : new Date(`${form.current.deadline}T00:00:00Z`);
		if (deadline !== null && Number.isNaN(deadline.getTime())) {
			setError('Die Deadline ist kein gültiges Datum.');
			return;
		}

		setError(null);
		setSaving(true);
		try {
			if (isEdit) {
				const taskUpdate: TaskUpdate = {
					title,
					status: form.current.status,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					deadline,
				};
				await api.updateTask({ id: task.id, taskUpdate });
			} else {
				const taskCreate: TaskCreate = {
					title,
					status: form.current.status,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					deadline,
				};
				await api.createTask({ taskCreate });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Liefert für `KolInputDate._value` nur ein valides `Date` (UTC) oder `undefined`, damit bei
	// unvollständiger Eingabe kein `Invalid Date` an die Komponente gereicht wird.
	const deadlineValue = ((): Date | undefined => {
		if (form.current.deadline === '') {
			return undefined;
		}
		const parsed = new Date(`${form.current.deadline}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	})();

	return (
		<Modal title={isEdit ? `Task bearbeiten: ${task.title}` : 'Neuen Task anlegen'} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Titel"
					_required
					_value={form.current.title}
					_on={{
						onInput: (_event, value) => {
							form.current.title = readString(value);
						},
						onChange: (_event, value) => {
							form.current.title = readString(value);
						},
					}}
				/>
				<KolSingleSelect
					_label="Status"
					_options={STATUS_OPTIONS}
					_value={form.current.status}
					_on={{
						onChange: (_event, value) => {
							const next = readString(value);
							if (next === TaskStatus.Open || next === TaskStatus.InProcess || next === TaskStatus.Done) {
								form.current.status = next;
							}
						},
					}}
				/>
				<KolInputNumber
					_label="Priorität (Ganzzahl ≥ 1)"
					_min={1}
					_step={1}
					_value={form.current.priority ?? undefined}
					_on={{
						onInput: (_event, value) => {
							form.current.priority = readNumber(value);
						},
						onChange: (_event, value) => {
							form.current.priority = readNumber(value);
						},
					}}
				/>
				<KolInputNumber
					_label="Geschätzter Aufwand in Tagen (≥ 0,1)"
					_min={0.1}
					_step={0.1}
					_value={form.current.estimatedEffort ?? undefined}
					_on={{
						onInput: (_event, value) => {
							form.current.estimatedEffort = readNumber(value);
						},
						onChange: (_event, value) => {
							form.current.estimatedEffort = readNumber(value);
						},
					}}
				/>
				<KolInputDate
					_label="Deadline (optional)"
					_type="date"
					_value={deadlineValue}
					_on={{
						onChange: (_event, value) => {
							form.current.deadline = readString(value);
						},
						onInput: (_event, value) => {
							form.current.deadline = readString(value);
						},
					}}
				/>
				<KolTextarea
					_label="Beschreibung (optional)"
					_rows={4}
					_value={form.current.description}
					_on={{
						onInput: (_event, value) => {
							form.current.description = readString(value);
						},
						onChange: (_event, value) => {
							form.current.description = readString(value);
						},
					}}
				/>
			</div>
			<div className="modal-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
