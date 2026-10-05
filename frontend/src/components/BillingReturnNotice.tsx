import { KolAlert } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlan } from '../lib/usePlan';

/**
 * Rückkehr von PayPal (#2235): `?billing=cancelled` heißt, der Nutzer hat bei PayPal abgebrochen —
 * die ausstehende Buchung (`approval_pending`) wird über die Kündigungs-Route aufgeräumt, damit
 * sofort neu gebucht werden kann. Die Route schluckt einen PayPal-4xx (nie zugestimmt) und löscht
 * die lokale Zeile trotzdem. Ohne Router-Kontext (Tests, native Einbettung) tut die Komponente
 * nichts — Router-Haken nur im inneren Element, Muster `FeaturePopoverButton`.
 */
export const BillingReturnNotice = () => {
	if (!useInRouterContext()) {
		return null;
	}
	return <BillingReturnNoticeInRouter />;
};

const BillingReturnNoticeInRouter = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { refresh } = usePlan();
	const [aborted, setAborted] = useState(false);

	useEffect(() => {
		if (new URLSearchParams(location.search).get('billing') !== 'cancelled') {
			return;
		}
		// Parameter sofort aus der URL nehmen, damit ein Reload nicht erneut räumt.
		navigate({ pathname: location.pathname }, { replace: true });
		void api
			.cancelBillingSubscription()
			.catch(() => {})
			.finally(() => {
				void refresh?.();
				setAborted(true);
			});
	}, [location.pathname, location.search, navigate, refresh]);

	if (!aborted) {
		return null;
	}
	return (
		<KolAlert _type="info" _alert _label="Buchung abgebrochen" data-testid="billing-cancelled-notice">
			Die Buchung wurde abgebrochen — es wurde nichts abgebucht. Du kannst jederzeit neu buchen.
		</KolAlert>
	);
};
