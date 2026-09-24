import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { PERIOD_LABELS, planLabel, type Period, type Plan } from '../lib/planOffers';
import { useBillingReturnPoll } from '../lib/usePlan';
import { Modal } from './Modal';

/**
 * Wartezustand nach Rückkehr aus einem Buchungs-/Wechselvorgang ohne `approvalUrl` (#1496 AK4) —
 * eigene Komponente, damit `useBillingReturnPoll` nur gemountet läuft, solange eine Wartezeit
 * aktiv ist (kein Poll-Overhead im Normalfall).
 */
export const BillingReturnWait = ({
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
export const ChangeDialog = ({ targetPlan, targetPeriod, onClose, onChanged }: ChangeDialogProps) => {
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
