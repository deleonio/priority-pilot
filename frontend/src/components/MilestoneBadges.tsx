import { KolBadge, KolCard } from '@public-ui/react-v19';
import type { Milestone } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Dashboard-Card „Meilensteine" (#1362): feste Streak- und Punkte-Stufen aus
 * `GET /scores/milestones`, rückwirkend aus Bestandsdaten ausgewertet.
 *
 * Lädt selbst (Muster `StreakCard`), damit `Dashboard.tsx` keine weitere Prop-Kette bekommt.
 * Nicht erreichte Stufen bleiben sichtbar statt ausgeblendet zu werden (mobile-ui-rules Regel 9:
 * Farbe allein trägt keine Bedeutung) — `data-erreicht` macht den Status zusätzlich im DOM
 * abfragbar, `_label` trägt ihn für Screenreader.
 */

const GRUPPEN: { titel: string; typ: Milestone['typ'] }[] = [
	{ titel: 'Streak', typ: 'streak' },
	{ titel: 'Punkte', typ: 'punkte' },
];

const badgeLabel = (stufe: Milestone): string =>
	`${stufe.typ === 'streak' ? `${stufe.schwelle} Tage` : `${stufe.schwelle} Punkte`} — ${
		stufe.erreicht ? 'erreicht' : 'nicht erreicht'
	}`;

export const MilestoneBadges = () => {
	const [stufen, setStufen] = useState<Milestone[] | null>(null);

	useEffect(() => {
		let cancelled = false;
		api
			.getMilestones({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
			.then((result) => {
				if (!cancelled) {
					setStufen(result);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setStufen(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<KolCard
			className="dashboard-milestones"
			role="region"
			aria-label="Meilensteine"
			_label="Meilensteine"
			_level={3}
			data-testid="milestone-badges-card"
		>
			{stufen === null ? (
				<p className="dashboard-milestones-hint">Meilensteine werden geladen …</p>
			) : (
				GRUPPEN.map(({ titel, typ }) => (
					<div className="dashboard-milestones-group" key={typ}>
						<p className="dashboard-milestones-group-title">{titel}</p>
						<div className="dashboard-milestones-badges">
							{stufen
								.filter((stufe) => stufe.typ === typ)
								.map((stufe) => (
									<span key={stufe.schluessel} data-erreicht={stufe.erreicht}>
										<KolBadge
											_label={badgeLabel(stufe)}
											_color={stufe.erreicht ? '#2e7d32' : '#9e9e9e'}
											className="dashboard-milestones-badge"
										/>
									</span>
								))}
						</div>
					</div>
				))
			)}
		</KolCard>
	);
};
