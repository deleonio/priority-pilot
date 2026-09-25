/**
 * Lebensbalance-Rechenkern (#1423) — die Server-Fassung des Dashboard-Herzens.
 *
 * Das Herz (`frontend/src/lib/heartBalance.ts`) rechnet **nicht** mit den Gamification-Punkten aus
 * `/scores/by-pillar`, sondern mit dem anteilig auf die Säulen verteilten **erledigten Aufwand**
 * (`Dashboard.tsx:131-147` über `buildPillarSummaries`, `frontend/src/lib/pillar.ts:161-190`). Damit
 * der MCP-Wert dieselbe Zahl nennt wie die Oberfläche, ist genau diese Rechnung hier portiert —
 * reine Funktionen ohne DB-Zugriff, damit die Mathematik ohne Express prüfbar bleibt.
 *
 * **Maß:** `füllstand = min(füllstandGewichtet, füllstandUngewichtet)` — das **Strengste-Prinzip**
 * (#1474) — mit `defizitᵢ` = relativer Unterdeckung der Säule (`1 − min(1, ist/soll)`). Die
 * gewichtete Komponente `1 − √(Σ sollᵢ · defizitᵢ²) / √(1 − min{sollᵢ | sollᵢ > 0})` misst das
 * Defizit nach Soll-Gewicht; die ungewichtete `1 − √(Σ_{sollᵢ > 0} defizitᵢ² / |{sollᵢ > 0}|)`
 * misst die Schieflage direkt, eine Säule pro Ziel. Quadratisch, damit eine stark vernachlässigte
 * Säule schwerer wiegt als dünn verteiltes Defizit; normiert auf das Maximum der Summe über die
 * Säulen **mit** Ziel, damit 0 („alles an einer Säule") und 1 („Ist = Soll") beide erreichbar sind.
 * Säulen ohne Gewicht bleiben aus dem Nenner heraus — sie sind der Normalfall (`POST /pillars` legt
 * mit `weight: 0` an) und würden die Normierung sonst abschalten. Begründung und Herleitung stehen
 * ausführlich in `frontend/src/lib/heartBalance.ts`.
 */
import { PILLAR_RHYTHMS } from '../models/pillarData.js';

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
 * - **Eine einzige Säule trägt das ganze Soll** → es gibt keine zweite, gegen die sie schieflaufen
 *   könnte; der Füllstand ist dann ihr Erfüllungsgrad, also 0,95 bei 95 % des Aufwands.
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
	// Maximum nur über die Säulen mit Ziel: aller Aufwand in der am geringsten gewichteten von ihnen.
	// Bei nur einer Ziel-Säule gibt es keine zweite — dort ist der schlechteste Fall, dass sie leer
	// ausgeht, das Maximum also 1. Der Deckel bei 0 fängt „aller Aufwand in Säulen ohne Ziel" ab.
	const mitZiel = sollAnteile.filter((sollAnteil) => sollAnteil > 0);
	const maximaleAbweichung = mitZiel.length > 1 ? 1 - Math.min(...mitZiel) : mitZiel.length === 1 ? 1 : 0;
	const fillGewichtet = maximaleAbweichung > 0 ? Math.max(0, 1 - Math.sqrt(abweichung / maximaleAbweichung)) : 1;

	/*
	 * Ungewichtete Komponente (#1474, Strengste-Prinzip): Dieselbe Defizit-Summe ohne Soll-Gewichtung
	 * über die Ziel-Säulen — die Gewichtung allein dämpfte eine leere, niedrig gewichtete Säule
	 * mehrfach. Ziel-Säulen zählen hier einzeln, der Füllstand nimmt das Minimum beider Komponenten.
	 */
	const defizitQuadratSumme = saeulen.reduce((summe, saeule, index) => {
		const sollAnteil = sollAnteile[index];
		if (sollAnteil <= 0) {
			return summe;
		}
		const istAnteil = hasPoints ? (punkte.get(saeule.id) ?? 0) / gesamtPunkte : 0;
		return summe + (1 - Math.min(1, istAnteil / sollAnteil)) ** 2;
	}, 0);
	const fillUngewichtet = mitZiel.length > 0 ? 1 - Math.sqrt(defizitQuadratSumme / mitZiel.length) : 1;

	const fill = !hasPoints ? 0 : Math.min(fillGewichtet, fillUngewichtet);

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

/**
 * Säule im Kadenz-Modell (#1638): Soll-Erledigungen pro Woche aus `PILLAR_RHYTHMS`; `weight` ist das
 * `Pillar.weight`, das seit #1663 die Soll-Anteile im Kadenz-Füllstand bestimmt.
 */
export interface KadenzSaeule {
	id: number;
	name: string;
	rhythmusProWoche: number;
	weight: number;
}

/** Task im Kadenz-Modell: zusätzlich der Erledigt-Zeitpunkt (`ScoreEntry.zeitpunkt`, sonst `null`). */
export interface KadenzTask extends BalanceTask {
	erledigtAm: Date | null;
}

/** Lebensbalance im Kadenz-Modell: je Säule zusätzlich die Erfüllung des Soll-Rhythmus (0–1). */
interface KadenzBalance extends Lebensbalance {
	saeulen: (BalanceSaeulenStand & { erfuellung: number })[];
}

const KADENZ_FENSTER_TAGE = 28;
const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Kadenz-Füllstand (#1638): Statt des Ist-Anteils am Gesamtaufwand zählt, wie gut jede Säule ihren
 * eigenen Soll-Rhythmus im 28-Tage-Fenster erfüllt — `erfuellungᵢ = min(1, Aufgaben_28d / (rhythmus × 4))`,
 * Mehrfach-Zuweisungen anteilig (`share / 100`), Tasks ohne Zuweisung gleichverteilt. `punkte` bleibt die
 * kumulative Aufwandssumme über die ganze Historie (`punkteProSaeule`).
 *
 * Aggregation (#1663): `fill = min(fillGewichtet, fillUngewichtet)` aus Soll-Anteilen
 * `sollᵢ = weightᵢ / Σweight` wie in `berechneLebensbalance` (#1474, Strengste-Prinzip). Anders als dort
 * kann hier jede Säule unabhängig ein volles Defizit haben, das Maximum der gewichteten Summe ist also 1:
 * `fillGewichtet = 1 − √(Σ sollᵢ · defizitᵢ²)`, `fillUngewichtet = 1 − √(Σ_{sollᵢ>0} defizitᵢ² / |{sollᵢ>0}|)`.
 * Säulen mit `sollᵢ = 0` fallen aus beiden Komponenten heraus; alle Gewichte 0 → Gleichverteilung.
 */
export const berechneKadenzFuellstand = (saeulen: KadenzSaeule[], tasks: KadenzTask[], jetzt: Date): KadenzBalance => {
	const gleichGewichtet = saeulen.map((saeule) => ({ id: saeule.id, name: saeule.name, weight: 1 }));
	const punkte = punkteProSaeule(gleichGewichtet, tasks);
	const hasPoints = saeulen.some((saeule) => (punkte.get(saeule.id) ?? 0) > 0);

	const fensterStart = jetzt.getTime() - KADENZ_FENSTER_TAGE * TAG_MS;
	const imFenster = tasks
		.filter(
			(task) =>
				task.erledigtAm !== null &&
				task.erledigtAm.getTime() > fensterStart &&
				task.erledigtAm.getTime() <= jetzt.getTime(),
		)
		// Gezählt werden Aufgaben, nicht Aufwand: jede Erledigung zählt 1 (anteilig nach `share`).
		.map((task) => ({ ...task, estimatedEffort: 1 }));
	const anzahl = punkteProSaeule(gleichGewichtet, imFenster);

	const erfuellung = new Map(
		saeulen.map((saeule) => {
			const soll = saeule.rhythmusProWoche * (KADENZ_FENSTER_TAGE / 7);
			return [saeule.id, soll > 0 ? Math.min(1, (anzahl.get(saeule.id) ?? 0) / soll) : 1];
		}),
	);
	const gesamtGewicht = saeulen.reduce((summe, saeule) => summe + saeule.weight, 0);
	const sollAnteile = saeulen.map((saeule) => (gesamtGewicht > 0 ? saeule.weight / gesamtGewicht : 1 / saeulen.length));
	const defizite = saeulen.map((saeule) => 1 - (erfuellung.get(saeule.id) ?? 0));
	// Gewichtung mit Normierung 1: im Kadenz-Modell kann jede Säule unabhängig voll: im Kadenz-Modell kann jede Säule unabhängig voll
	// unbedient sein, das Maximum der Soll-gewichteten Defizit-Quadrat-Summe ist also Σ sollᵢ = 1.
	const gewichteteAbweichung = sollAnteile.reduce(
		(summe, sollAnteil, index) => summe + sollAnteil * defizite[index]! ** 2,
		0,
	);
	const fillGewichtet = 1 - Math.sqrt(gewichteteAbweichung);
	// Ungewichtete Komponente (Strengste-Prinzip wie #1474): nur Säulen mit Ziel zählen einzeln.
	const mitZiel = sollAnteile.filter((sollAnteil) => sollAnteil > 0);
	const defizitQuadratSumme = defizite.reduce(
		(summe, defizit, index) => (sollAnteile[index]! > 0 ? summe + defizit ** 2 : summe),
		0,
	);
	const fillUngewichtet = mitZiel.length > 0 ? 1 - Math.sqrt(defizitQuadratSumme / mitZiel.length) : 1;
	const fill = !hasPoints || saeulen.length === 0 ? 0 : Math.min(fillGewichtet, fillUngewichtet);

	return {
		fill,
		hasPoints,
		saeulen: saeulen.map((saeule) => ({
			id: saeule.id,
			name: saeule.name,
			punkte: punkte.get(saeule.id) ?? 0,
			gewichtung: saeule.rhythmusProWoche,
			erfuellung: erfuellung.get(saeule.id) ?? 0,
		})),
	};
};

/** Rhythmus für Säulen, die nicht unter einem mitgelieferten Namen stehen (umbenannt/Altbestand): 1×/Woche. */
const STANDARD_RHYTHMUS_PRO_WOCHE = 1;

/**
 * Füllstand der Antworten (GET /scores/balance, Verlauf, MCP `balance_status`) im Kadenz-Modell (#1638):
 * Rhythmus je Säule aus `PILLAR_RHYTHMS` (Name), `weight` ist `Pillar.weight` und bestimmt seit #1663 die
 * Soll-Anteile des Füllstands; `gewichtung` bleibt im DTO `Pillar.weight` — die Form ist unverändert,
 * `erfuellung` bleibt intern.
 */
export const berechneLebensbalanceNachKadenz = (
	saeulen: BalanceSaeule[],
	tasks: KadenzTask[],
	jetzt: Date,
): Lebensbalance => {
	const rhythmusProName = new Map(PILLAR_RHYTHMS.map((eintrag) => [eintrag.name, eintrag.rhythmusProWoche]));
	const kadenz = berechneKadenzFuellstand(
		saeulen.map((saeule) => ({
			id: saeule.id,
			name: saeule.name,
			rhythmusProWoche: rhythmusProName.get(saeule.name) ?? STANDARD_RHYTHMUS_PRO_WOCHE,
			weight: saeule.weight,
		})),
		tasks,
		jetzt,
	);
	return {
		fill: kadenz.fill,
		hasPoints: kadenz.hasPoints,
		saeulen: saeulen.map((saeule, index) => ({
			id: saeule.id,
			name: saeule.name,
			punkte: kadenz.saeulen[index].punkte,
			gewichtung: saeule.weight,
		})),
	};
};
