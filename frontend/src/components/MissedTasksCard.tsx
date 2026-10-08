import { KolCard } from '@public-ui/react-v19';
import type { MissedTasksSummary } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

/**
 * Dashboard-Card „Verpasste Aufgaben": zeigt, wie viele Aufgaben der Auto-Delete-Cron
 * (`runDeadlineAutoDelete`, Issue #523) wegen abgelaufener Deadline bereits gelöscht hat
 * (`GET /scores/missed`). Rein informativ — wirkt sich NICHT auf Punkte oder Streak aus
 * (`StreakCard`/`MilestoneBadges` bleiben unberührt); es gibt hier bewusst keine Bestrafung.
 *
 * Lädt selbst (Muster `StreakCard`), damit `Dashboard.tsx` keine weitere Prop-Kette bekommt.
 * Bewusst neutrale Formulierung ohne Warnfarbe/„Versagen"-Sprache (mobile-ui-rules Regel 7) —
 * die Karte ist immer sichtbar, auch im Nullzustand, analog zu `StreakCard`/`MilestoneBadges`.
 */

export const MissedTasksCard = () => {
	const { t } = useTranslation('tasks');
	const [summary, setSummary] = useState<MissedTasksSummary | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		api
			.getMissedTasks()
			.then((result) => {
				if (!cancelled) {
					setSummary(result);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<KolCard
			className="dashboard-missed"
			role="region"
			aria-label={t('missedCard.title')}
			_label={t('missedCard.title')}
			_level={3}
			data-testid="missed-tasks-card"
		>
			{summary === null && !failed ? (
				<p className="dashboard-missed-hint">{t('missedCard.loading')}</p>
			) : failed || summary === null || summary.anzahl === 0 ? (
				<p className="dashboard-missed-hint" data-testid="missed-tasks-zero">
					{t('missedCard.zero')}
				</p>
			) : (
				<div className="dashboard-missed-content">
					<p className="dashboard-missed-count" data-testid="missed-tasks-count">
						<span className="dashboard-missed-value">{t('missedCard.count', { count: summary.anzahl })}</span>
						<span className="dashboard-missed-label">{t('missedCard.cleaned')}</span>
					</p>
					<ul className="dashboard-missed-list">
						{summary.eintraege.slice(0, 3).map((eintrag) => (
							<li key={eintrag.taskId} data-testid="missed-tasks-item">
								{eintrag.title}
							</li>
						))}
					</ul>
				</div>
			)}
		</KolCard>
	);
};
