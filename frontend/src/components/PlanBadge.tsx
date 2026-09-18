import { KolBadge } from '@public-ui/react-v19';
import { useNavigate } from 'react-router-dom';
import { featureOffer, planLabel, type FeatureId } from '../lib/planOffers';
import { useEntitlement } from '../lib/usePlan';

/** Zielroute des Badges: der Pakete-Reiter der Einstellungen (Tab 6, `SettingsPage.tsx`). */
const PAKETE_ROUTE = '/settings/pakete';

/**
 * Badge-Farben als Hex-Statische (Review #1564 F2): KolBris `_color` validiert Hex
 * (`#rgb`/`#rrggbb`/`#rrggbbaa`, dist `color-*.js`) und verwirft alles andere stumm mit
 * Dev-Warnung — `var(--…)` ließ die Badges bisher ungefärbt. Werte = helle Theme-Varianten
 * `--pp-status-total`/`--pp-success` (app.css); die Kontrast-Vordergrundfarbe rechnet KoliBri
 * selbst aus dem Hex, das Badge ist damit in beiden Themes kontrastsicher.
 */
const COLOR_STATUS = '#3f4a5c';
const COLOR_SUCCESS = '#1a7f37';

/**
 * Link-Variante außerhalb von Modalen (AK3, Entscheidung B). Eigenes Bauteil, damit der
 * Router-Hook NUR in dieser Variante läuft — Modals und „enthalten"-Badges rendern ohne
 * Router-Kontext (isolierte Unit-Tests der Host-Komponenten bleiben routerfrei).
 */
const PlanBadgeLink = ({ feature, label }: { feature: FeatureId; label: string }) => {
	const navigate = useNavigate();
	return (
		<a
			className="plan-badge plan-badge--link"
			data-testid={`plan-badge-${feature}`}
			href={PAKETE_ROUTE}
			onClick={(event) => {
				// Router-Navigation statt Dokument-Reload; das href bleibt für Mittelklick/„In neuem Tab öffnen".
				event.preventDefault();
				navigate(PAKETE_ROUTE);
			}}
		>
			<KolBadge _label={label} _color={COLOR_STATUS} />
		</a>
	);
};

/**
 * Paket-Badge an einer Bedienstelle (#1458 AK4, umgebaut in #1528). Rendert AUSSCHLIESSLICH aus
 * `allowed` und `requiredPlan` des übergebenen Feature-Identifiers — kein Plan-Vergleich, keine
 * Rangfolge im Frontend: Welches Paket ein Feature enthält, weiß allein der Server (`GET /auth/me`).
 *
 * Das Badge sperrt nichts (AK13). Es beschriftet Funktion und Paket direkt (AK2); der globale
 * Angebots-Dialog mit dem `pp:plan-required`-Event ist entfallen (AK1). Klick-Verhalten nach der
 * Autoren-Entscheidung „B" (2026-09-17, AK3): außerhalb von Modalen führt es als echtes `<a>` auf
 * den Pakete-Reiter (Tastatur-/Screenreader-Semantik, Klick-Naht für JSDOM über den Testid am
 * `<a>` selbst); innerhalb von Modalen (`inModal`) ist es reine Beschriftung ohne Klickziel, damit
 * eingetippter Text nicht durch eine Navigation verloren geht. Das grüne „enthalten"-Badge hat
 * nirgends ein Klickziel — auf dem Pakete-Reiter gäbe es dort nichts zu tun.
 */
export const PlanBadge = ({ feature, inModal = false }: { feature: FeatureId; inModal?: boolean }) => {
	const entitlement = useEntitlement(feature);

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
					_label={`${title} · ${paket} · enthalten`}
					_color={COLOR_SUCCESS}
					_icons={{ left: { icon: 'fa-solid fa-check' } }}
				/>
			</span>
		);
	}

	if (inModal) {
		return (
			<span className="plan-badge plan-badge--label" data-testid={`plan-badge-${feature}`}>
				<KolBadge _label={`${title} · ${paket}`} _color={COLOR_STATUS} />
			</span>
		);
	}

	return <PlanBadgeLink feature={feature} label={`${title} · ${paket}`} />;
};
