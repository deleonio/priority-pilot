import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { planLabel } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';
import { Modal } from './Modal';

type Invoice = components['schemas']['Invoice'];

const PERIOD_LABELS: Record<string, string> = { monthly: 'monatlich', quarterly: 'quartalsweise', yearly: 'jährlich' };

/** Zeitpunkte in Abo-Status und Rechnungsliste als „TT.MM.JJJJ" (Muster `ApiTokensSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

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

interface SubscriptionSectionProps {
	/** #1529 AK7: führt zum Pakete-Reiter — ohne laufendes Abo die einzige sinnvolle nächste Handlung. */
	onShowPlans?: () => void;
}

/**
 * Reiter „Abo" der Einstellungen (#1529 AK1/AK7) — laufendes Abo, anstehender Wechsel, Kulanzfrist,
 * Kündigung und Rechnungsliste. Die Abschnitte kommen unverändert aus `PlansSection` (#1496 T6c);
 * neu ist nur der Zustand ohne Abo: statt einer leeren Seite ein Hinweis mit der Handlung „Pakete
 * ansehen" (UX-Beratung zu #1529: aktiver Hinweis statt reiner Leerzustands-Notiz).
 */
export const SubscriptionSection = ({ onShowPlans }: SubscriptionSectionProps) => {
	const { subscription } = usePlan();
	const [invoices, setInvoices] = useState<Invoice[] | null>(null);
	const [invoicesError, setInvoicesError] = useState<string | null>(null);
	const [cancelOpen, setCancelOpen] = useState(false);

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
					<KolButton
						data-testid="cancel-subscription"
						_label="Abo kündigen"
						_variant="danger"
						_on={{ onClick: () => setCancelOpen(true) }}
					/>
				</section>
			) : (
				// `undefined` heißt „Abo-Status noch nicht geladen" — dann steht hier nichts, statt
				// fälschlich „kein Abo" zu behaupten (Muster `renderActionCell` in `PlansSection`).
				subscription === null && (
					<section className="subscription-empty" data-testid="subscription-empty">
						<p>Für dieses Konto läuft derzeit kein Abo. Die Pakete zeigen, was die kostenpflichtigen Stufen bieten.</p>
						<KolButton _label="Pakete ansehen" _variant="primary" _on={{ onClick: () => onShowPlans?.() }} />
					</section>
				)
			)}

			<section className="billing-invoices" data-testid="billing-invoices">
				<h3>Rechnungen</h3>
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
							</li>
						))}
					</ul>
				)}
			</section>

			{cancelOpen && <CancelDialog onClose={() => setCancelOpen(false)} onCancelled={() => setCancelOpen(false)} />}
		</div>
	);
};
