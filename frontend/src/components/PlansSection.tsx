import { KolAlert, KolBadge, KolDetails, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { components } from 'client';
import { formatEuro } from '../lib/format';
import { featureOffer, PERIOD_LABELS, PERIODS, planLabel, yearlyMonthlyEquivalent, type Plan } from '../lib/planOffers';
import { getChannel } from '../lib/platform';
import { usePlan } from '../lib/usePlan';
import { purchaseHookFor } from './billingChannel';

type PlansCatalog = components['schemas']['PlansCatalog'];

/**
 * Buchbare Pakete im Reiter „Pakete & Abo" (#1458 AK11, #1496 T6c, #1529; seit #1902 als Liste statt
 * Matrix). Preise und Funktionen kommen vollständig aus `GET /plans`; Buchen und Wechseln liefert
 * der Kaufweg des Kanals (`billingChannel.tsx`), die Ansicht kennt keinen Anbieter. Je Paket eine
 * Zeile mit Preisen samt Aktion und den enthaltenen Funktionen in einem `KolDetails` (Regel 1,
 * `ux-design.md`: keine Karte je Paket). Abo-Status, Kündigung und Rechnungen: `SubscriptionSection`.
 */
export const PlansSection = () => {
	const { plan } = usePlan();
	// Der Kanal wechselt zur Laufzeit nicht, der gewählte Hook bleibt über alle Renders derselbe.
	const usePurchase = purchaseHookFor(getChannel());
	const { t } = useTranslation('messages');
	const purchase = usePurchase();
	const [catalog, setCatalog] = useState<PlansCatalog | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		// `Promise.resolve().then(…)`: Der Aufruf liegt bewusst IM Promise, damit auch ein synchroner
		// Fehler (z. B. eine in Tests nur teilweise gemockte API-Fassade) im Fehlerzustand landet und
		// nicht den Render-Baum reißt — die Karte zeigt dann den Ladefehler statt eines Absturzes.
		void Promise.resolve()
			.then(() => api.getPlansCatalog({ signal: controller.signal }))
			.then((value: PlansCatalog | undefined) => {
				// Der Katalog wird nur übernommen, wenn er wirklich Matrix UND Preise trägt — sonst ist es
				// keine gültige Antwort und die Karte zeigt den Ladefehler statt halber Daten.
				if (value === undefined || !Array.isArray(value.features) || typeof value.prices !== 'object') {
					throw new Error('Unerwartete Antwort von GET /plans.');
				}
				setCatalog(value);
			})
			.catch(() => {
				// StrictMode montiert Effekte doppelt (Setup→Cleanup→Setup): der abgebrochene erste
				// Versuch darf den Fehlerzustand NICHT mehr setzen, sonst gewinnt er das Rennen gegen
				// den erfolgreichen zweiten Versuch und die Karte zeigt fälschlich den Ladefehler.
				if (!controller.signal.aborted) {
					setError('Die Pakete konnten nicht geladen werden.');
				}
			});
		return () => controller.abort();
	}, []);

	if (error !== null) {
		return (
			<KolAlert _type="error" _label="Pakete">
				{error}
			</KolAlert>
		);
	}

	if (catalog === null) {
		return <KolSpin _show _variant="cycle" _label="Pakete werden geladen …" />;
	}

	const plans = Object.keys(catalog.prices);

	const { actionCell } = purchase;

	return (
		<div className="plans-section" data-testid="plans-section">
			{purchase.notice}

			<ul className="plans-list">
				{plans.map((key) => {
					const included = catalog.features.filter((entry) => entry.allowedPlans.includes(key as never));
					return (
						<li key={key} className="plans-list__item" data-testid={`plan-item-${key}`}>
							<p className="plans-list__name">
								<strong>{planLabel(key)}</strong>
								{key === plan && <KolBadge _label="Aktuell" />}
							</p>
							<ul className="plans-list__periods">
								{PERIODS.map((period) => {
									const storePrice =
										key === 'free' ? undefined : purchase.price?.(key as Exclude<Plan, 'free'>, period);
									const action = key === 'free' ? undefined : actionCell?.(key as Exclude<Plan, 'free'>, period);
									// #1898: Monatsäquivalent der Jahreszahlung unter dem Monatspreis; im Store-Modus entfällt es.
									const perMonth = yearlyMonthlyEquivalent(catalog.prices[key].yearly);
									const showPerMonth = period === 'monthly' && storePrice === undefined && perMonth !== null;
									return (
										<li key={period} className="plans-list__period">
											<span>
												{PERIOD_LABELS[period]}: <span>{storePrice ?? formatEuro(catalog.prices[key][period])}</span>
												{showPerMonth && (
													<span className="plans-list__per-month">
														{t('billing.yearlyPerMonth', { price: formatEuro(perMonth) })}
													</span>
												)}
											</span>
											{action?.node}
										</li>
									);
								})}
							</ul>
							{included.length > 0 && (
								<KolDetails _label="Enthaltene Funktionen" _level={3}>
									<ul>
										{included.map((entry) => (
											<li key={entry.feature}>{featureOffer(entry.feature).title}</li>
										))}
									</ul>
								</KolDetails>
							)}
						</li>
					);
				})}
			</ul>

			{purchase.dialog}
		</div>
	);
};
