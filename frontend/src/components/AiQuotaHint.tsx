import { KolAlert } from '@public-ui/react-v19';
import { hasAiQuota, isQuotaLow } from '../lib/planOffers';
import { usePlan, useEntitlement } from '../lib/usePlan';

/**
 * Rest des KI-Monatskontingents (#1458 AK10). Der Wert kommt ausschließlich aus
 * `entitlements.ai_assist.quotaRemaining` (`GET /auth/me`); unter 10 Prozent des Monatskontingents
 * steht zusätzlich eine Warnung. Ohne Kontingent im Paket (free) gibt es nichts anzuzeigen — dort
 * erklärt das `PlanBadge` die Lage.
 */
export const AiQuotaHint = () => {
	const { plan } = usePlan();
	const entitlement = useEntitlement('ai_assist');
	const remaining = entitlement?.quotaRemaining;

	// Ohne Kontingent im Paket (free) ist auch ein gelieferter Rest von 0 keine Aussage über ein
	// Monatskontingent — „Noch 0 KI-Anfragen" wäre irreführend. Dieselbe Schranke wie in `isQuotaLow`.
	if (remaining === undefined || plan === null || !hasAiQuota(plan)) {
		return null;
	}

	return (
		<div className="ai-quota-hint">
			<p className="hint">{`Noch ${remaining} KI-Anfragen in diesem Monat.`}</p>
			{isQuotaLow(remaining, plan) && (
				<KolAlert _type="warning" _label="Kontingent fast aufgebraucht">
					Dein KI-Kontingent für diesen Monat neigt sich dem Ende zu.
				</KolAlert>
			)}
		</div>
	);
};
