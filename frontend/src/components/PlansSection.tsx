import { KolAlert, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { featureOffer, planLabel } from '../lib/planOffers';
import { usePlan } from '../lib/usePlan';

type PlansCatalog = components['schemas']['PlansCatalog'];

/** Cent-Betrag aus `GET /plans` (#1494) als Euro-String mit Komma, z. B. 799 → "7,99 €". */
const formatEuro = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

/**
 * Sekundärbereich „Pakete" in den Einstellungen (#1458 AK11). Feature-Matrix und Preise kommen
 * vollständig aus `GET /plans` — im Frontend steht weder eine Preisliste noch eine Matrixzeile, so
 * bleibt eine Preisänderung eine reine Serversache.
 */
export const PlansSection = () => {
	const { plan } = usePlan();
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
			.catch(() => setError('Die Pakete konnten nicht geladen werden.'));
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

	return (
		<div className="plans-section" data-testid="plans-section">
			<table className="plans-matrix">
				<thead>
					<tr>
						<th scope="col">Funktion</th>
						{plans.map((key) => (
							<th key={key} scope="col">
								{planLabel(key)}
								{key === plan ? ' (dein Paket)' : ''}
							</th>
						))}
					</tr>
					<tr>
						<th scope="row">Preis je Monat</th>
						{plans.map((key) => (
							<td key={key}>{formatEuro(catalog.prices[key].monthly)}</td>
						))}
					</tr>
				</thead>
				<tbody>
					{catalog.features.map((entry) => (
						<tr key={entry.feature}>
							<th scope="row">{featureOffer(entry.feature).title}</th>
							{plans.map((key) => (
								<td key={key}>{entry.allowedPlans.includes(key as never) ? 'enthalten' : '—'}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};
