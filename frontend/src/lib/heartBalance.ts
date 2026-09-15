import type { Pillar } from 'client';

/**
 * Rechenkern des Dashboard-Herzens („Lebensbalance", Konzept §4.4). Bewusst — wie `score.ts` und
 * `pillar.ts` — als reine Funktionen ohne React, damit die Mathematik ohne DOM prüfbar bleibt und
 * die Komponente nur noch zeichnet.
 *
 * **Metapher:** Das Herz ist ein Gefäß, dessen Wasserpegel von unten steigt. Steht eine Säule
 * auf ihrem Soll, trägt ihr Farbsegment voll bei; sind alle Säulen auf Soll, ist das Herz
 * randvoll — die *Höhe* der gemeinsamen Wasserlinie trägt die Aussage „ausgewogen", die
 * Aufschlüsselung je Säule die Legende neben dem Bild.
 *
 * **Maß:** Der Füllstand ist die normierte quadratische Abweichung vom Soll,
 * `füllstand = 1 − √(Σ sollᵢ · defizitᵢ²) / √(1 − min{sollᵢ | sollᵢ > 0})` mit
 * `defizitᵢ = 1 − levelᵢ`, also der relativen Unterdeckung der Säule. Zwei Eigenschaften, die das
 * Vorgängermaß `Σ min(sollᵢ, istᵢ)` nicht hatte:
 *
 * - **Quadratisch:** Eine stark vernachlässigte Säule wiegt schwerer als dieselbe Menge Defizit,
 *   dünn über alle Säulen verteilt. Genau das liest ein Mensch als Schieflage.
 * - **Normiert:** Der Nenner ist das Maximum, das die Summe über die Säulen **mit** Ziel annehmen
 *   kann (sie ist konvex, ihr Maximum liegt an einer Ecke der Simplex und beträgt dort
 *   `1 − min soll`). Der Füllstand ist damit 0, wenn alles an einer einzigen Säule hängt, und 1
 *   genau dann, wenn Ist = Soll — die Skala nutzt ihren vollen Bereich. `Σ min(sollᵢ, istᵢ)` kam
 *   bei fünf gleich gewichteten Säulen nie unter 20 % und hat Schieflagen dadurch beschönigt.
 *
 * **Warum der Nenner Säulen ohne Ziel überspringt:** `POST /pillars` legt jede neue Säule mit
 * `weight: 0` an, gewichtslose Säulen sind also der Normalfall, nicht die Ausnahme. Zöge das
 * Minimum sie mit, wäre der Nenner konstant 1, sobald eine einzige davon existiert — die Normierung
 * wäre praktisch abgeschaltet und der Füllstand spränge, ohne dass sich an der Verteilung etwas
 * ändert. Verankert wird deshalb an den Säulen, die überhaupt ein Ziel tragen.
 *
 * Die große Prozentzahl und die Höhe der Wasserlinie bleiben derselbe Wert; das Bild kann der Zahl
 * also weiterhin nicht widersprechen.
 */

/** Eine Wassersäule im Herzen: eine Lebenssäule mit ihrem Soll, ihrem Ist und ihrer Farbe. */
interface HeartSegment {
	pillar: Pillar;
	/**
	 * Nullbasierter Rang in der Säulen-Rampe `--pp-pillar-1…7`. Er folgt der **Säulen-`id`**, nicht
	 * der Anzeigereihenfolge: Farbe folgt der Säule, eine Umsortierung darf keine Umfärbung
	 * auslösen (ux-design.md §2, Regel 3). Ab Rang 7 (der 8. Säule) wird nicht weiter eingefärbt.
	 */
	colorIndex: number;
	/**
	 * Balance dieses Segments (0–1): Ist-Anteil gemessen am Soll-Anteil, bei 1 gedeckelt. Das
	 * Herz-Bild zeichnet sie nicht mehr als eigene Wassersäule, sie bleibt Teil des Modells und
	 * der Lib-Tests.
	 */
	level: number;
	/** Ist-Anteil der Säule am Gesamt-Punktestand (0–1). */
	actualShare: number;
	/** Soll-Anteil der Säule aus ihrer Gewichtung (0–1). */
	targetShare: number;
}

/** Gesamtbild des Herzens: sein Füllstand und die Farbsegmente in Anzeigereihenfolge. */
interface HeartBalance {
	/** Füllstand des Herzens (0–1) — normierte quadratische Abweichung, siehe Modulkommentar. */
	fill: number;
	/** Ob überhaupt Punkte vergeben sind. Unterscheidet „noch nichts getan" von „unausgewogen". */
	hasPoints: boolean;
	segments: HeartSegment[];
}

/**
 * Baut das Herz-Modell aus den Säulen und ihren Punkteständen (dieselbe Punktequelle wie das
 * Widget „Gesamtguthaben", `buildPillarBalances`).
 *
 * Randfälle bewusst festgelegt:
 * - **Keine Punkte** → jede Wassersäule 0, Herz leer (`hasPoints: false`).
 * - **Alle Gewichte 0** (kein Soll gepflegt) → Gleichverteilung als Soll, damit das Bild trotzdem
 *   eine Aussage trifft statt leer zu bleiben.
 * - **Soll einer Säule = 0** → ihre Wassersäule bleibt leer; dort investierte Punkte zählen nicht
 *   auf den Füllstand ein, sie fehlen den Säulen mit Soll. Genau das soll das Bild zeigen.
 * - **Alle Punkte in Säulen ohne Soll** → jede Säule mit Ziel steht auf 0, das Herz ist leer.
 * - **Eine einzige Säule trägt das ganze Soll** → es gibt keine zweite, gegen die sie schieflaufen
 *   könnte; der Füllstand ist dann ihr Erfüllungsgrad (`level`), also 0,95 bei 95 % des Aufwands.
 */
export const buildHeartBalance = (pillars: Pillar[], punkteProSaeule: ReadonlyMap<number, number>): HeartBalance => {
	// Rang in der Farbrampe über die Säulen-id vergeben (stabil gegen Umsortierung der Anzeige).
	const colorRank = new Map<number, number>(
		[...pillars].sort((a, b) => a.id - b.id).map((pillar, index): [number, number] => [pillar.id, index]),
	);

	const totalPoints = pillars.reduce((sum, pillar) => sum + (punkteProSaeule.get(pillar.id) ?? 0), 0);
	const totalWeight = pillars.reduce((sum, pillar) => sum + pillar.weight, 0);

	const segments = pillars.map((pillar): HeartSegment => {
		const targetShare = totalWeight > 0 ? pillar.weight / totalWeight : 1 / pillars.length;
		const actualShare = totalPoints > 0 ? (punkteProSaeule.get(pillar.id) ?? 0) / totalPoints : 0;
		return {
			pillar,
			colorIndex: colorRank.get(pillar.id) ?? 0,
			level: targetShare > 0 ? Math.min(1, actualShare / targetShare) : 0,
			actualShare,
			targetShare,
		};
	});

	/*
	 * Soll-gewichtete Summe der quadrierten Unterdeckungen und ihr Maximum über die Säulen mit Ziel
	 * (Modulkommentar). Dieselbe Rechnung steht auf dem Server in `server/src/logics/heartBalance.ts`
	 * — beide Seiten müssen zahlengleich bleiben, sonst nennt das MCP-Werkzeug eine andere Zahl als
	 * das Dashboard.
	 *
	 * Das Maximum ist der schlechteste Fall unter den Zielen: aller Aufwand in der am geringsten
	 * gewichteten Ziel-Säule (`1 − min soll`). Gibt es nur **eine** Ziel-Säule, gibt es dafür keine
	 * zweite — der schlechteste Fall ist dann, dass sie leer ausgeht, und das Maximum ist 1 (Soll 1,
	 * Defizit 1). Der Füllstand ist dort stetig ihr eigener Erfüllungsgrad.
	 *
	 * Der Deckel bei 0 ist Fachlogik, keine Absicherung: Liegt aller Aufwand in Säulen **ohne** Ziel,
	 * wird `spread` größer als dieses Maximum — leerer geht das Herz nicht.
	 */
	const spread = segments.reduce((sum, segment) => sum + segment.targetShare * (1 - segment.level) ** 2, 0);
	const zielAnteile = segments.map((segment) => segment.targetShare).filter((targetShare) => targetShare > 0);
	const worstSpread = zielAnteile.length > 1 ? 1 - Math.min(...zielAnteile) : zielAnteile.length === 1 ? 1 : 0;
	const hasPoints = totalPoints > 0;
	// `worstSpread` ist nur ohne jede Säule 0 — dann greift schon `!hasPoints`, der Zweig ist Typsache.
	const fill = !hasPoints ? 0 : worstSpread > 0 ? Math.max(0, 1 - Math.sqrt(spread / worstSpread)) : 1;

	return { fill, hasPoints, segments };
};

/** Gesundheitszustand des Herzens: Zustandsschlüssel (fürs Styling) plus Klartext. */
interface HeartHealth {
	state: 'leer' | 'schwach' | 'wackelig' | 'gut' | 'stark';
	label: string;
	hint: string;
}

/**
 * Stufen des Gesundheitszustands, absteigend geprüft. Die Grenzen sind bewusst grob (vier Stufen):
 * Der Füllstand schwankt mit jedem erledigten Task, eine feinere Staffelung würde Rauschen als
 * Zustandswechsel verkaufen.
 */
const HEALTH_STEPS: readonly (HeartHealth & { min: number })[] = [
	{ min: 0.85, state: 'stark', label: 'In Balance', hint: 'Deine Säulen liegen dicht am Soll.' },
	{
		min: 0.65,
		state: 'gut',
		label: 'Gut in Balance',
		hint: 'Die Verteilung ist solide, kleine Abweichungen sind normal.',
	},
	{
		min: 0.4,
		state: 'wackelig',
		label: 'Leichte Schieflage',
		hint: 'Einzelne Säulen ziehen davon, andere kommen zu kurz.',
	},
	{ min: 0, state: 'schwach', label: 'Aus der Balance', hint: 'Fast alle Punkte hängen an wenigen Säulen.' },
];

/** Ab 10 % unter Soll gilt eine Säule als „kommt zu kurz" — darunter ist es Rauschen. */
const SHORTFALL_LEVEL = 0.9;
/** Ab 5 Prozentpunkten über Soll gilt eine Säule als „zieht davon". */
const EXCESS_SHARE = 0.05;

/**
 * Prozentzahl fürs Fließtext-Zitat einer Säule (die Rechnung selbst bleibt ungerundet). Zwischen
 * Zahl und Zeichen steht ein geschütztes Leerzeichen, sonst bricht der Hinweis auf schmalen
 * Viewports zwischen „20" und „%" um.
 */
const percent = (share: number): string => `${Math.round(share * 100)}\u00A0%`;

/**
 * Benennt die Schieflage im Klartext: die Säule mit der größten relativen Unterdeckung und die mit
 * dem größten Überhang. Ohne auffällige Säule bleibt der Stufentext stehen — das ist der Fall, in
 * dem es nichts zu benennen gibt.
 */
const concreteHint = (segments: readonly HeartSegment[]): string | undefined => {
	const withTarget = segments.filter((segment) => segment.targetShare > 0);
	const weakest = withTarget.reduce<HeartSegment | undefined>(
		(worst, segment) => (!worst || segment.level < worst.level ? segment : worst),
		undefined,
	);
	const strongest = withTarget.reduce<HeartSegment | undefined>(
		(best, segment) =>
			!best || segment.actualShare - segment.targetShare > best.actualShare - best.targetShare ? segment : best,
		undefined,
	);

	const teile: string[] = [];
	if (weakest && weakest.level < SHORTFALL_LEVEL) {
		teile.push(
			`${weakest.pillar.name} kommt am kürzesten (${percent(weakest.actualShare)} statt ${percent(weakest.targetShare)})`,
		);
	}
	if (strongest && strongest.actualShare - strongest.targetShare >= EXCESS_SHARE) {
		teile.push(`${strongest.pillar.name} zieht davon (${percent(strongest.actualShare)})`);
	}
	return teile.length > 0 ? `${teile.join(', ')}.` : undefined;
};

/** Leitet den Gesundheitszustand aus dem Füllstand ab; ohne Punkte gilt der eigene Leer-Zustand. */
export const heartHealth = (balance: HeartBalance): HeartHealth => {
	if (!balance.hasPoints) {
		return {
			state: 'leer',
			label: 'Noch leer',
			hint: 'Erledige Aufgaben, damit sich das Herz füllt.',
		};
	}
	// Die letzte Stufe hat `min: 0` und greift damit immer; der Fallback ist nur fürs Typsystem.
	const step = HEALTH_STEPS.find((s) => balance.fill >= s.min) ?? HEALTH_STEPS[HEALTH_STEPS.length - 1];
	/*
	 * Im Zustand „In Balance" bleibt der Stufentext stehen: Eine Säule knapp unter der Schwelle gibt
	 * es dort fast immer, und „X kommt am kürzesten" unter der Überschrift „In Balance" zöge die
	 * beiden Zeilen auseinander. Ab „Gut in Balance" ersetzt der konkrete Hinweis die Floskel — dort
	 * ist das Benennen der Schieflage die nützlichere Auskunft.
	 */
	const hint = (step.state !== 'stark' ? concreteHint(balance.segments) : undefined) ?? step.hint;
	return { state: step.state, label: step.label, hint };
};
