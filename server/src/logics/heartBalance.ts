/**
 * Lebensbalance-Rechenkern (#1423) — die Server-Fassung des Dashboard-Herzens.
 *
 * Das Herz (`frontend/src/lib/heartBalance.ts`) rechnet **nicht** mit den Gamification-Punkten aus
 * `/scores/by-pillar`, sondern mit dem anteilig auf die Säulen verteilten **erledigten Aufwand**
 * (`Dashboard.tsx:131-147` über `buildPillarSummaries`, `frontend/src/lib/pillar.ts:161-190`). Damit
 * der MCP-Wert dieselbe Zahl nennt wie die Oberfläche, ist genau diese Rechnung hier portiert —
 * reine Funktionen ohne DB-Zugriff, damit die Mathematik ohne Express prüfbar bleibt.
 *
 * **Maß:** `füllstand = Σ min(sollᵢ, istᵢ)` — die Überlappung zwischen Ist- und Soll-Verteilung
 * (Komplement der Totalvariations-Distanz), garantiert zwischen 0 und 1.
 */

/** Eine Säule, so wie die Rechnung sie braucht: Identität, Anzeigename und ihr Soll-Gewicht. */
export interface BalanceSaeule {
	id: number;
	name: string;
	/** `Pillar.weight` — prozentualer Soll-Anteil der Säule. */
	weight: number;
}

/** Ein Task mit seinem Aufwand und seiner (ggf. leeren) Säulen-Aufteilung. */
export interface BalanceTask {
	status: string;
	estimatedEffort: number;
	/** Join-Zeilen `TaskPillar`: `share` in Prozent, die Summe über einen Task ergibt 100. */
	pillars: { pillarId: number; share: number }[];
}

/** Punktestand einer Säule samt ihrer Gewichtung, wie ihn die Antwort ausweist. */
interface BalanceSaeulenStand {
	id: number;
	name: string;
	/** Roher (ungerundeter) anteiliger erledigter Aufwand dieser Säule. */
	punkte: number;
	gewichtung: number;
}

/** Gesamtbild: Füllstand, ob überhaupt Punkte da sind, und die Aufschlüsselung je Säule. */
export interface Lebensbalance {
	/** Füllstand des Herzens (0–1), ungerundet. */
	fill: number;
	/** Ob überhaupt Punkte vergeben sind. Unterscheidet „noch nichts getan" von „unausgewogen". */
	hasPoints: boolean;
	saeulen: BalanceSaeulenStand[];
}

const TOTAL_SHARE = 100;

/**
 * Punkte je Säule nach dem Dashboard-Modell: erledigte Tasks tragen ihren `estimatedEffort`
 * anteilig (`share / 100`) auf ihre zugewiesenen Säulen bei; erledigte Tasks **ohne** Zuweisung
 * werden gewichtsproportional auf alle Säulen verteilt, damit erledigte Arbeit auch ohne explizite
 * Säule sichtbar wird (`Dashboard.tsx:126-147`).
 */
const punkteProSaeule = (saeulen: BalanceSaeule[], tasks: BalanceTask[]): Map<number, number> => {
	const punkte = new Map<number, number>(saeulen.map((saeule) => [saeule.id, 0]));
	const gesamtGewicht = saeulen.reduce((summe, saeule) => summe + saeule.weight, 0);

	for (const task of tasks) {
		if (task.status !== 'Done') {
			continue;
		}
		if (task.pillars.length === 0) {
			// Ohne Soll-Verteilung gibt es keinen Schlüssel, nach dem verteilt werden könnte — der
			// Aufwand bleibt dann (wie im Frontend) draußen.
			if (gesamtGewicht > 0) {
				for (const saeule of saeulen) {
					punkte.set(saeule.id, (punkte.get(saeule.id) ?? 0) + task.estimatedEffort * (saeule.weight / gesamtGewicht));
				}
			}
			continue;
		}
		for (const beitrag of task.pillars) {
			// Beiträge auf gelöschte/fremde Säulen ignorieren: die Map kennt nur die eigenen Säulen.
			if (!punkte.has(beitrag.pillarId)) {
				continue;
			}
			punkte.set(
				beitrag.pillarId,
				(punkte.get(beitrag.pillarId) ?? 0) + task.estimatedEffort * (beitrag.share / TOTAL_SHARE),
			);
		}
	}
	return punkte;
};

/**
 * Baut den Lebensbalance-Stand aus den Säulen des Nutzers und seinen Tasks.
 *
 * Randfälle bewusst wie im Frontend festgelegt:
 * - **Keine Punkte** → Füllstand 0, `hasPoints: false`.
 * - **Alle Gewichte 0** (kein Soll gepflegt) → Gleichverteilung als Soll, damit die Zahl trotzdem
 *   eine Aussage trifft statt 0 zu bleiben.
 * - **Soll einer Säule = 0** → dort investierte Punkte zählen nicht auf den Füllstand ein, sie
 *   fehlen den Säulen mit Soll. Genau das soll die Zahl zeigen.
 */
export const berechneLebensbalance = (saeulen: BalanceSaeule[], tasks: BalanceTask[]): Lebensbalance => {
	const punkte = punkteProSaeule(saeulen, tasks);
	const gesamtPunkte = saeulen.reduce((summe, saeule) => summe + (punkte.get(saeule.id) ?? 0), 0);
	const gesamtGewicht = saeulen.reduce((summe, saeule) => summe + saeule.weight, 0);

	const fill = saeulen.reduce((summe, saeule) => {
		const sollAnteil = gesamtGewicht > 0 ? saeule.weight / gesamtGewicht : 1 / saeulen.length;
		const istAnteil = gesamtPunkte > 0 ? (punkte.get(saeule.id) ?? 0) / gesamtPunkte : 0;
		return summe + Math.min(sollAnteil, istAnteil);
	}, 0);

	return {
		fill,
		hasPoints: gesamtPunkte > 0,
		saeulen: saeulen.map((saeule) => ({
			id: saeule.id,
			name: saeule.name,
			punkte: punkte.get(saeule.id) ?? 0,
			gewichtung: saeule.weight,
		})),
	};
};
