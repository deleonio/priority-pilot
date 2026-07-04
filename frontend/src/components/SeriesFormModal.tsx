import { KolAlert, KolButton, KolInputDate, KolInputText, KolSingleSelect } from '@public-ui/react-v19';
import type { Series, SeriesCreate, SeriesRhythm, SeriesUpdate } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readString } from '../lib/inputValue';
import { VoiceField } from './VoiceField';

interface SeriesFormModalProps {
	/** Zu bearbeitende Serie; `null` legt eine neue Serie an. */
	series: Series | null;
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Serien-Liste neu laden). */
	onSaved: () => void;
}

/** Auswahl-Optionen des Serien-Rhythmus (Vertrag `SeriesRhythm`). */
const RHYTHM_OPTIONS: { label: string; value: SeriesRhythm }[] = [
	{ label: 'Täglich', value: 'daily' },
	{ label: 'Wöchentlich', value: 'weekly' },
	{ label: 'Monatlich', value: 'monthly' },
];

/** Wandelt ein `Date` (Serien-`startDate`, UTC) in den Wert eines `<input type="date">` (YYYY-MM-DD). */
const startDateToInput = (startDate: Date | undefined): string => {
	if (startDate === undefined || Number.isNaN(startDate.getTime())) {
		return '';
	}
	const year = startDate.getUTCFullYear().toString().padStart(4, '0');
	const month = (startDate.getUTCMonth() + 1).toString().padStart(2, '0');
	const day = startDate.getUTCDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
};

/**
 * Modal zum Anlegen/Bearbeiten eines Serien-Templates (#142, AK 1). Analog zu `TaskFormModal`:
 * Eingaben liegen in einem Ref (KoliBri-Inputs verwalten ihren Anzeigewert selbst), Validierung beim
 * Absenden. Felder: Titel, Startdatum (Pflicht-Anker der Serie) und Rhythmus.
 */
export const SeriesFormModal = ({ series, onClose, onSaved }: SeriesFormModalProps) => {
	const isEdit = series !== null;

	const form = useRef<{ title: string; rhythm: SeriesRhythm; startDate: string }>({
		title: series?.title ?? '',
		rhythm: series?.rhythm ?? 'weekly',
		startDate: startDateToInput(series?.startDate),
	});

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// State-Mirror für den Titel (#264): KoliBri verwaltet den Anzeigewert selbst, aber ein per
	// Sprach-Transkript geänderter Wert muss über `_value` ins Feld gespiegelt werden.
	const [title, setTitle] = useState(form.current.title);

	const submit = async (): Promise<void> => {
		const title = form.current.title.trim();
		if (title === '') {
			setError('Bitte einen Titel angeben.');
			return;
		}
		if (form.current.startDate.trim() === '') {
			setError('Bitte ein Startdatum angeben.');
			return;
		}
		// Datum explizit als UTC interpretieren (`Z`), damit der Kalendertag zeitzonenunabhängig bleibt.
		const startDate = new Date(`${form.current.startDate}T00:00:00Z`);
		if (Number.isNaN(startDate.getTime())) {
			setError('Das Startdatum ist kein gültiges Datum.');
			return;
		}

		setError(null);
		setSaving(true);
		try {
			if (isEdit) {
				const seriesUpdate: SeriesUpdate = { title, rhythm: form.current.rhythm, startDate };
				await api.updateSeries({ id: series.id, seriesUpdate });
			} else {
				// Die Spec-UI (#142, AK 1) erfasst nur Titel/Startdatum/Rhythmus. Die übrigen
				// Pflichtfelder des `SeriesCreate`-Vertrags übernehmen ihre Default-Werte (analog zum
				// e2e-Setup in series.spec.ts): Standard-Priorität/-Aufwand künftiger Instanzen, aktiv.
				const seriesCreate: SeriesCreate = {
					title,
					rhythm: form.current.rhythm,
					startDate,
					defaultPriority: 3,
					defaultEstimatedEffort: 0.5,
					active: true,
				};
				await api.createSeries({ seriesCreate });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA „Speichern" aus, solange kein Speichern läuft
	// (analog zum `_disabled` des CTAs). Leere Pflichtfelder werden von `submit` selbst abgefangen.
	useCtrlEnter(() => void submit(), !saving);

	const startDateValue = ((): Date | undefined => {
		if (form.current.startDate === '') {
			return undefined;
		}
		const parsed = new Date(`${form.current.startDate}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	})();

	// Eigenes Card-Overlay (keine verschachtelte `Modal`/`KolDialog`-Instanz, da dieses Formular
	// bereits innerhalb der Serien-Verwaltung geöffnet wird). Heading + Felder reichen für die Spec.
	return (
		<div className="series-form" role="group" aria-label={isEdit ? 'Serie bearbeiten' : 'Neue Serie anlegen'}>
			<h3>{isEdit ? `Serie bearbeiten: ${series.title}` : 'Neue Serie anlegen'}</h3>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<VoiceField
					variant="input"
					fieldLabel="Titel"
					onTranscript={(text) => {
						const newVal = form.current.title ? `${form.current.title} ${text}` : text;
						form.current.title = newVal;
						setTitle(newVal);
					}}
				>
					<KolInputText
						_label="Titel"
						_required
						_value={title}
						_on={{
							onInput: (_event, value) => {
								const newVal = readString(value);
								form.current.title = newVal;
								setTitle(newVal);
							},
							onChange: (_event, value) => {
								const newVal = readString(value);
								form.current.title = newVal;
								setTitle(newVal);
							},
						}}
					/>
				</VoiceField>
				<KolInputDate
					_label="Startdatum"
					_type="date"
					_value={startDateValue}
					_on={{
						onInput: (_event, value) => {
							form.current.startDate = value instanceof Date ? startDateToInput(value) : readString(value);
						},
						onChange: (_event, value) => {
							form.current.startDate = value instanceof Date ? startDateToInput(value) : readString(value);
						},
					}}
				/>
				<KolSingleSelect
					_label="Rhythmus"
					_options={RHYTHM_OPTIONS}
					_value={form.current.rhythm}
					_on={{
						onChange: (_event, value) => {
							const next = readString(value);
							if (next === 'daily' || next === 'weekly' || next === 'monthly') {
								form.current.rhythm = next;
							}
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
		</div>
	);
};
