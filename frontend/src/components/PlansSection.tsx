import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolAlert, KolButton, KolSpin, KolTableStateful } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import type { components } from 'client';
import { toApiError } from '../lib/apiError';
import { formatEuro } from '../lib/format';
import { featureOffer, planLabel, type Plan } from '../lib/planOffers';
import { renderIntoCell } from '../lib/reactCellRoot';
import { useBillingReturnPoll, usePlan } from '../lib/usePlan';
import { Modal } from './Modal';

type PlansCatalog = components['schemas']['PlansCatalog'];

const PERIODS = ['monthly', 'quarterly', 'yearly'] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_LABELS: Record<Period, string> = { monthly: 'monatlich', quarterly: 'quartalsweise', yearly: 'jährlich' };

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
 * Wartezustand nach Rückkehr aus einem Buchungs-/Wechselvorgang ohne `approvalUrl` (#1496 AK4) —
 * eigene Komponente, damit `useBillingReturnPoll` nur gemountet läuft, solange eine Wartezeit
 * aktiv ist (kein Poll-Overhead im Normalfall).
 */
const BillingReturnWait = ({
	refresh,
	expectedPlan,
	currentPlan,
}: {
	refresh: () => Promise<void>;
	expectedPlan: Plan;
	currentPlan: Plan | null;
}) => {
	const { status } = useBillingReturnPoll(refresh, expectedPlan, currentPlan);
	if (status === 'confirmed') {
		return null;
	}
	if (status === 'timeout') {
		return (
			<KolAlert _type="warning" _alert _label="Zahlung wird bestätigt">
				Die Bestätigung dauert länger als erwartet. Bitte die Einstellungen in Kürze erneut öffnen.
			</KolAlert>
		);
	}
	return (
		<KolAlert _type="info" _alert _label="Zahlung wird bestätigt">
			Zahlung wird bestätigt …
		</KolAlert>
	);
};

interface ChangeDialogProps {
	targetPlan: Exclude<Plan, 'free'>;
	targetPeriod: Period;
	onClose: () => void;
	onChanged: (approvalUrl: string | undefined) => void;
}

/** Bestätigungsdialog vor einem Paketwechsel (#1496 AK3) — nennt die Restbetrag-Anrechnung. */
const ChangeDialog = ({ targetPlan, targetPeriod, onClose, onChanged }: ChangeDialogProps) => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const confirm = async (): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			const { approvalUrl } = await api.changeBillingSubscription({ plan: targetPlan, period: targetPeriod });
			onChanged(approvalUrl);
		} catch (reason) {
			setError((await toApiError(reason)).message);
			setBusy(false);
		}
	};

	return (
		<Modal title="Paket wechseln" onClose={onClose} initialFocusRef={cancelRef as RefObject<HTMLElement | null>}>
			{error !== null && (
				<KolAlert _type="error" _label="Wechsel fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Wechsel zu <strong>{planLabel(targetPlan)}</strong> ({PERIOD_LABELS[targetPeriod]}). Der Restbetrag des
				laufenden Abos wird als Rabatt angerechnet — gegen das Zahlungssystem läuft nur die Differenz.
			</p>
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => onClose() }}
				/>
				<KolButton
					_label={busy ? 'Wird gewechselt…' : 'Wechseln bestätigen'}
					_variant="primary"
					_disabled={busy}
					_on={{ onClick: () => void confirm() }}
				/>
			</div>
		</Modal>
	);
};

/**
 * Reiter „Pakete" in den Einstellungen (#1458 AK11, erweitert um #1496 T6c; eigener Reiter seit
 * #1529 AK1). Feature-Matrix und Preise kommen vollständig aus `GET /plans`; Buchen/Wechseln laufen
 * über die Abo-Routen (#1505/#1506) — der angezeigte Plan ändert sich erst, wenn `/auth/me` ihn
 * liefert (AK3/AK4). Abo-Status, Kündigung und Rechnungen liegen im Reiter „Abo"
 * (`SubscriptionSection`).
 */
export const PlansSection = () => {
	const { plan, subscription, refresh } = usePlan();
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
	const [bookingKey, setBookingKey] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [changeTarget, setChangeTarget] = useState<{ plan: Exclude<Plan, 'free'>; period: Period } | null>(null);
	const [pendingWait, setPendingWait] = useState<{ expectedPlan: Plan } | null>(null);

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

	const handleBook = async (targetPlan: Exclude<Plan, 'free'>, period: Period): Promise<void> => {
		const key = `${targetPlan}-${period}`;
		setActionError(null);
		setBookingKey(key);
		try {
			const { approvalUrl } = await api.createBillingSubscription({ plan: targetPlan, period });
			if (approvalUrl !== undefined) {
				window.location.href = approvalUrl;
				return;
			}
		} catch (reason) {
			setActionError((await toApiError(reason)).message);
		} finally {
			setBookingKey(null);
		}
	};

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

	const renderActionCell = (targetPlan: Exclude<Plan, 'free'>, period: Period) => {
		// `undefined` heißt „Abo-Status noch nicht geladen" (usePlanState hat /auth/me noch nicht
		// beantwortet) — bis dahin lieber keine Aktion zeigen als fälschlich „Buchen" (kein Abo) oder
		// „Wechseln" (Abo vorhanden) zu behaupten.
		if (subscription === undefined) {
			return null;
		}
		if (subscription !== null && subscription.plan === targetPlan && subscription.period === period) {
			return <span>Aktuelles Paket</span>;
		}
		if (subscription === null) {
			return (
				<KolButton
					data-testid={`book-${targetPlan}-${period}`}
					_label="Buchen"
					_variant="primary"
					_disabled={bookingKey === `${targetPlan}-${period}`}
					_on={{ onClick: () => void handleBook(targetPlan, period) }}
				/>
			);
		}
		return (
			<KolButton
				data-testid={`change-plan-${targetPlan}-${period}`}
				_label="Wechseln"
				_variant="secondary"
				_on={{ onClick: () => setChangeTarget({ plan: targetPlan, period }) }}
			/>
		);
	};

	/** Reiner Textwert einer Buchen-Zelle — Sortier-/Filterwert der Zelle und Fallback ohne `render`. */
	const actionCellText = (planKey: string, period: Period): string => {
		if (planKey === 'free') {
			return '—';
		}
		if (subscription === undefined) {
			return '';
		}
		if (subscription !== null && subscription.plan === planKey && subscription.period === period) {
			return 'Aktuelles Paket';
		}
		return subscription === null ? 'Buchen' : 'Wechseln';
	};

	// #1529 AK3: Preis-, Buchen- UND Feature-Zeilen liegen gemeinsam im Tabellenkörper (`_data`) —
	// vor #1529 hingen Preis- und Buchen-Zeilen im `<thead>`, was sie für die Tabellen-Komponente
	// unzugänglich machte.
	const rows: PlanRow[] = [
		...PERIODS.map((period) => {
			const row: PlanRow = { label: `Preis ${PERIOD_LABELS[period]}`, _kind: 'price' };
			for (const key of plans) {
				row[key] = formatEuro(catalog.prices[key][period]);
			}
			return row;
		}),
		...PERIODS.map((period) => {
			const row: PlanRow = { label: `Buchen ${PERIOD_LABELS[period]}`, _kind: 'action', _period: period };
			for (const key of plans) {
				row[key] = actionCellText(key, period);
			}
			return row;
		}),
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
							key === 'free' ? <span>—</span> : renderActionCell(key as Exclude<Plan, 'free'>, row._period as Period),
						);
					},
				})),
			],
		],
	};

	return (
		<div className="plans-section" data-testid="plans-section">
			{actionError !== null && (
				<KolAlert _type="error" _label="Buchung fehlgeschlagen">
					{actionError}
				</KolAlert>
			)}

			{pendingWait !== null && refresh !== undefined && (
				<BillingReturnWait refresh={refresh} expectedPlan={pendingWait.expectedPlan} currentPlan={plan} />
			)}

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

			{changeTarget !== null && (
				<ChangeDialog
					targetPlan={changeTarget.plan}
					targetPeriod={changeTarget.period}
					onClose={() => setChangeTarget(null)}
					onChanged={(approvalUrl) => {
						const target = changeTarget;
						setChangeTarget(null);
						if (approvalUrl !== undefined) {
							window.location.href = approvalUrl;
							return;
						}
						setPendingWait({ expectedPlan: target.plan });
					}}
				/>
			)}
		</div>
	);
};
