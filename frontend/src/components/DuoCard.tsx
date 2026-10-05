import { KolAlert, KolCard, KolDetails, KolSpin } from '@public-ui/react-v19';
import type { Duo } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';

/** Tage mit Einheit — eine Zahl ohne Kontext sagt nichts („3 Tage" statt „3"). */
const tage = (anzahl: number): string => `${anzahl} ${anzahl === 1 ? 'Tag' : 'Tage'}`;

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
	const [duo, setDuo] = useState<Duo | null>(null);
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
		<KolCard className="duo-card" role="region" aria-label="Duo" _label="Duo" _level={3} data-testid="duo-card">
			{failed ? (
				<KolAlert _type="error" _label="Duo nicht verfügbar">
					Das Duo konnte gerade nicht geladen werden. Lade die Seite neu und versuche es noch einmal.
				</KolAlert>
			) : duo === null ? (
				<KolSpin _show _variant="cycle" _label="Duo wird geladen …" />
			) : (
				<div className="duo-content">
					{duo.streak.aktuell > 0 ? (
						<p className="duo-streak" data-testid="duo-streak-shared">
							<span className="dashboard-streak-value">{tage(duo.streak.aktuell)}</span>
							<span className="dashboard-streak-label">
								{`in Folge erledigt: ${duo.members.map((member) => member.name).join(' und ')}`}
							</span>
						</p>
					) : (
						<p className="dashboard-streak-hint" data-testid="duo-streak-zero">
							Noch kein gemeinsamer Streak — erledigt heute beide etwas, dann zählt der erste Tag.
						</p>
					)}
					<p className="duo-streak-best">
						<span className="dashboard-streak-best-value">{tage(duo.streak.best)}</span>
						<span className="dashboard-streak-label">Bestmarke</span>
					</p>
					<KolDetails _label="Wann zählt der gemeinsame Streak?" _open={false}>
						<p>
							Ein Tag zählt, wenn ihr beide an diesem Tag etwas erledigt habt. Aufgaben des anderen bleiben unsichtbar.
						</p>
					</KolDetails>
					<div className="duo-members">
						{duo.members.map((member) => (
							<section key={member.userId} className="duo-member" data-testid="duo-member">
								<h4 className="duo-member-name">{member.name}</h4>
								<ul className="duo-pillars">
									{member.saeulen.map((saeule) => (
										<li key={saeule.pillarId}>{`${saeule.name}: ${saeule.wert} Punkte`}</li>
									))}
								</ul>
							</section>
						))}
						{duo.members.length < 2 && <p className="hint duo-member-empty">Noch niemand dabei</p>}
					</div>
				</div>
			)}
		</KolCard>
	);
};
