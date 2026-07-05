import { Pillar } from '../models/index.js';

/** Soll-Summe der `share`-Werte über die Säulen eines Beitrags-Arrays (100 %-Verteilung). */
const TOTAL_SHARE = 100;
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
 *  - `share`/`confidence` Zahlen in `[0, 100]` (`confidence` optional, Default 100),
 *  - bei mindestens einem Beitrag muss die Summe der `share` 100 ergeben (leere Liste erlaubt).
 *
 * Der Erfolgs-/Fehler-Kanal ist als Rückgabe modelliert: `{ ok: true, pillars }` mit aufgefülltem
 * confidence-Default bzw. `{ ok: false }` bei Verletzung.
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
		if (typeof share !== 'number' || !Number.isFinite(share) || share < 0 || share > 100) {
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
		if (Math.abs(sum - TOTAL_SHARE) > SHARE_SUM_EPSILON) {
			return { ok: false };
		}
	}
	return { ok: true, pillars };
};

/**
 * DB-gestützte Prüfung, ob alle referenzierten Säulen als globale Stammdaten existieren. Säulen sind
 * für alle Nutzer identisch, daher wird nur auf Existenz geprüft. `[]` ist trivial `true`.
 */
export const arePillarsExistent = async (pillarIds: number[]): Promise<boolean> => {
	if (pillarIds.length === 0) {
		return true;
	}
	const count = await Pillar.count({ where: { id: pillarIds } });
	return count === pillarIds.length;
};
