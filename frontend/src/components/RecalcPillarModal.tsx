import { KolAlert, KolButton, KolInputRadio } from '@public-ui/react-v19';
import type { ReassignStatusFilter } from 'client';
import { useCallback, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { useReassignRun, type ReassignPortionArgs } from '../lib/useReassignRun';
import { Modal } from './Modal';
import { ReassignFailureList, ReassignProgressView, ReassignStatusText } from './ReassignRunViews';

interface RecalcPillarModalProps {
	onClose: () => void;
	/** Nach einem Lauf, der etwas verändert hat — die Aufrufer laden ihre Aufgaben neu. */
	onCompleted?: () => void;
}

/**
 * Neuberechnung der Säulenverteilung über die eigenen Aufgaben (#1614).
 *
 * Die Verteilung entsteht serverseitig über den KI-Klassifikator (`POST /tasks/reassign-pillars`) —
 * dieselbe Semantik wie beim app-weiten Admin-Batch. Das Modal rechnet bewusst NICHTS selbst: ein
 * zweiter, clientseitiger Rechenweg hätte für dieselbe fachliche Operation eine abweichende
 * Semantik ergeben (Review-Finding #5 zu PR #1615).
 *
 * Den portionierten Lauf, den Fortschritt und das Fortsetzen über Sitzungen hinweg übernimmt
 * `useReassignRun` — gemeinsam mit dem Admin-Batch. Den Stand des letzten Laufs liefert
 * `GET /tasks/reassign-pillars/status`; „Fortsetzen“ verarbeitet nur fehlgeschlagene und nicht
 * erreichte Aufgaben, nicht noch einmal alle.
 */

const FILTER_OPTIONS: { labelKey: string; value: ReassignStatusFilter }[] = [
	{ labelKey: 'recalcPillar.filterAll', value: 'all' },
	{ labelKey: 'recalcPillar.filterOpen', value: 'open' },
	{ labelKey: 'recalcPillar.filterDone', value: 'done' },
];

export const RecalcPillarModal = ({ onClose, onCompleted }: RecalcPillarModalProps) => {
	const { t } = useTranslation(['settings', 'common']);
	const [filter, setFilter] = useState<ReassignStatusFilter>('all');
	const closeRef = useRef<HTMLKolButtonElement>(null);

	const runPortion = useCallback(
		(args: ReassignPortionArgs) => api.reassignOwnTaskPillars({ status: filter, ...args }),
		[filter],
	);
	const loadStatus = useCallback(() => api.getOwnReassignPillarsStatus({ status: filter }), [filter]);
	const { run, status, canResume, start } = useReassignRun({ runPortion, loadStatus, onChanged: onCompleted });

	// Schließen bricht nichts ab: der Lauf geht auf dem Server weiter (#1642).
	const handleClose = (): void => {
		onClose();
	};

	return (
		<Modal title={t('recalcPillar.title')} onClose={handleClose} initialFocusRef={closeRef}>
			{run.phase === 'idle' && (
				<>
					<p>{t('recalcPillar.intro')}</p>
					<KolAlert _type="info" _label={t('recalcPillar.quotaLabel')}>
						{t('recalcPillar.quotaText')}
					</KolAlert>

					<div className="form-grid">
						<KolInputRadio
							_label={t('recalcPillar.filter')}
							_options={FILTER_OPTIONS.map(({ labelKey, value }) => ({ label: t(labelKey), value }))}
							_value={filter}
							_on={{
								onChange: (_event, value) => {
									const next = FILTER_OPTIONS.find((option) => option.value === value);
									if (next !== undefined) {
										setFilter(next.value);
									}
								},
							}}
						/>
					</div>

					{status !== null && status.startedAt !== null && status.total > 0 && (
						<KolAlert _type={status.pending > 0 ? 'warning' : 'success'} _label={t('recalcPillar.lastRun')}>
							<ReassignStatusText status={status} testId="recalc-run-status" />
							{status.pending > 0 && <p>{t('recalcPillar.resumeHint')}</p>}
						</KolAlert>
					)}

					<div className="modal-actions">
						<KolButton
							ref={closeRef}
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_on={{ onClick: handleClose }}
						/>
						{canResume && status !== null ? (
							<>
								<KolButton
									_label={t('recalcPillar.restartAll', { total: status.total })}
									_variant="secondary"
									_on={{ onClick: () => void start(true) }}
								/>
								<KolButton
									_label={t('recalcPillar.resume', { pending: status.pending })}
									_variant="primary"
									_on={{ onClick: () => void start(false) }}
								/>
							</>
						) : (
							<KolButton
								_label={t('recalcPillar.start')}
								_variant="primary"
								_on={{ onClick: () => void start(true) }}
							/>
						)}
					</div>
				</>
			)}

			{run.phase === 'processing' && (
				<>
					<ReassignProgressView run={run} />
					<p>{t('recalcPillar.continuesOnServer')}</p>
					<div className="modal-actions">
						<KolButton _label={t('common:actions.cancel')} _variant="secondary" _on={{ onClick: handleClose }} />
					</div>
				</>
			)}

			{run.phase === 'completed' && (
				<>
					{run.error !== null ? (
						<KolAlert _type="error" _label={t('recalcPillar.failed')}>
							{run.error}
						</KolAlert>
					) : (
						<KolAlert _type={run.failed === 0 ? 'success' : 'warning'} _label={t('recalcPillar.completed')}>
							{run.total === 0 ? (
								<p>{t('recalcPillar.noTasks')}</p>
							) : (
								<p>
									<Trans
										t={t}
										i18nKey="recalcPillar.result"
										values={{ updated: run.updated, skipped: run.skipped, failed: run.failed }}
										components={{ strong: <strong /> }}
									/>
								</p>
							)}
							{run.failed > 0 && <ReassignFailureList reasons={run.failureReasons} />}
						</KolAlert>
					)}

					{run.quotaExhausted && (
						<KolAlert _type="warning" _label={t('recalcPillar.quotaExhaustedLabel')}>
							{t('recalcPillar.quotaExhaustedText', { count: run.total - run.processed })}
						</KolAlert>
					)}

					{canResume && status !== null && (
						<p data-testid="recalc-pending-hint">{t('recalcPillar.pendingHint', { pending: status.pending })}</p>
					)}

					<div className="modal-actions">
						{canResume && status !== null && (
							<KolButton
								_label={t('recalcPillar.resume', { pending: status.pending })}
								_variant="secondary"
								_on={{ onClick: () => void start(false) }}
							/>
						)}
						<KolButton
							ref={closeRef}
							_label={t('common:actions.close')}
							_variant="primary"
							_on={{ onClick: handleClose }}
						/>
					</div>
				</>
			)}
		</Modal>
	);
};
