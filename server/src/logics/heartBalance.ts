/**
 * Lebensbalance-Rechenkern (#1423) — die Server-Fassung des Dashboard-Herzens.
 *
 * Das Herz (`frontend/src/lib/heartBalance.ts`) rechnet **nicht** mit den Gamification-Punkten aus
 * `/scores/by-pillar`, sondern mit dem anteilig auf die Säulen verteilten **erledigten Aufwand**
 * (`Dashboard.tsx:131-147` über `buildPillarSummaries`, `frontend/src/lib/pillar.ts:161-190`). Damit
 * der MCP-Wert dieselbe Zahl nennt wie die Oberfläche, ist genau diese Rechnung hier portiert —
 * reine Funktionen ohne DB-Zugriff, damit die Mathematik ohne Express prüfbar bleibt.
 *
 * **Maß:** `füllstand = 1 − √(Σ sollᵢ · defizitᵢ²) / √(1 − min{sollᵢ | sollᵢ > 0})` mit `defizitᵢ` =
 * relative Unterdeckung der Säule (`1 − min(1, ist/soll)`). Quadratisch, damit eine stark
 * vernachlässigte Säule schwerer wiegt als dünn verteiltes Defizit; normiert auf das Maximum der
 * Summe über die Säulen **mit** Ziel, damit 0 („alles an einer Säule") und 1 („Ist = Soll") beide
 * erreichbar sind. Säulen ohne Gewicht bleiben aus dem Nenner heraus — sie sind der Normalfall
 * (`POST /pillars` legt mit `weight: 0` an) und würden die Normierung sonst abschalten. Begründung
 * und Herleitung stehen ausführlich in `frontend/src/lib/heartBalance.ts`.
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
 * - **Alle Punkte in Säulen ohne Soll** → jede Säule mit Soll steht auf 0, Füllstand 0.
 * - **Eine einzige Säule trägt das ganze Soll** → zwischen den Zielen gibt es keine Schieflage, die
 *   das Maß messen könnte (der Nenner ist 0); dann entscheidet allein, ob diese Säule ihr Ziel hält.
 */
export const berechneLebensbalance = (saeulen: BalanceSaeule[], tasks: BalanceTask[]): Lebensbalance => {
	const punkte = punkteProSaeule(saeulen, tasks);
	const gesamtPunkte = saeulen.reduce((summe, saeule) => summe + (punkte.get(saeule.id) ?? 0), 0);
	const gesamtGewicht = saeulen.reduce((summe, saeule) => summe + saeule.weight, 0);
	const hasPoints = gesamtPunkte > 0;

	const sollAnteile = saeulen.map((saeule) => (gesamtGewicht > 0 ? saeule.weight / gesamtGewicht : 1 / saeulen.length));
	// Soll-gewichtete Summe der quadrierten Unterdeckungen und ihr denkbares Maximum — dieselbe
	// Rechnung wie `buildHeartBalance` im Frontend, beide Seiten müssen zahlengleich bleiben.
	const abweichung = saeulen.reduce((summe, saeule, index) => {
		const sollAnteil = sollAnteile[index];
		const istAnteil = hasPoints ? (punkte.get(saeule.id) ?? 0) / gesamtPunkte : 0;
		const defizit = sollAnteil > 0 ? 1 - Math.min(1, istAnteil / sollAnteil) : 1;
		return summe + sollAnteil * defizit ** 2;
	}, 0);
	// Maximum nur über die Säulen mit Ziel; der Deckel bei 0 fängt den Fall „aller Aufwand in Säulen
	// ohne Ziel" ab, der Zweig darunter den Fall „nur eine Säule trägt überhaupt ein Ziel".
	const mitZiel = sollAnteile.filter((sollAnteil) => sollAnteil > 0);
	const maximaleAbweichung = mitZiel.length > 0 ? 1 - Math.min(...mitZiel) : 0;
	const fill = !hasPoints
		? 0
		: maximaleAbweichung > 0
			? Math.max(0, 1 - Math.sqrt(abweichung / maximaleAbweichung))
			: abweichung > 0
				? 0
				: 1;

	return {
		fill,
		hasPoints,
		saeulen: saeulen.map((saeule) => ({
			id: saeule.id,
			name: saeule.name,
			punkte: punkte.get(saeule.id) ?? 0,
			gewichtung: saeule.weight,
		})),
	};
};
