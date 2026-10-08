import { KolProgress } from '@public-ui/react-v19';
import type { OwnReassignPillarsStatus } from 'client';
import { Trans, useTranslation } from 'react-i18next';
import type { ReassignRunState } from '../lib/useReassignRun';

/**
 * Gemeinsame Anzeigen der Säulen-Neuberechnung (#1614) für Nutzer-Modal und Admin-Batch — dieselbe
 * Darstellung an beiden Einstiegen, damit sie nicht wieder auseinanderlaufen (siehe `useReassignRun`).
 */

/** Fortschritt eines laufenden Laufs. */
export const ReassignProgressView = ({ run }: { run: ReassignRunState }) => {
	const { t } = useTranslation('tasks');
	return run.total === 0 ? (
		// Vor der ersten Antwort ist die Gesamtzahl unbekannt — kein „0 / 0“, das wie ein hängender
		// Lauf aussieht.
		<p>{t('reassign.preparing')}</p>
	) : (
		<>
			<p>
				{t('reassign.processing')}{' '}
				<strong>
					{run.processed} / {run.total}
				</strong>
			</p>
			<KolProgress _variant="bar" _max={run.total} _value={run.processed} _label={t('reassign.progressLabel')} />
		</>
	);
};

/** Fehlergründe eines abgeschlossenen Laufs, z. B. „HTTP 429 (Rate-Limit des KI-Anbieters): 12“. */
export const ReassignFailureList = ({ reasons }: { reasons: Record<string, number> }) => {
	const { t } = useTranslation('tasks');
	return (
		<ul>
			{Object.entries(reasons).map(([reason, count]) => (
				<li key={reason}>
					{reason === 'HTTP 429' ? t('reassign.rateLimit') : reason}: {count}
				</li>
			))}
		</ul>
	);
};

/** Stand des letzten Laufs: wie viele Aufgaben seit seinem Start neu berechnet und noch offen sind. */
export const ReassignStatusText = ({ status, testId }: { status: OwnReassignPillarsStatus; testId: string }) => {
	const { t, i18n } = useTranslation('tasks');
	return status.startedAt === null ? null : (
		<p data-testid={testId}>
			<Trans
				t={t}
				i18nKey={status.pending > 0 ? 'reassign.statusPending' : 'reassign.status'}
				values={{
					date: new Date(status.startedAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
					done: status.total - status.pending,
					total: status.total,
					pending: status.pending,
				}}
				components={{ strong: <strong /> }}
			/>
		</p>
	);
};
