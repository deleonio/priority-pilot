import type { Pillar } from 'client';
import { useId, useMemo, type CSSProperties } from 'react';
import { buildHeartBalance, heartHealth } from '../lib/heartBalance';

/**
 * Das Herz der Startseite: ein vektorielles Gefäß (SVG), in dem je Lebenssäule eine Wassersäule
 * steht. Jede Wassersäule steigt, je näher ihre Säule an ihrem Soll-Anteil liegt; die Wellen an
 * der Oberfläche laufen dauerhaft weiter.
 *
 * **Warum Wassersäulen und nicht Tortenstücke:** Die Segmente sind vertikal, weil die Aussage
 * vertikal ist — „wie voll ist diese Säule". Dadurch bildet die Wasserlinie über alle Segmente
 * hinweg selbst die Balance ab: gleichmäßige Säulen ergeben eine flache, ruhige Oberfläche,
 * eine Schieflage eine zerklüftete. Die Form trägt die Aussage, nicht erst die Prozentzahl.
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
 * Wellenlänge und Auslenkung der Oberfläche in Nutzereinheiten. Die Wellenlänge ist bewusst kürzer
 * als ein Segment breit ist (bei fünf Säulen 20 Einheiten): Sieht man weniger als eine volle Welle,
 * liest die Oberfläche als schiefe Kante statt als Wasser.
 */
const WAVE_LENGTH = 16;
const WAVE_AMPLITUDE = 2;

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
 * Farbklasse einer Wassersäule. Ab der 9. Säule wird nicht weiter eingefärbt (ux-design.md §2,
 * Regel 3) — diese Segmente bleiben neutral, ihr Name steht wie bei allen anderen in der Legende.
 */
const waterClass = (colorIndex: number): string =>
	colorIndex < PILLAR_RAMP_SIZE ? `heart-water heart-water--${colorIndex + 1}` : 'heart-water';

/** Ganze Prozent für die Anzeige (die Rechnung selbst bleibt ungerundet). */
const asPercent = (share: number): number => Math.round(share * 100);

export const HeartBalance = ({ pillars, punkteProSaeule }: HeartBalanceProps) => {
	const balance = useMemo(() => buildHeartBalance(pillars, punkteProSaeule), [pillars, punkteProSaeule]);
	const health = heartHealth(balance);

	// Eindeutige, aber stabile Präfixe für die SVG-Fragment-Referenzen: mehrere Herzen auf einer
	// Seite dürfen sich nicht gegenseitig die `clipPath`-IDs überschreiben. Doppelpunkte aus
	// `useId()` fallen raus, damit die IDs auch für `querySelector` benutzbar bleiben.
	const uid = useId().replace(/:/g, '');
	const heartClipId = `${uid}-heart`;
	const columnClipId = (index: number): string => `${uid}-col-${index}`;

	const columnWidth = balance.segments.length > 0 ? VIEW_WIDTH / balance.segments.length : VIEW_WIDTH;
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
			 * Zwei Werte, die die Grafik der Animation vorgibt: der Ruhepuls und der Versatz einer
			 * vollen Wellenlänge. Letzterer MUSS `WAVE_LENGTH` entsprechen, sonst springt die Kachelung
			 * bei jedem Schleifendurchlauf — deshalb kommt er aus derselben Konstante wie der Pfad.
			 */}
			<div
				className="heart-balance-stage"
				style={{ '--pp-heart-beat': `${beatSeconds}s`, '--pp-heart-wave-shift': `${WAVE_LENGTH}px` } as CSSProperties}
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
						{balance.segments.map((segment, index) => (
							<clipPath key={segment.pillar.id} id={columnClipId(index)}>
								<rect x={index * columnWidth} y={0} width={columnWidth} height={VIEW_HEIGHT} />
							</clipPath>
						))}
					</defs>

					{/* Leeres Gefäß — die eingesenkte Fläche macht sichtbar, wie viel noch fehlt. */}
					<path d={HEART_PATH} className="heart-vessel" />

					<g clipPath={`url(#${heartClipId})`}>
						{balance.segments.map((segment, index) => {
							const surfaceY = HEART_BOTTOM - segment.level * (HEART_BOTTOM - HEART_TOP);
							// Leicht verschiedene Laufzeiten und Phasen: sonst schwingen alle Segmente im
							// Gleichtakt und das Wasser wirkt wie eine einzige starre Kachel.
							const drift = { animationDuration: `${(7 + index * 0.9).toFixed(1)}s` };
							const driftBack = {
								animationDuration: `${(9.5 + index * 1.1).toFixed(1)}s`,
								animationDelay: `-${(index * 1.3).toFixed(1)}s`,
							};
							return (
								<g key={segment.pillar.id} clipPath={`url(#${columnClipId(index)})`} data-testid="heart-column">
									<g transform={`translate(0 ${surfaceY.toFixed(2)})`}>
										{/* Hintere Welle: gegenläufig und blasser — das erzeugt Tiefe im Wasser. */}
										<g className="heart-wave heart-wave--back" style={driftBack}>
											<path d={WAVE_PATH} className={waterClass(segment.colorIndex)} />
										</g>
										<g className="heart-wave" style={drift}>
											<path d={WAVE_PATH} className={waterClass(segment.colorIndex)} />
										</g>
									</g>
								</g>
							);
						})}

						{/* Trennfugen zwischen den Segmenten — in Kartenfarbe, damit sie als Fuge lesen. */}
						{balance.segments.slice(1).map((segment, index) => (
							<line
								key={segment.pillar.id}
								className="heart-seam"
								x1={(index + 1) * columnWidth}
								y1={0}
								x2={(index + 1) * columnWidth}
								y2={VIEW_HEIGHT}
							/>
						))}
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
			 * die Wassersäulen im Bild überhaupt zuordenbar macht.
			 */}
			<ul className="heart-balance-legend" data-testid="heart-balance-legend">
				{balance.segments.map((segment) => (
					<li key={segment.pillar.id} className="heart-balance-legend-row">
						<span className={`heart-legend-dot heart-legend-dot--${segment.colorIndex + 1}`} aria-hidden="true" />
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
