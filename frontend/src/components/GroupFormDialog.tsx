import { KolAlert, KolButton, KolInputText, KolTextarea } from '@public-ui/react-v19';
import type { Group } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readString } from '../lib/inputValue';
import { Modal } from './Modal';

/** #1211: Gruppenname ist Pflicht und auf 60 Zeichen begrenzt (Server-Validierung, AK4). */
const GROUP_NAME_MAX_LENGTH = 60;

interface GroupFormDialogProps {
	/** Gruppe, die bearbeitet werden soll (`undefined` = Anlegen-Modus). */
	group?: Group;
	onClose: () => void;
	/** Nach erfolgreichem Anlegen/Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Dialog zum Anlegen (`group === undefined`) oder Bearbeiten (`group` gesetzt) einer Gruppe
 * (#1211 AK6). Basiert auf dem generischen `Modal` (PillarFormDialog-Muster) mit KoliBri-Feldern:
 * Name (Pflicht, ≤ 60 Zeichen) und optionale Beschreibung. Inline-Validierung mit deutscher
 * Meldung, der Dialog bleibt bei ungültigem Namen offen (KI-UX: kein Alert-Wechsel).
 */
export const GroupFormDialog = ({ group, onClose, onSaved }: GroupFormDialogProps) => {
	const isEdit = group !== undefined;

	// Form-Ref: Werte werden beim Mount initialisiert und bei Eingabe aktualisiert (PillarFormDialog-
	// Muster: Anzeigewert im State, frischer Wert für Ctrl+Enter synchron im Ref).
	const form = useRef({
		name: group?.name ?? '',
		description: group?.description ?? '',
		imageUrl: group?.imageUrl ?? '',
	});
	const [nameState, setNameState] = useState(form.current.name);
	const [descriptionState, setDescriptionState] = useState(form.current.description);
	const [imageUrlState, setImageUrlState] = useState(form.current.imageUrl);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		form.current = { name: group?.name ?? '', description: group?.description ?? '', imageUrl: group?.imageUrl ?? '' };
		setNameState(form.current.name);
		setDescriptionState(form.current.description);
		setImageUrlState(form.current.imageUrl);
	}, [group]);

	const submit = async (): Promise<void> => {
		const name = form.current.name.trim();
		if (name === '') {
			setError('Bitte gib einen Namen für die Gruppe ein.');
			return;
		}
		if (name.length > GROUP_NAME_MAX_LENGTH) {
			setError(`Der Name darf maximal ${GROUP_NAME_MAX_LENGTH} Zeichen lang sein.`);
			return;
		}
		const imageUrl = form.current.imageUrl.trim();
		// Clientseitige https-Prüfung (#1225, KI-UX): ungültige Adresse bricht das Speichern ab,
		// der Dialog bleibt offen (gleiche Inline-Meldung wie der Server, 400).
		if (imageUrl !== '' && !imageUrl.startsWith('https://')) {
			setError('Die Bildadresse muss beginnen mit https://.');
			return;
		}
		setError(null);
		setSaving(true);
		const description = form.current.description.trim();
		try {
			if (isEdit && group !== undefined) {
				const groupUpdate: { name?: string; description?: string; imageUrl?: string | null } = {};
				if (name !== group.name) {
					groupUpdate.name = name;
				}
				if (description !== (group.description ?? '')) {
					groupUpdate.description = description;
				}
				// Bildadresse (#1225): „Feld leer = kein Bild" — das Leeren wird bewusst als
				// `imageUrl: null` gesendet, nicht als abwesendes Feld (sonst bliebe das Bild laut
				// presence-basiertem PATCH-Vertrag stehen). Nur bei Änderung senden.
				if (imageUrl !== (group.imageUrl ?? '')) {
					groupUpdate.imageUrl = imageUrl === '' ? null : imageUrl;
				}
				if (Object.keys(groupUpdate).length > 0) {
					await api.updateGroup({ id: group.id, groupUpdate });
				}
			} else {
				await api.createGroup({ groupInput: description !== '' ? { name, description } : { name } });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA aus — nur wenn kein Request läuft.
	useCtrlEnter(() => void submit(), !saving);

	return (
		<Modal title={isEdit ? 'Gruppe bearbeiten' : 'Gruppe anlegen'} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label={isEdit ? 'Speichern fehlgeschlagen' : 'Anlegen fehlgeschlagen'}>
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Name"
					_required
					_maxLength={GROUP_NAME_MAX_LENGTH}
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
				{isEdit && (
					/* Bildadresse (#1225, KI-UX): nur im Bearbeiten-Modus (eine frische Gruppe hat selten
					   schon eine Bild-URL), Pflicht ist es nie. type="url" + deutscher Hinweis auf die
					   https-Regel, die clientseitig und serverseitig (400) geprüft wird. */
					<KolInputText
						_label="Bildadresse"
						_type="url"
						_hint="Adresse eines Bildes, beginnt mit https://"
						_value={imageUrlState}
						_on={{
							onInput: (_event, value) => {
								const next = readString(value);
								form.current.imageUrl = next;
								setImageUrlState(next);
							},
							onChange: (_event, value) => {
								const next = readString(value);
								form.current.imageUrl = next;
								setImageUrlState(next);
							},
						}}
					/>
				)}
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
