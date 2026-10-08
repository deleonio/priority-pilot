import { KolAlert, KolButton, KolInputDate, KolInputRange, KolInputText, KolTextarea } from '@public-ui/react-v19';
import type { Series } from 'client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber, readString } from '../lib/inputValue';
import { deadlineToDateInput, formatNumber } from '../lib/task';
import { Modal } from './Modal';

interface SeriesInstanceDialogProps {
	/** Serie/Vorlage, aus der die Aufgabe angelegt wird. */
	series: Series;
	onClose: () => void;
	/** Nach erfolgreichem Anlegen aufgerufen (Dialog schließen, Rückmeldung zeigen, Liste neu laden). */
	onCreated: (task: Awaited<ReturnType<typeof api.createSeriesInstance>>) => void;
}

/**
 * Dialog „Aufgabe anlegen“ an einer Serie/Vorlage (#2359): legt per `POST /series/{id}/instances` genau
 * eine Aufgabe an. Vorbefüllt mit Titel, Priorität, Aufwand und Beschreibung der Serie, dazu eine optionale
 * Fälligkeit. Gesendet werden nur geänderte Felder plus `deadline` — der Server wertet jede mitgegebene
 * Abweichung als „geändert“ (`isException`).
 */
export const SeriesInstanceDialog = ({ series, onClose, onCreated }: SeriesInstanceDialogProps) => {
	const { t } = useTranslation(['capture', 'common']);
	const [title, setTitle] = useState(series.title);
	const [description, setDescription] = useState(series.description ?? '');
	const [priority, setPriority] = useState(series.priority);
	const [estimatedEffort, setEstimatedEffort] = useState(series.estimatedEffort);
	const [deadline, setDeadline] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	// Synchroner Guard: `kol-button` feuert `_on.onClick` UND den Host-Klick, `saving` reagiert erst nach dem Render.
	const submitting = useRef(false);

	const submit = async (): Promise<void> => {
		if (submitting.current) {
			return;
		}
		submitting.current = true;
		setSaving(true);
		setError(null);
		try {
			const input: Parameters<typeof api.createSeriesInstance>[0]['seriesInstanceInput'] = {};
			if (title !== series.title) {
				input.title = title;
			}
			if (description !== (series.description ?? '')) {
				input.description = description;
			}
			if (priority !== series.priority) {
				input.priority = priority;
			}
			if (estimatedEffort !== series.estimatedEffort) {
				input.estimatedEffort = estimatedEffort;
			}
			if (deadline !== '') {
				input.deadline = new Date(`${deadline}T00:00:00Z`).toISOString();
			}
			onCreated(await api.createSeriesInstance({ id: series.id, seriesInstanceInput: input }));
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			submitting.current = false;
			setSaving(false);
		}
	};

	return (
		<Modal title={t('seriesInstance.title', { title: series.title })} onClose={onClose} width="44rem">
			<div className="series-instance-form">
				{error !== null && (
					<KolAlert _type="error" _alert _label={t('seriesInstance.notCreated')}>
						{error}
					</KolAlert>
				)}
				<KolInputText
					_label={t('seriesInstance.fieldTitle')}
					_required
					_value={title}
					_on={{
						onInput: (_event, value) => setTitle(readString(value)),
						onChange: (_event, value) => setTitle(readString(value)),
					}}
				/>
				<KolTextarea
					_label={t('seriesInstance.description')}
					_rows={3}
					_value={description}
					_on={{
						onInput: (_event, value) => setDescription(readString(value)),
						onChange: (_event, value) => setDescription(readString(value)),
					}}
				/>
				<div className="range-inputs-row">
					<KolInputRange
						_label={t('seriesInstance.priority', { value: formatNumber(priority) })}
						_min={1}
						_max={5}
						_step={1}
						_value={priority}
						_on={{
							onInput: (_event, value) => setPriority(readNumber(value) ?? priority),
							onChange: (_event, value) => setPriority(readNumber(value) ?? priority),
						}}
					/>
					<KolInputRange
						_label={t('seriesInstance.effort', { value: formatNumber(estimatedEffort) })}
						_min={0.1}
						_max={1}
						_step={0.1}
						_value={estimatedEffort}
						_on={{
							onInput: (_event, value) => setEstimatedEffort(readNumber(value) ?? estimatedEffort),
							onChange: (_event, value) => setEstimatedEffort(readNumber(value) ?? estimatedEffort),
						}}
					/>
				</div>
				<KolInputDate
					_label={t('seriesInstance.deadline')}
					_type="date"
					_value={deadline === '' ? undefined : new Date(`${deadline}T00:00:00Z`)}
					_on={{
						onInput: (_event, value) =>
							setDeadline(value instanceof Date ? deadlineToDateInput(value) : readString(value)),
						onChange: (_event, value) =>
							setDeadline(value instanceof Date ? deadlineToDateInput(value) : readString(value)),
					}}
				/>
				<div className="modal-actions">
					<KolButton _label={t('common:actions.cancel')} _variant="secondary" _on={{ onClick: onClose }} />
					<KolButton
						_label={t('seriesInstance.submit')}
						_variant="primary"
						_disabled={saving}
						_on={{ onClick: () => void submit() }}
					/>
				</div>
			</div>
		</Modal>
	);
};
