import { KolCard } from '@public-ui/react-v19';
import type { NearbyTask } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useGeolocation } from '../lib/useGeolocation';

/**
 * Dashboard-Card „In der Nähe" (#1066): zeigt maximal 10 offene Tasks mit Koordinaten, aufsteigend
 * nach Geo-Distanz zur aktuellen Position (`GET /tasks/nearby`, Haversine serverseitig). Jeder
 * Eintrag nennt `#id`, Titel und Distanz in km mit einer Nachkommastelle — bewusst OHNE Adresse
 * (KI-UX: Datensparsamkeit in Listen; Adressen entstehen erst bei Anzeige per Reverse-Geocoding).
 *
 * Vier gestaltete Text-Zustände (KI-UX, Regel 7 — nie ein Fehlerzustand):
 * Erfolg (Liste), Leer (`nearby-empty`, AK9), Browser verweigert (`nearby-denied`, AK4) und
 * Präferenz aus (`nearby-preference-off`, AK8 — dann wird `navigator.geolocation` nie aufgerufen,
 * die Positionserhebung beginnt erst nach Freigabe bzw. Aktivierung, AK5).
 *
 * Eigene `useGeolocation`-Instanz wie Footer/SettingsPage: Der Hook spiegelt die Präferenz in den
 * localStorage und holt bei aktivierter Freigabe sofort + alle 5 Minuten die Position.
 */

/** Distanz in km mit einer Nachkommastelle, deutsch formatiert („2,4 km", AK3). */
const formatKm = (km: number): string =>
	km.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const NearbyCard = () => {
	const { supported, enabled, pending, permissionDenied, position } = useGeolocation();
	const [nearby, setNearby] = useState<NearbyTask[] | null>(null);

	useEffect(() => {
		if (position === null) {
			setNearby(null);
			return;
		}
		let cancelled = false;
		api
			.listNearbyTasks({ lat: position.latitude, lon: position.longitude })
			.then((tasks) => {
				if (!cancelled) {
					setNearby(tasks);
				}
			})
			.catch(() => {
				// Netzwerk-/Serverfehler degradieren zur Leer-Aussage statt zum Fehlerzustand (AK9).
				if (!cancelled) {
					setNearby([]);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [position]);

	return (
		<section className="dashboard-nearby" aria-label="In der Nähe">
			<KolCard _label="In der Nähe" _level={0} data-testid="nearby-card">
				{permissionDenied || !supported ? (
					<p className="dashboard-nearby-hint" data-testid="nearby-denied">
						Der Browser hat die Standortfreigabe verweigert oder unterstützt keine Standortermittlung. Erlaube den
						Standortzugriff in den Browser-Einstellungen, um Aufgaben in deiner Nähe zu sehen.
					</p>
				) : !enabled ? (
					<p className="dashboard-nearby-hint" data-testid="nearby-preference-off">
						Die Standortverwendung ist deaktiviert. Aktiviere sie in den Einstellungen, um Aufgaben in deiner Nähe zu
						sehen.
					</p>
				) : nearby === null ? (
					<p className="dashboard-nearby-hint">
						{pending ? 'Standort wird ermittelt …' : 'Aufgaben in der Nähe werden geladen …'}
					</p>
				) : nearby.length === 0 ? (
					<p className="dashboard-nearby-hint" data-testid="nearby-empty">
						Keine Aufgaben mit Standort in deiner Nähe. Vergib beim Anlegen einer Aufgabe einen Ort über die
						Adresssuche, damit sie hier erscheint.
					</p>
				) : (
					<ol className="dashboard-nearby-list">
						{nearby.map((task) => (
							<li key={task.id} className="dashboard-nearby-item" data-testid="nearby-item">
								<span className="dashboard-nearby-title">
									#{task.id} – {task.title}
								</span>
								<span className="dashboard-nearby-distance">{formatKm(task.distanceKm)} km</span>
							</li>
						))}
					</ol>
				)}
			</KolCard>
		</section>
	);
};
