import type { BalanceMetrics, PillarMetric } from './balanceMetric';

/**
 * Geometrie und Bewegung der Balance-Figuren — der Bilder, die dieselbe Kennzahl je Säule
 * (`balanceMetric.ts`) jeweils anders zeichnen, und des Zifferblatts, das sie alle umgibt.
 *
 * **Die Arbeitsteilung:** `balanceMetric.ts` sagt *was* gezeigt wird (ein Wert je Säule, 0–1, plus
 * die Marke, an der „auf Ziel" liegt). Diese Datei sagt *wo* das im Bild landet. Bewusst DOM-frei
 * und ohne React, damit dieselbe Rechnung die SVG- und die WebGL-Fassung speist — es gibt nur diese
 * eine Quelle für Radien, Winkel und Phasen.
 *
 * **Die Figuren**, alle um denselben Mittelpunkt, alle innerhalb desselben Zifferblatts:
 *
 * - **Blasen** — je Säule eine schwingende Ellipse, gestapelt von groß nach klein. Die Säule, die
 *   am weitesten zurückliegt, ist die kleinste Blase und liegt ganz vorn.
 * - **Ringe** — je Säule ein konzentrischer Bogen wie die Aktivitätsringe einer Uhr. Die Bogenlänge
 *   ist der Wert, die stärkste Säule bekommt die äußerste Spur.
 * - **Strahlen** — je Säule ein Lichtstrahl vom Mittelpunkt nach außen, gleichmäßig über den Kreis
 *   verteilt. Die Länge ist der Wert, der längste Strahl steht auf 12 Uhr.
 * - **Blüte und Kristall** — alle Säulen als **eine** Silhouette: je Säule ein Stützpunkt auf ihrem
 *   Winkel, so weit außen wie ihr Wert. Die Blüte verbindet sie weich, der Kristall mit harten
 *   Kanten — derselbe Stapel in zwei Materialien wie Blasen und Scheiben.
 * - **Segmente** — der Ring als Tortengrafik der Zielanteile: je Säule ein Stück, so breit wie ihr
 *   Zielanteil, gefüllt bis auf ihren Wert. Das Breitenmaß ist bewusst der Soll- und nicht der
 *   Ist-Anteil — die Größe der Form bleibt die Kennzahl, die Breite zeigt, wem wie viel vom Ring
 *   zusteht.
 * - **Zeiger** — je Säule ein Zeiger auf dem gemeinsamen Zifferblatt, gleichmäßig über den Kreis
 *   verteilt wie die Strahlen, aber mit schmalerer Spitze. Der längste Zeiger steht auf 12 Uhr.
 *
 * Alle ordnen nach derselben Regel: **stärkste Säule zuerst** (`byStrength`). Wer das Bild
 * wechselt, findet dieselbe Säule an derselben Stelle der Reihenfolge wieder.
 *
 * **Warum jede Säule eine eigene Phase bekommt:** Liegen alle Säulen gleich, sind alle Formen
 * gleich groß. Ohne unterschiedliche Bewegung lägen die Blasen deckungsgleich übereinander und das
 * Bild zeigte im Gleichstand eine einzige Blase. Jede Form schwingt deshalb mit eigener Phase und
 * eigener Periode; die Ränder kreuzen sich fortwährend, jede Farbe wird immer wieder sichtbar.
 * `balanceFigure.test.ts` nagelt genau das fest.
 */

/** Zeichenfläche in Nutzereinheiten; die Anzeigegröße bestimmt allein das CSS. Quadratisch. */
export const VIEW_SIZE = 100;
export const CENTER = VIEW_SIZE / 2;

/** Innenradius des Zifferblatts und die beiden Strichlängen (Zehner-Marke länger). */
export const RING_INNER = 40;
const TICK_LENGTH = 5;
const TICK_LENGTH_MAJOR = 7.5;

/** Ein Strich je Prozentpunkt — die Zahl unter dem Bild und die Zahl der Striche sind dieselbe. */
export const TICK_COUNT = 100;

/**
 * Äußerer Rand des Figurenfelds. Zusammen mit der Schwingungsreserve muss er unter `RING_INNER`
 * bleiben, sonst liefe eine Figur ins Zifferblatt und beide Aussagen vermischten sich.
 */
export const FIGURE_MAX = 33;

/**
 * Kleinster Radius einer Blase. Kein Schönheitswert: Säulen ohne Gewicht haben dauerhaft das
 * Verhältnis 0 (`POST /pillars` legt jede neue Säule mit `weight: 0` an). Ihre Form muss trotzdem
 * sichtbar bleiben, sonst verschwände eine gepflegte Säule spurlos aus dem Bild.
 */
export const R_MIN = 8;

/**
 * Auslenkung der Formschwingung: Die eine Halbachse wächst um diesen Anteil, während die andere um
 * denselben Anteil schrumpft — die Fläche bleibt dabei nahezu konstant, die Blase „atmet" also,
 * statt zu wachsen.
 */
export const SWING = 0.12;

/** Auftakt: die Figuren wachsen einmalig auf ihren Stand, der Ring zieht sich auf (Sekunden). */
export const RISE_DURATION = 1.4;

/** Innerer Rand des Ringfelds — die Mitte bleibt frei, sonst laufen die Bögen dort zusammen. */
const ARC_INNER = 11;
/** Anteil der verfügbaren Spur, den ein Bogen ausfüllt; der Rest ist Luft zwischen den Ringen. */
const ARC_FILL = 0.62;

/** Kürzester Strahl — auch ein Wert von 0 bleibt als Lichtpunkt sichtbar. */
const RAY_MIN = 7;
/** Halbe Breite eines Strahls an seiner Wurzel, als Anteil des Winkelabstands zum Nachbarn. */
const RAY_WIDTH = 0.46;

/**
 * Bewegungs-Staffelung. Die Phase folgt dem goldenen Winkel — der verteilt aufeinanderfolgende
 * Ränge so ungleich wie möglich über den Kreis und ist damit die einzige Größe, die auch bei vielen
 * Säulen paarweise verschieden bleibt. Perioden dagegen laufen im Kreis (Modulo), damit sie bei
 * vielen Säulen nicht ins Zähe wachsen: Eine Form mit 25 s Schwingung liest als Standbild.
 */
const GOLDEN_RATIO = 0.618033988749895;
const SWING_BASE = 6.5;
const SWING_STEP = 0.85;
const SWING_VARIANTS = 5;
const ROT_BASE = 19;
const ROT_STEP = 2.5;
const ROT_VARIANTS = 4;

const TAU = Math.PI * 2;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Die Bewegung einer Säule — in jeder Figur dieselbe, damit ein Wechsel nichts umwirft. */
export interface FigureMotion {
	/** Startphase in Radiant — zugleich die Grunddrehung der Form. */
	phase: number;
	/** Dauer einer vollen Formschwingung in Sekunden. */
	swingPeriod: number;
	/** Dauer einer vollen Drehung um den Mittelpunkt in Sekunden. */
	rotPeriod: number;
	/** Drehrichtung: +1 im Uhrzeigersinn, −1 dagegen. */
	rotDirection: 1 | -1;
}

const motionOf = (colorIndex: number): FigureMotion => ({
	phase: (colorIndex * GOLDEN_RATIO * TAU) % TAU,
	swingPeriod: SWING_BASE + (colorIndex % SWING_VARIANTS) * SWING_STEP,
	rotPeriod: ROT_BASE + (colorIndex % ROT_VARIANTS) * ROT_STEP,
	rotDirection: colorIndex % 2 === 0 ? 1 : -1,
});

/** Radius zu einem Wert 0–1. Auch die 0 behält den Mindestradius (Begründung bei `R_MIN`). */
const toRadius = (value: number): number => R_MIN + clamp01(value) * (FIGURE_MAX - R_MIN);

/**
 * Die gemeinsame Ordnung aller Figuren: **stärkste Säule zuerst**, bei Gleichstand nach
 * Säulen-`id`. Sie entscheidet bei den Blasen, welche hinten liegt, bei den Ringen, welche Spur die
 * äußere ist, und bei den Strahlen, welcher zuerst steht.
 *
 * Der Tie-Break über die `id` ist kein Detail: Ohne ihn hinge die Reihenfolge bei gleichen Werten
 * an der Sortierung der Eingabe, und eine Umsortierung der Säulen-Anzeige würfelte das Bild neu.
 */
const byStrength = (pillars: readonly PillarMetric[]): PillarMetric[] =>
	[...pillars].sort((a, b) => b.scaled - a.scaled || a.pillarId - b.pillarId);

// ── Figur „Blasen" ──────────────────────────────────────────────────────────────────────────────

/** Eine Blase in Zeichenreihenfolge: Grundform plus ihre eigene Bewegung. */
export interface Orb extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Grundradius in Nutzereinheiten (`R_MIN`–`FIGURE_MAX`). */
	radius: number;
}

/**
 * Baut die Blasen in **Zeichenreihenfolge**: größter Radius zuerst (hinten), kleinster zuletzt
 * (vorn). Bei gleichem Radius entscheidet die Säulen-`id` — die Reihenfolge darf nicht von der
 * Sortierung der Eingabe abhängen, sonst springt der Stapel bei einer Umsortierung der Anzeige.
 */
export const buildOrbs = (metrics: BalanceMetrics): Orb[] =>
	byStrength(metrics.pillars).map((pillar): Orb => ({
		pillarId: pillar.pillarId,
		colorIndex: pillar.colorIndex,
		radius: toRadius(pillar.scaled),
		...motionOf(pillar.colorIndex),
	}));

/** Radius des gemeinsamen Soll-Kreises — die Marke, an der eine Säule genau auf ihrem Ziel steht. */
export const targetRadius = (metrics: BalanceMetrics): number => toRadius(metrics.targetMark);

/**
 * Halbachsen einer Blase zum Zeitpunkt `time` (Sekunden). Gegenläufig: `rx` wächst genau um den
 * Anteil, um den `ry` schrumpft. Dieselbe Formel rechnet der Shader je Bildpunkt; hier speist sie
 * die Stützwerte der SMIL-Animation im SVG.
 */
export const orbAxes = (motion: FigureMotion, radius: number, time: number): { rx: number; ry: number } => {
	const swing = Math.sin(motion.phase + (TAU * time) / motion.swingPeriod) * SWING;
	return { rx: radius * (1 + swing), ry: radius * (1 - swing) };
};

// ── Figur „Ringe" ───────────────────────────────────────────────────────────────────────────────

/** Ein Aktivitätsring: eine Spur, deren Lage und Bogenlänge beide den Wert tragen. */
export interface Arc extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Mittlerer Radius der Spur in Nutzereinheiten. */
	radius: number;
	/** Strichstärke des Bogens. */
	width: number;
	/** Bogenlänge als Anteil des vollen Umlaufs (0–1) — der Wert der Säule. */
	sweep: number;
	/** Dieselbe Marke als Anteil des Umlaufs: Dort steht die Säule genau auf ihrem Ziel. */
	target: number;
}

/**
 * Baut die Ringe **von außen nach innen, stärkste Säule zuerst** — dieselbe Ordnung wie der
 * Blasen-Stapel: Die am stärksten ausgeprägte Säule bekommt die größte Form, die schwächste die
 * kleinste. Zusätzlich zur Lage trägt die Bogenlänge denselben Wert; beide Signale zeigen in
 * dieselbe Richtung, statt sich gegenseitig zu widersprechen.
 *
 * Die Spurbreite teilt sich das Feld unter allen Säulen auf; bei vielen Säulen werden die Ringe also
 * dünner statt enger — eng gestellte Ringe verschmelzen optisch, dünne bleiben lesbar.
 */
export const buildArcs = (metrics: BalanceMetrics): Arc[] => {
	const pillars = byStrength(metrics.pillars);
	const track = (FIGURE_MAX - ARC_INNER) / Math.max(1, pillars.length);
	return pillars.map((pillar, index): Arc => ({
		pillarId: pillar.pillarId,
		colorIndex: pillar.colorIndex,
		// Index 0 ist die stärkste Säule und bekommt die äußerste Spur.
		radius: FIGURE_MAX - track * (index + 0.5),
		width: track * ARC_FILL,
		sweep: clamp01(pillar.scaled),
		target: clamp01(metrics.targetMark),
		...motionOf(pillar.colorIndex),
	}));
};

// ── Figur „Strahlen" ────────────────────────────────────────────────────────────────────────────

/** Ein Lichtstrahl vom Mittelpunkt nach außen. */
export interface Ray extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Mittelwinkel in Grad, 0 zeigt nach rechts, −90 nach oben (SVG-Konvention). */
	angle: number;
	/** Halbe Öffnung des Strahls in Grad. */
	spread: number;
	/** Länge des Strahls in Nutzereinheiten. */
	length: number;
	/** Länge, bei der die Säule genau auf ihrem Ziel stünde — als Marke im Bild. */
	targetLength: number;
}

/**
 * Baut die Strahlen gleichmäßig über den Kreis, ab 12 Uhr im Uhrzeigersinn, **stärkste Säule
 * zuerst** — dieselbe Ordnung wie Blasen und Ringe. Der längste Strahl steht damit immer auf 12 Uhr
 * und das Bild liest sich wie ein Zeiger, der von der stärksten zur schwächsten Säule wandert.
 */
export const buildRays = (metrics: BalanceMetrics): Ray[] => {
	const pillars = byStrength(metrics.pillars);
	const step = 360 / Math.max(1, pillars.length);
	const toLength = (value: number): number => RAY_MIN + clamp01(value) * (FIGURE_MAX - RAY_MIN);
	return pillars.map((pillar, index): Ray => ({
		pillarId: pillar.pillarId,
		colorIndex: pillar.colorIndex,
		angle: -90 + index * step,
		spread: (step / 2) * RAY_WIDTH,
		length: toLength(pillar.scaled),
		targetLength: toLength(metrics.targetMark),
		...motionOf(pillar.colorIndex),
	}));
};

// ── Figuren „Blüte" und „Kristall" ──────────────────────────────────────────────────────────────

/**
 * Ein Stützpunkt der gemeinsamen Silhouette: die Spitze des Lappens einer Säule.
 *
 * Die Atmung der Spitzen (±6 % um den Wert, ±1,6° Wippen um den Winkel) lebt allein im Shader
 * (`PETAL_SWING`/`PETAL_SWAY` in `balance-figure.frag`) — das SVG atmet, wie die Strahlen, nur in
 * der Deckkraft und im Puls der Knoten.
 */
export interface Petal extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Mittelwinkel in Grad, 0 zeigt nach rechts, −90 nach oben (SVG-Konvention). */
	angle: number;
	/** Halber Winkelabstand zum Nachbarn — so breit ist der eigene Anteil an der Kontur. */
	spread: number;
	/** Abstand der Spitze vom Mittelpunkt in Nutzereinheiten (`R_MIN`–`FIGURE_MAX`) — der Wert. */
	radius: number;
}

/**
 * Baut die Stützpunkte der Silhouette wie die Strahlen: gleichmäßig über den Kreis ab 12 Uhr im
 * Uhrzeigersinn, **stärkste Säule zuerst**. Der weiteste Lappen steht damit immer auf 12 Uhr.
 *
 * Blüte und Kristall teilen sich diese Punkte (wie Blasen und Scheiben ihren Stapel) — sie
 * unterscheiden sich allein darin, wie die Kontur zwischen ihnen verläuft: weich oder kantig.
 */
export const buildPetals = (metrics: BalanceMetrics): Petal[] => {
	const pillars = byStrength(metrics.pillars);
	const step = 360 / Math.max(1, pillars.length);
	return pillars.map((pillar, index): Petal => ({
		pillarId: pillar.pillarId,
		colorIndex: pillar.colorIndex,
		angle: -90 + index * step,
		spread: step / 2,
		radius: toRadius(pillar.scaled),
		...motionOf(pillar.colorIndex),
	}));
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Radius der Silhouette zu einem Winkel. Die Stützpunkte tragen Dreiecksgewichte über den Ring
 * (Partition der Eins): An der Spitze selbst wiegt allein die eigene Säule, zur Mitte zwischen zwei
 * Nachbarn mischen sie sich. `smooth` wählt den weichen Übergang der Blüte, sonst entsteht die
 * gerade Kante des Kristalls — dieselbe Rechnung führt der Shader je Bildpunkt aus.
 */
export const petalRadiusAt = (petals: readonly Petal[], angle: number, smooth: boolean): number => {
	const count = petals.length;
	if (count === 0) return 0;
	const step = 360 / count;
	// Position auf dem Ring, bezogen auf den ersten Stützpunkt (steht immer auf −90°, also 0).
	const position = ((((angle + 90) % 360) + 360) % 360) / step;
	let radius = 0;
	for (let index = 0; index < count; index += 1) {
		let distance = Math.abs(position - index);
		distance = Math.min(distance, count - distance);
		if (distance >= 1) continue;
		const share = smooth ? 1 - smoothstep(distance) : 1 - distance;
		radius += petals[index].radius * share;
	}
	return radius;
};

/**
 * Stützpunkte eines Lappens für den Strich der Blüte: der Bogen vom halben Winkelabstand vor bis
 * hinter seiner Spitze. Alle Lappen aneinandergelegt ergeben die geschlossene Kontur — jeder
 * Stützpunkt gehört genau einem Lappen, und damit genau einer Säulenfarbe.
 */
export const petalArcPoints = (
	petals: readonly Petal[],
	index: number,
	smooth: boolean,
	samples = 16,
): { x: number; y: number }[] => {
	const petal = petals[index];
	if (!petal) return [];
	return Array.from({ length: samples + 1 }, (_, step): { x: number; y: number } => {
		const angle = petal.angle - petal.spread + (petal.spread * 2 * step) / samples;
		return polar(angle, petalRadiusAt(petals, angle, smooth));
	});
};

// ── Figur „Segmente“ ───────────────────────────────────────────────────────────────

/** Innerer Radius der Ringstücke — gemeinsam für alle, die Breite trägt allein der Winkel. */
const WEDGE_INNER = 8;
/** Sichtbare Fuge zwischen zwei Stücken, je Seite in Grad — sonst liest der Ring als Fläche. */
const WEDGE_GAP = 0.8;
/**
 * Kleinster Winkel eines Stücks — das Breiten-Pendant zu `R_MIN`: Eine Säule ohne Ziel hat keinen
 * Anteil am Ring, ihr Stück wäre unsichtbar. Das Mindeststück hält sie im Bild; den Rest des
 * Ringes verteilen die Zielanteile weiter exakt.
 */
const WEDGE_MIN_SPAN = 3;

/**
 * Ein Ringstück: so breit wie der Anteil der Säule, gefüllt von innen bis auf ihren Wert.
 */
export interface Wedge extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Startwinkel in Grad, 0 zeigt nach rechts, −90 nach oben (SVG-Konvention). */
	start: number;
	/** Endwinkel in Grad (exklusiv) — zwischen ihm und dem Nachbarn liegt die Fuge. */
	end: number;
	/** Voller Winkelanteil am Ring in Grad, inklusive Fugen — die Stücke schließen den Ring. */
	span: number;
	/** Mittlerer Winkel des Stücks — dort steht seine Soll-Marke quer über den Ring. */
	angle: number;
	/** Innerer Radius in Nutzereinheiten (bei allen Stücken `WEDGE_INNER`). */
	inner: number;
	/** Äußerer Radius in Nutzereinheiten (`R_MIN`–`FIGURE_MAX`) — der Wert der Säule. */
	outer: number;
	/** Radius, bei dem die Säule genau auf ihrem Ziel stünde — als Strich quer über das Stück. */
	targetRadius: number;
}

/**
 * Baut die Ringstücke als Tortengrafik der **Ist**-Anteile: Die Anteile summieren auf 100 % und
 * teilen den Ring daher vollständig auf — kein Luftanteil, kein klappender Startwinkel. Die
 * Reihenfolge ist wie bei allen Figuren **stärkste Säule zuerst**, ab 12 Uhr im Uhrzeigersinn.
 *
 * Das Mindeststück (`WEDGE_MIN_SPAN`) bekommen alle Säulen zuerst, der Rest des Ringes geht nach
 * Zielanteil daran — so bleibt eine Säule ohne Ziel als schmales, aber sichtbares Haar stehen
 * (dieselbe Pflicht, die `R_MIN` für die Radien erfüllt). Die Fuge schrumpft mit dem Stück, damit
 * ein Mindeststück nicht zur Zahl 0 zusammenfällt.
 */
export const buildWedges = (metrics: BalanceMetrics): Wedge[] => {
	const pillars = byStrength(metrics.pillars);
	const count = pillars.length;
	if (count === 0) return [];
	const totalActual = metrics.pillars.reduce((sum, pillar) => sum + pillar.actualShare, 0);
	const reserve = Math.min(WEDGE_MIN_SPAN, 360 / count);
	let start = -90;
	return pillars.map((pillar): Wedge => {
		const share = totalActual > 0 ? pillar.actualShare / totalActual : 0;
		const span = reserve + (360 - reserve * count) * share;
		const gap = Math.min(WEDGE_GAP, span / 4);
		const wedge: Wedge = {
			pillarId: pillar.pillarId,
			colorIndex: pillar.colorIndex,
			start: start + gap,
			end: start + span - gap,
			span,
			angle: start + span / 2,
			inner: WEDGE_INNER,
			outer: toRadius(pillar.scaled),
			targetRadius: toRadius(metrics.targetMark),
			...motionOf(pillar.colorIndex),
		};
		start += span;
		return wedge;
	});
};

// ── Figur „Zeiger“ ───────────────────────────────────────────────────────────────────

/** Ein Zeiger auf dem gemeinsamen Zifferblatt — einer je Säule. */
export interface Hand extends FigureMotion {
	pillarId: number;
	colorIndex: number;
	/** Mittelwinkel in Grad, 0 zeigt nach rechts, −90 nach oben (SVG-Konvention). */
	angle: number;
	/** Halbe Öffnung des Zeigers in Grad — schmaler als ein Strahl, die Skala steht im Zentrum. */
	spread: number;
	/** Länge des Zeigers in Nutzereinheiten (`R_MIN`–`FIGURE_MAX`) — der Wert der Säule. */
	length: number;
	/** Länge, bei der die Säule genau auf ihrem Ziel stünde — als Marke im Bild. */
	targetLength: number;
}

/**
 * Baut die Zeiger wie die Strahlen: gleichmäßig über den Kreis ab 12 Uhr im Uhrzeigersinn,
 * **stärkste Säule zuerst**. Der längste Zeiger steht damit auf 12 Uhr und das Bild liest sich
 * wie ein Uhrwerk, das die Stärken der Säulen anzeigt.
 */
export const buildHands = (metrics: BalanceMetrics): Hand[] => {
	const pillars = byStrength(metrics.pillars);
	const step = 360 / Math.max(1, pillars.length);
	const toLength = (value: number): number => R_MIN + clamp01(value) * (FIGURE_MAX - R_MIN);
	return pillars.map((pillar, index): Hand => ({
		pillarId: pillar.pillarId,
		colorIndex: pillar.colorIndex,
		angle: -90 + index * step,
		spread: (step / 2) * 0.42,
		length: toLength(pillar.scaled),
		targetLength: toLength(metrics.targetMark),
		...motionOf(pillar.colorIndex),
	}));
};

// ── Das Zifferblatt ─────────────────────────────────────────────────────────────────────────────

/** Ein Strich des Zifferblatts. */
export interface RingTick {
	/** 0–99; Strich `i` steht für den Prozentpunkt `i`. */
	index: number;
	/** Winkel in Grad, 0 zeigt nach rechts, −90 nach oben (SVG-Konvention, y nach unten). */
	angle: number;
	/** Jeder zehnte Strich ist länger und dicker — die Zehner-Marke einer Uhr. */
	major: boolean;
	/** Leuchtet der Strich? Gilt für alle Striche unterhalb des Balance-Werts. */
	active: boolean;
	/** Linke Stützstelle der Farbrampe (0/25/50/75) und Mischanteil zur nächsten (0–1). */
	stop: number;
	mix: number;
}

/**
 * Zahl der leuchtenden Striche. Bewusst dieselbe Rundung wie die große Prozentzahl unter dem Bild
 * (`asPercent` in `HeartBalance.tsx`) — Bild und Zahl dürfen sich nicht um einen Strich
 * widersprechen.
 */
export const activeTicks = (fill: number): number => Math.round(clamp01(fill) * TICK_COUNT);

/**
 * Das Zifferblatt zum Füllstand: 100 Striche ab 12 Uhr im Uhrzeigersinn, je 3,6°. Die Farbe kommt
 * als Stützstelle plus Mischanteil zurück statt als fertiger Farbwert — so kann die SVG-Fassung sie
 * per `color-mix()` aus den Theme-Tokens auflösen (und folgt damit einem Theme-Wechsel ohne
 * JavaScript), während die WebGL-Fassung dieselben fünf Stützstellen als Uniform mischt.
 */
export const ringTicks = (fill: number): RingTick[] => {
	const active = activeTicks(fill);
	return Array.from({ length: TICK_COUNT }, (_, index): RingTick => {
		// Vier Abschnitte zwischen fünf Stützstellen; der letzte Strich landet exakt auf der fünften.
		const position = (index / (TICK_COUNT - 1)) * 4;
		const segment = Math.min(3, Math.floor(position));
		return {
			index,
			angle: -90 + index * (360 / TICK_COUNT),
			major: index % 10 === 0,
			active: index < active,
			stop: segment * 25,
			mix: position - segment,
		};
	});
};

/** Anfangs- und Endpunkt eines Strichs in Nutzereinheiten. */
export const tickLine = (tick: RingTick): { x1: number; y1: number; x2: number; y2: number } => {
	const radians = (tick.angle * Math.PI) / 180;
	const outer = RING_INNER + (tick.major ? TICK_LENGTH_MAJOR : TICK_LENGTH);
	return {
		x1: CENTER + Math.cos(radians) * RING_INNER,
		y1: CENTER + Math.sin(radians) * RING_INNER,
		x2: CENTER + Math.cos(radians) * outer,
		y2: CENTER + Math.sin(radians) * outer,
	};
};

/** Punkt auf einem Kreis um den Mittelpunkt — geteilt von Bögen, Strahlen und Marken. */
export const polar = (angle: number, radius: number): { x: number; y: number } => {
	const radians = (angle * Math.PI) / 180;
	return { x: CENTER + Math.cos(radians) * radius, y: CENTER + Math.sin(radians) * radius };
};
