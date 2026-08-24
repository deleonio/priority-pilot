import { KolAlert, KolButton, KolInputText, KolTextarea } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readString } from '../lib/inputValue';
import { TITLE_MAX_LENGTH } from '../lib/titleLengthValidation';
import { Modal } from './Modal';

interface PillarFormDialogProps {
	/** Säule, die bearbeitet werden soll (`undefined` = Anlegen-Modus). */
	pillar?: Pillar;
	onClose: () => void;
	/** Nach erfolgreichem Anlegen/Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Dialog zum Anlegen (`pillar === undefined`) oder Bearbeiten (`pillar` gesetzt) einer Säule.
 * Basiert auf dem generischen `Modal` (KolDialog Variant `card`) und verwendet KoliBri-Eingabefelder.
 *
 * Die Eingaben liegen in einem Ref parallel zum State, damit KoliBri-Felder ihren Anzeigewert selbst
 * verwalten können und Ctrl+Enter den frischen Wert synchron liest (Race zum Re-Render).
 */
export const PillarFormDialog = ({ pillar, onClose, onSaved }: PillarFormDialogProps) => {
	const isEdit = pillar !== undefined;

	// Form-Ref: Werte werden beim Mount initialisiert und bei Eingabe aktualisiert.
	const form = useRef({ name: pillar?.name ?? '', description: pillar?.description ?? '' });
	const [nameState, setNameState] = useState(form.current.name);
	const [descriptionState, setDescriptionState] = useState(form.current.description);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Form-Ref im Sync mit dem initialisierungsabhängigen State halten, falls der Aufrufer die
	// Komponente mit geändertem `pillar` neu mountet (defensiv).
	useEffect(() => {
		form.current = { name: pillar?.name ?? '', description: pillar?.description ?? '' };
		setNameState(form.current.name);
		setDescriptionState(form.current.description);
	}, [pillar]);

	const submit = async (): Promise<void> => {
		const name = form.current.name.trim();
		if (name === '') {
			setError('Name darf nicht leer sein.');
			return;
		}
		setError(null);
		setSaving(true);
		try {
			if (isEdit && pillar !== undefined) {
				const pillarUpdate: { name?: string; description?: string } = {};
				if (name !== pillar.name) {
					pillarUpdate.name = name;
				}
				const description = form.current.description.trim();
				if (description !== pillar.description) {
					pillarUpdate.description = description;
				}
				if (Object.keys(pillarUpdate).length > 0) {
					await api.updatePillar({ id: pillar.id, pillarUpdate });
				}
			} else {
				const pillarCreate: { name: string; description?: string } = { name };
				const description = form.current.description.trim();
				if (description !== '') {
					pillarCreate.description = description;
				}
				await api.createPillar({ pillarCreate });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA „Speichern\"/„Anlegen\" aus — nur wenn er
	// nicht deaktiviert ist (kein laufender Request), analog zu dessen `_disabled`.
	useCtrlEnter(() => void submit(), !saving);

	return (
		<Modal title={isEdit ? 'Säule bearbeiten' : 'Neue Säule anlegen'} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label={isEdit ? 'Speichern fehlgeschlagen' : 'Anlegen fehlgeschlagen'}>
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Name"
					_required
					_maxLength={TITLE_MAX_LENGTH}
					_value={nameState}
					_on={{
						onInput: (_event, value) => {
							const next = readString(value);
							form.current.name = next;
							setNameState(next);
						},
						onChange: (_event, value) => {
							const next = readString(value);
							form.current.name = next;
							setNameState(next);
						},
					}}
				/>
				<KolTextarea
					_label="Beschreibung"
					_rows={4}
					_value={descriptionState}
					_on={{
						onInput: (_event, value) => {
							const next = readString(value);
							form.current.description = next;
							setDescriptionState(next);
						},
						onChange: (_event, value) => {
							const next = readString(value);
							form.current.description = next;
							setDescriptionState(next);
						},
					}}
				/>
			</div>
			<div className="modal-actions">
				<KolButton
					_label={saving ? (isEdit ? 'Speichern…' : 'Anlegen…') : isEdit ? 'Speichern' : 'Anlegen'}
					_variant="primary"
					_disabled={saving}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
