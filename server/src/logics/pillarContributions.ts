import { Pillar } from '../models/index.js';
import { SHARE_MIN, SHARE_TOTAL } from './pillarShares.js';

/** Höchstanteil einer einzelnen Säule in Prozent (#2077) — keine Säule dominiert die Verteilung. */
const SHARE_MAX = 80;
/** Float-Toleranz für den Summenvergleich (z. B. 33,33 + 33,33 + 33,34). */
const SHARE_SUM_EPSILON = 1e-6;
/** Default-Konfidenz (volle Sicherheit), wenn ein Beitrag keine `confidence` mitschickt. */
const DEFAULT_CONFIDENCE = 100;

/** Ein vollständig normierter Säulen-Beitrag (confidence aufgelöst auf den Default). */
export interface PillarContribution {
	pillarId: number;
	share: number;
	confidence: number;
}

/**
 * Geteilte, rein strukturelle (DB-freie) Validierung eines Säulen-Beitrags-Arrays
 * `{ pillarId, share, confidence? }` — genutzt sowohl von den Task-Beiträgen als auch von der
 * Series-Vorlage (#302, keine Duplizierung). Regeln:
 *  - jede `pillarId` eine Ganzzahl `>= 1` ohne Dubletten,
 *  - `confidence` eine Zahl in `[0, 100]` (optional, Default 100),
 *  - bei mindestens einem Beitrag liegt jeder `share` zwischen `SHARE_MIN` und `SHARE_MAX`
 *    (5–80, #2077) und die Summe der `share` ergibt 100 (leere Liste erlaubt).
 *
 * Die Konto-Abdeckung (alle Säulen des Eigentümers, #2077) ist hier nicht prüfbar — sie hängt am
 * Konto und damit an der DB; dafür sieht `coversAllAccountPillars` vor. Der Erfolgs-/Fehler-Kanal
 * ist als Rückgabe modelliert: `{ ok: true, pillars }` mit aufgefülltem confidence-Default bzw.
 * `{ ok: false }` bei Verletzung.
 */
export const validatePillars = (raw: unknown[]): { ok: true; pillars: PillarContribution[] } | { ok: false } => {
	const pillars: PillarContribution[] = [];
	const seen = new Set<number>();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) {
			return { ok: false };
		}
		const { pillarId, share, confidence } = item as Record<string, unknown>;
		if (typeof pillarId !== 'number' || !Number.isInteger(pillarId) || pillarId < 1) {
			return { ok: false };
		}
		if (typeof share !== 'number' || !Number.isFinite(share) || share < SHARE_MIN || share > SHARE_MAX) {
			return { ok: false };
		}
		let resolvedConfidence = DEFAULT_CONFIDENCE;
		if (confidence !== undefined) {
			if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
				return { ok: false };
			}
			resolvedConfidence = confidence;
		}
		if (seen.has(pillarId)) {
			return { ok: false };
		}
		seen.add(pillarId);
		pillars.push({ pillarId, share, confidence: resolvedConfidence });
	}
	if (pillars.length > 0) {
		const sum = pillars.reduce((acc, entry) => acc + entry.share, 0);
		if (Math.abs(sum - SHARE_TOTAL) > SHARE_SUM_EPSILON) {
			return { ok: false };
		}
	}
	return { ok: true, pillars };
};

/**
 * Regeltext der Vollverteilungs-Pflicht (#2077) für die 400-Antworten der Task-/Series-Routen —
 * die Fehlermeldung muss die Regel nennen (alle Säulen oder leer, jeder Anteil 5–80, Summe 100).
 */
export const PILLAR_DISTRIBUTION_RULE =
	'Eine Verteilung muss alle Säulen des Kontos abdecken (oder die Liste ist leer), jeder Anteil ' +
	'muss zwischen 5 und 80 liegen und die Summe muss 100 ergeben.';

/**
 * Abdeckungs-Prüfung der Vollverteilungs-Pflicht (#2077): eine nicht-leere Verteilung ist nur
 * gültig, wenn ALLE Säulen des Kontos (Schlüsselmenge aus `getAccountPillarIds`) abgedeckt sind —
 * Teilmengen werden abgelehnt. Dubletten schließt `validatePillars` zuvor aus, daher genügt die
 * Enthaltenseins-Prüfung.
 */
export const coversAllAccountPillars = (
	pillars: readonly PillarContribution[],
	accountPillarIds: readonly number[],
): boolean => {
	const referenced = new Set(pillars.map((entry) => entry.pillarId));
	return accountPillarIds.every((id) => referenced.has(id));
};

/**
 * Alle Säulen-Ids eines Kontos — die Schlüsselmenge der Vollverteilungs-Pflicht (#2077).
 * `null` heißt „kein Konto am Request" und tritt nur im Dev-/Test-Pass-Through auf (gleiches
 * Scoping wie in `arePillarsExistent`): es gelten alle vorhandenen Säulen.
 */
export const getAccountPillarIds = async (userId: number | null): Promise<number[]> => {
	const scope = userId === null ? {} : { userId };
	const pillars = await Pillar.findAll({ where: scope });
	return pillars.map((pillar) => pillar.id);
};

/**
 * DB-gestützte Prüfung, ob alle referenzierten Säulen für ein Konto existieren (Teil 2, #428).
 * Säulen sind nutzer-eigen; der Kontobezug ist Pflichtparameter (#1249, AK5) — die frühere globale
 * Prüfung ohne Konto ist entfallen. `[]` ist trivial `true`.
 *
 * `null` heißt „kein Konto am Request" und tritt nur im Dev-/Test-Pass-Through auf (produktiv setzt
 * `requireAuth` die Session, der Kontobezug ist dort immer eine Id). In dem Fall gilt dasselbe
 * Scoping wie beim Lesen: `GET /pillars` filtert über `ownerScope(undefined)` gar nicht und liefert
 * jede Säule (siehe `logics/ownerScope.ts` — Abwärtskompatibilität für Setups ohne Login), also
 * akzeptiert die Existenz-Prüfung hier ebenfalls jede existierende Säule. Beides unterschiedlich zu
 * scopen hieß: Das Formular bekommt Säulen angeboten, die es anschließend nicht speichern darf.
 */
export const arePillarsExistent = async (pillarIds: number[], userId: number | null): Promise<boolean> => {
	if (pillarIds.length === 0) {
		return true;
	}
	const scope = userId === null ? {} : { userId };
	const count = await Pillar.count({ where: { id: pillarIds, ...scope } });
	return count === pillarIds.length;
};
