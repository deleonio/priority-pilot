import { KolAlert } from '@public-ui/react-v19';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { featureOffer, planLabel, type FeatureId } from '../lib/planOffers';
import { isNativeChannel } from '../lib/platform';
import { useEntitlement } from '../lib/usePlan';

/** Zielroute des Hinweises: der Pakete-Reiter der Einstellungen (wie `PlanBadge`). */
const PAKETE_ROUTE = '/settings/pakete';

/** Nach dem Schließen bleibt der Hinweis eines Features so lange verborgen (#1787 AK3). */
const HIDE_MS = 7 * 24 * 60 * 60 * 1000;

const hintKey = (feature: FeatureId): string => `pp-plan-hint-${feature}`;

/** Ist der Hinweis noch gesperrt? Gesperrter/kaputter Storage → nicht gesperrt. */
const isHidden = (feature: FeatureId): boolean => {
	try {
		const closedAt = Number(localStorage.getItem(hintKey(feature)));
		return closedAt > 0 && Date.now() - closedAt < HIDE_MS;
	} catch {
		return false;
	}
};

const storeClosed = (feature: FeatureId): void => {
	try {
		localStorage.setItem(hintKey(feature), String(Date.now()));
	} catch {
		// Best-Effort; im Zweifel erscheint der Hinweis früher wieder.
	}
};

/**
 * Link außerhalb von Modalen. Eigenes Bauteil, damit der Router-Hook nur hier läuft — Modals
 * rendern ohne Router-Kontext (Muster `PlanBadgeLink`).
 */
const PaketeLink = () => {
	const navigate = useNavigate();
	return (
		<a
			href={PAKETE_ROUTE}
			onClick={(event) => {
				event.preventDefault();
				navigate(PAKETE_ROUTE);
			}}
		>
			Pakete ansehen
		</a>
	);
};

/**
 * Dezenter Inline-Hinweis auf das Paket, das eine Funktion enthält (#1787, ADR 0018 Entscheidung 6).
 * Rendert nur aus `allowed`/`requiredPlan` des Servers, öffnet nie einen Dialog und sperrt nichts.
 * Schließen sperrt den Hinweis je Feature 7 Tage (localStorage). In Modalen (`inModal`) führt ein
 * Link in einem neuen Tab zu den Paketen, in der nativen App gibt es dort nur den Text — eine
 * Navigation würde ungesicherte Eingaben verwerfen.
 *
 * Text im Slot statt in `_label`: KoliBri rendert `_label` im Shadow DOM (Muster `PushToast.tsx`).
 */
export const PlanHint = ({ feature, inModal = false }: { feature: FeatureId; inModal?: boolean }) => {
	const entitlement = useEntitlement(feature);
	const [closed, setClosed] = useState(() => isHidden(feature));

	if (entitlement === undefined || entitlement.allowed || closed) {
		return null;
	}

	const paket = planLabel(entitlement.requiredPlan);
	const { title } = featureOffer(feature);

	return (
		<KolAlert
			_type="info"
			_label={`Hinweis zum Paket ${paket}`}
			_hasCloser
			_on={{
				onClose: () => {
					storeClosed(feature);
					setClosed(true);
				},
			}}
			data-testid={`plan-hint-${feature}`}
		>
			<p>
				{title}: Das gehört zum Paket {paket}. {!inModal && <PaketeLink />}
				{inModal &&
					(isNativeChannel() ? (
						'Mehr unter Einstellungen › Pakete.'
					) : (
						<a href={PAKETE_ROUTE} target="_blank" rel="noopener noreferrer">
							Pakete ansehen
						</a>
					))}
			</p>
		</KolAlert>
	);
};
