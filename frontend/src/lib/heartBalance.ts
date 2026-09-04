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
 * **Maß:** Der Füllstand ist die Überlappung zwischen Ist- und Soll-Verteilung,
 * `füllstand = Σ min(sollᵢ, istᵢ)`. Das ist das Komplement der Totalvariations-Distanz und liegt
 * damit garantiert zwischen 0 (Ist und Soll disjunkt) und 1 (Ist = Soll). Es ist zugleich exakt
 * das soll-gewichtete Mittel der Segment-Füllstände — die große Prozentzahl und das Bild sagen
 * also nachweislich dasselbe.
 */

/** Eine Wassersäule im Herzen: eine Lebenssäule mit ihrem Soll, ihrem Ist und ihrer Farbe. */
interface HeartSegment {
	pillar: Pillar;
	/**
	 * Nullbasierter Rang in der Säulen-Rampe `--pp-pillar-1…8`. Er folgt der **Säulen-`id`**, nicht
	 * der Anzeigereihenfolge: Farbe folgt der Säule, eine Umsortierung darf keine Umfärbung
	 * auslösen (ux-design.md §2, Regel 3). Ab Rang 8 (der 9. Säule) wird nicht weiter eingefärbt.
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
	/** Füllstand des Herzens (0–1) — `Σ min(soll, ist)`, siehe Modulkommentar. */
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

	const fill = segments.reduce((sum, segment) => sum + Math.min(segment.targetShare, segment.actualShare), 0);

	return { fill, hasPoints: totalPoints > 0, segments };
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
	{ min: 0.9, state: 'stark', label: 'In Balance', hint: 'Deine Säulen liegen dicht am Soll.' },
	{
		min: 0.7,
		state: 'gut',
		label: 'Gut in Balance',
		hint: 'Die Verteilung ist solide, kleine Abweichungen sind normal.',
	},
	{
		min: 0.45,
		state: 'wackelig',
		label: 'Leichte Schieflage',
		hint: 'Einzelne Säulen ziehen davon, andere kommen zu kurz.',
	},
	{ min: 0, state: 'schwach', label: 'Aus der Balance', hint: 'Fast alle Punkte hängen an wenigen Säulen.' },
];

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
	return HEALTH_STEPS.find((step) => balance.fill >= step.min) ?? HEALTH_STEPS[HEALTH_STEPS.length - 1];
};
