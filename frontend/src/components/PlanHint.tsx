import { featureOffer, planLabel, type FeatureId } from '../lib/planOffers';
import { useEntitlement } from '../lib/usePlan';
import { FeaturePopoverButton } from './FeaturePopoverButton';

/**
 * Paket-Hinweis an einer Grenzstelle (#1787, ADR 0018 Entscheidung 6): ein Info-Button, dessen
 * Popover die Erklärung als schließbare Alert-Card trägt ([FeaturePopoverButton], Muster in
 * ux-design.md). Rendert nur aus `allowed`/`requiredPlan` des Servers, öffnet nie einen Dialog und
 * sperrt nichts. Der Weg zu den Paketen ist ein Button in der Card (`inModal`: neuer Tab, siehe
 * [FeaturePopoverButton]).
 */
export const PlanHint = ({ feature, inModal = false }: { feature: FeatureId; inModal?: boolean }) => {
	const entitlement = useEntitlement(feature);

	if (entitlement === undefined || entitlement.allowed) {
		return null;
	}

	const paket = planLabel(entitlement.requiredPlan);
	const { title } = featureOffer(feature);

	return (
		<FeaturePopoverButton label={`Paket „${paket}“ erforderlich`} testId={`plan-badge-${feature}`} inModal={inModal}>
			<p>
				{title}: Das gehört zum Paket {paket}.
			</p>
		</FeaturePopoverButton>
	);
};
