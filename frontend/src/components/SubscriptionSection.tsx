import { KolAlert, KolButton, KolDetails, KolSpin } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { planLabel } from '../lib/planOffers';
import { getChannel } from '../lib/platform';
import { usePlan } from '../lib/usePlan';
import { CHANNEL_PROVIDER } from './billingChannel';
import { ManagedBy } from './ManagedBy';
import { Modal } from './Modal';

type Invoice = components['schemas']['Invoice'];

const PERIOD_LABELS: Record<string, string> = { monthly: 'monatlich', quarterly: 'quartalsweise', yearly: 'jährlich' };

/** Zeitpunkte in Abo-Status und Rechnungsliste als „TT.MM.JJJJ" (Muster `ApiTokensSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/** PDF-Download je Rechnung (#1955 AK5) — Anker-Navigation; die Session läuft als Cookie mit, der Server liefert Content-Disposition. */
const downloadInvoicePdf = (invoice: Invoice): void => {
	const link = document.createElement('a');
	link.href = `/api/v1/billing/invoices/${invoice.id}/pdf`;
	link.download = `${invoice.number}.pdf`;
	document.body.appendChild(link);
	link.click();
	link.remove();
};

interface CancelDialogProps {
	onClose: () => void;
	onCancelled: () => void;
}

/** Bestätigungsdialog vor der Kündigung (#1496 AK3) — Kündigen-Button trägt `data-variant="danger"`. */
const CancelDialog = ({ onClose, onCancelled }: CancelDialogProps) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const confirm = async (): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			await api.cancelBillingSubscription();
			onCancelled();
		} catch (reason) {
			setError((await toApiError(reason)).message);
			setBusy(false);
		}
	};

	return (
		<Modal title="Abo kündigen" onClose={onClose} initialFocusRef={cancelRef as RefObject<HTMLElement | null>}>
			{error !== null && (
				<KolAlert _type="error" _label="Kündigung fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>Soll das laufende Abo wirklich gekündigt werden? Es bleibt bis zum Ende der laufenden Periode aktiv.</p>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					data-variant="danger"
					_label={busy ? 'Wird gekündigt…' : 'Kündigen'}
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
 * Abo, anstehender Wechsel und Kulanzfrist sichtbar; Rechnungen (und Kündigung, wenn möglich) in einem `KolDetails`.
 * Ohne Abo ein Hinweis, die Rechnungen nur, wenn es welche gibt (UX-Beratung zu #1902: kein „Pakete ansehen", die Pakete liegen darunter; AK3 von #1902 seit #1940 geändert).
 */
export const SubscriptionSection = () => {
	const { subscription } = usePlan();
	const [invoices, setInvoices] = useState<Invoice[] | null>(null);
	const [invoicesError, setInvoicesError] = useState<string | null>(null);
	const [cancelOpen, setCancelOpen] = useState(false);
	const canCancel = subscription?.provider === 'paypal' && CHANNEL_PROVIDER[getChannel()] === 'paypal';

	// Ehemalige Abonnenten (`subscription === null`) sehen ihre Rechnungen weiter, aber keine leere Gruppe (#1940).
	const showInvoices = subscription != null || (subscription === null && invoices !== null && invoices.length > 0);

	useEffect(() => {
		const controller = new AbortController();
		void Promise.resolve()
			.then(() => api.listBillingInvoices({ signal: controller.signal }))
			.then((value: Invoice[] | undefined) => setInvoices(value ?? []))
			.catch(() => {
				if (!controller.signal.aborted) {
					setInvoicesError('Die Rechnungen konnten nicht geladen werden.');
				}
			});
		return () => controller.abort();
	}, []);

	return (
		<div className="subscription-section" data-testid="subscription-section">
			{subscription != null ? (
				<>
					<section className="subscription-status" data-testid="subscription-status">
						<p>
							Aktuelles Paket: <strong>{planLabel(subscription.plan)}</strong> ({PERIOD_LABELS[subscription.period]})
						</p>
						<p>Periodenende: {formatDate(subscription.currentPeriodEnd)}</p>
						{subscription.pendingPlan !== null && (
							<p data-testid="subscription-pending-plan">
								Wechsel zu {planLabel(subscription.pendingPlan)}
								{subscription.pendingPlanEffectiveAt !== null
									? ` ab ${formatDate(subscription.pendingPlanEffectiveAt)}`
									: ''}
							</p>
						)}
						{subscription.graceUntil !== null && (
							<p data-testid="subscription-grace-until">Kulanzfrist bis {formatDate(subscription.graceUntil)}</p>
						)}
						{/* Kündigen über die eigene Route gibt es nur für PayPal im Web; sonst verwaltet der Anbieter (#1695). */}
						{!canCancel && <ManagedBy provider={subscription.provider} />}
					</section>
				</>
			) : (
				// `undefined` heißt „Abo-Status noch nicht geladen" — dann steht hier nichts, statt
				// fälschlich „kein Abo" zu behaupten (Muster `actionCell` in `PaypalPurchase`).
				subscription === null && (
					<section className="subscription-empty" data-testid="subscription-empty">
						<p>
							Für dieses Konto läuft derzeit kein Abo. Die Pakete darunter zeigen, was die kostenpflichtigen Stufen
							bieten.
						</p>
					</section>
				)
			)}

			{showInvoices && (
				<KolDetails _label={canCancel ? 'Rechnungen und Kündigung' : 'Rechnungen'} _level={3}>
					{canCancel && (
						<KolButton
							data-testid="cancel-subscription"
							_label="Abo kündigen"
							_variant="danger"
							_on={{ onClick: () => setCancelOpen(true) }}
						/>
					)}
					<section className="billing-invoices" data-testid="billing-invoices">
						{invoicesError !== null ? (
							<KolAlert _type="error" _label="Rechnungen">
								{invoicesError}
							</KolAlert>
						) : invoices === null ? (
							<KolSpin _show _variant="cycle" _label="Rechnungen werden geladen …" />
						) : invoices.length === 0 ? (
							<p data-testid="invoices-empty">Noch keine Rechnungen vorhanden.</p>
						) : (
							<ul className="billing-invoices__list">
								{invoices.map((invoice) => (
									<li key={invoice.id} className="billing-invoices__item">
										<span>{invoice.number}</span>
										<span>
											{formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
										</span>
										<span>{formatEuro(invoice.amountCents)}</span>
										<span>
											<KolButton
												data-testid="invoice-download"
												_label="PDF herunterladen"
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

			{cancelOpen && <CancelDialog onClose={() => setCancelOpen(false)} onCancelled={() => setCancelOpen(false)} />}
		</div>
	);
};
