import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
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
	/** `immediate` aus der Vorschau: nur ein Upgrade wartet auf die Plan-Bestätigung, alles andere wirkt zum Periodenende (ADR 0013). */
	onChanged: (approvalUrl: string | undefined, immediate: boolean) => void;
}

/** Bestätigungsdialog vor einem Paketwechsel (#1496 AK3) — zeigt vorab Guthaben und fälligen Betrag (#1913). */
export const ChangeDialog = ({ targetPlan, targetPeriod, onClose, onChanged }: ChangeDialogProps) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<{ creditCents: number; dueCents: number; immediate: boolean } | null>(null);
	const [previewFailed, setPreviewFailed] = useState(false);
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	useEffect(() => {
		// Ignore-Flag: bei wechselndem Ziel darf keine veraltete Antwort den Betrag überschreiben.
		let stale = false;
		setPreview(null);
		setPreviewFailed(false);
		api
			.previewBillingChange({ plan: targetPlan, period: targetPeriod })
			.then((result) => {
				if (!stale) setPreview(result);
			})
			.catch(() => {
				if (!stale) setPreviewFailed(true);
			});
		return () => {
			stale = true;
		};
	}, [targetPlan, targetPeriod]);

	const confirm = async (): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			const { approvalUrl } = await api.changeBillingSubscription({ plan: targetPlan, period: targetPeriod });
			onChanged(approvalUrl, preview !== null && preview.immediate);
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
			{previewFailed && (
				<KolAlert _type="error" _label="Vorschau nicht verfügbar">
					Der fällige Betrag konnte nicht berechnet werden. Bitte den Dialog schließen und erneut öffnen.
				</KolAlert>
			)}
			<p>
				Wechsel zu <strong>{planLabel(targetPlan)}</strong> ({PERIOD_LABELS[targetPeriod]}).
			</p>
			{preview === null && !previewFailed && <KolSpin _label="Betrag wird berechnet …" />}
			<div aria-live="polite">
				{preview !== null && (
					<dl className="change-preview">
						{preview.creditCents > 0 && (
							<div>
								<dt>Guthaben aus dem laufenden Abo</dt>
								<dd>{formatEuro(preview.creditCents)}</dd>
							</div>
						)}
						<div>
							<dt>Fällig beim ersten Zyklus</dt>
							<dd>
								<strong>{formatEuro(preview.dueCents)}</strong>
							</dd>
						</div>
					</dl>
				)}
			</div>
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
					_disabled={busy || preview === null}
					_on={{ onClick: () => void confirm() }}
				/>
			</div>
		</Modal>
	);
};
