import { KolAlert, KolCard, KolDetails, KolSpin } from '@public-ui/react-v19';
import type { Duo } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

/**
 * Duo-Karte (#1991): gemeinsamer Streak und je Person die Säulenwerte (`GET /groups/:id/duo`).
 * Der Endpunkt liefert bewusst keine Aufgaben — die Karte zeigt nur Namen, Streak und Säulenwerte.
 *
 * Streak 0 ist ein ermutigender Satz ohne Vorwurf (Muster `StreakCard`), die Bestmarke bleibt in
 * allen geladenen Zuständen sichtbar. Säulenname und Wert stehen immer als Text (nie nur Farbe).
 * Bei 375 px stehen die Personen untereinander, erst ab breiteren Viewports nebeneinander
 * (`.duo-members`, Grid mit `minmax`).
 */
export const DuoCard = ({ groupId }: { groupId: number }) => {
	const { t, i18n } = useTranslation('dashboard');
	const tage = (anzahl: number): string => t('days', { count: anzahl });
	const [duo, setDuo] = useState<Duo | null>(null);
	const [helpOpen, setHelpOpen] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		api
			// Die Kalendertagsgrenze richtet sich nach der Zeitzone des Nutzers, nicht der des Servers.
			.getGroupDuo({ id: groupId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
			.then((result) => {
				if (!cancelled) {
					setDuo(result);
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
	}, [groupId]);

	return (
		<KolCard
			className="duo-card"
			role="region"
			aria-label={t('duo.label')}
			_label={t('duo.label')}
			_level={3}
			data-testid="duo-card"
		>
			{failed ? (
				<KolAlert _type="error" _label={t('duo.errorLabel')}>
					{t('duo.errorText')}
				</KolAlert>
			) : duo === null ? (
				<KolSpin _show _variant="cycle" _label={t('duo.loading')} />
			) : (
				<div className="duo-content">
					{duo.streak.aktuell > 0 ? (
						<p className="duo-streak" data-testid="duo-streak-shared">
							<span className="dashboard-streak-value">{tage(duo.streak.aktuell)}</span>
							<span className="dashboard-streak-label">
								{t('duo.streakMembers', {
									names: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
										duo.members.map((member) => member.name),
									),
								})}
							</span>
						</p>
					) : (
						<p className="dashboard-streak-hint" data-testid="duo-streak-zero">
							{t('duo.streakZero')}
						</p>
					)}
					<p className="duo-streak-best">
						<span className="dashboard-streak-best-value">{tage(duo.streak.best)}</span>
						<span className="dashboard-streak-label">{t('streak.best')}</span>
					</p>
					<KolDetails
						_label={t('duo.helpLabel')}
						_open={helpOpen}
						_on={{ onToggle: (_event, value) => setHelpOpen(value === true) }}
					>
						<p>{t('duo.helpText')}</p>
					</KolDetails>
					<div className="duo-members">
						{duo.members.map((member) => (
							<section key={member.userId} className="duo-member" data-testid="duo-member">
								<h4 className="duo-member-name">{member.name}</h4>
								<ul className="duo-pillars">
									{member.saeulen.map((saeule) => (
										<li key={saeule.pillarId}>
											{t('duo.pillarPoints', { name: saeule.name, count: saeule.wert, points: saeule.wert })}
										</li>
									))}
								</ul>
							</section>
						))}
						{duo.members.length < 2 && <p className="hint duo-member-empty">{t('duo.memberEmpty')}</p>}
					</div>
				</div>
			)}
		</KolCard>
	);
};
