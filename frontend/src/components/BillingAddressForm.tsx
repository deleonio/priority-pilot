import { KolAlert, KolButton, KolInputText } from '@public-ui/react-v19';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';

/** Maximale Feldlänge der Rechnungsadresse (#2661) — Spiegel der Server-Validierung (120). */
const MAX_FIELD_LENGTH = 120;

/** Felder des Formulars — Schlüssel wie die API (`BillingAddressInput`). */
const FIELDS = [
	{ key: 'name', labelKey: 'address.name' },
	{ key: 'street', labelKey: 'address.street' },
	{ key: 'zip', labelKey: 'address.zip' },
	{ key: 'city', labelKey: 'address.city' },
	{ key: 'country', labelKey: 'address.country' },
] as const;

type AddressKey = (typeof FIELDS)[number]['key'];

interface BillingAddressFormProps {
	/** Meldet, ob alle Pflichtfelder ausgefüllt sind — nach dem Laden und nach dem Speichern. */
	onCompletenessChange?: (complete: boolean) => void;
	/** Nach erfolgreichem Speichern — der eigenständige Dialog schließt damit. */
	onSaved?: () => void;
}

/**
 * Imperativer Zugang für den Checkout-Dialog: `save` sichert ungespeicherte Änderungen vor der
 * Bestellung, `isDirty` entscheidet, ob das nötig ist (Review #2661).
 */
export interface BillingAddressFormHandle {
	save: () => Promise<boolean>;
	isDirty: () => boolean;
}

/**
 * Formular der Rechnungsadresse (#2661) — EINE Quelle für Felder, Validierung, Laden und
 * Speichern: Der Checkout-Dialog bettet es vor der Bestellung ein, der Dialog „Rechnungsadresse"
 * in der Abrechnungs-Sektion nutzt dasselbe. Die Vollständigkeit geht über
 * `onCompletenessChange` an den Aufrufer (dort sperrt sie den Bestell-Knopf).
 */
export const BillingAddressForm = forwardRef<BillingAddressFormHandle, BillingAddressFormProps>(
	({ onCompletenessChange, onSaved }, ref) => {
		const { t } = useTranslation('billing');
		const form = useRef<Record<AddressKey, string>>({ name: '', street: '', zip: '', city: '', country: '' });
		/** Zuletzt geladener bzw. gespeicherter Stand — Basis des Dirty-Abgleichs vor dem Bestellen. */
		const savedRef = useRef<Record<AddressKey, string>>({ name: '', street: '', zip: '', city: '', country: '' });
		const [values, setValues] = useState<Record<AddressKey, string>>(form.current);
		const [addressError, setAddressError] = useState<string | null>(null);
		const [saving, setSaving] = useState(false);
		useEffect(() => {
			let stale = false;
			api
				.getBillingAddress()
				.then((address) => {
					if (stale) return;
					const next = {
						name: address.name ?? '',
						street: address.street ?? '',
						zip: address.zip ?? '',
						city: address.city ?? '',
						country: address.country ?? '',
					};
					form.current = next;
					savedRef.current = next;
					setValues(next);
					onCompletenessChange?.(FIELDS.every(({ key }) => next[key].trim().length > 0));
				})
				.catch(async (reason) => stale || setAddressError((await toApiError(reason)).message));
			return () => {
				stale = true;
			};
		}, [onCompletenessChange]);
		const saveAddress = async (): Promise<boolean> => {
			setAddressError(null);
			const address = Object.fromEntries(FIELDS.map(({ key }) => [key, form.current[key].trim()])) as Record<
				AddressKey,
				string
			>;
			if (FIELDS.some(({ key }) => address[key].length === 0 || address[key].length > MAX_FIELD_LENGTH)) {
				setAddressError(t('address.invalid'));
				return false;
			}
			setSaving(true);
			try {
				await api.updateBillingAddress(address);
				savedRef.current = address;
				onCompletenessChange?.(true);
				onSaved?.();
				return true;
			} catch (reason) {
				setAddressError((await toApiError(reason)).message);
				return false;
			} finally {
				setSaving(false);
			}
		};
		/** Formular weicht vom geladenen bzw. gespeicherten Stand ab. */
		const isDirty = (): boolean => FIELDS.some(({ key }) => form.current[key].trim() !== savedRef.current[key].trim());
		useImperativeHandle(ref, () => ({ save: saveAddress, isDirty }));
		return (
			<>
				<div className="form-grid">
					{FIELDS.map(({ key, labelKey }) => (
						<KolInputText
							key={key}
							data-testid={`billing-address-${key}`}
							_label={t(labelKey)}
							_required
							_maxLength={MAX_FIELD_LENGTH}
							_type="search"
							_value={values[key]}
							_on={{
								onInput: (_event, value) => {
									const next = readString(value);
									form.current[key] = next;
									setValues({ ...form.current });
								},
								onChange: (_event, value) => {
									const next = readString(value);
									form.current[key] = next;
									setValues({ ...form.current });
								},
							}}
						/>
					))}
				</div>
				{addressError !== null && (
					<KolAlert _type="error" _label={t('address.saveFailed')}>
						{addressError}
					</KolAlert>
				)}
				<KolButton
					data-testid="billing-address-save"
					_label={saving ? t('address.saving') : t('address.save')}
					_variant="secondary"
					_disabled={saving}
					_on={{ onClick: () => void saveAddress() }}
				/>
			</>
		);
	},
);
