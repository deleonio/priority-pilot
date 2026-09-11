import type { Pillar } from 'client';
import { useCallback, useId, useMemo, useState, type CSSProperties } from 'react';
import { VesselGlass } from './VesselGlass';
import { buildVesselBalance, vesselHealth } from '../lib/vesselBalance';
import { bandEdges, SCALE_TICKS, VESSEL_BOTTOM, VESSEL_PATH, VESSEL_TOP, waterlineY } from '../lib/vesselGeometry';
import { useAnimationsEnabled } from '../lib/animations';
import { useVesselAnimationEnabled } from '../lib/vesselAnimation';
import { usePrefersReducedMotion } from '../lib/reducedMotion';

/**
 * Das Balance-Gefäß der Startseite: ein vektorieller Messkolben (SVG), der sich wie ein
 * Füllstandsglas füllt. Der Füllstand steigt von unten nach oben, je ausgewogener — je
 * balancierter — die Lebenssäulen sind (Rechnung in `lib/vesselBalance.ts`); die Oberfläche ist
 * eine durchlaufende Welle, die Skalenstriche an den Wänden tragen die Höhen-Ablese.
 *
 * **Das Bild sagt zwei Dinge gleichzeitig:** Die *Höhe* der gemeinsamen Wasserlinie trägt die
 * Gesamt-Balance, die *Fläche* der Farbstreifen unter der Oberfläche die Verteilung — jeder
 * Streifen deckt genau den Anteil der Wasserfläche ab, den seine Säule am Punkte-Saldo hält
 * (`lib/vesselGeometry.ts`). Ein kleines Band neben einem großen ist damit auch ohne Zahl eine
 * Schieflage.
 *
 * **Warum eine gemeinsame Wasserlinie:** „Wie voll ist das Gefäß" ist eine einzige Zahl — also
 * gibt es im Bild auch nur eine Wasserlinie. Sie steigt einmalig von unten auf ihren Stand und
 * wellt danach über die volle Kolbenbreite.
 *
 * **Zwei Fassungen desselben Bildauftrags:** Kann der Browser WebGL2, zeichnet `VesselGlass` das
 * Gefäß als Glas-Messkolben (Shader `vessel-glass.frag`) — Kontur, Füllstand, Streifen, Welle und
 * Aufstieg identisch, das Material dazu (Fresnel-Saum, Glanzlichter, Meniskus, Brechung). Ohne
 * WebGL (oder nach Kontextverlust ohne Wiederkehr) steht das SVG hier als Rückfall — dasselbe
 * Bild, nur ohne Glas.
 *
 * **Warum das SVG text-, theme- und zoomfähig bleibt:** Farbrollen als Custom Properties,
 * `role="img"` mit Label, scharf bei jeder Größe — und kein Render-Loop in JavaScript: Die Welle
 * läuft als SMIL/CSS-Animation im Compositor. Die WebGL-Fassung hält dieselben Eigenschaften über
 * Uniforms aus denselben CSS-Rollen und stoppt ihre Loop, wenn nichts zu tun ist (Details in
 * `VesselGlass.tsx`).
 *
 * Rechnung, Randfälle und das Balance-Maß stehen in `lib/vesselBalance.ts`.
 */
interface VesselBalanceProps {
	/** Die Lebenssäulen — je Säule ein Segment, in Anzeigereihenfolge. */
	pillars: Pillar[];
	/** Punktestand je Säule (`pillarId → Punkte`), dieselbe Quelle wie „Gesamtguthaben". */
	punkteProSaeule: ReadonlyMap<number, number>;
}

/* Zeichenfläche in Nutzereinheiten; die Anzeigegröße bestimmt allein das CSS (`width: 100%`). */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 92;

/**
 * Wellenlänge und Auslenkung der Oberfläche in Nutzereinheiten. Die Auslenkung ist bewusst zart
 * (Wasserlinie soll leben, nicht branden) und gilt gemeinsam für SVG- und Glas-Fassung — beide
 * zeigen dasselbe Bild. Die Wellenlänge ist bewusst kürzer als ein Segment breit ist (bei fünf
 * Säulen 20 Einheiten): Sieht man weniger als eine volle Welle, liest die Oberfläche als schiefe
 * Kante statt als Wasser.
 */
const WAVE_LENGTH = 16;
const WAVE_AMPLITUDE = 1.3;

/**
 * Baut eine Wellenfläche, die über die Zeichenfläche hinaussteht: Die CSS-Animation verschiebt sie
 * um genau **eine** Wellenlänge, wodurch die Kachelung nahtlos in sich zurückläuft.
 *
 * Die Fläche beginnt eine Wellenlänge vor der Zeichenfläche und reicht eine über sie hinaus — die
 * sichtbaren 0–100 bleiben damit über die ganze Verschiebung gedeckt. Nach unten schließt sie weit
 * unter dem Gefäßboden; geclippt wird ohnehin an der Kolbenkontur.
 */
const buildWavePath = (amplitude: number): string => {
	const halfWave = WAVE_LENGTH / 2;
	const start = -WAVE_LENGTH * 2;
	// Auf eine gerade Anzahl Halbwellen aufrunden, damit die Kachel auf einer vollen Periode endet.
	const needed = Math.ceil((VIEW_WIDTH + WAVE_LENGTH - start) / halfWave);
	const halfWaves = needed + (needed % 2);
	// Erste Halbwelle als `q`, alle weiteren als `t` — das spiegelt den Kontrollpunkt automatisch
	// und erzeugt so eine stetige Sinus-Näherung ohne Knick an den Nahtstellen.
	const crests = [
		`q ${halfWave / 2} ${-amplitude} ${halfWave} 0`,
		...Array.from({ length: halfWaves - 1 }, () => `t ${halfWave} 0`),
	];
	const end = start + halfWaves * halfWave;
	const floor = VIEW_HEIGHT * 2;
	return `M ${start} 0 ${crests.join(' ')} L ${end} ${floor} L ${start} ${floor} Z`;
};

const WAVE_PATH = buildWavePath(WAVE_AMPLITUDE);

/**
 * Die zwei Tiefenschichten unter der Wasserlinie — Parameter exakt wie die `STRATUM`-Aufrufe im
 * Glas-Shader (gleiche Wellenlänge, ampScale 1,35/1,7, drop 3,4/6,8), damit beide Fassungen
 * dasselbe Bild zeigen. Die Geschwindigkeiten (14 s / 23 s) sind bewusst deutlich langsamer als
 * die Oberfläche (7 s). Die Abdunkelung liegt stärker als im Glas (dark 0,82/0,70 × strength
 * 0,45 ≈ 8 %), damit die Schichten auch ohne Glasmaterial lesbar bleiben.
 */
const DEPTH_WAVE_LAYERS = [
	{
		duration: '14s',
		drop: 3.4,
		opacity: 0.16,
		path: buildWavePath(WAVE_AMPLITUDE * 1.35),
	},
	{
		duration: '23s',
		drop: 6.8,
		opacity: 0.22,
		path: buildWavePath(WAVE_AMPLITUDE * 1.7),
	},
];

/** Höchster in `app.css` definierter Rang der Säulen-Rampe (`--pp-pillar-1…7`). */
const PILLAR_RAMP_SIZE = 7;

/**
 * Farbklassen aus der Säulen-Rampe — einmal für den Farbstreifen im Bild (`vessel-water`), einmal
 * für den Tupfer in der Legende (`vessel-legend-dot`). Ab der 8. Säule wird nicht weiter eingefärbt
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
 * Es gibt **eine** Wasseroberfläche — sie allein trägt die Füllstands-Aussage. Darunter liegen
 * seit 2026-09-06 (Nutzer-Auftrag „drei Wellen, unterschiedliche Geschwindigkeit“) zwei Tiefen-
 * schichten als Abdunkelung, dieselben drei Schichten wie im Glas-Shader (`STRATUM`). Ihre Drops
 * (3,4 / 6,8) halten jede Schicht im Wellental der vorherigen — nichts schaut als blasser Bogen
 * über die Farbkante (der Fehler, der die erste Tiefenwelle einst entfernt hat). Die
 * Geschwindigkeiten liegen bewusst weit auseinander (7 s / 14 s / 23 s), damit die drei
 * Schichten als eigenständige Bewegungen lesbar sind. Gerendert wird das `<animateTransform>`
 * nur bei erlaubter Animation (`animated`); sonst stehen die Wellen still in ihrer Grundform —
 * SMIL lässt sich nicht per CSS abschalten.
 */
const WAVE_DRIFT_DURATION = '7s';

/** Ganze Prozent für die Anzeige (die Rechnung selbst bleibt ungerundet). */
const asPercent = (share: number): number => Math.round(share * 100);

/** Ein Farbstreifen unter der Wasserlinie: eine Säule mit ihrer horizontalen Spanne über der Gefäßbreite. */
interface VesselBand {
	pillarId: number;
	colorIndex: number;
	/** Linke und rechte Kante des Streifens in Nutzereinheiten. */
	x0: number;
	x1: number;
}

/**
 * WebGL2 einmalig anfragen (jsdom-sicher): Ohne Kontext rendert die Bühne das SVG — dasselbe
 * Bild, nur ohne Glas. `WebGL2RenderingContext` wird zuerst geprüft, damit Umgebungen ohne WebGL
 * (Tests) gar nicht erst `getContext` anfassen müssen.
 */
const supportsGlassVessel = (): boolean => {
	try {
		return typeof WebGL2RenderingContext !== 'undefined' && !!document.createElement('canvas').getContext('webgl2');
	} catch {
		return false;
	}
};

export const VesselBalance = ({ pillars, punkteProSaeule }: VesselBalanceProps) => {
	const balance = useMemo(() => buildVesselBalance(pillars, punkteProSaeule), [pillars, punkteProSaeule]);
	const health = vesselHealth(balance);

	/*
	 * Das Gefäß atmet und wellt nur, wenn beide Schalter es erlauben: der Master „Animationen“
	 * (#1183) und der Feinschalter „Lebensbalance animieren“. Die OS-Einstellung „Bewegung
	 * reduzieren“ hat Vorrang und schaltet hier mit ab — die Wellen-Drift ist SMIL und lässt sich
	 * nicht per CSS-Media-Query ausnehmen (Atmen und Aufstieg bleiben trotzdem im CSS abgesichert).
	 */
	const { enabled: animationsEnabled } = useAnimationsEnabled();
	const { enabled: vesselAnimationEnabled } = useVesselAnimationEnabled();
	const prefersReducedMotion = usePrefersReducedMotion();
	const animated = animationsEnabled && vesselAnimationEnabled && !prefersReducedMotion;

	/*
	 * Horizontale Spannen der Farbstreifen: Jeder Streifen deckt genau den Anteil der **gefüllten
	 * Wasserfläche** ab, den seine Säule am Punkte-Saldo hält (#1302). Die Kanten kommen deshalb aus
	 * der kumulierten Fläche (`bandEdges` in `lib/vesselGeometry.ts`) und nicht aus der Breite —
	 * weil die Kontur an Lippe und Bodenecken über die Wandbreite hinausreicht bzw. einrundet,
	 * trüge sonst dieselbe Breite je nach Position unterschiedlich viel Wasser. Die Kanten hängen
	 * damit auch vom Füllstand ab. Ohne Punkte gilt die Soll-Verteilung, damit das leere Gefäß
	 * schon die Zielaufteilung zeigt. Dieselben Kanten liest der Glas-Shader (`toSlotBands`) — so
	 * zeigen SVG und Glas dasselbe Bild.
	 */
	const bands = useMemo<VesselBand[]>(() => {
		const shares = balance.segments.map((segment) => (balance.hasPoints ? segment.actualShare : segment.targetShare));
		const edges = bandEdges(shares, balance.fill);
		return balance.segments.map((segment, index) => ({
			pillarId: segment.pillar.id,
			colorIndex: segment.colorIndex,
			x0: edges[index],
			x1: edges[index + 1],
		}));
	}, [balance]);

	// Eindeutige, aber stabile Präfixe für die SVG-Fragment-Referenzen: mehrere Gefäße auf einer
	// Seite dürfen sich nicht gegenseitig die `clipPath`-IDs überschreiben. Doppelpunkte aus
	// `useId()` fallen raus, damit die IDs auch für `querySelector` benutzbar bleiben.
	const uid = useId().replace(/:/g, '');
	const vesselClipId = `${uid}-vessel`;
	const bandClipId = (index: number): string => `${uid}-band-${index}`;

	const fillPercent = asPercent(balance.fill);
	const ariaLabel = `Füllstand ${fillPercent} Prozent — ${health.label}`;

	/* Glas zuerst, SVG als Rückfall: WebGL fehlt oder fällt aus → bekanntes Bild. */
	const [glassBroken, setGlassBroken] = useState(false);
	const [glassSupported] = useState(supportsGlassVessel);
	const renderGlass = glassSupported && !glassBroken;
	const giveUpGlass = useCallback((): void => setGlassBroken(true), []);

	/*
	 * Atem: Je ausgewogener das Gefäß, desto langsamer und ruhiger atmet es (4,5 s leer bis 6 s
	 * voll) — kein Herzschlag mehr, nur ein subtiler Lebens-Hinweis. Der Wert geht als Custom
	 * Property ins CSS, damit die Animation dort bleibt, wo Bewegung hingehört — und
	 * `prefers-reduced-motion` sie an einer Stelle abschalten kann.
	 */
	const breathSeconds = (4.5 + balance.fill * 1.5).toFixed(2);

	return (
		<div className="vessel-balance">
			{/*
			 * Zwei Werte, die die CSS-Animationen der Grafik vorgeben: der Atem und der Aufstiegsweg.
			 * Die Wellen-Drift selbst läuft per SMIL (s. unten) und braucht hier keinen Versatz mehr.
			 */}
			<div
				className={animated ? 'vessel-balance-stage' : 'vessel-balance-stage vessel-balance-stage--still'}
				style={
					{
						'--pp-vessel-breath': `${breathSeconds}s`,
						// Weg, den das Wasser beim Aufstieg zurücklegt: die volle Gefäßhöhe. Die Animation
						// (`vessel-water-rise` in app.css) startet mit der Oberfläche am Boden und endet hier.
						'--pp-vessel-rise': `${VESSEL_BOTTOM - VESSEL_TOP}px`,
					} as CSSProperties
				}
			>
				{renderGlass ? (
					<VesselGlass
						fill={balance.fill}
						bands={bands}
						animated={animated}
						ariaLabel={ariaLabel}
						onGiveUp={giveUpGlass}
					/>
				) : (
					<svg
						className="vessel-balance-svg"
						viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
						role="img"
						aria-label={ariaLabel}
						data-testid="vessel-balance-svg"
					>
						<defs>
							<clipPath id={vesselClipId}>
								<path d={VESSEL_PATH} />
							</clipPath>
							{bands.map((band, index) => (
								<clipPath key={band.pillarId} id={bandClipId(index)}>
									<rect x={band.x0} y={0} width={band.x1 - band.x0} height={VIEW_HEIGHT} />
								</clipPath>
							))}
						</defs>

						{/* Leeres Gefäß — die eingesenkte Fläche macht sichtbar, wie viel noch fehlt. */}
						<path d={VESSEL_PATH} className="vessel-empty" />

						<g clipPath={`url(#${vesselClipId})`}>
							{/*
							 * Das Wasser steigt einmalig von unten auf seinen Stand (CSS, Compositor) und wellt
							 * danach dauerhaft weiter. Eine Oberfläche fürs ganze Gefäß — Details zur Phasen-
							 * und Clip-Struktur bei den Drift-Konstanten oben.
							 */}
							<g className="vessel-water-rise">
								<g transform={`translate(0 ${waterlineY(balance.fill).toFixed(2)})`}>
									{bands.map((band, index) => (
										<g key={band.pillarId} clipPath={`url(#${bandClipId(index)})`} data-testid="vessel-column">
											<g className="vessel-wave">
												<path d={WAVE_PATH} className={rampClass('vessel-water', band.colorIndex)} />
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
									{/* Tiefenwellen: dieselben drei Schichten wie im Glas-Shader (STRATUM) — mit 14 s / 23 s
								   bewusst langsamer als die Oberfläche (7 s) und nie über die Wasserlinie steigend. */}
									{DEPTH_WAVE_LAYERS.map((layer) => (
										<g key={layer.duration} transform={`translate(0 ${layer.drop})`}>
											<g className="vessel-depth">
												<path d={layer.path} opacity={layer.opacity} />
												{animated && (
													<animateTransform
														attributeName="transform"
														type="translate"
														from="0 0"
														to={`${-WAVE_LENGTH} 0`}
														dur={layer.duration}
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
												className="vessel-seam"
												x1={band.x0}
												y1={0}
												x2={band.x0}
												y2={VIEW_HEIGHT}
											/>
										),
								)}

							{/*
							 * Skala: Striche knapp innerhalb beider Wände bei 25/50/75 % der Gefäßhöhe — die
							 * Wasserlinie liest den Füllstand direkt an ihnen ab. Über dem Wasser gezeichnet,
							 * damit sie auch gefüllt ablesbar bleiben.
							 */}
							{SCALE_TICKS.map((tick, index) => (
								<line key={`tick-${index}`} className="vessel-tick" x1={tick.x1} y1={tick.y} x2={tick.x2} y2={tick.y} />
							))}
						</g>

						{/* Kontur zuletzt, damit sie über dem Wasser liegt und die Silhouette scharf bleibt. */}
						<path d={VESSEL_PATH} className="vessel-outline" />
					</svg>
				)}
			</div>

			<p className="vessel-balance-readout">
				<span className="vessel-balance-value" data-testid="vessel-balance-value">
					{fillPercent} %
				</span>
				<span className="vessel-balance-state" data-state={health.state}>
					{health.label}
				</span>
				<span className="vessel-balance-hint">{health.hint}</span>
			</p>

			{/*
			 * Relief-Regel (ux-design.md §2, Regel 4): Der Säulenname steht immer als Text neben der
			 * Farbe — die Farbe allein trägt hier keine Bedeutung. Zugleich ist das die Legende, die
			 * die Farbstreifen im Bild überhaupt zuordenbar macht.
			 */}
			<ul className="vessel-balance-legend" data-testid="vessel-balance-legend">
				{balance.segments.map((segment) => (
					<li key={segment.pillar.id} className="vessel-balance-legend-row" data-testid="vessel-balance-legend-row">
						<span className={rampClass('vessel-legend-dot', segment.colorIndex)} aria-hidden="true" />
						<span className="vessel-balance-legend-name">{segment.pillar.name}</span>
						<span className="vessel-balance-legend-value">
							{asPercent(segment.actualShare)} % · Ziel {asPercent(segment.targetShare)} %
						</span>
					</li>
				))}
			</ul>
		</div>
	);
};
