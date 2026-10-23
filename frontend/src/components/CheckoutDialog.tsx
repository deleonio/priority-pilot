import { KolAlert, KolButton, KolDetails, KolInputCheckbox, KolLink } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { components } from 'client';
import { toApiError } from '../lib/apiError';
import { legalPath } from '../lib/operator';
import { formatEuro } from '../lib/format';
import { periodLabel, planLabel, type Period, type Plan } from '../lib/planOffers';
import { BillingAddressForm, type BillingAddressFormHandle } from './BillingAddressForm';
import { Modal } from './Modal';

/** PayPal-Sandbox-Testkonto aus `GET /plans` — der Server liefert es nur im Sandbox-Modus mit. */
type SandboxAccount = NonNullable<components['schemas']['PlansCatalog']['paypalSandboxAccount']>;

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
 * beides zusammen schaltet „Zahlungspflichtig bestellen“ frei (§ 312f BGB, #2307). Preis und
 * Verlängerungshinweis stehen oberhalb der Zustimmung (#2766); der Katalog-Preis wird ohne
 * Platzhalter ausgewiesen, ein Ladefehler als Meldung im Dialog.
 */
export const CheckoutDialog = ({ targetPlan, targetPeriod, onClose, onOrder }: CheckoutDialogProps) => {
	const { t, i18n } = useTranslation(['billing', 'messages']);
	const formRef = useRef<BillingAddressFormHandle>(null);
	/** Vollständige Adresse aus dem Formular — mit der Widerrufs-Zustimmung schaltet sie bestellen frei. */
	const [hasAddress, setHasAddress] = useState(false);
	const [withdrawalConsent, setWithdrawalConsent] = useState(false);
	const [orderError, setOrderError] = useState<string | null>(null);
	const [ordering, setOrdering] = useState(false);
	/** Gesamtpreis des gewählten Pakets/Zeitraums aus `GET /plans` (#2766) — `null`, solange nicht geladen. */
	const [price, setPrice] = useState<number | null>(null);
	const [priceFailed, setPriceFailed] = useState(false);
	/** Sandbox-Testkonto aus dem geladenen Katalog — `null`, solange nicht geladen bzw. im LIVE-Betrieb. */
	const [sandboxAccount, setSandboxAccount] = useState<SandboxAccount | null>(null);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	// #2766: Preis kommt allein aus dem Paket-Katalog (keine zweite Quelle) — Muster PlansSection
	// (AbortController, `Promise.resolve().then` hält synchronen Fehler im Fehlerzustand).
	useEffect(() => {
		const controller = new AbortController();
		void Promise.resolve()
			.then(() => api.getPlansCatalog({ signal: controller.signal }))
			.then((catalog) => {
				setSandboxAccount(catalog.paypalSandboxAccount ?? null);
				const cents = catalog.prices[targetPlan]?.[targetPeriod];
				if (typeof cents !== 'number') throw new Error('Unerwartete Antwort von GET /plans.');
				setPrice(cents);
			})
			.catch(() => {
				// StrictMode montiert Effekte doppelt — der abgebrochene erste Versuch darf den
				// Fehlerzustand nicht setzen (sonst gewinnt er gegen den zweiten, erfolgreichen).
				if (!controller.signal.aborted) setPriceFailed(true);
			});
		return () => controller.abort();
	}, [targetPlan, targetPeriod]);
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
		// Ungespeicherte Änderungen sichert der Dialog vor der Bestellung — auch bei bereits
		// gespeicherter Adresse (Review: kein stiller Verwurf des alten Standes).
		const form = formRef.current;
		if (form && (!hasAddress || form.isDirty()) && !(await form.save())) return;
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
				<BillingAddressForm ref={formRef} onCompletenessChange={setHasAddress} />
			</KolDetails>
			{priceFailed && (
				<KolAlert _type="error" _label={t('plans.label')}>
					{t('plans.loadFailed')}
				</KolAlert>
			)}
			{price !== null && (
				<>
					{/* #2766: Preis mit Bezugsgröße (KI-UX) — Endpreis-Hinweis abgesetzt, kein Platzhalter. */}
					<p data-testid="checkout-price">
						<strong>
							{t('checkoutDialog.price', { price: formatEuro(price), period: t(`periodUnits.${targetPeriod}`) })}
						</strong>{' '}
						<span style={{ color: 'var(--pp-ink-muted)', fontSize: 'var(--pp-font-size-sm)' }}>
							{t('checkoutDialog.finalPrice')}
						</span>
					</p>
					<p data-testid="checkout-renewal">{t('checkoutDialog.renewal')}</p>
				</>
			)}
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
			{sandboxAccount !== null && (
				<p className="sandbox-hint">
					{t('checkoutDialog.sandboxHint', {
						email: sandboxAccount.email,
						password: sandboxAccount.password,
					})}
				</p>
			)}
		</Modal>
	);
};
