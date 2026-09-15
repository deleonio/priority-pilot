import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { checkAuth, type Subscription } from './auth';
import type { EntitlementMap, FeatureEntitlement, FeatureId, Plan } from './planOffers';

/**
 * Paket-Kontext (#1458). `GET /auth/me` liefert Paket und Entitlement-Map bereits mit (T1 #1456) —
 * hier werden sie EINMAL gehalten, statt an jeder Bedienstelle erneut geholt.
 *
 * `localStorage`-Spiegel wie in `push.ts:101-121`: Ohne ihn rendert jedes Badge beim Seitenwechsel
 * erst leer und kippt dann auf den Serverwert. Der Schlüssel trägt die User-Id (AK2), damit auf
 * einem geteilten Gerät nie die Badges des vorigen Kontos erscheinen; ein gesperrter oder kaputter
 * Storage ist kein Fehlerfall, sondern bedeutet nur: warten auf `/auth/me` (AK3).
 */

export interface PlanState {
	/** Paket des Nutzers; `null`, solange weder Spiegel noch Antwort vorliegen. */
	plan: Plan | null;
	/** Entitlement-Map des Servers — die einzige Quelle für `allowed`/`requiredPlan` (AK4). */
	entitlements: EntitlementMap;
	/**
	 * Abo-Status aus `/auth/me` (#1496 AK6); `undefined` vor dem ersten Laden, `null` ohne Abo.
	 * Optional, damit bestehende `PlanProvider`-Testwerte (nur `plan`/`entitlements`) unverändert
	 * gültig bleiben.
	 */
	subscription?: Subscription | null;
	/**
	 * Erneuter `/auth/me`-Abruf, der Zustand + Spiegel aktualisiert (#1496 AK4) — die EINZIGE
	 * Stelle, die den Spiegel schreibt. Optional, weil Test-Provider ohne echten Kontext oft keinen
	 * Refresh brauchen.
	 */
	refresh?: () => Promise<void>;
}

const EMPTY_STATE: PlanState = { plan: null, entitlements: {} };

/** `localStorage`-Schlüssel des Spiegels — je Konto einer (AK2). */
export const planMirrorKey = (userId: number): string => `pp-plan-${userId}`;

/** Liest den Spiegel als synchronen Anfangszustand; gesperrter/kaputter Storage → Leerzustand. */
export const readPlanMirror = (userId: number): PlanState => {
	try {
		const raw = localStorage.getItem(planMirrorKey(userId));
		if (raw === null) {
			return EMPTY_STATE;
		}
		const parsed = JSON.parse(raw) as PlanState;
		if (typeof parsed !== 'object' || parsed === null || typeof parsed.entitlements !== 'object') {
			return EMPTY_STATE;
		}
		return { plan: parsed.plan ?? null, entitlements: parsed.entitlements ?? {} };
	} catch {
		return EMPTY_STATE;
	}
};

/** Schreibt den Spiegel; Fehler (voller/gesperrter Storage) werden bewusst ignoriert. */
export const storePlanMirror = (userId: number, state: PlanState): void => {
	try {
		localStorage.setItem(planMirrorKey(userId), JSON.stringify(state));
	} catch {
		// Best-Effort; der nächste `/auth/me` liefert die Werte ohnehin.
	}
};

/** Räumt den Spiegel beim Logout weg (AK2) — Konto B sieht nie die Badges von Konto A. */
export const clearPlanMirror = (userId: number): void => {
	try {
		localStorage.removeItem(planMirrorKey(userId));
	} catch {
		// Best-Effort.
	}
};

const PlanContext = createContext<PlanState>(EMPTY_STATE);

export const PlanProvider = PlanContext.Provider;

/** Paket + Entitlement-Map des angemeldeten Nutzers. */
export const usePlan = (): PlanState => useContext(PlanContext);

/**
 * Entitlement eines Features; `undefined`, solange nichts geladen ist. Enthält bewusst KEINEN
 * Plan-Vergleich — `allowed` und `requiredPlan` kommen unverändert vom Server (AK4).
 */
export const useEntitlement = (feature: FeatureId): FeatureEntitlement | undefined => usePlan().entitlements[feature];

/**
 * Hält den Paket-Zustand: erst aus dem Spiegel (AK1), dann aus `/auth/me`; bei App-Fokus erneut
 * (AK3), damit eine Paketänderung ohne Neu-Login ankommt.
 */
export const usePlanState = (userId: number): PlanState => {
	const [state, setState] = useState<PlanState>(() => readPlanMirror(userId));
	// Abo-Status wird bewusst NICHT im Spiegel gehalten (#1496 AK6) — er ist nur für die laufende
	// Sitzung relevant und ändert sich ausschließlich über das Webhook-Ereignis auf dem Server.
	const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);

	const refresh = useCallback(async (): Promise<void> => {
		try {
			const user = await checkAuth();
			if (user === null) {
				return;
			}
			const next: PlanState = { plan: user.plan ?? null, entitlements: user.entitlements ?? {} };
			setState(next);
			storePlanMirror(userId, next);
			setSubscription(user.subscription ?? null);
		} catch {
			// Netzwerkfehler ändern den Zustand nicht — der Spiegel bleibt stehen.
		}
	}, [userId]);

	useEffect(() => {
		setState(readPlanMirror(userId));
		void refresh();
		const onFocus = (): void => void refresh();
		window.addEventListener('focus', onFocus);
		return () => window.removeEventListener('focus', onFocus);
	}, [userId, refresh]);

	return { ...state, subscription, refresh };
};

/** Zustand des Rückkehr-Pollings (#1496 AK4). */
export interface BillingReturnPollState {
	status: 'waiting' | 'confirmed' | 'timeout';
}

/** Default-Intervall/Obergrenze laut Spec (docs/spec/issue-1496.md AK4). */
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_MAX_ATTEMPTS = 10;

/**
 * Rückkehr-Wartezustand nach Buchung/Wechsel ohne sofortige `approvalUrl`-Navigation (#1496 AK4).
 * Löst bei Mount **genau einen** sofortigen `refresh()` aus, schreibt selbst NIE den Plan-Spiegel
 * (das bleibt allein `refresh()` — hier nur aufgerufen, nicht dupliziert) und pollt danach in
 * festen Abständen nach, bis `currentPlan` dem erwarteten Paket entspricht oder die Obergrenze
 * erreicht ist.
 */
export const useBillingReturnPoll = (
	refresh: () => Promise<void>,
	expectedPlan: Plan,
	currentPlan: Plan | null,
	options: { intervalMs?: number; maxAttempts?: number } = {},
): BillingReturnPollState => {
	const { intervalMs = DEFAULT_POLL_INTERVAL_MS, maxAttempts = DEFAULT_POLL_MAX_ATTEMPTS } = options;
	const [status, setStatus] = useState<BillingReturnPollState['status']>(
		currentPlan === expectedPlan ? 'confirmed' : 'waiting',
	);
	const attemptsRef = useRef(0);
	const refreshRef = useRef(refresh);
	useEffect(() => {
		refreshRef.current = refresh;
	}, [refresh]);

	// Genau ein sofortiger Refresh bei Mount — unabhängig vom Poll-Intervall unten.
	useEffect(() => {
		void refreshRef.current();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (currentPlan === expectedPlan) {
			setStatus('confirmed');
		}
	}, [currentPlan, expectedPlan]);

	useEffect(() => {
		if (status !== 'waiting') {
			return;
		}
		const id = setInterval(() => {
			attemptsRef.current += 1;
			if (attemptsRef.current >= maxAttempts) {
				setStatus('timeout');
				return;
			}
			void refreshRef.current();
		}, intervalMs);
		return () => clearInterval(id);
	}, [status, intervalMs, maxAttempts]);

	return { status };
};
