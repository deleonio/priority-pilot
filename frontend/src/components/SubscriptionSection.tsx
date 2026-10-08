import {
	KolAlert,
	KolBadge,
	KolButton,
	KolDetails,
	KolInputEmail,
	KolInputRadio,
	KolSpin,
	KolTextarea,
} from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import type { components } from 'client';
import i18next from '../i18n/config';
import { toApiError } from '../lib/apiError';
import type { Subscription } from '../lib/auth';
import { formatEuro, paymentStatusLabel } from '../lib/format';
import { readString } from '../lib/inputValue';
import { periodLabel, planLabel } from '../lib/planOffers';
import { getChannel } from '../lib/platform';
import { usePlan } from '../lib/usePlan';
import { CHANNEL_PROVIDER } from './billingChannel';
import { getApiBase } from '../lib/siteOrigin';
import { ManagedBy } from './ManagedBy';
import { Modal } from './Modal';

type Invoice = components['schemas']['Invoice'];

/** Zeitpunkte in Abo-Status und Rechnungsliste als „TT.MM.JJJJ" (Muster `ApiTokensSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(i18next.language);

/** PDF-Download je Rechnung (#1955 AK5) — Anker-Navigation; die Session läuft als Cookie mit, der Server liefert Content-Disposition. */
const downloadInvoicePdf = (invoice: Invoice): void => {
	const link = document.createElement('a');
	link.href = `${getApiBase()}/billing/invoices/${invoice.id}/pdf`;
	link.download = `${invoice.number}.pdf`;
	document.body.appendChild(link);
	link.click();
	link.remove();
};

type CancellationKind = 'ordinary' | 'extraordinary';

const KIND_VALUES: CancellationKind[] = ['ordinary', 'extraordinary'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CancelDialogProps {
	subscription: Subscription;
	/** Konto-Adresse als Vorbelegung der Bestätigungsadresse. */
	accountEmail: string;
	onClose: () => void;
	onCancelled: (email: string) => void;
}

/**
 * Bestätigungsschritt vor der Kündigung (#1496 AK3, § 312k Abs. 2 BGB seit #2308): Vertrag und Zeitpunkt
 * nur lesend, Art, Grund (Pflicht bei außerordentlich) und Bestätigungsadresse. Fehlende Angaben
 * erscheinen nach dem Klick am Feld, statt den Button stumm zu sperren (KI-UX). Der Ref-Guard fängt
 * den Doppel-Klick, bevor `busy` gerendert ist.
 */
const CancelDialog = ({ subscription, accountEmail, onClose, onCancelled }: CancelDialogProps) => {
	const [kind, setKind] = useState<CancellationKind>('ordinary');
	const [reason, setReason] = useState('');
	const [email, setEmail] = useState(accountEmail);
	const [touched, setTouched] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const busyRef = useRef(false);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	const { t } = useTranslation(['billing', 'common']);
	const kindOptions = KIND_VALUES.map((value) => ({ label: t(`cancelDialog.${value}`), value }));

	const reasonMissing = kind === 'extraordinary' && reason.trim() === '';
	const emailInvalid = !EMAIL_RE.test(email.trim());

	const confirm = async (): Promise<void> => {
		setTouched(true);
		if (reasonMissing || emailInvalid || busyRef.current) {
			return;
		}
		busyRef.current = true;
		setError(null);
		setBusy(true);
		try {
			await api.cancelBillingSubscription(
				kind === 'extraordinary' ? { kind, reason: reason.trim(), email: email.trim() } : { kind, email: email.trim() },
			);
			onCancelled(email.trim());
		} catch (failure) {
			setError((await toApiError(failure)).message);
			setBusy(false);
		} finally {
			busyRef.current = false;
		}
	};

	return (
		<Modal
			title={t('cancelDialog.title')}
			onClose={onClose}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label={t('cancelDialog.errorLabel')}>
					{error}
				</KolAlert>
			)}
			<p>
				<Trans
					t={t}
					i18nKey="cancelDialog.contract"
					values={{ plan: planLabel(subscription.plan), period: periodLabel(subscription.period) }}
					components={{ strong: <strong /> }}
				/>
			</p>
			<KolInputRadio
				_label={t('cancelDialog.kindLabel')}
				_orientation="vertical"
				_options={kindOptions}
				_value={kind}
				_on={{
					onChange: (_event, value) => {
						if (value === 'ordinary' || value === 'extraordinary') {
							setKind(value);
						}
					},
				}}
			/>
			{kind === 'extraordinary' && (
				<KolTextarea
					_label={t('cancelDialog.reason')}
					_required
					_rows={3}
					_value={reason}
					_touched={touched}
					_msg={reasonMissing ? { _type: 'error', _description: t('cancelDialog.reasonMissing') } : undefined}
					_on={{ onInput: (_event, value) => setReason(readString(value)) }}
				/>
			)}
			<p>{t('cancelDialog.effective', { date: formatDate(subscription.currentPeriodEnd) })}</p>
			<KolInputEmail
				_label={t('cancelDialog.emailLabel')}
				_required
				_autoComplete="email"
				_hint={t('cancelDialog.emailHint')}
				_value={email}
				_touched={touched}
				_msg={emailInvalid ? { _type: 'error', _description: t('cancelDialog.emailInvalid') } : undefined}
				_on={{ onInput: (_event, value) => setEmail(readString(value)) }}
			/>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label={t('common:actions.cancel')}
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					data-variant="danger"
					_label={busy ? t('cancelDialog.busy') : t('cancelDialog.confirm')}
					_variant="danger"
					_disabled={busy}
					_on={{ onClick: () => void confirm() }}
				/>
			</div>
		</Modal>
	);
};

/**
 * Obere Karte des Reiters „Pakete & Abo" (#1529, seit #1902 gemeinsam mit den Paketen) — laufendes
 * Abo, anstehender Wechsel und Kulanzfrist sichtbar; „Verträge hier kündigen" ohne Aufklappen (§ 312k BGB, #2308), Rechnungen in einem `KolDetails`.
 * Ohne Abo ein Hinweis, die Rechnungen nur, wenn es welche gibt (UX-Beratung zu #1902: kein „Pakete ansehen", die Pakete liegen darunter; AK3 von #1902 seit #1940 geändert).
 */
export const SubscriptionSection = () => {
	const { subscription, email } = usePlan();
	const { t } = useTranslation('billing');
	const [invoices, setInvoices] = useState<Invoice[] | null>(null);
	const [invoicesFailed, setInvoicesFailed] = useState(false);
	const [cancelOpen, setCancelOpen] = useState(false);
	// Merker nach erfolgreicher Kündigung: der Webhook stellt den Status erst verzögert um (#2048).
	const [locallyCancelled, setLocallyCancelled] = useState(false);
	// Bestätigungsadresse der lokalen Kündigung — die Mail kommt erst mit dem Webhook (KI-UX #2308).
	const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
	// Kündigen gibt es nur für PayPal im Web und nur, solange das Abo läuft (auch mit
	// Zahlungsrückstand, #2240) und noch nicht (auch lokal) gekündigt ist (#2048).
	const canCancel =
		subscription?.provider === 'paypal' &&
		CHANNEL_PROVIDER[getChannel()] === 'paypal' &&
		['active', 'past_due', 'suspended'].includes(subscription.status) &&
		!locallyCancelled;
	const isPaypalWeb = subscription?.provider === 'paypal' && CHANNEL_PROVIDER[getChannel()] === 'paypal';
	// Gekündigt mit laufendem Zeitraum: serverseitiger Status ODER lokaler Merker (#2048).
	const isCancelled =
		subscription != null &&
		new Date(subscription.currentPeriodEnd).getTime() > Date.now() &&
		(subscription.status === 'cancelled' || locallyCancelled);

	// Ein offener Checkout ist kein aktuelles Paket (#2235) — er erscheint wie „kein Abo".
	const current = subscription?.status === 'approval_pending' ? null : subscription;

	// Ehemalige Abonnenten (`subscription === null`) sehen ihre Rechnungen weiter, aber keine leere Gruppe (#1940).
	const showInvoices = subscription != null || (subscription === null && invoices !== null && invoices.length > 0);

	// Ein neues Abo (z. B. Weiterführen, #2049) meldet /auth/me als `approval_pending` — der lokale
	// Kündigungs-Merker verfällt, der Gekündigt-Hinweis verschwindet ohne Neuladen (AK7). Ein
	// weiterhin `active` geliefertes Abo dreht den Merker NICHT zurück: dessen Webhook steht noch
	// aus, genau dafür trägt der Merker (#2048).
	useEffect(() => {
		if (locallyCancelled && subscription?.status === 'approval_pending') {
			setLocallyCancelled(false);
		}
	}, [locallyCancelled, subscription]);

	useEffect(() => {
		const controller = new AbortController();
		void Promise.resolve()
			.then(() => api.listBillingInvoices({ signal: controller.signal }))
			.then((value: Invoice[] | undefined) => setInvoices(value ?? []))
			.catch(() => {
				if (!controller.signal.aborted) {
					setInvoicesFailed(true);
				}
			});
		return () => controller.abort();
	}, []);

	return (
		<div className="subscription-section" data-testid="subscription-section">
			{current != null ? (
				<>
					<section className="subscription-status" data-testid="subscription-status">
						<p>
							<Trans
								t={t}
								i18nKey="subscription.current"
								values={{ plan: planLabel(current.plan), period: periodLabel(current.period) }}
								components={{ strong: <strong /> }}
							/>
						</p>
						<p>{t('subscription.periodEnd', { date: formatDate(current.currentPeriodEnd) })}</p>
						{current.pendingPlan !== null && (
							<p data-testid="subscription-pending-plan">
								{current.pendingPlanEffectiveAt !== null
									? t('subscription.pendingAt', {
											plan: planLabel(current.pendingPlan),
											date: formatDate(current.pendingPlanEffectiveAt),
										})
									: t('subscription.pendingOnPayment', { plan: planLabel(current.pendingPlan) })}
							</p>
						)}
						{current.graceUntil !== null && (
							<p data-testid="subscription-grace-until">
								{t('subscription.graceUntil', { date: formatDate(current.graceUntil) })}
							</p>
						)}
						{isCancelled && (
							<p data-testid="subscription-cancelled" aria-live="polite">
								{t('subscription.cancelled', { date: formatDate(current.currentPeriodEnd) })}
							</p>
						)}
						{isCancelled && confirmationEmail !== null && (
							<p>{t('subscription.confirmationSent', { email: confirmationEmail })}</p>
						)}
						{canCancel && (
							<KolButton
								data-testid="cancel-subscription"
								_label={t('subscription.cancel')}
								_variant="danger"
								_on={{ onClick: () => setCancelOpen(true) }}
							/>
						)}
						{/* Kündigen über die eigene Route gibt es nur für PayPal im Web; sonst verwaltet der Anbieter (#1695). */}
						{!isPaypalWeb && <ManagedBy provider={current.provider} />}
					</section>
				</>
			) : (
				// `undefined` heißt „Abo-Status noch nicht geladen" — dann steht hier nichts, statt
				// fälschlich „kein Abo" zu behaupten (Muster `actionCell` in `PaypalPurchase`).
				current === null && (
					<section className="subscription-empty" data-testid="subscription-empty">
						<p>{t('subscription.empty')}</p>
					</section>
				)
			)}

			{showInvoices && (
				<KolDetails _label={t('invoices.label')} _level={3}>
					<section className="billing-invoices" data-testid="billing-invoices">
						{invoicesFailed ? (
							// Eigener Titel: „Rechnungen" trägt seit #2308 immer das KolDetails-Label.
							<KolAlert _type="error" _label={t('subscription.loadErrorLabel')}>
								{t('subscription.invoicesLoadFailed')}
							</KolAlert>
						) : invoices === null ? (
							<KolSpin _show _variant="cycle" _label={t('invoices.loading')} />
						) : invoices.length === 0 ? (
							<p data-testid="invoices-empty">{t('invoices.empty')}</p>
						) : (
							<ul className="billing-invoices__list">
								{invoices.map((invoice) => (
									<li key={invoice.id} className="billing-invoices__item">
										<span>{invoice.number}</span>
										<span>
											{formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
										</span>
										<span>{formatEuro(invoice.amountCents)}</span>
										{/* Status als Text-Badge — Information nie allein über Farbe (WCAG 1.4.1, KI-UX). */}
										<KolBadge _label={paymentStatusLabel(invoice.paymentStatus)} />
										<span>
											<KolButton
												data-testid="invoice-download"
												_label={t('invoices.download', { number: invoice.number })}
												_variant="secondary"
												_icons={{ left: { icon: 'fa-solid fa-download' } }}
												_on={{ onClick: () => downloadInvoicePdf(invoice) }}
											/>
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
				</KolDetails>
			)}

			{cancelOpen && current != null && (
				<CancelDialog
					subscription={current}
					accountEmail={email ?? ''}
					onClose={() => setCancelOpen(false)}
					onCancelled={(confirmedTo) => {
						setConfirmationEmail(confirmedTo);
						setLocallyCancelled(true);
						setCancelOpen(false);
					}}
				/>
			)}
		</div>
	);
};
