import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { periodLabel, planLabel, type Period, type Plan } from '../lib/planOffers';
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
	const { t } = useTranslation('billing');
	if (status === 'confirmed') {
		return null;
	}
	if (status === 'timeout') {
		return (
			<KolAlert _type="warning" _alert _label={t('returnWait.label')}>
				{t('returnWait.timeout')}
			</KolAlert>
		);
	}
	return (
		<KolAlert _type="info" _alert _label={t('returnWait.label')}>
			{t('returnWait.pending')}
		</KolAlert>
	);
};

/** Zeitpunkte der Vorschau als „TT.MM.JJJJ" (Muster `SubscriptionSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(i18next.language);

interface ChangeDialogProps {
	targetPlan: Exclude<Plan, 'free'>;
	targetPeriod: Period;
	onClose: () => void;
	/** `immediate` aus der Vorschau: nur ein Upgrade wartet auf die Plan-Bestätigung, alles andere wirkt zum Periodenende (ADR 0013). */
	onChanged: (approvalUrl: string | undefined, immediate: boolean) => void;
}

/** Bestätigungsdialog vor einem Paketwechsel (#1496 AK3) — zeigt vorab Guthaben, fälligen Betrag (#1913) und Startzeitpunkt (#2049). */
export const ChangeDialog = ({ targetPlan, targetPeriod, onClose, onChanged }: ChangeDialogProps) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<{
		priceCents: number;
		creditCents: number;
		dueCents: number;
		immediate: boolean;
		startsAt?: string;
		creditCoversUntil?: string;
		currentPlan?: Plan;
	} | null>(null);
	const [previewFailed, setPreviewFailed] = useState(false);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	const { t } = useTranslation(['billing', 'common']);

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
		<Modal
			title={t('changeDialog.title')}
			onClose={onClose}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label={t('changeDialog.errorLabel')}>
					{error}
				</KolAlert>
			)}
			{previewFailed && (
				<KolAlert _type="error" _label={t('changeDialog.previewFailedLabel')}>
					{t('changeDialog.previewFailedText')}
				</KolAlert>
			)}
			<p>
				<Trans
					t={t}
					i18nKey="changeDialog.target"
					values={{ plan: planLabel(targetPlan), period: periodLabel(targetPeriod) }}
					components={{ strong: <strong /> }}
				/>
			</p>
			{preview === null && !previewFailed && <KolSpin _label={t('changeDialog.calculating')} />}
			<div aria-live="polite">
				{preview !== null && (
					<dl className="change-preview">
						{preview.currentPlan != null && preview.startsAt != null ? (
							<>
								<div>
									<dt>{t('changeDialog.currentUntil')}</dt>
									<dd>{formatDate(preview.startsAt)}</dd>
								</div>
								<div>
									<dt>
										{t('changeDialog.startsAt', {
											date: formatDate(preview.startsAt),
											plan: planLabel(targetPlan),
											price: formatEuro(preview.priceCents),
											unit: t(`periodUnits.${targetPeriod}`),
										})}
									</dt>
								</div>
							</>
						) : preview.immediate ? (
							<>
								<div>
									<dt>{t('changeDialog.price', { plan: planLabel(targetPlan), period: periodLabel(targetPeriod) })}</dt>
									<dd>{formatEuro(preview.priceCents)}</dd>
								</div>
								{preview.creditCents > 0 && (
									<div>
										<dt>{t('changeDialog.credit')}</dt>
										<dd>−{formatEuro(preview.creditCents)}</dd>
									</div>
								)}
							</>
						) : null}
						<div>
							<dt>
								{/* #2241: bei einem Guthaben über dem Preis zieht PayPal den Rest als Gebühr bei der Zustimmung ein. */}
								{preview.currentPlan != null
									? t('changeDialog.dueNow')
									: preview.creditCoversUntil != null && preview.dueCents > 0
										? t('changeDialog.dueOnApproval')
										: t('changeDialog.dueFirstCycle')}
							</dt>
							<dd>
								<strong>{formatEuro(preview.dueCents)}</strong>
							</dd>
						</div>
						{preview.creditCoversUntil != null && (
							<div>
								<dt>{t('changeDialog.creditCoversUntil')}</dt>
								<dd>{formatDate(preview.creditCoversUntil)}</dd>
							</div>
						)}
						{preview.currentPlan == null && preview.startsAt != null && (
							<div>
								<dt>{t('changeDialog.effectiveFrom')}</dt>
								<dd>{preview.immediate ? t('changeDialog.immediately') : formatDate(preview.startsAt)}</dd>
							</div>
						)}
					</dl>
				)}
			</div>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label={t('common:actions.cancel')}
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					_label={busy ? t('changeDialog.busy') : t('changeDialog.confirm')}
					_variant="primary"
					_disabled={busy || preview === null}
					_on={{ onClick: () => void confirm() }}
				/>
			</div>
		</Modal>
	);
};
