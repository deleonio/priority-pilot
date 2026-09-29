import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolAlert, KolSpin, KolTableStateful } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { formatEuro } from '../lib/format';
import { featureOffer, PERIOD_LABELS, PERIODS, planLabel, type Period, type Plan } from '../lib/planOffers';
import { getChannel } from '../lib/platform';
import { renderIntoCell } from '../lib/reactCellRoot';
import { usePlan } from '../lib/usePlan';
import { purchaseHookFor } from './billingChannel';

type PlansCatalog = components['schemas']['PlansCatalog'];

/** Spaltenschlüssel der Zeilenbezeichnung („Funktion") — erste, beim Scrollen stehende Spalte. */
const LABEL_KEY = 'label';
/** Feste Spaltenbreiten (AK3): die Matrix behält ihre Breite und scrollt in sich selbst (ADR 0014,
 * Entscheidung 6). Die Werte sind so bemessen, dass keine Kopfzelle auf mehr als zwei Zeilen
 * umbricht (AK6) — „Ultimate (dein Paket)" ist der längste Kopftext. */
const LABEL_COLUMN_WIDTH = 170;
const PLAN_COLUMN_WIDTH = 150;

/** Zeilenarten der Matrix: Preis-, Buchen- und Feature-Zeilen liegen gemeinsam im Tabellenkörper. */
type RowKind = 'price' | 'action' | 'feature';

/**
 * Eine Zeile der Paket-Matrix: Zeilenbezeichnung (`label`) plus je Paket eine Spalte. `_kind` ist ein
 * privates, nicht als Spalte gerendertes Feld (Muster `_task` in `CompletedTasksTable`-Zeilen) — es
 * unterscheidet die drei Zeilenarten im gemeinsamen Körper.
 */
interface PlanRow extends KoliBriTableDataType {
	label: string;
	_kind: RowKind;
	[key: string]: unknown;
}

/**
 * Reiter „Pakete" in den Einstellungen (#1458 AK11, erweitert um #1496 T6c; eigener Reiter seit
 * #1529 AK1). Feature-Matrix und Preise kommen vollständig aus `GET /plans`; Buchen und Wechseln
 * liefert der Kaufweg des Kanals (`billingChannel.tsx`), die Ansicht kennt keinen Anbieter.
 * Abo-Status, Kündigung und Rechnungen liegen im Reiter „Abo" (`SubscriptionSection`).
 */
export const PlansSection = () => {
	const { plan } = usePlan();
	// Der Kanal wechselt zur Laufzeit nicht, der gewählte Hook bleibt über alle Renders derselbe.
	const usePurchase = purchaseHookFor(getChannel());
	const purchase = usePurchase();
	const matrixRef = useRef<HTMLDivElement>(null);
	/**
	 * #1529 AK5: `KolTableStateful` entscheidet EINMAL beim Laden (`componentDidLoad`), ob die
	 * fixierten Spalten stehen bleiben — und schaltet sie ab, sobald ihre Summenbreite die
	 * Containerbreite erreicht. In einem noch nicht sichtbaren Tab-Panel ist diese Breite 0, die
	 * Funktionsspalte bliebe also dauerhaft ungefixt (die Korrektur per ResizeObserver kommt nur
	 * verzögert). Die Tabelle wird deshalb erst gemountet, wenn ihr Platz tatsächlich vermessen ist.
	 * Ohne `ResizeObserver` (JSDOM in den Unit-Tests) entfällt das Messen — dort gibt es kein Layout.
	 */
	const [matrixReady, setMatrixReady] = useState(typeof ResizeObserver === 'undefined');
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

	useEffect(() => {
		const node = matrixRef.current;
		if (node === null || typeof ResizeObserver === 'undefined') {
			return;
		}
		const check = (): void => {
			if (node.clientWidth > 0) {
				setMatrixReady(true);
			}
		};
		check();
		const observer = new ResizeObserver(check);
		observer.observe(node);
		return () => observer.disconnect();
		// `catalog` in den Abhängigkeiten: der Messcontainer existiert erst, wenn der Katalog geladen
		// ist (davor stehen Ladefehler bzw. Spinner an seiner Stelle).
	}, [catalog]);

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

	// #1529 AK3: Preis-, Buchen- UND Feature-Zeilen liegen gemeinsam im Tabellenkörper (`_data`) —
	// vor #1529 hingen Preis- und Buchen-Zeilen im `<thead>`, was sie für die Tabellen-Komponente
	// unzugänglich machte.
	const rows: PlanRow[] = [
		...PERIODS.map((period) => {
			const row: PlanRow = { label: `Preis ${PERIOD_LABELS[period]}`, _kind: 'price' };
			for (const key of plans) {
				const storePrice = key === 'free' ? undefined : purchase.price?.(key as Exclude<Plan, 'free'>, period);
				row[key] = storePrice ?? formatEuro(catalog.prices[key][period]);
			}
			return row;
		}),
		...(actionCell === undefined
			? []
			: PERIODS.map((period) => {
					const row: PlanRow = { label: `Buchen ${PERIOD_LABELS[period]}`, _kind: 'action', _period: period };
					for (const key of plans) {
						row[key] = key === 'free' ? '—' : actionCell(key as Exclude<Plan, 'free'>, period).text;
					}
					return row;
				})),
		...catalog.features.map((entry) => {
			const row: PlanRow = { label: featureOffer(entry.feature).title, _kind: 'feature' };
			for (const key of plans) {
				row[key] = entry.allowedPlans.includes(key as never) ? 'enthalten' : '—';
			}
			return row;
		}),
	];

	const headers: { horizontal: KoliBriTableHeaderCellWithLogic[][] } = {
		horizontal: [
			[
				{ key: LABEL_KEY, label: 'Funktion', width: LABEL_COLUMN_WIDTH },
				...plans.map((key) => ({
					key,
					label: `${planLabel(key)}${key === plan ? ' (dein Paket)' : ''}`,
					width: PLAN_COLUMN_WIDTH,
					// Buchen-Zellen tragen eine Web Component (KolButton); sie passt nicht deklarativ in
					// eine KoliBri-Zelle und wird wie in `CompletedTasksTable` über `render` in eine pro
					// Zelle gecachte React-Root gemountet. Preis- und Feature-Zellen bleiben Text — der
					// Datenwert der Zeile ist bereits die fertige Anzeige.
					render: (domNode: HTMLElement, _cell: unknown, tupel: unknown) => {
						const row = tupel as PlanRow;
						if (row._kind !== 'action') {
							renderIntoCell(domNode, <span>{String(row[key] ?? '')}</span>);
							return;
						}
						renderIntoCell(
							domNode,
							key === 'free' ? <span>—</span> : actionCell?.(key as Exclude<Plan, 'free'>, row._period as Period).node,
						);
					},
				})),
			],
		],
	};

	return (
		<div className="plans-section" data-testid="plans-section">
			{purchase.notice}

			{/*
			 * #1529 AK3-AK6 (ADR 0014, Entscheidung 6): Die Preis-Matrix bleibt bewusst eine Tabelle und
			 * wird NICHT nach Mobile-Regel 3 auf 375px in Karten zerlegt — der Vergleich mehrerer Pakete
			 * lebt vom Nebeneinander. Stattdessen feste Spaltenbreiten plus seitliches Scrollen innerhalb
			 * der Tabelle. `_fixedCols` ist hier — anders als im Vorbild `CompletedTasksTable` — auch
			 * mobil gesetzt, damit die Funktionsspalte beim Scrollen stehen bleibt (AK5).
			 *
			 * `[1, 0]` (nur die erste Spalte) statt des `[1, 1]` aus `CompletedTasksTable`: KoliBri
			 * schaltet die Sticky-Spalten komplett ab, sobald ihre Summenbreite die Containerbreite
			 * erreicht (`checkAndUpdateStickyState`, kol-table-stateless). Bei 375px wären
			 * 170 + 150 px breiter als der Container — mit `[1, 1]` bliebe die Funktionsspalte also
			 * ausgerechnet dort NICHT stehen, wo AK5 sie braucht.
			 */}
			<div className="plans-matrix" ref={matrixRef}>
				{matrixReady && (
					<KolTableStateful _label="Pakete im Vergleich" _data={rows} _headers={headers} _fixedCols={[1, 0]} />
				)}
			</div>

			{purchase.dialog}
		</div>
	);
};
