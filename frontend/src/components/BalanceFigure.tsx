import { useCallback, useMemo, useState } from 'react';
import { BalanceFigureGL } from './BalanceFigureGL';
import {
	activeTicks,
	buildArcs,
	buildOrbs,
	buildRays,
	CENTER,
	orbAxes,
	polar,
	ringTicks,
	targetRadius,
	tickLine,
	VIEW_SIZE,
	type Arc,
	type FigureMotion,
	type Ray,
	type RingTick,
} from '../lib/balanceFigure';
import { balanceMetrics } from '../lib/balanceMetric';
import type { BalanceModel } from '../lib/heartBalance';
import type { FigureKind } from '../lib/balanceVariant';
import { rampClass } from '../lib/pillarRamp';
import { supportsWebGl2 } from '../lib/webgl';

/**
 * Die **Figuren-Varianten** der Lebensbalance: Blasen, Scheiben, Ringe, Strahlen — außen herum
 * immer dasselbe Zifferblatt aus 100 Strichen.
 *
 * **Alle drei zeigen dieselben Zahlen.** Je Säule das Verhältnis Ist zu Soll (`balanceMetric.ts`),
 * ungedeckelt: 1 heißt „genau auf Ziel", 1,5 heißt „zieht davon". Die stärkste Säule bekommt
 * überall die größte Form — bei Blasen und Scheiben die unterste, bei den Ringen die äußerste Spur,
 * bei den Strahlen den längsten Strahl auf 12 Uhr. „Blasen" und „Scheiben" teilen sich Geometrie
 * und Bewegung und unterscheiden sich allein im Material: durchscheinende Haut gegen deckende
 * Fläche mit harter Kante. Eine gemeinsame Soll-Marke zeigt, wo „auf Ziel" läge.
 * *Außen* trägt das Zifferblatt die Gesamt-Balance: ein Strich je Prozentpunkt, dunkelrot bei 0
 * über orange bis dunkelgrün bei 100. Die Striche bis zum Wert leuchten, die übrigen bleiben
 * abgedunkelt stehen — die Skala ist immer ganz zu sehen, der Stand liest sich als Bogenlänge.
 *
 * **Warum die Formen schwingen:** Liegen alle Säulen gleich, sind alle Formen gleich groß. Ohne
 * Bewegung lägen die Blasen deckungsgleich übereinander und der Gleichstand zeigte eine einzige
 * Blase. Jede Form schwingt deshalb mit eigener Phase und eigener Periode (Rechnung und Begründung
 * in `lib/balanceFigure.ts`); ihre Ränder kreuzen sich fortwährend, jede Farbe wird immer wieder
 * sichtbar.
 *
 * **Zwei Fassungen desselben Bildauftrags:** Kann der Browser WebGL2, zeichnet `BalanceFigureGL`
 * die Figur in Neon-Glas (Shader `balance-figure.frag`) — Geometrie, Reihenfolge, Bewegung und
 * Zifferblatt identisch, das Material dazu (Fresnel-Saum, Irisierung, Glanzlicht, Neon-Schein,
 * Lichtpuls). Ohne WebGL (oder nach Kontextverlust ohne Wiederkehr) steht das SVG hier als
 * Rückfall — dasselbe Bild, nur ohne Leuchten.
 *
 * **Warum das SVG text-, theme- und zoomfähig bleibt:** Farbrollen als Custom Properties,
 * `role="img"` mit Label, scharf bei jeder Größe — und kein Render-Loop in JavaScript: Die
 * Bewegung läuft als SMIL-Animation, der Ring ist statisch.
 */
interface BalanceFigureProps {
	/** Das gerechnete Gesamtbild aus `buildHeartBalance`. */
	balance: BalanceModel;
	/** Welche der drei Figuren gezeichnet wird. */
	figure: FigureKind;
	/** Bewegung erlauben (beide Animationsschalter + OS-Einstellung). */
	animated: boolean;
	/** Sekunden je Ruhepuls-Schlag; ruhiger, je ausgewogener das Bild. */
	beatSeconds: number;
	/** Zugängliches Label der Grafik. */
	ariaLabel: string;
}

/**
 * Stützstellen der SMIL-Schwingung. 16 lineare Stützwerte nähern die Sinuskurve auf unter 0,3 %
 * des Radius an — bei einer Schwingung über sechs Sekunden ist davon nichts zu sehen, und es bleibt
 * bei einer Animation im Compositor statt einer Frame-Schleife in JavaScript.
 */
const SWING_SAMPLES = 16;

/** `rx`- bzw. `ry`-Stützwerte einer Blase über eine volle Periode, geschlossen (erster = letzter). */
const swingValues = (motion: FigureMotion, radius: number, axis: 'rx' | 'ry'): string =>
	Array.from({ length: SWING_SAMPLES + 1 }, (_, step) =>
		orbAxes(motion, radius, (step / SWING_SAMPLES) * motion.swingPeriod)[axis].toFixed(3),
	).join(';');

/** Grunddrehung einer Form in Grad — dieselbe Phase, die auch ihre Formschwingung anstößt. */
const baseRotation = (motion: FigureMotion): number => (motion.phase * 180) / Math.PI;

/**
 * Strichfarbe als `color-mix()` zwischen zwei Theme-Tokens. Bewusst nicht als fertiger Farbwert aus
 * JavaScript: So löst der Browser die Rampe selbst auf, und ein Theme-Wechsel färbt den Ring um,
 * ohne dass React etwas davon mitbekommen muss.
 */
const tickStroke = (tick: RingTick): string =>
	`color-mix(in srgb, var(--pp-balance-ring-${tick.stop}) ${((1 - tick.mix) * 100).toFixed(1)}%, var(--pp-balance-ring-${tick.stop + 25}))`;

/** Eine schwingende Ellipse samt ihrer SMIL-Animation. */
const SwingingEllipse = ({
	motion,
	radius,
	className,
	testId,
	animated,
}: {
	motion: FigureMotion;
	radius: number;
	className: string;
	testId?: string;
	animated: boolean;
}) => {
	const rotation = baseRotation(motion);
	const axes = orbAxes(motion, radius, 0);
	return (
		<ellipse
			className={className}
			data-testid={testId}
			cx={CENTER}
			cy={CENTER}
			rx={axes.rx.toFixed(3)}
			ry={axes.ry.toFixed(3)}
			transform={`rotate(${rotation.toFixed(2)} ${CENTER} ${CENTER})`}
		>
			{animated && (
				<>
					{/* Halbachsen gegenläufig: Die Blase atmet, statt zu wachsen. */}
					<animate
						attributeName="rx"
						values={swingValues(motion, radius, 'rx')}
						dur={`${motion.swingPeriod}s`}
						repeatCount="indefinite"
					/>
					<animate
						attributeName="ry"
						values={swingValues(motion, radius, 'ry')}
						dur={`${motion.swingPeriod}s`}
						repeatCount="indefinite"
					/>
					<animateTransform
						attributeName="transform"
						type="rotate"
						from={`${rotation.toFixed(2)} ${CENTER} ${CENTER}`}
						to={`${(rotation + 360 * motion.rotDirection).toFixed(2)} ${CENTER} ${CENTER}`}
						dur={`${motion.rotPeriod}s`}
						repeatCount="indefinite"
					/>
				</>
			)}
		</ellipse>
	);
};

/**
 * Ein Bogen als Kreis mit `stroke-dasharray`: Der erste Abschnitt ist die gefüllte Strecke, der
 * Rest bleibt Lücke. Bewusst kein `<path>` mit Bogenbefehl — der bräuchte eine Fallunterscheidung
 * für den Halbkreis (`large-arc-flag`) und könnte bei Anteil 1 nicht schließen.
 */
const arcDash = (arc: Arc, sweep: number): { dasharray: string; circumference: number } => {
	const circumference = 2 * Math.PI * arc.radius;
	return { dasharray: `${(circumference * sweep).toFixed(3)} ${circumference.toFixed(3)}`, circumference };
};

/** Die Spitze eines Strahls als Dreieck — innen die volle Öffnung, außen auf ein Drittel verjüngt. */
const rayPoints = (ray: Ray): string => {
	const tip = polar(ray.angle, ray.length);
	const left = polar(ray.angle - ray.spread, 0.5);
	const right = polar(ray.angle + ray.spread, 0.5);
	const tipLeft = polar(ray.angle - ray.spread * 0.34, ray.length);
	const tipRight = polar(ray.angle + ray.spread * 0.34, ray.length);
	return [left, tipLeft, tip, tipRight, right].map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
};

export const BalanceFigure = ({ balance, figure, animated, beatSeconds, ariaLabel }: BalanceFigureProps) => {
	const metrics = useMemo(() => balanceMetrics(balance), [balance]);
	const ticks = useMemo(() => ringTicks(balance.fill), [balance.fill]);
	const lit = activeTicks(balance.fill);

	/* Glas zuerst, SVG als Rückfall: WebGL fehlt oder fällt aus → bekanntes Bild. */
	const [glassBroken, setGlassBroken] = useState(false);
	const [glassSupported] = useState(supportsWebGl2);
	const giveUpGlass = useCallback((): void => setGlassBroken(true), []);

	if (glassSupported && !glassBroken) {
		return (
			<BalanceFigureGL
				figure={figure}
				metrics={metrics}
				activeTicks={lit}
				beatSeconds={beatSeconds}
				animated={animated}
				ariaLabel={ariaLabel}
				onGiveUp={giveUpGlass}
			/>
		);
	}

	return (
		<svg
			className="balance-figure-svg"
			viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
			role="img"
			aria-label={ariaLabel}
			data-testid="heart-balance-svg"
		>
			{/*
			 * Zifferblatt: statisch, ohne jede Animation — es ist die Skala und darf nicht wackeln.
			 * Die Farbe mischt der Browser aus den Theme-Tokens (siehe `tickStroke`).
			 */}
			<g className="balance-ring" data-testid="balance-ring">
				{ticks.map((tick) => {
					const line = tickLine(tick);
					return (
						<line
							key={tick.index}
							className={tick.active ? 'balance-tick balance-tick--on' : 'balance-tick'}
							data-testid="balance-tick"
							x1={line.x1.toFixed(3)}
							y1={line.y1.toFixed(3)}
							x2={line.x2.toFixed(3)}
							y2={line.y2.toFixed(3)}
							strokeWidth={tick.major ? 1.8 : 1.1}
							style={{ stroke: tickStroke(tick) }}
						/>
					);
				})}
			</g>

			{/*
			 * Zwei Gruppen übereinander, weil zwei Bewegungen auf demselben `transform` sonst
			 * einander überschreiben: außen der einmalige Auftakt (die Figur wächst auf ihren
			 * Stand), innen der Ruhepuls als Dauerschleife.
			 */}
			<g className="balance-figure-rise">
				<g className="balance-figure-beat">
					{(figure === 'blasen' || figure === 'scheiben') && (
						<Orbs metrics={metrics} animated={animated} sharp={figure === 'scheiben'} />
					)}
					{figure === 'ringe' && <Arcs metrics={metrics} animated={animated} />}
					{figure === 'strahlen' && <Rays metrics={metrics} animated={animated} />}
				</g>
			</g>
		</svg>
	);
};

/**
 * Figuren „Blasen" und „Scheiben": derselbe Stapel, stärkste Ellipse hinten, dazu der gemeinsame
 * Soll-Kreis. `sharp` entscheidet allein über das Material — halbtransparente Haut oder deckende
 * Fläche mit harter Kante (Klassen in `app.css`).
 */
const Orbs = ({
	metrics,
	animated,
	sharp,
}: {
	metrics: ReturnType<typeof balanceMetrics>;
	animated: boolean;
	sharp: boolean;
}) => {
	const orbs = buildOrbs(metrics);
	const target = targetRadius(metrics);
	return (
		<>
			{/* Soll-Kreis: Blase innerhalb heißt „kommt zu kurz", außerhalb „zieht davon". */}
			<circle className="balance-target" data-testid="balance-target" cx={CENTER} cy={CENTER} r={target.toFixed(2)} />
			{orbs.map((orb) => (
				<SwingingEllipse
					key={orb.pillarId}
					motion={orb}
					radius={orb.radius}
					className={rampClass(sharp ? 'balance-disc' : 'balance-orb', orb.colorIndex)}
					testId="heart-column"
					animated={animated}
				/>
			))}
		</>
	);
};

/** Figur „Ringe": je Säule eine Spur, Bogenlänge und Lage tragen beide den Wert. */
const Arcs = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => (
	<>
		{buildArcs(metrics).map((arc) => {
			const { dasharray, circumference } = arcDash(arc, arc.sweep);
			const inner = polar(-90 + arc.target * 360, arc.radius - arc.width / 2);
			const outer = polar(-90 + arc.target * 360, arc.radius + arc.width / 2);
			return (
				<g key={arc.pillarId} data-testid="heart-column">
					{/* Unausgefüllte Spur bleibt blass stehen — sie zeigt, wie weit es noch wäre. */}
					<circle
						className={rampClass('balance-arc-track', arc.colorIndex)}
						cx={CENTER}
						cy={CENTER}
						r={arc.radius.toFixed(3)}
						strokeWidth={arc.width.toFixed(3)}
					/>
					{/*
					 * Gefüllter Bogen: gedreht auf 12 Uhr, damit die Strecke dort beginnt, wo auch das
					 * Zifferblatt beginnt. Der Strich atmet in der Stärke, die Spur bleibt liegen.
					 */}
					<circle
						className={rampClass('balance-arc', arc.colorIndex)}
						cx={CENTER}
						cy={CENTER}
						r={arc.radius.toFixed(3)}
						strokeWidth={arc.width.toFixed(3)}
						strokeDasharray={dasharray}
						transform={`rotate(-90 ${CENTER} ${CENTER})`}
					>
						{animated && (
							<animate
								attributeName="stroke-width"
								values={`${arc.width.toFixed(3)};${(arc.width * 1.12).toFixed(3)};${arc.width.toFixed(3)}`}
								dur={`${arc.swingPeriod}s`}
								repeatCount="indefinite"
							/>
						)}
						<title>{`${(circumference * arc.sweep).toFixed(0)} von ${circumference.toFixed(0)}`}</title>
					</circle>
					{/* Soll-Marke: ein Strich quer über die Spur. */}
					<line
						className="balance-target-mark"
						data-testid="balance-target"
						x1={inner.x.toFixed(2)}
						y1={inner.y.toFixed(2)}
						x2={outer.x.toFixed(2)}
						y2={outer.y.toFixed(2)}
					/>
				</g>
			);
		})}
	</>
);

/** Figur „Strahlen": je Säule ein Lichtkeil vom Mittelpunkt, längster auf 12 Uhr. */
const Rays = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => {
	const rays = buildRays(metrics);
	return (
		<>
			{/* Soll-Kreis quer über alle Strahlen — dieselbe Marke wie bei den Blasen. */}
			{rays.length > 0 && (
				<circle
					className="balance-target"
					data-testid="balance-target"
					cx={CENTER}
					cy={CENTER}
					r={rays[0].targetLength.toFixed(2)}
				/>
			)}
			{rays.map((ray) => (
				<polygon
					key={ray.pillarId}
					className={rampClass('balance-ray', ray.colorIndex)}
					data-testid="heart-column"
					points={rayPoints(ray)}
				>
					{animated && (
						<animate
							attributeName="opacity"
							values="0.78;1;0.78"
							dur={`${ray.swingPeriod}s`}
							repeatCount="indefinite"
						/>
					)}
				</polygon>
			))}
		</>
	);
};
