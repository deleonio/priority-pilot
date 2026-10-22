import { useEffect } from 'react';
import { isKoliHydrated } from './useDashboardAnchor';

/** Wartezeit zwischen den Such-Durchläufen nach dem Anker-Ziel (Panel/Inhalt lädt asynchron). */
const POLL_MS = 200;
/** Obergrenze des Nachhaltens (~5 s) — ein Anker ohne Ziel pollt nicht ewig. */
const MAX_ATTEMPTS = 25;

/**
 * #2852 (docs/spec/issue-2852.md AK7): Öffnet ein Push-Ziel die Einstellungen mit einem
 * Sektions-Anker (`/settings/<tab>#<id>`), springt die App nach dem ersten Rendern der
 * Zielsektion dorthin — Fokus aufs Anker-Ziel (`tabIndex={-1}` an der Sektion), dann EIN
 * `scrollIntoView` ohne Animation, danach entfernt `history.replaceState` den Anker
 * (#2848-Muster `useDashboardAnchor`, dessen Hydrations-Prädikat hier mitgenutzt wird).
 * Der Anker wird beim Mount UND bei jedem `hashchange` ausgewertet: `notificationclick`
 * navigiert ein bereits offenes Fenster per Hash-Änderung. Fehlt das Ziel, bleibt die Seite
 * still — keine Meldung.
 */
export const useSettingsAnchor = (id: string): void => {
	useEffect(() => {
		let attempts = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const jump = (): void => {
			if (window.location.hash !== `#${id}`) {
				return;
			}
			const target = document.getElementById(id);
			// Sichtbarkeit ist Teil des Render-Ziels: Panels sind vor dem KoliBri-Upgrade verdeckt —
			// ein focus() dort versackt still. Erst springen, wenn die Sektion wirklich gerendert ist.
			if (target === null || target.getClientRects().length === 0 || !isKoliHydrated()) {
				if (attempts < MAX_ATTEMPTS) {
					attempts += 1;
					timer = setTimeout(jump, POLL_MS);
				}
				return;
			}
			HTMLElement.prototype.focus.call(target, { preventScroll: true });
			Element.prototype.scrollIntoView.call(target, { behavior: 'auto', block: 'start' });
			window.history.replaceState(null, '', window.location.pathname + window.location.search);
		};
		jump();
		window.addEventListener('hashchange', jump);
		return () => {
			window.removeEventListener('hashchange', jump);
			clearTimeout(timer);
		};
	}, [id]);
};
