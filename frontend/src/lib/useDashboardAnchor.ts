import { useEffect } from 'react';

/** Wartezeit zwischen den Such-Durchläufen nach dem Anker-Ziel (Karten laden asynchron). */
const POLL_MS = 200; /** Obergrenze des Nachhaltens (~5 s) — ein Anker ohne Karte pollt nicht ewig. */
const MAX_ATTEMPTS = 25;
/** Wartezeit zwischen den Korrektur-Scrolls, bis das Layout über dem Ziel ruhig ist. */
const SETTLE_MS = 250;
/** Obergrenze des Nachhaltens nach dem ersten Sprung (~3 s Layout-Beruhigung). */
const MAX_SETTLE = 12;

/**
 * #2848 (docs/spec/issue-2848.md): Öffnet ein Push-Ziel das Dashboard mit einem Karten-Anker
 * (`/#karte-…`), springt die App nach dem ersten Rendern der Zielkarte dorthin — Fokus aufs
 * Anker-Ziel (`tabIndex={-1}` an der Karte, Vorbild `dashboard-next-task-empty`), dann EIN
 * `scrollIntoView` ohne Animation: Die Position wird zum Fokus-Zeitpunkt gemessen (e2e AK1), und
 * asynchron nachladende Karten über dem Ziel verschieben das Animationsziel sonst während des
 * Laufs (bewusste Abweichung von der Animations-Idee aus docs/push-konzept.md §2.2, s. PR —
 * deckt sich mit dem `prefers-reduced-motion`-Verhalten). Der Sticky-Header ist über das
 * bestehende `scroll-padding-top` am Scroll-Container (app.css) abgezogen. Danach entfernt
 * `history.replaceState` den Anker (kein History-Eintrag, Matomo hängt am pathname, kein
 * Re-Sprung beim Reload). Fehlt die Karte (datumabhängige Rückblicke), bleibt das Dashboard
 * still oben — keine Meldung (§2.2.4 des Push-Konzepts).
 *
 * Der Sprung wird kurz gegenhalten (§2.2 „nach dem ersten Rendern mit Daten"): Selbstladende
 * Karten über dem Ziel (Herz, Fürsorge, Willkommen) wachsen asynchron und verschieben die
 * angesprungene Karte — bis zur Beruhigung wird korrigiert nachgezogen, ohne den Fokus neu zu
 * setzen. Der Anker wird beim Mount UND bei jedem `hashchange` ausgewertet: `notificationclick`
 * navigiert ein bereits offenes Fenster per Hash-Änderung (§2.2.1) — das remountet das
 * Dashboard nicht.
 */
/**
 * KoliBri-Hydration abgeschlossen? (gleiches Prädikat wie `waitForStableView` in e2e/helpers.ts)
 * Ein Sprung während des Upgrades verliert den Fokus wieder — KoliBri-Eigenfokus läuft dort
 * noch und überblendet ihn. Erst danach springen. Geschwister-Hook: `useSettingsAnchor` (#2852).
 */
export const isKoliHydrated = (): boolean => {
	if (document.querySelector(':not(:defined)') !== null) {
		return false;
	}
	return !Array.from(document.querySelectorAll('kol-tabs')).some((host) =>
		Array.from(host.children).some((child) => child.assignedSlot === null),
	);
};

export const useDashboardAnchor = (): void => {
	useEffect(() => {
		let attempts = 0;
		let settles = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const scrollTargetIntoView = (target: Element): void => {
			Element.prototype.scrollIntoView.call(target, { behavior: 'auto', block: 'start' });
		};
		const holdPosition = (target: Element): void => {
			// Karte im sichtbaren Band halten (Kartenanfang zwischen 0 und Viewport-Höhe), bis das
			// Layout über ihr ruhig ist. Korrektur ohne Animation, ohne erneuten Fokus.
			if (!target.isConnected) {
				return;
			}
			const top = target.getBoundingClientRect().top;
			if (top >= 0 && top < window.innerHeight) {
				return;
			}
			if (settles < MAX_SETTLE) {
				settles += 1;
				scrollTargetIntoView(target);
				timer = setTimeout(() => holdPosition(target), SETTLE_MS);
			}
		};
		const jump = (): void => {
			const id = /^#(karte-[a-z-]+)$/.exec(window.location.hash)?.[1];
			if (id === undefined) {
				return;
			}
			const target = document.getElementById(id);
			// Sichtbarkeit ist Teil des Render-Ziels: KolTabs-Panels sind vor dem KoliBri-Upgrade
			// verdeckt — ein focus() dort versackt still. Erst springen, wenn die Karte wirklich
			// gerendert ist.
			if (target === null || target.getClientRects().length === 0 || !isKoliHydrated()) {
				if (attempts < MAX_ATTEMPTS) {
					attempts += 1;
					timer = setTimeout(jump, POLL_MS);
				}
				return;
			}
			// KoliBri überschreibt focus() am Host (Stencil-Lazy-Proxy) — dieser schlägt bei der
			// Karte still fehl. Der native HTMLElement.focus greift auf dem tabindex="-1"-Host
			// zuverlässig (Probe im #2848-Impl-Lauf).
			HTMLElement.prototype.focus.call(target, { preventScroll: true });
			scrollTargetIntoView(target);
			window.history.replaceState(null, '', window.location.pathname + window.location.search);
			timer = setTimeout(() => holdPosition(target), SETTLE_MS);
		};
		const onHashChange = (): void => {
			attempts = 0;
			settles = 0;
			clearTimeout(timer);
			jump();
		};
		jump();
		window.addEventListener('hashchange', onHashChange);
		return () => {
			window.removeEventListener('hashchange', onHashChange);
			clearTimeout(timer);
		};
	}, []);
};
