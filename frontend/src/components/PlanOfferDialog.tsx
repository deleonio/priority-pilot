import { KolButton } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../api';
import { PLAN_REQUIRED_EVENT, type PlanRequiredDetail } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { featureOffer, planLabel, type Plan } from '../lib/planOffers';
import { Modal } from './Modal';

/**
 * Globaler Angebots-Dialog (#1458 AK5/AK7). Lauscht ausschließlich auf `pp:plan-required` — gefeuert
 * von `toApiError` (403 `plan_required` / 429 `quota_exhausted`) und vom (i)-Schalter des
 * `PlanBadge`. So gibt es genau EINEN Dialog für beide Wege; mehrere Events hintereinander stauen
 * nicht an, der zuletzt gemeldete Anlass gewinnt.
 *
 * Aufbau und Klick-Naht wie im `SessionExpiredDialog` (#1231): nativer `<span>`-Wrapper mit
 * `data-testid`, weil `KolButton._on.onClick` in JSDOM nicht per DOM-Klick auslöst.
 *
 * Der Preis kommt aus `GET /plans` (AK11) — im Frontend steht keine Preisliste.
 */
export const PlanOfferDialog = () => {
	const [offer, setOffer] = useState<PlanRequiredDetail | null>(null);
	const [prices, setPrices] = useState<Record<string, { monthly: number; yearly: number }> | null>(null);
	const closeRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const onPlanRequired = (event: Event): void => {
			const { detail } = event as CustomEvent<PlanRequiredDetail>;
			// flushSync wie im SessionExpiredDialog: Das Event trifft mitten in der Fehlerverarbeitung
			// einer Aktion ein, der Nutzer soll das Angebot ohne Verzögerung sehen.
			flushSync(() => {
				setOffer(detail);
			});
		};
		window.addEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
		return () => window.removeEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
	}, []);

	useEffect(() => {
		if (offer === null || prices !== null) {
			return;
		}
		const controller = new AbortController();
		void Promise.resolve()
			.then(() => api.getPlansCatalog({ signal: controller.signal }))
			.then((catalog) => setPrices(catalog?.prices ?? null))
			.catch(() => {
				// Ohne Preis bleibt der Nutzen sichtbar — der Dialog ist wichtiger als die Zahl.
			});
		return () => controller.abort();
	}, [offer, prices]);

	if (offer === null) {
		return null;
	}

	const { title, benefit } = featureOffer(offer.feature);
	const monthly = prices?.[offer.requiredPlan as Plan]?.monthly;

	return (
		<Modal
			title={`${title} — mit ${planLabel(offer.requiredPlan)}`}
			onClose={() => setOffer(null)}
			initialFocusRef={closeRef}
		>
			<p>{benefit}</p>
			<p>
				Enthalten ab Paket <strong>{planLabel(offer.requiredPlan)}</strong>
				{monthly === undefined ? '' : ` — ${formatEuro(monthly)} im Monat`}. Dein Paket: {planLabel(offer.currentPlan)}.
			</p>
			<div className="modal-actions">
				<span ref={closeRef} data-testid="plan-offer-close" tabIndex={-1} onClick={() => setOffer(null)}>
					<KolButton _label="Schließen" _variant="secondary" />
				</span>
			</div>
		</Modal>
	);
};
