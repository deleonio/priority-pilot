import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { featureOffer, planLabel, type Plan } from '../lib/planOffers';
import { useBillingReturnPoll, usePlan } from '../lib/usePlan';
import { Modal } from './Modal';

type PlansCatalog = components['schemas']['PlansCatalog'];
type Invoice = components['schemas']['Invoice'];

const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_LABELS: Record<Period, string> = { monthly: 'monatlich', quarterly: 'quartalsweise', yearly: 'jährlich' };

/** Zeitpunkte in Abo-Status und Rechnungsliste als „TT.MM.JJJJ" (Muster `ApiTokensSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/**
 * Wartezustand nach Rückkehr aus einem Buchungs-/Wechselvorgang ohne `approvalUrl` (#1496 AK4) —
 * eigene Komponente, damit `useBillingReturnPoll` nur gemountet läuft, solange eine Wartezeit
 * aktiv ist (kein Poll-Overhead im Normalfall).
 */
const BillingReturnWait = ({
	refresh,
	expectedPlan,
	currentPlan,
}: {
	refresh: () => Promise<void>;
	expectedPlan: Plan;
	currentPlan: Plan | null;
}) => {
	const { status } = useBillingReturnPoll(refresh, expectedPlan, currentPlan);
	if (status === 'confirmed') {
		return null;
	}
	if (status === 'timeout') {
		return (
			<KolAlert _type="warning" _alert _label="Zahlung wird bestätigt">
				Die Bestätigung dauert länger als erwartet. Bitte die Einstellungen in Kürze erneut öffnen.
			</KolAlert>
		);
	}
	return (
		<KolAlert _type="info" _alert _label="Zahlung wird bestätigt">
			Zahlung wird bestätigt …
		</KolAlert>
	);
};

interface ChangeDialogProps {
	targetPlan: Exclude<Plan, 'free'>;
	targetPeriod: Period;
	onClose: () => void;
	onChanged: (approvalUrl: string | undefined) => void;
}

/** Bestätigungsdialog vor einem Paketwechsel (#1496 AK3) — nennt die Restbetrag-Anrechnung. */
const ChangeDialog = ({ targetPlan, targetPeriod, onClose, onChanged }: ChangeDialogProps) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const confirm = async (): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			const { approvalUrl } = await api.changeBillingSubscription({ plan: targetPlan, period: targetPeriod });
			onChanged(approvalUrl);
		} catch (reason) {
			setError((await toApiError(reason)).message);
			setBusy(false);
		}
	};

	return (
		<Modal title="Paket wechseln" onClose={onClose} initialFocusRef={cancelRef as RefObject<HTMLElement | null>}>
			{error !== null && (
				<KolAlert _type="error" _label="Wechsel fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Wechsel zu <strong>{planLabel(targetPlan)}</strong> ({PERIOD_LABELS[targetPeriod]}). Der Restbetrag des
				laufenden Abos wird als Rabatt angerechnet — gegen das Zahlungssystem läuft nur die Differenz.
			</p>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					_label={busy ? 'Wird gewechselt…' : 'Wechseln bestätigen'}
					_variant="primary"
					_disabled={busy}
					_on={{ onClick: () => void confirm() }}
				/>
			</div>
		</Modal>
	);
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
 * Sekundärbereich „Pakete" in den Einstellungen (#1458 AK11, erweitert um #1496 T6c). Feature-Matrix
 * und Preise kommen vollständig aus `GET /plans`; Buchen/Wechseln/Kündigen laufen über die Abo-Routen
 * (#1505/#1506) — der angezeigte Plan ändert sich erst, wenn `/auth/me` ihn liefert (AK3/AK4).
 */
export const PlansSection = () => {
	const { plan, subscription, refresh } = usePlan();
	const [catalog, setCatalog] = useState<PlansCatalog | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [invoices, setInvoices] = useState<Invoice[] | null>(null);
	const [invoicesError, setInvoicesError] = useState<string | null>(null);
	const [bookingKey, setBookingKey] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [changeTarget, setChangeTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	const [cancelOpen, setCancelOpen] = useState(false);
	const [pendingWait, setPendingWait] = useState<{ expectedPlan: Plan } | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		// `Promise.resolve().then(…)`: Der Aufruf liegt bewusst IM Promise, damit auch ein synchroner
		// Fehler (z. B. eine in Tests nur teilweise gemockte API-Fassade) im Fehlerzustand landet und
		// nicht den Render-Baum reißt — die Karte zeigt dann den Ladefehler statt eines Absturzes.
		void Promise.resolve()
			.then(() => api.getPlansCatalog({ signal: controller.signal }))
			.then((value: PlansCatalog | undefined) => {
				// Der Katalog wird nur übernommen, wenn er wirklich Matrix UND Preise trägt — sonst ist es
				// keine gültige Antwort und die Karte zeigt den Ladefehler statt halber Daten.
				if (value === undefined || !Array.isArray(value.features) || typeof value.prices !== 'object') {
					throw new Error('Unerwartete Antwort von GET /plans.');
				}
				setCatalog(value);
			})
			.catch(() => {
				// StrictMode montiert Effekte doppelt (Setup→Cleanup→Setup): der abgebrochene erste
				// Versuch darf den Fehlerzustand NICHT mehr setzen, sonst gewinnt er das Rennen gegen
				// den erfolgreichen zweiten Versuch und die Karte zeigt fälschlich den Ladefehler.
				if (!controller.signal.aborted) {
					setError('Die Pakete konnten nicht geladen werden.');
				}
			});
		return () => controller.abort();
	}, []);

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

	const handleBook = async (targetPlan: Exclude<Plan, 'free'>, period: Period): Promise<void> => {
		const key = `${targetPlan}-${period}`;
		setActionError(null);
		setBookingKey(key);
		try {
			const { approvalUrl } = await api.createBillingSubscription({ plan: targetPlan, period });
			if (approvalUrl !== undefined) {
				window.location.href = approvalUrl;
				return;
			}
		} catch (reason) {
			setActionError((await toApiError(reason)).message);
		} finally {
			setBookingKey(null);
		}
	};

	if (error !== null) {
		return (
			<KolAlert _type="error" _label="Pakete">
				{error}
			</KolAlert>
		);
	}

	if (catalog === null) {
		return <KolSpin _show _variant="cycle" _label="Pakete werden geladen …" />;
	}

	const plans = Object.keys(catalog.prices);

	const renderActionCell = (targetPlan: Exclude<Plan, 'free'>, period: Period) => {
		// `undefined` heißt „Abo-Status noch nicht geladen" (usePlanState hat /auth/me noch nicht
		// beantwortet) — bis dahin lieber keine Aktion zeigen als fälschlich „Buchen" (kein Abo) oder
		// „Wechseln" (Abo vorhanden) zu behaupten.
		if (subscription === undefined) {
			return null;
		}
		if (subscription !== null && subscription.plan === targetPlan && subscription.period === period) {
			return <span>Aktuelles Paket</span>;
		}
		if (subscription === null) {
			return (
				<KolButton
					data-testid={`book-${targetPlan}-${period}`}
					_label="Buchen"
					_variant="primary"
					_disabled={bookingKey === `${targetPlan}-${period}`}
					_on={{ onClick: () => void handleBook(targetPlan, period) }}
				/>
			);
		}
		return (
			<KolButton
				data-testid={`change-plan-${targetPlan}-${period}`}
				_label="Wechseln"
				_variant="secondary"
				_on={{ onClick: () => setChangeTarget({ plan: targetPlan, period }) }}
			/>
		);
	};

	return (
		<div className="plans-section" data-testid="plans-section">
			{actionError !== null && (
				<KolAlert _type="error" _label="Buchung fehlgeschlagen">
					{actionError}
				</KolAlert>
			)}

			{subscription != null && (
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
			)}

			{pendingWait !== null && refresh !== undefined && (
				<BillingReturnWait refresh={refresh} expectedPlan={pendingWait.expectedPlan} currentPlan={plan} />
			)}

			<table className="plans-matrix">
				<thead>
					<tr>
						<th scope="col">Funktion</th>
						{plans.map((key) => (
							<th key={key} scope="col">
								{planLabel(key)}
								{key === plan ? ' (dein Paket)' : ''}
							</th>
						))}
					</tr>
					{PERIODS.map((period) => (
						<tr key={`price-${period}`}>
							<th scope="row">{`Preis ${PERIOD_LABELS[period]}`}</th>
							{plans.map((key) => (
								<td key={key}>{formatEuro(catalog.prices[key][period])}</td>
							))}
						</tr>
					))}
					{PERIODS.map((period) => (
						<tr key={`action-${period}`}>
							<th scope="row">{`Buchen ${PERIOD_LABELS[period]}`}</th>
							{plans.map((key) =>
								key === 'free' ? (
									<td key={key}>—</td>
								) : (
									<td key={key}>{renderActionCell(key as Exclude<Plan, 'free'>, period)}</td>
								),
							)}
						</tr>
					))}
				</thead>
				<tbody>
					{catalog.features.map((entry) => (
						<tr key={entry.feature}>
							<th scope="row">{featureOffer(entry.feature).title}</th>
							{plans.map((key) => (
								<td key={key}>{entry.allowedPlans.includes(key as never) ? 'enthalten' : '—'}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>

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

			{changeTarget !== null && (
				<ChangeDialog
					targetPlan={changeTarget.plan}
					targetPeriod={changeTarget.period}
					onClose={() => setChangeTarget(null)}
					onChanged={(approvalUrl) => {
						const target = changeTarget;
						setChangeTarget(null);
						if (approvalUrl !== undefined) {
							window.location.href = approvalUrl;
							return;
						}
						setPendingWait({ expectedPlan: target.plan });
					}}
				/>
			)}

			{cancelOpen && <CancelDialog onClose={() => setCancelOpen(false)} onCancelled={() => setCancelOpen(false)} />}
		</div>
	);
};
