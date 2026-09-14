import { useEffect } from 'react';
import { PLAN_REQUIRED_EVENT } from './apiError';

/**
 * Schließt das aufrufende Modal, sobald ein Paket-Angebot angefordert wird (#1458, Entscheidung
 * 7.1 zum Review von PR #1488).
 *
 * `PlanOfferDialog` hängt als EIN globaler Dialog in `App.tsx` und lauscht auf dasselbe
 * `pp:plan-required`-Event (AK7). Liegt der Auslöser in einem Modal — der (i)-Schalter am
 * `PlanBadge` oder eine serverseitige 403/429-Antwort während einer Aktion — öffnete sich das
 * Angebot bisher ÜBER dem offenen Modal. `docs/mobile-ui-rules.md` führt „Modal in Modal" als
 * Anti-Pattern. Das auslösende Modal schließt sich deshalb zuerst.
 *
 * Reihenfolge des Fokus: React führt die Cleanups (Fokus-Rückgabe des Modals an seinen Auslöser)
 * vor den Effekten des neu gemounteten Dialogs aus — der Fokus landet also im Angebot und kehrt
 * beim Schließen zum ursprünglichen Trigger-Button im Hintergrund zurück.
 *
 * Bewusst in Kauf genommen (Teil der Entscheidung 7.1): Trifft im `QuickCaptureModal` eine
 * serverseitige Ablehnung ein, gehen nicht gespeicherte Formulareingaben verloren.
 */
export const useClosingOnPlanRequired = (onClose: () => void): void => {
	useEffect(() => {
		const onPlanRequired = (): void => onClose();
		window.addEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
		return () => window.removeEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
	}, [onClose]);
};
