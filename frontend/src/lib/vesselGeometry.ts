/**
 * Geometrie des Balance-Gefäßes (Messkolben): Kontur, Wasserlinie, Skalenstriche und die Kanten
 * der Farbstreifen.
 *
 * Die Streifen im Gefäß sollen den **Flächenanteil** ihrer Säule zeigen, nicht deren Breite
 * (#1302). Weil die Kontur an Lippe und Bodenecken über die Wandbreite hinausreicht bzw.
 * einrundet, trägt dieselbe Breite je nach Position unterschiedlich viel Wasser — zwei Säulen mit
 * je 20 % sähen verschieden groß aus. Deshalb werden die Kanten hier aus der **kumulierten
 * Wasserfläche** bestimmt: die Kontur wird zu einer Polylinie geflacht, die Säulenhöhe unterhalb
 * der Wasserlinie dicht abgetastet und integriert; jede Kante ist die Umkehrfunktion dieser
 * Integration am kumulierten Anteil.
 *
 * Bewusst DOM-frei und ohne React — dieselbe Rechnung speist die SVG- und die Glas-Fassung
 * (`VesselGlass`/`toSlotBands` normieren dieselben Kanten), es gibt nur diese eine Kantenquelle.
 */

/** Wandlage der geraden Kolbenwände — die Skalenstriche setzen knapp innerhalb von ihr an. */
const WALL_LEFT = 9;
const WALL_RIGHT = 91;

/**
 * Kontrollpunkte der symmetrischen Kolbenkontur (an `x = 50` gespiegelt, Bounding-Box x 4–96 /
 * y 6–88) als kubische Bézier-Segmente `[x0,y0, x1,y1, x2,y2, x3,y3]`: flacher Boden mit
 * gerundeten Ecken, gerade Wände, oben eine kurze Ausgusslippe, die als einziger Punkt die volle
 * Breite erreicht. Die Kontur ist **x-einfach** — jede Senkrechte schneidet den Rand genau
 * zweimal; die vertikalen Wände selbst tragen keine Fläche zwischen benachbarten Spalten. Die
 * Segmente sind die **eine** Wahrheit über die Kontur: `VESSEL_PATH` zeichnet daraus, die
 * Flächenrechnung misst darin.
 */
const CUBIC_SEGMENTS: readonly (readonly [number, number, number, number, number, number, number, number])[] = [
	// Boden von der Mitte nach links, dann Bodenecke in die linke Wand.
	[50, 88, 36, 88, 25, 88, 16, 88],
	[16, 88, 11.5, 87.4, WALL_LEFT, 84, WALL_LEFT, 79],
	// Linke Wand, bewusst gerade — Messinstrument, keine Vase.
	[WALL_LEFT, 79, WALL_LEFT, 60, WALL_LEFT, 40, WALL_LEFT, 20],
	// Ausgusslippe: kurzer Aussteller, erreicht als einziger Punkt die volle Gefäßbreite.
	[WALL_LEFT, 20, WALL_LEFT, 13, 6.5, 10.5, 4, 8.4],
	// Randöffnung von der Lippe zur Mitte.
	[4, 8.4, 8.8, 6.6, 28, 6, 50, 6],
	// Rechte Hälfte gespiegelt.
	[50, 6, 72, 6, 91.2, 6.6, 96, 8.4],
	[96, 8.4, 92.4, 10.2, WALL_RIGHT, 14, WALL_RIGHT, 20],
	[WALL_RIGHT, 20, WALL_RIGHT, 40, WALL_RIGHT, 60, WALL_RIGHT, 79],
	[WALL_RIGHT, 79, WALL_RIGHT, 84, 88.5, 87.4, 84, 88],
	[84, 88, 73, 88, 62, 88, 50, 88],
];

/**
 * Kolbenkontur als SVG-Pfad. Bewusst aus denselben Kontrollpunkten gebaut wie die Flächenrechnung:
 * gezeichnete und gemessene Kontur können so nicht auseinanderlaufen.
 */
export const VESSEL_PATH = [
	`M ${CUBIC_SEGMENTS[0][0]} ${CUBIC_SEGMENTS[0][1]}`,
	...CUBIC_SEGMENTS.map(([, , x1, y1, x2, y2, x3, y3]) => `C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`),
	'Z',
].join(' ');

/** Oberkante (Randmitte) und Tiefpunkt (Boden) des Gefäßes — zwischen ihnen steigt die Wasserlinie. */
export const VESSEL_TOP = 6;
export const VESSEL_BOTTOM = 88;

/** Sichtbare Gefäßbreite (x-Spanne der Kontur inklusive Lippen) — Bandmaß und Glas-Normierung teilen sie. */
const VESSEL_LEFT = 4;
const VESSEL_RIGHT = 96;

/** Höhe der Wasserlinie zum Füllstand `fill` (0 = leer am Boden, 1 = voll an der Oberkante). */
export const waterlineY = (fill: number): number => VESSEL_BOTTOM - fill * (VESSEL_BOTTOM - VESSEL_TOP);

/**
 * Waagrechte Skalenstriche knapp innerhalb beider Wände bei 25/50/75 % der Gefäßhöhe. Weil die
 * Wasserlinie höhenlinear läuft (`waterlineY`), liest sich der Füllstand direkt an ihnen ab —
 * dieselben Segmente zeichnet das SVG als `<line>` und der Glas-Shader als Distanzstreifen.
 */
export interface ScaleTick {
	/** Linke und rechte Kante des Strichs in Nutzereinheiten. */
	x1: number;
	x2: number;
	/** Höhe des Strichs in Nutzereinheiten. */
	y: number;
}

const TICK_INSET = 2;
const TICK_LENGTH = 6;

export const SCALE_TICKS: readonly ScaleTick[] = [0.25, 0.5, 0.75].flatMap((fraction): ScaleTick[] => {
	const y = waterlineY(fraction);
	return [
		{ x1: WALL_LEFT + TICK_INSET, x2: WALL_LEFT + TICK_INSET + TICK_LENGTH, y },
		{ x1: WALL_RIGHT - TICK_INSET - TICK_LENGTH, x2: WALL_RIGHT - TICK_INSET, y },
	];
});

/* Auflösung der Kontur-Näherung: Stützstellen je Bézier-Segment bzw. Spalten über die Gefäßbreite. */
const FLATTEN_STEPS = 96;
const COLUMNS = 1024;

const cubicAt = (
	[x0, y0, x1, y1, x2, y2, x3, y3]: readonly [number, number, number, number, number, number, number, number],
	t: number,
): [number, number] => {
	const u = 1 - t;
	return [
		u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
		u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
	];
};

/** Geschlossene Polylinie der Kontur — Grundlage für die spaltenweise Höhenmessung. */
const flattenContour = (): [number, number][] => {
	const points: [number, number][] = [];
	for (const segment of CUBIC_SEGMENTS) {
		for (let step = 0; step < FLATTEN_STEPS; step += 1) {
			points.push(cubicAt(segment, step / FLATTEN_STEPS));
		}
	}
	return points;
};

/**
 * Ober- und Unterkante der Kontur je Spalte. Die Kontur ist x-einfach — jede Senkrechte schneidet
 * den Rand genau zweimal (auch an der Lippe und in den Bodenecken) —, also genügen Minimum und
 * Maximum der Schnitt-y-Werte. Einmalig zur Modulladezeit, die Kontur ist konstant.
 */
const COLUMN_BOUNDS = ((): { top: Float64Array; bottom: Float64Array } => {
	const contour = flattenContour();
	const step = (VESSEL_RIGHT - VESSEL_LEFT) / COLUMNS;
	const top = new Float64Array(COLUMNS + 1).fill(Number.POSITIVE_INFINITY);
	const bottom = new Float64Array(COLUMNS + 1).fill(Number.NEGATIVE_INFINITY);

	for (let i = 0, j = contour.length - 1; i < contour.length; j = i, i += 1) {
		const [xi, yi] = contour[i];
		const [xj, yj] = contour[j];
		if (xi === xj) continue;
		const from = Math.max(0, Math.ceil((Math.min(xi, xj) - VESSEL_LEFT) / step));
		const to = Math.min(COLUMNS, Math.floor((Math.max(xi, xj) - VESSEL_LEFT) / step));
		for (let column = from; column <= to; column += 1) {
			const x = VESSEL_LEFT + column * step;
			const y = yi + ((yj - yi) * (x - xi)) / (xj - xi);
			if (y < top[column]) top[column] = y;
			if (y > bottom[column]) bottom[column] = y;
		}
	}

	// Spalten ohne Treffer (Rundung an den Rändern) tragen keine Fläche.
	for (let column = 0; column <= COLUMNS; column += 1) {
		if (!Number.isFinite(top[column]) || !Number.isFinite(bottom[column])) {
			top[column] = VESSEL_BOTTOM;
			bottom[column] = VESSEL_BOTTOM;
		}
	}
	return { top, bottom };
})();

/** Kumulierte Wasserfläche von `VESSEL_LEFT` bis zur jeweiligen Spalte (Trapezregel). */
const cumulativeArea = (fill: number): Float64Array => {
	const yWater = waterlineY(fill);
	const step = (VESSEL_RIGHT - VESSEL_LEFT) / COLUMNS;
	const cumulative = new Float64Array(COLUMNS + 1);
	let previousHeight = Math.max(0, COLUMN_BOUNDS.bottom[0] - Math.max(COLUMN_BOUNDS.top[0], yWater));
	for (let column = 1; column <= COLUMNS; column += 1) {
		const height = Math.max(0, COLUMN_BOUNDS.bottom[column] - Math.max(COLUMN_BOUNDS.top[column], yWater));
		cumulative[column] = cumulative[column - 1] + ((previousHeight + height) / 2) * step;
		previousHeight = height;
	}
	return cumulative;
};

/** Umkehrfunktion der Flächenintegration: die x-Stelle, bis zu der `target` Fläche aufgelaufen ist. */
const areaToX = (cumulative: Float64Array, target: number): number => {
	const step = (VESSEL_RIGHT - VESSEL_LEFT) / COLUMNS;
	let low = 0;
	let high = COLUMNS;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (cumulative[mid] < target) low = mid + 1;
		else high = mid;
	}
	if (low === 0) return VESSEL_LEFT;
	const grown = cumulative[low] - cumulative[low - 1];
	const within = grown > 0 ? (target - cumulative[low - 1]) / grown : 0;
	return VESSEL_LEFT + (low - 1 + within) * step;
};

/**
 * Kanten der Farbstreifen über die Gefäßbreite, flächengetreu zu `shares`.
 *
 * Rückgabe: `shares.length + 1` monoton steigende Kanten von `VESSEL_LEFT` bis `VESSEL_RIGHT`. Die
 * Fläche zwischen zwei Kanten — Kontur geschnitten mit der Halbebene unterhalb der Wasserlinie —
 * entspricht dem jeweiligen Anteil an der gefüllten Gesamtfläche. Ein Anteil von 0 ergibt eine
 * Kante ohne Abstand zur vorherigen (Bandbreite 0).
 *
 * **Füllstand 0** (leeres Gefäß, etwa ohne Punkte) hätte keine Wasserfläche und damit keine
 * teilbare Größe: Dann wird über die **volle** Gefäßfläche aufgeteilt, statt durch null zu teilen.
 */
export const bandEdges = (shares: readonly number[], fill: number): number[] => {
	if (shares.length === 0) return [];

	let cumulative = cumulativeArea(fill);
	// Füllstand 0 heißt „keine Wasserfläche“ — aber die Bernstein-Auswertung des flachen Bodens
	// streut um y = 88 und hinterlässt Pseudo-Flächen von ~1e-12. Erst ab einer echten Fläche
	// (der volle Kolben liegt in der Größenordnung 1e3) gilt der Füllstand als erreicht.
	if (cumulative[COLUMNS] < 1e-9) cumulative = cumulativeArea(1);
	const total = cumulative[COLUMNS];

	const shareSum = shares.reduce((sum, share) => sum + Math.max(0, share), 0);
	const edges = [VESSEL_LEFT];
	let cumulativeShare = 0;
	for (let index = 0; index < shares.length - 1; index += 1) {
		cumulativeShare += Math.max(0, shares[index]);
		const fraction = shareSum > 0 ? cumulativeShare / shareSum : (index + 1) / shares.length;
		// Ein voll aufgebrauchter Anteil endet an der Kontur, nicht am Ende der Wasserfläche — sonst
		// bekäme eine abschließende Säule mit Anteil 0 doch noch eine Breite.
		edges.push(fraction >= 1 ? VESSEL_RIGHT : areaToX(cumulative, fraction * total));
	}
	// Letzte Kante exakt an die rechte Kontur legen — ein Float-Rest darf keinen Spalt lassen.
	edges.push(VESSEL_RIGHT);
	return edges;
};
