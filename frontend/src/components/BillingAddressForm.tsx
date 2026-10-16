import { KolAlert, KolButton, KolInputText } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
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

/**
 * Rechnungsadresse vor dem Abo-Abschluss (#2661): lädt beim Mount die gespeicherte Adresse,
 * zeigt sie ausgefüllt zum Ändern und speichert sie über `PUT /billing/address`. Alle fünf
 * Felder sind Pflicht (Server validiert gleich), inline statt Alert-Wechsel (Muster
 * `GroupFormDialog`). Ohne gespeicherte Adresse bleibt das Formular offen.
 */
export const BillingAddressForm = () => {
	const { t } = useTranslation('billing');
	const form = useRef<Record<AddressKey, string>>({ name: '', street: '', zip: '', city: '', country: '' });
	const [values, setValues] = useState<Record<AddressKey, string>>(form.current);
	const [addressError, setAddressError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [hasAddress, setHasAddress] = useState(false);
	useEffect(() => {
		api
			.getBillingAddress()
			.then((address) => {
				const next = {
					name: address.name ?? '',
					street: address.street ?? '',
					zip: address.zip ?? '',
					city: address.city ?? '',
					country: address.country ?? '',
				};
				form.current = next;
				setValues(next);
				setHasAddress(FIELDS.every(({ key }) => next[key].trim().length > 0));
			})
			.catch(async (reason) => setAddressError((await toApiError(reason)).message));
	}, []);
	const save = async (): Promise<void> => {
		setAddressError(null);
		const address = Object.fromEntries(FIELDS.map(({ key }) => [key, form.current[key].trim()])) as Record<
			AddressKey,
			string
		>;
		if (FIELDS.some(({ key }) => address[key].length === 0 || address[key].length > MAX_FIELD_LENGTH)) {
			setAddressError(t('address.invalid'));
			return;
		}
		setSaving(true);
		try {
			await api.updateBillingAddress(address);
			setSaved(true);
			setHasAddress(true);
		} catch (reason) {
			setAddressError((await toApiError(reason)).message);
		} finally {
			setSaving(false);
		}
	};
	if (hasAddress && !saved) {
		return (
			<p>
				<KolButton
					data-testid="billing-address-edit"
					_label={t('address.edit')}
					_variant="tertiary"
					_on={{ onClick: () => setHasAddress(false) }}
				/>
			</p>
		);
	}
	return (
		<div className="billing-address" data-testid="billing-address-form">
			<h3>{t('address.required')}</h3>
			<p>{t('address.requiredHint')}</p>
			{saved && (
				<KolAlert _type="success" _label={t('address.saved')}>
					{t('address.saved')}
				</KolAlert>
			)}
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
				_variant="primary"
				_disabled={saving}
				_on={{ onClick: () => void save() }}
			/>
		</div>
	);
};
