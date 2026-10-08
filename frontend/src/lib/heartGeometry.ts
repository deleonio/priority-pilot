/**
 * Geometrie des Herz-Gefäßes: Kontur, Wasserlinie und die Kanten der Farbstreifen.
 *
 * Die Streifen im Herz sollen den **Flächenanteil** ihrer Säule zeigen, nicht deren Breite (#1302).
 * Weil das Herz oben breit ist und unten spitz zuläuft, trägt dieselbe Breite je nach Position
 * unterschiedlich viel Wasser — zwei Säulen mit je 20 % sähen verschieden groß aus. Deshalb werden
 * die Kanten hier aus der **kumulierten Wasserfläche** bestimmt: die Kontur wird zu einer Polylinie
 * geflacht, die Säulenhöhe unterhalb der Wasserlinie dicht abgetastet und integriert; jede Kante
 * ist die Umkehrfunktion dieser Integration am kumulierten Anteil.
 *
 * Bewusst DOM-frei und ohne React — dieselbe Rechnung speist die SVG- und die Glas-Fassung
 * (`HeartGlass`/`toSlotBands` normieren dieselben Kanten), es gibt nur diese eine Kantenquelle.
 */

/**
 * Kontrollpunkte der symmetrischen Herzkontur (an `x = 50` gespiegelt, Bounding-Box x 4–96 /
 * y 6–88) als kubische Bézier-Segmente `[x0,y0, x1,y1, x2,y2, x3,y3]`. Sie sind die **eine**
 * Wahrheit über die Kontur: `HEART_PATH` zeichnet daraus, die Flächenrechnung misst darin.
 */
const CUBIC_SEGMENTS: readonly (readonly [number, number, number, number, number, number, number, number])[] = [
	[50, 88, 20, 66, 4, 48, 4, 32],
	[4, 32, 4, 16, 16, 6, 29, 6],
	[29, 6, 38, 6, 46, 11, 50, 18],
	[50, 18, 54, 11, 62, 6, 71, 6],
	[71, 6, 84, 6, 96, 16, 96, 32],
	[96, 32, 96, 48, 80, 66, 50, 88],
];

/**
 * Herzkontur als SVG-Pfad. Bewusst aus denselben Kontrollpunkten gebaut wie die Flächenrechnung:
 * gezeichnete und gemessene Kontur können so nicht auseinanderlaufen.
 */
export const HEART_PATH = [
	`M ${CUBIC_SEGMENTS[0][0]} ${CUBIC_SEGMENTS[0][1]}`,
	...CUBIC_SEGMENTS.map(([, , x1, y1, x2, y2, x3, y3]) => `C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`),
	'Z',
].join(' ');

/** Oberkante und Tiefpunkt des Gefäßes — zwischen ihnen bewegt sich die Wasserlinie. */
export const HEART_TOP = 6;
export const HEART_BOTTOM = 88;

/** Sichtbare Gefäßbreite (x-Spanne der Herzkontur) — Bandmaß und Glas-Normierung teilen sie. */
const VESSEL_LEFT = 4;
const VESSEL_RIGHT = 96;

/** Höhe der Wasserlinie zum Füllstand `fill` (0 = leer am Tiefpunkt, 1 = voll an der Oberkante). */
export const waterlineY = (fill: number): number => HEART_BOTTOM - fill * (HEART_BOTTOM - HEART_TOP);

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
 * den Rand genau zweimal (auch in der Einkerbung oben) —, also genügen Minimum und Maximum der
 * Schnitt-y-Werte. Einmalig zur Modulladezeit, die Kontur ist konstant.
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
			top[column] = HEART_BOTTOM;
			bottom[column] = HEART_BOTTOM;
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
 * **Füllstand 0** (leeres Herz, etwa ohne Punkte) hätte keine Wasserfläche und damit keine
 * teilbare Größe: Dann wird über die **volle** Herzfläche aufgeteilt, statt durch null zu teilen.
 */
export const bandEdges = (shares: readonly number[], fill: number): number[] => {
	if (shares.length === 0) return [];

	let cumulative = cumulativeArea(fill);
	if (cumulative[COLUMNS] <= 0) cumulative = cumulativeArea(1);
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
