import { KolCard } from '@public-ui/react-v19';
import type { GeoConfig, NearbyTask } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useGeolocation } from '../lib/useGeolocation';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

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

/** Titel ohne geladene Konfiguration (vor dem Fetch bzw. bei Fehler). */
const baseTitle = 'In der Nähe';

export const NearbyCard = () => {
	const { supported, enabled, pending, permissionDenied, unavailable, position } = useGeolocation();
	const [nearby, setNearby] = useState<NearbyTask[] | null>(null);
	// #1110 (AK4): Nach dem Anlegen einer Aufgabe mit Adresse erscheint sie ohne Reload in der Liste.
	const [refreshKey, setRefreshKey] = useState(0);
	// #1110 (AK1/AK2): Der Titel nennt die gespeicherte Anzeige-Entfernung aus `GET /geo-config`
	// statt eines hartcodierten Werts — beim nächsten Laden nach einer Änderung in den Einstellungen.
	const [displayDistanceKm, setDisplayDistanceKm] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		api
			.getGeoConfig()
			// Ganzzahl ohne Nachkommastelle („(5 km)"), die Distanzkette bleibt unbezeichnet.
			.then((config: GeoConfig) => {
				if (!cancelled) {
					setDisplayDistanceKm(Math.round(config.displayDistanceKm));
				}
			})
			.catch(() => {
				// Config nicht erreichbar → unverfänglicher Basistitel statt einer falschen Zahl.
				if (!cancelled) {
					setDisplayDistanceKm(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const onTasksChanged = () => setRefreshKey((key) => key + 1);
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

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
	}, [position, refreshKey]);

	return (
		/* #1118-Folge: Die Card selbst ist das Widget — die alte Außen-<section> ist entfernt,
		   die Widget-Klasse sitzt am Card-Host (gleiches Muster wie die Dashboard-Sektionen). */
		<KolCard
			className="dashboard-nearby"
			_label={displayDistanceKm === null ? baseTitle : `In der Nähe (${displayDistanceKm} km)`}
			_level={0}
			data-testid="nearby-card"
		>
			{permissionDenied || !supported || unavailable ? (
				<p className="dashboard-nearby-hint" data-testid="nearby-denied">
					Der Browser hat die Standortfreigabe verweigert, ist nicht verfügbar oder unterstützt keine
					Standortermittlung. Erlaube den Standortzugriff in den Browser-Einstellungen, um Aufgaben in deiner Nähe zu
					sehen.
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
					Keine Aufgaben mit Standort in deiner Nähe. Vergib beim Anlegen einer Aufgabe einen Ort über die Adresssuche,
					damit sie hier erscheint.
				</p>
			) : (
				<ol className="dashboard-nearby-list">
					{nearby.map((task) => (
						<li key={task.id} className="dashboard-nearby-item" data-testid="nearby-item">
							<span className="dashboard-nearby-title">
								#{task.id} – {task.title}
							</span>
							{/* #1098 AK6: Distanz in Klammern am Eintrag („(2,4 km)"). */}
							<span className="dashboard-nearby-distance">({formatKm(task.distanceKm)} km)</span>
						</li>
					))}
				</ol>
			)}
		</KolCard>
	);
};
