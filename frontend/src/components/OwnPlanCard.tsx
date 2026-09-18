import { KolAlert, KolCard, KolSingleSelect } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel, type Plan } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';

/**
 * Paket-Auswahl in der Reihenfolge des Serververtrags (`PLAN_VALUES`, server/src/logics/plans.ts).
 * Labels über `planLabel` — dieselbe Quelle wie das Zeilen-Badge in der Nutzerverwaltung und die
 * Matrix-Köpfe, damit Auswahl und Anzeige niemals auseinanderlaufen (#1556 AK2-Muster).
 */
const PLAN_OPTIONS: Array<{ label: string; value: Plan }> = (['free', 'pro', 'max', 'ultimate'] as Plan[]).map(
	(plan) => ({ label: planLabel(plan), value: plan }),
);

/**
 * Eigene Paket-Karte im Tab „Pakete" (#1565 AK1): Der kostenfreie Selbst-Wechsel ist hierher aus
 * der Zeile der Nutzerverwaltung gezogen (#1556) — die Bedienaktion steht über der Vergleichs-
 * Matrix (Lesestoff). Rollenerweiterbar gebaut: `SettingsPage` rendert die Karte selbst nur für
 * berechtigte Rollen (heute admin, später ggf. tester); die Karte kennt keine Rolle.
 *
 * Wechsel wie das frühere `handlePlanChange`-Muster: PATCH + danach `/auth/me` neu lesen
 * (`refresh` aus dem `PlanProvider`-Kontext), damit Badge, Auswahl-Vorauswahl und der
 * „(dein Paket)"-Marker der Matrix ohne Reload nachziehen (AK1).
 */
export const OwnPlanCard = ({ userId }: { userId: number }) => {
	const { plan, refresh } = usePlan();
	/** Sperrt die Auswahl während des laufenden PATCH (Race-Schutz bei schnellen Wechseln). */
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handlePlanChange = async (nextPlan: Plan): Promise<void> => {
		try {
			setPending(true);
			await api.updateUserPlan({ id: userId, plan: nextPlan });
			await refresh?.();
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setPending(false);
		}
	};

	return (
		<KolCard className="settings-card own-plan-card" _label="Eigenes Paket" _level={2}>
			<p className="own-plan-hint">
				Der Wechsel ist kostenfrei, sofort wirksam und ohne Zahlungsweg — er gilt für dein eigenes Konto.
			</p>
			{error !== null && (
				<KolAlert _type="error" _label="Wechsel nicht möglich">
					{error}
				</KolAlert>
			)}
			<KolSingleSelect
				_label="Eigenes Paket wechseln"
				_options={PLAN_OPTIONS}
				_value={plan ?? 'free'}
				_disabled={pending}
				/* Ein „kein Paket"-Zwischenstand ist ungültig — jeder Nutzer hat stets eines (KI-UX). */
				_hasClearButton={false}
				_on={{
					onChange: (_event, value) => void handlePlanChange(String(value) as Plan),
				}}
			/>
		</KolCard>
	);
};
