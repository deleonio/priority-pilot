import { KolCard } from '@public-ui/react-v19';
import type { Streak } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Dashboard-Card „Streak" (#1360): zeigt die Kalendertage in Folge, an denen mindestens eine
 * Aufgabe abgehakt wurde, und die persönliche Bestmarke (`GET /scores/streak`).
 *
 * Lesereihenfolge ist Absicht: der aktuelle Streak zuerst — das ist die Frage, die der Nutzer
 * stellt —, die Bestmarke danach als Bezugsgröße. Die Card lädt selbst (Muster `NearbyCard`),
 * damit `Dashboard.tsx` keine weitere Prop-Kette bekommt.
 *
 * Drei gestaltete Textzustände, keiner davon ein Fehlerzustand (mobile-ui-rules Regel 7):
 * Laden, Streak vorhanden und „Streak gerissen" (`streak-zero`) — Letzterer als echter Satz
 * statt einer kontextlosen „0". Die Bestmarke bleibt in allen geladenen Zuständen sichtbar.
 *
 * Bewusst KEIN `KolMeter`/`KolProgress`: beide sind semantisch an Fortschritt zwischen Min und Max
 * gebunden, ein Streak ist ein reiner Zählwert. Ebenso bewusst ohne `--pp-signal` — die Signalfarbe
 * gehört allein der „Nächsten Aufgabe" als der einen Hauptaussage des Dashboards.
 */

/** Tage mit Einheit — eine Zahl ohne Kontext sagt nichts („3 Tage" statt „3"). */
const tage = (anzahl: number): string => `${anzahl} ${anzahl === 1 ? 'Tag' : 'Tage'}`;

export const StreakCard = () => {
	const [streak, setStreak] = useState<Streak | null>(null);

	useEffect(() => {
		let cancelled = false;
		api
			// Die Kalendertagsgrenze richtet sich nach der Zeitzone des Nutzers, nicht der des Servers.
			.getStreak({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
			.then((result) => {
				if (!cancelled) {
					setStreak(result);
				}
			})
			.catch(() => {
				// Netzwerk-/Serverfehler bleiben im Ladezustand statt einen Fehlerzustand zu malen —
				// ein nicht erreichbarer Streak ist keine schlechte Nachricht über den Nutzer.
				if (!cancelled) {
					setStreak(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<KolCard
			className="dashboard-streak"
			role="region"
			aria-label="Streak"
			_label="Streak"
			_level={3}
			data-testid="streak-card"
		>
			{streak === null ? (
				<p className="dashboard-streak-hint">Streak wird geladen …</p>
			) : (
				<div className="dashboard-streak-content">
					{streak.aktuell === 0 ? (
						<p className="dashboard-streak-hint" data-testid="streak-zero">
							Noch kein Streak — hake heute eine Aufgabe ab, dann zählt der erste Tag.
						</p>
					) : (
						<p className="dashboard-streak-current">
							<span className="dashboard-streak-value">{tage(streak.aktuell)}</span>
							<span className="dashboard-streak-label">in Folge erledigt</span>
						</p>
					)}
					<p className="dashboard-streak-best" data-testid="streak-best">
						<span className="dashboard-streak-best-value">{tage(streak.best)}</span>
						<span className="dashboard-streak-label">Bestmarke</span>
					</p>
				</div>
			)}
		</KolCard>
	);
};
