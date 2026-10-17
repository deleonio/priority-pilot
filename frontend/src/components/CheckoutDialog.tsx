import { KolAlert, KolButton, KolDetails, KolInputCheckbox, KolInputText, KolLink } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { legalPath } from '../lib/operator';
import { readString } from '../lib/inputValue';
import { periodLabel, planLabel, type Period, type Plan } from '../lib/planOffers';
import { Modal } from './Modal';

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

interface CheckoutDialogProps {
	targetPlan: Exclude<Plan, 'free'>;
	targetPeriod: Period;
	onClose: () => void;
	/** Liefert die Bestellung aus — der Aufrufer leitet auf die PayPal-Zustimmungs-URL weiter. */
	onOrder: () => Promise<void>;
}

/**
 * Bestell-Dialog vor dem Zahlungsanbieter (#2661): Rechnungsadresse und Widerrufs-Zustimmung
 * in einem Schritt. Das Adress-Details ist offen und deaktiviert die Bestellung, solange keine
 * vollständige Adresse gespeichert ist; die Widerrufs-Checkbox ist zusätzlich nötig. Erst
 * beides zusammen schaltet „Zahlungspflichtig bestellen“ frei (§ 312f BGB, #2307).
 */
export const CheckoutDialog = ({ targetPlan, targetPeriod, onClose, onOrder }: CheckoutDialogProps) => {
	const { t, i18n } = useTranslation(['billing', 'messages']);
	const form = useRef<Record<AddressKey, string>>({ name: '', street: '', zip: '', city: '', country: '' });
	const [values, setValues] = useState<Record<AddressKey, string>>(form.current);
	const [hasAddress, setHasAddress] = useState(false);
	const [withdrawalConsent, setWithdrawalConsent] = useState(false);
	const [addressError, setAddressError] = useState<string | null>(null);
	const [orderError, setOrderError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [ordering, setOrdering] = useState(false);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
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
				setValues(next);
				setHasAddress(FIELDS.every(({ key }) => next[key].trim().length > 0));
			})
			.catch(async (reason) => stale || setAddressError((await toApiError(reason)).message));
		return () => {
			stale = true;
		};
	}, []);
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
			setHasAddress(true);
			return true;
		} catch (reason) {
			setAddressError((await toApiError(reason)).message);
			return false;
		} finally {
			setSaving(false);
		}
	};
	const order = async (): Promise<void> => {
		setOrderError(null);
		setOrdering(true);
		try {
			await onOrder();
		} catch (reason) {
			setOrderError((await toApiError(reason)).message);
			setOrdering(false);
		}
	};
	const confirm = async (): Promise<void> => {
		// Ohne gespeicherte Adresse sichert der Dialog sie zuerst (Server prüft erneut, #2661).
		if (!hasAddress && !(await saveAddress())) return;
		await order();
	};
	return (
		<Modal
			title={t('checkoutDialog.title', {
				plan: planLabel(targetPlan),
				period: periodLabel(targetPeriod),
			})}
			onClose={onClose}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{orderError !== null && (
				<KolAlert _type="error" _label={t('paypal.bookingFailed')}>
					{orderError}
				</KolAlert>
			)}
			<p>
				{t('checkoutDialog.intro', {
					plan: planLabel(targetPlan),
					period: periodLabel(targetPeriod),
				})}
			</p>
			{/* #2661: Adress-Details ist offen, solange keine vollständige Adresse hinterlegt ist. */}
			<KolDetails
				_label={hasAddress ? t('checkoutDialog.addressEdit') : t('checkoutDialog.addressCreate')}
				_open={!hasAddress}
			>
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
			</KolDetails>
			<div className="withdrawal-consent" data-testid="withdrawal-consent">
				<p>
					{t('messages:billing.withdrawal.hint')}{' '}
					<KolLink
						_href={legalPath('withdrawal', i18n.language)}
						_label={t('messages:billing.withdrawal.link')}
						_target="_blank"
					/>
				</p>
				<KolInputCheckbox
					_label={t('messages:billing.withdrawal.consent')}
					_checked={withdrawalConsent}
					_on={{ onChange: () => setWithdrawalConsent((value) => !value) }}
				/>
			</div>
			<KolButton
				data-testid="order-submit"
				_label=""
				_variant="primary"
				_disabled={!hasAddress || !withdrawalConsent || ordering}
				_on={{ onClick: () => void confirm() }}
			>
				<span slot="expert">
					{t('messages:billing.withdrawal.order')}
					<span className="visually-hidden">{` ${planLabel(targetPlan)} (${periodLabel(targetPeriod)})`}</span>
				</span>
			</KolButton>
			<KolButton ref={cancelRef} _label={t('common:cancel')} _variant="tertiary" _on={{ onClick: onClose }} />
		</Modal>
	);
};
