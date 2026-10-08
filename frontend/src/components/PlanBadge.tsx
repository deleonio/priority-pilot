import { KolBadge } from '@public-ui/react-v19';
import { useTranslation } from 'react-i18next';
import { featureOffer, planLabel, type FeatureId } from '../lib/planOffers';
import { useEntitlement } from '../lib/usePlan';
import { PlanHint } from './PlanHint';

/**
 * Badge-Farben als Hex-Statische (Review #1564 F2): KolBris `_color` validiert Hex
 * (`#rgb`/`#rrggbb`/`#rrggbbaa`, dist `color-*.js`) und verwirft alles andere stumm mit
 * Dev-Warnung — `var(--…)` ließ die Badges bisher ungefärbt. Werte = helle Theme-Varianten
 * `--pp-status-total`/`--pp-success` (app.css); die Kontrast-Vordergrundfarbe rechnet KoliBri
 * selbst aus dem Hex, das Badge ist damit in beiden Themes kontrastsicher.
 */
const COLOR_SUCCESS = '#1a7f37';

/**
 * Paket-Badge an einer Bedienstelle (#1458 AK4, umgebaut in #1528). Rendert AUSSCHLIESSLICH aus
 * `allowed` und `requiredPlan` des übergebenen Feature-Identifiers — kein Plan-Vergleich, keine
 * Rangfolge im Frontend: Welches Paket ein Feature enthält, weiß allein der Server (`GET /auth/me`).
 *
 * Das Badge sperrt nichts (AK13). Nur der „enthalten"-Zustand bleibt ein Badge; gesperrt rendert
 * `PlanHint` (Popover-Button mit Alert-Card). Es beschriftet Funktion und Paket direkt (AK2); der globale
 * Angebots-Dialog mit dem `pp:plan-required`-Event ist entfallen (AK1). Klick-Verhalten nach der
 * Autoren-Entscheidung „B" (2026-09-17, AK3): außerhalb von Modalen führt es als echtes `<a>` auf
 * den Pakete-Reiter (Tastatur-/Screenreader-Semantik, Klick-Naht für JSDOM über den Testid am
 * `<a>` selbst); innerhalb von Modalen (`inModal`) ist es reine Beschriftung ohne Klickziel, damit
 * eingetippter Text nicht durch eine Navigation verloren geht. Das grüne „enthalten"-Badge hat
 * nirgends ein Klickziel — auf dem Pakete-Reiter gäbe es dort nichts zu tun.
 */
export const PlanBadge = ({ feature, inModal = false }: { feature: FeatureId; inModal?: boolean }) => {
	const entitlement = useEntitlement(feature);
	const { t } = useTranslation('billing');

	if (entitlement === undefined) {
		// Weder Spiegel noch Serverantwort — lieber nichts als ein falsches Badge (AK1).
		return null;
	}

	const { title } = featureOffer(feature);
	const paket = planLabel(entitlement.requiredPlan);

	if (entitlement.allowed) {
		// Häkchen nie als alleiniger Bedeutungsträger: Icon + Text „enthalten" (WCAG 1.4.1).
		return (
			<span className="plan-badge plan-badge--included" data-testid={`plan-badge-${feature}`}>
				<KolBadge
					_label={t('planBadge.included', { title, plan: paket })}
					_color={COLOR_SUCCESS}
					_icons={{ left: { icon: 'fa-solid fa-check' } }}
				/>
			</span>
		);
	}

	// Gesperrt: kein Badge, sondern der einheitliche Feature-Popover-Button (ux-design.md).
	return <PlanHint feature={feature} inModal={inModal} />;
};
