import type { Pillar } from 'client';
import { useId, useMemo, type CSSProperties } from 'react';
import { buildHeartBalance, heartHealth } from '../lib/heartBalance';
import { useAnimationsEnabled } from '../lib/animations';
import { useHeartAnimationEnabled } from '../lib/heartAnimation';
import { usePrefersReducedMotion } from '../lib/reducedMotion';

/**
 * Das Herz der Startseite: ein vektorielles Gefäß (SVG), das sich wie ein Wasserglas füllt. Der
 * Füllstand steigt von unten nach oben, je ausgewogener — je balancierter — die Lebenssäulen sind
 * (Rechnung in `lib/heartBalance.ts`); die Oberfläche ist eine durchlaufende Welle.
 *
 * **Das Bild sagt zwei Dinge gleichzeitig:** Die *Höhe* der gemeinsamen Wasserlinie trägt die
 * Gesamt-Balance, die *Breite* der Farbstreifen unter der Oberfläche die Verteilung — jeder
 * Streifen ist genau so breit, wie sein Ist-Anteil am Punkte-Saldo beträgt. Ein schmales Band
 * neben einem breiten ist damit auch ohne Zahl eine Schieflage.
 *
 * **Warum eine gemeinsame Wasserlinie:** „Wie voll ist das Herz" ist eine einzige Zahl — also
 * gibt es im Bild auch nur eine Wasserlinie. Sie steigt einmalig von unten auf ihren Stand und
 * wellt danach über die volle Herzbreite.
 *
 * **Warum SVG und nicht Canvas:** Die Grafik ist Text-, Theme- und Zoom-fähig (Farbrollen als
 * Custom Properties, `role="img"` mit Label, scharf bei jeder Größe) und braucht keinen
 * Render-Loop in JavaScript — die Wellen laufen als CSS-Animation im Compositor.
 *
 * Rechnung, Randfälle und das Balance-Maß stehen in `lib/heartBalance.ts`.
 */
interface HeartBalanceProps {
	/** Die Lebenssäulen — je Säule ein Segment, in Anzeigereihenfolge. */
	pillars: Pillar[];
	/** Punktestand je Säule (`pillarId → Punkte`), dieselbe Quelle wie „Gesamtguthaben". */
	punkteProSaeule: ReadonlyMap<number, number>;
}

/* Zeichenfläche in Nutzereinheiten; die Anzeigegröße bestimmt allein das CSS (`width: 100%`). */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 92;

/**
 * Symmetrische Herzkontur (an `x = 50` gespiegelt, Bounding-Box x 4–96 / y 6–88). Bewusst als
 * Konstante statt berechnet: die Kurve ist von Hand ausbalanciert, eine Formel würde sie nur
 * schwerer nachvollziehbar machen.
 */
const HEART_PATH = [
	'M 50 88',
	'C 20 66, 4 48, 4 32',
	'C 4 16, 16 6, 29 6',
	'C 38 6, 46 11, 50 18',
	'C 54 11, 62 6, 71 6',
	'C 84 6, 96 16, 96 32',
	'C 96 48, 80 66, 50 88',
	'Z',
].join(' ');

/** Oberkante und Tiefpunkt des Gefäßes — zwischen ihnen bewegt sich die Wasserlinie. */
const HEART_TOP = 6;
const HEART_BOTTOM = 88;

/**
 * Wellenlänge und Auslenkung der Oberfläche in Nutzereinheiten. Die Auslenkung ist so gewählt,
 * dass die Oberfläche auch in voller Farbe klar als Welle lesbar ist. Die Wellenlänge ist bewusst
 * kürzer als ein Segment breit ist (bei fünf Säulen 20 Einheiten): Sieht man weniger als eine
 * volle Welle, liest die Oberfläche als schiefe Kante statt als Wasser.
 */
const WAVE_LENGTH = 16;
const WAVE_AMPLITUDE = 3;

/**
 * Baut eine Wellenfläche, die über die Zeichenfläche hinaussteht: Die CSS-Animation verschiebt sie
 * um genau **eine** Wellenlänge, wodurch die Kachelung nahtlos in sich zurückläuft.
 *
 * Die Fläche beginnt eine Wellenlänge vor der Zeichenfläche und reicht eine über sie hinaus — die
 * sichtbaren 0–100 bleiben damit über die ganze Verschiebung gedeckt. Nach unten schließt sie weit
 * unter dem Gefäßboden; geclippt wird ohnehin an der Herzkontur.
 */
const buildWavePath = (): string => {
	const halfWave = WAVE_LENGTH / 2;
	const start = -WAVE_LENGTH * 2;
	// Auf eine gerade Anzahl Halbwellen aufrunden, damit die Kachel auf einer vollen Periode endet.
	const needed = Math.ceil((VIEW_WIDTH + WAVE_LENGTH - start) / halfWave);
	const halfWaves = needed + (needed % 2);
	// Erste Halbwelle als `q`, alle weiteren als `t` — das spiegelt den Kontrollpunkt automatisch
	// und erzeugt so eine stetige Sinus-Näherung ohne Knick an den Nahtstellen.
	const crests = [
		`q ${halfWave / 2} ${-WAVE_AMPLITUDE} ${halfWave} 0`,
		...Array.from({ length: halfWaves - 1 }, () => `t ${halfWave} 0`),
	];
	const end = start + halfWaves * halfWave;
	const floor = VIEW_HEIGHT * 2;
	return `M ${start} 0 ${crests.join(' ')} L ${end} ${floor} L ${start} ${floor} Z`;
};

const WAVE_PATH = buildWavePath();

/** Höchster in `app.css` definierter Rang der Säulen-Rampe (`--pp-pillar-1…8`). */
const PILLAR_RAMP_SIZE = 8;

/**
 * Farbklassen aus der Säulen-Rampe — einmal für den Farbstreifen im Bild (`heart-water`), einmal
 * für den Tupfer in der Legende (`heart-legend-dot`). Ab der 9. Säule wird nicht weiter eingefärbt
 * (ux-design.md §2, Regel 3): Dann bleibt es bei der Basisklasse, die neutral färbt, und der Name
 * in der Legende trägt die Zuordnung allein.
 *
 * Beide Stellen gehen bewusst durch dieselbe Funktion — sonst driftet die Rampen-Grenze der einen
 * von der anderen ab.
 */
const rampClass = (base: string, colorIndex: number): string =>
	colorIndex < PILLAR_RAMP_SIZE ? `${base} ${base}--${colorIndex + 1}` : base;

/*
 * Wellen-Drift per SMIL (`<animateTransform>`), nicht per CSS-Animation: Alle Kopien der Welle
 * müssen zwingend **phasengleich** laufen — nur dann ist die sichtbare Oberfläche über die
 * Bandgrenzen hinweg eine einzige, ununterbrochene Welle. CSS-Animationsuhren starten je Element
 * und laufen auseinander; die SMIL-Zeitachse ist eine gemeinsame Dokument-Uhr, gleiche `dur`
 * bedeutet damit garantiert gleiche Phase. Die Verschiebung um genau eine Wellenlänge
 * (`WAVE_LENGTH`, siehe Pfad) lässt die Kachelung sprungfrei zurücklaufen.
 *
 * Es gibt bewusst nur **eine** Wasseroberfläche: Eine zweite, dahinter laufende „Tiefenwelle“
 * schaut als blasser Bogen über die Farbkante und wirkt wie abgeschnitten — der Effekt wurde
 * nach Nutzer-Feedback entfernt. Gerendert wird das `<animateTransform>` nur bei erlaubter
 * Animation (`animated`); sonst steht die Welle still in ihrer Grundform — SMIL lässt sich
 * nicht per CSS abschalten.
 */
const WAVE_DRIFT_DURATION = '7s';

/** Ganze Prozent für die Anzeige (die Rechnung selbst bleibt ungerundet). */
const asPercent = (share: number): number => Math.round(share * 100);

/** Ein Farbstreifen unter der Wasserlinie: eine Säule mit ihrer horizontalen Spanne (0–100). */
interface HeartBand {
	pillarId: number;
	colorIndex: number;
	/** Linke und rechte Kante des Streifens in Nutzereinheiten. */
	x0: number;
	x1: number;
}

export const HeartBalance = ({ pillars, punkteProSaeule }: HeartBalanceProps) => {
	const balance = useMemo(() => buildHeartBalance(pillars, punkteProSaeule), [pillars, punkteProSaeule]);
	const health = heartHealth(balance);

	/*
	 * Das Herz schlägt und wellt nur, wenn beide Schalter es erlauben: der Master „Animationen“
	 * (#1183) und der Feinschalter „Herz animieren“. Die OS-Einstellung „Bewegung reduzieren“ hat
	 * Vorrang und schaltet hier mit ab — die Wellen-Drift ist SMIL und lässt sich nicht per
	 * CSS-Media-Query ausnehmen (Schlag und Aufstieg bleiben trotzdem im CSS abgesichert).
	 */
	const { enabled: animationsEnabled } = useAnimationsEnabled();
	const { enabled: heartAnimationEnabled } = useHeartAnimationEnabled();
	const prefersReducedMotion = usePrefersReducedMotion();
	const animated = animationsEnabled && heartAnimationEnabled && !prefersReducedMotion;

	/*
	 * Horizontale Spannen der Farbstreifen: kumulierte Ist-Anteile über die Zeichenbreite — die
	 * Breite jedes Streifens entspricht exakt dem Ist-Anteil seiner Säule (Verteilung im Bild).
	 * Ohne Punkte gilt die Soll-Verteilung, damit das leere Herz schon die Zielaufteilung zeigt.
	 */
	const bands = useMemo<HeartBand[]>(() => {
		let x = 0;
		const next = balance.segments.map((segment) => {
			const share = balance.hasPoints ? segment.actualShare : segment.targetShare;
			const x0 = x;
			x = Math.min(VIEW_WIDTH, x + share * VIEW_WIDTH);
			return { pillarId: segment.pillar.id, colorIndex: segment.colorIndex, x0, x1: x };
		});
		// Letzte Kante exakt auf die Zeichenbreite legen — ein Float-Rest darf keinen Spalt lassen.
		if (next.length > 0) next[next.length - 1].x1 = VIEW_WIDTH;
		return next;
	}, [balance]);

	// Eindeutige, aber stabile Präfixe für die SVG-Fragment-Referenzen: mehrere Herzen auf einer
	// Seite dürfen sich nicht gegenseitig die `clipPath`-IDs überschreiben. Doppelpunkte aus
	// `useId()` fallen raus, damit die IDs auch für `querySelector` benutzbar bleiben.
	const uid = useId().replace(/:/g, '');
	const heartClipId = `${uid}-heart`;
	const bandClipId = (index: number): string => `${uid}-band-${index}`;

	const fillPercent = asPercent(balance.fill);

	/*
	 * Ruhepuls: Je ausgewogener das Herz, desto langsamer und ruhiger schlägt es (1,5 s leer bis
	 * 2,6 s voll). Der Wert geht als Custom Property ins CSS, damit die Animation dort bleibt,
	 * wo Bewegung hingehört — und `prefers-reduced-motion` sie an einer Stelle abschalten kann.
	 */
	const beatSeconds = (1.5 + balance.fill * 1.1).toFixed(2);

	return (
		<div className="heart-balance">
			{/*
			 * Zwei Werte, die die CSS-Animationen der Grafik vorgeben: der Ruhepuls und der
			 * Aufstiegsweg. Die Wellen-Drift selbst läuft per SMIL (s. unten) und braucht hier
			 * keinen Versatz mehr.
			 */}
			<div
				className={animated ? 'heart-balance-stage' : 'heart-balance-stage heart-balance-stage--still'}
				style={
					{
						'--pp-heart-beat': `${beatSeconds}s`,
						// Weg, den das Wasser beim Aufstieg zurücklegt: die volle Gefäßhöhe. Die Animation
						// (`heart-water-rise` in app.css) startet mit der Oberfläche am Boden und endet hier.
						'--pp-heart-rise': `${HEART_BOTTOM - HEART_TOP}px`,
					} as CSSProperties
				}
			>
				<svg
					className="heart-balance-svg"
					viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
					role="img"
					aria-label={`Herz-Füllstand ${fillPercent} Prozent — ${health.label}`}
					data-testid="heart-balance-svg"
				>
					<defs>
						<clipPath id={heartClipId}>
							<path d={HEART_PATH} />
						</clipPath>
						{bands.map((band, index) => (
							<clipPath key={band.pillarId} id={bandClipId(index)}>
								<rect x={band.x0} y={0} width={band.x1 - band.x0} height={VIEW_HEIGHT} />
							</clipPath>
						))}
					</defs>

					{/* Leeres Gefäß — die eingesenkte Fläche macht sichtbar, wie viel noch fehlt. */}
					<path d={HEART_PATH} className="heart-vessel" />

					<g clipPath={`url(#${heartClipId})`}>
						{/*
						 * Das Wasser steigt einmalig von unten auf seinen Stand (CSS, Compositor) und wellt
						 * danach dauerhaft weiter. Eine Oberfläche fürs ganze Herz — Details zur Phasen-
						 * und Clip-Struktur bei den Drift-Konstanten oben.
						 */}
						<g className="heart-water-rise">
							<g transform={`translate(0 ${(HEART_BOTTOM - balance.fill * (HEART_BOTTOM - HEART_TOP)).toFixed(2)})`}>
								{bands.map((band, index) => (
									<g key={band.pillarId} clipPath={`url(#${bandClipId(index)})`} data-testid="heart-column">
										<g className="heart-wave">
											<path d={WAVE_PATH} className={rampClass('heart-water', band.colorIndex)} />
											{animated && (
												<animateTransform
													attributeName="transform"
													type="translate"
													from="0 0"
													to={`${-WAVE_LENGTH} 0`}
													dur={WAVE_DRIFT_DURATION}
													repeatCount="indefinite"
												/>
											)}
										</g>
									</g>
								))}
							</g>
						</g>

						{/*
						 * Trennfugen zwischen den Streifen — in Kartenfarbe, damit sie als Fuge lesen. Nur an
						 * echten Kanten: Streifen ohne Breite (Ist-Anteil 0) erzeugen keine Fuge.
						 */}
						{bands
							.slice(1)
							.map(
								(band) =>
									band.x1 > band.x0 && (
										<line
											key={band.pillarId}
											className="heart-seam"
											x1={band.x0}
											y1={0}
											x2={band.x0}
											y2={VIEW_HEIGHT}
										/>
									),
							)}
					</g>

					{/* Kontur zuletzt, damit sie über dem Wasser liegt und die Silhouette scharf bleibt. */}
					<path d={HEART_PATH} className="heart-outline" />
				</svg>
			</div>

			<p className="heart-balance-readout">
				<span className="heart-balance-value" data-testid="heart-balance-value">
					{fillPercent} %
				</span>
				<span className="heart-balance-state" data-state={health.state}>
					{health.label}
				</span>
				<span className="heart-balance-hint">{health.hint}</span>
			</p>

			{/*
			 * Relief-Regel (ux-design.md §2, Regel 4): Der Säulenname steht immer als Text neben der
			 * Farbe — die Farbe allein trägt hier keine Bedeutung. Zugleich ist das die Legende, die
			 * die Farbstreifen im Bild überhaupt zuordenbar macht.
			 */}
			<ul className="heart-balance-legend" data-testid="heart-balance-legend">
				{balance.segments.map((segment) => (
					<li key={segment.pillar.id} className="heart-balance-legend-row">
						<span className={rampClass('heart-legend-dot', segment.colorIndex)} aria-hidden="true" />
						<span className="heart-balance-legend-name">{segment.pillar.name}</span>
						<span className="heart-balance-legend-value">
							{asPercent(segment.actualShare)} % · Ziel {asPercent(segment.targetShare)} %
						</span>
					</li>
				))}
			</ul>
		</div>
	);
};
