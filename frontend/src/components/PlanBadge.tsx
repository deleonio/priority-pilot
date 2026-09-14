import { KolBadge, KolButton } from '@public-ui/react-v19';
import { PLAN_REQUIRED_EVENT, type PlanRequiredDetail } from '../lib/apiError';
import { planLabel, type FeatureId } from '../lib/planOffers';
import { useEntitlement, usePlan } from '../lib/usePlan';

/**
 * Paket-Badge an einer Bedienstelle (#1458 AK4). Rendert AUSSCHLIESSLICH aus `allowed` und
 * `requiredPlan` des übergebenen Feature-Identifiers — kein Plan-Vergleich, keine Rangfolge im
 * Frontend: Welches Paket ein Feature enthält, weiß allein der Server (`GET /auth/me`).
 *
 * Das Badge sperrt nichts (AK13). Es beschriftet nur; die Aktion läuft bis zum Server, erst dessen
 * 403/429 öffnet das Angebot. Der (i)-Schalter feuert dasselbe `pp:plan-required`-Event wie
 * `toApiError`, damit Klick und Server-Ablehnung in EINEM Dialog zusammenlaufen (AK5/AK7).
 *
 * Klick-Naht wie im `SessionExpiredDialog`: `KolButton._on.onClick` löst in JSDOM nicht über einen
 * echten DOM-Klick aus, deshalb sitzt der Handler auf einem nativen `<span>` mit `data-testid`.
 */
export const PlanBadge = ({ feature }: { feature: FeatureId }) => {
	const { plan } = usePlan();
	const entitlement = useEntitlement(feature);

	if (entitlement === undefined) {
		// Weder Spiegel noch Serverantwort — lieber nichts als ein falsches Badge (AK1).
		return null;
	}

	if (entitlement.allowed) {
		return (
			<span className="plan-badge plan-badge--included" data-testid={`plan-badge-${feature}`}>
				<KolBadge _label="Im Paket enthalten" _color="#1a7f37" _icons={{ left: { icon: 'fa-solid fa-check' } }} />
			</span>
		);
	}

	const openOffer = (): void => {
		const detail: PlanRequiredDetail = {
			feature,
			requiredPlan: entitlement.requiredPlan,
			currentPlan: plan ?? 'free',
		};
		window.dispatchEvent(new CustomEvent<PlanRequiredDetail>(PLAN_REQUIRED_EVENT, { detail }));
	};

	return (
		<span className="plan-badge plan-badge--offer" data-testid={`plan-badge-${feature}`}>
			<KolBadge _label={planLabel(entitlement.requiredPlan)} _color="#5a3fc0" />
			<span data-testid={`plan-badge-info-${feature}`} onClick={openOffer}>
				<KolButton
					_label={`Was bietet ${planLabel(entitlement.requiredPlan)}?`}
					_hideLabel
					_variant="ghost"
					_icons={{ left: { icon: 'fa-solid fa-circle-info' } }}
				/>
			</span>
		</span>
	);
};
