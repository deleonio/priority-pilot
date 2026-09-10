import { KolAlert, KolButton, KolInputText, KolSingleSelect } from '@public-ui/react-v19';
import type { Category, CategoryColor, CategoryCreate, CategoryUpdate } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readString } from '../lib/inputValue';
import { categoryColorOptions, DEFAULT_CATEGORY_COLOR } from '../lib/categoryPalette';
import { CategoryBadge } from './CategoryBadge';
import { Modal } from './Modal';

/** Maximale Namenslänge (Spiegel von `openapi.yml` und `server/src/models/category.ts`). */
const CATEGORY_NAME_MAX_LENGTH = 40;

interface CategoryFormDialogProps {
	/** Kategorie, die bearbeitet werden soll (`undefined` = Anlegen-Modus). */
	category?: Category;
	onClose: () => void;
	/** Nach erfolgreichem Anlegen/Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Dialog zum Anlegen (`category === undefined`) oder Bearbeiten einer Kategorie — Muster
 * `PillarFormDialog`: Werte liegen in einem Ref parallel zum State, damit KoliBri-Felder ihren
 * Anzeigewert selbst verwalten und Ctrl+Enter den frischen Wert synchron liest.
 *
 * Statt einer reinen Farbliste zeigt der Dialog eine Live-Vorschau des Badges: So sieht man vor dem
 * Speichern, wie die Kategorie später in den Listen aussieht.
 */
export const CategoryFormDialog = ({ category, onClose, onSaved }: CategoryFormDialogProps) => {
	const isEdit = category !== undefined;

	const form = useRef({ name: category?.name ?? '', color: category?.color ?? DEFAULT_CATEGORY_COLOR });
	const [nameState, setNameState] = useState(form.current.name);
	const [colorState, setColorState] = useState<CategoryColor>(form.current.color);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Ref und State neu initialisieren, falls der Aufrufer mit geänderter `category` neu mountet.
	useEffect(() => {
		form.current = { name: category?.name ?? '', color: category?.color ?? DEFAULT_CATEGORY_COLOR };
		setNameState(form.current.name);
		setColorState(form.current.color);
	}, [category]);

	const submit = async (): Promise<void> => {
		const name = form.current.name.trim();
		if (name === '') {
			setError('Name darf nicht leer sein.');
			return;
		}
		setError(null);
		setSaving(true);
		try {
			if (isEdit && category !== undefined) {
				const categoryUpdate: CategoryUpdate = {};
				if (name !== category.name) {
					categoryUpdate.name = name;
				}
				if (form.current.color !== category.color) {
					categoryUpdate.color = form.current.color;
				}
				if (Object.keys(categoryUpdate).length > 0) {
					await api.updateCategory({ id: category.id, categoryUpdate });
				}
			} else {
				const categoryCreate: CategoryCreate = { name, color: form.current.color };
				await api.createCategory({ categoryCreate });
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	useCtrlEnter(() => void submit(), !saving);

	return (
		<Modal title={isEdit ? 'Kategorie bearbeiten' : 'Neue Kategorie anlegen'} onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label={isEdit ? 'Speichern fehlgeschlagen' : 'Anlegen fehlgeschlagen'}>
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Name"
					_required
					_maxLength={CATEGORY_NAME_MAX_LENGTH}
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
				<KolSingleSelect
					_label="Farbe"
					_options={categoryColorOptions()}
					_value={colorState}
					_on={{
						onChange: (_event, value) => {
							const next = readString(value) as CategoryColor;
							form.current.color = next;
							setColorState(next);
						},
					}}
				/>
			</div>
			<p className="hint category-form-preview">
				Vorschau:{' '}
				<CategoryBadge category={{ id: category?.id ?? 0, name: nameState.trim() || 'Kategorie', color: colorState }} />
			</p>
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
