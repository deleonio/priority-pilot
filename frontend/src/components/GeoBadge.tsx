import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

/**
 * Icon-only Globus-Badge für Ortsbezug (#1063, #1066 Coordinates-only): zeigt an, dass ein Eintrag
 * (Serie in der Serienliste, erledigter Task in der Erledigt-Liste) Standort-Koordinaten trägt.
 * Rein informativ — nicht klickbar, kein Filter, kein Tooltip-Handler. Die Adresse selbst wird
 * bewusst NICHT sichtbar angezeigt (Datensparsamkeit in Listen); ihre Präsenz transportiert das
 * `aria-label` für assistive Technologien (BITV, KI-UX-Block).
 *
 * #1066 AK11: Die Adresse im `aria-label` stammt aus Reverse-Geocoding der Koordinaten — NIEMALS aus
 * Rohkoordinaten (Screenreader-Zahlenfried) und ohne DB-Adress-Cache (bindende Coordinates-only-
 * Entscheidung). Fehler/Rate-Limit (Nominatim 1 req/s) degradieren kontrolliert auf
 * „Adresse nicht verfügbar“. Ein client-seitiger Session-Cache (Koordinate → Adresse) verhindert,
 * dass jede Liste dieselbe Koordinate erneut auflöst.
 *
 * Bewusst ein `<span role="img">` statt `KolBadge`: der Test-/BITV-Vertrag verlangt `data-testid` und
 * `aria-label` auf DEMSELBEN Element — bei der Web Component hängt KoliBri das Label in sein
 * Shadow-DOM, ein host-seitiges `aria-label` wäre daneben redundant/fragil. Font-Awesome-Globus statt
 * 🌍-Emoji (Refuse-Liste Emoji-als-Icon-System, ux-design.md Craft Floor).
 */

/**
 * Session-Cache: bereits aufgelöste Koordinaten nicht erneut anfragen (Nominatim 1 req/s). Ein leerer
 * Eintrag steht für „nicht verfügbar“ — der Fallback-Text wird erst beim Rendern übersetzt (AK11).
 */
const addressCache = new Map<string, string>();
/** Parallele Reverse-Geocoding-Aufrufe pro Koordinate serialisieren (Rate-Limit 1 req/s). */
const inflight = new Map<string, Promise<string>>();

interface GeoBadgeProps {
	/** Breite/Länge des Ortsbezugs — Basis des Reverse-Geocoding. */
	latitude: number | null;
	longitude: number | null;
	/** Legacy-Adresse aus #1063-Beständen ohne Koordinaten: wird unverändert angezeigt, kein Geocoding. */
	address?: string | null;
}

export const GeoBadge = ({ latitude, longitude, address = null }: GeoBadgeProps) => {
	const { t } = useTranslation('taskForm');
	// Legacy-Bestand ohne Koordinaten zeigt die gespeicherte Adresse; sonst liefert Reverse-Geocoding.
	const [resolved, setResolved] = useState<string | null>(address);

	useEffect(() => {
		if (latitude === null || longitude === null) {
			setResolved(address);
			return;
		}
		const key = `${latitude},${longitude}`;
		const cached = addressCache.get(key);
		if (cached !== undefined) {
			setResolved(cached);
			return;
		}
		let cancelled = false;
		// Aufrufe pro Koordinate serialisieren und Fehler ERGEBNIS-cachen: sonst re-fetchen
		// erneut gemountete Badges den gleichen Fehlschlag gegeneinander ins Rate-Limit
		// (1 req/s) — kontrollierter Fallback statt Fehlerzustand (AK11).
		const request: Promise<string> =
			inflight.get(key) ??
			api
				.reverseGeocode({ lat: latitude, lon: longitude })
				.then(({ address: hit }) => hit)
				.catch(() => '')
				.then((text) => {
					addressCache.set(key, text);
					inflight.delete(key);
					return text;
				});
		inflight.set(key, request);
		request.then((text) => {
			if (!cancelled) {
				setResolved(text);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [latitude, longitude, address]);

	if (latitude === null && longitude === null && address === null) {
		return null;
	}

	return (
		<span
			className="geo-badge"
			data-testid="geo-badge"
			role="img"
			aria-label={t('geoBadge.label', {
				address: resolved === null || resolved === '' ? t('geoBadge.unavailable') : resolved,
			})}
		>
			<i className="fa-solid fa-globe" aria-hidden="true" />
		</span>
	);
};
