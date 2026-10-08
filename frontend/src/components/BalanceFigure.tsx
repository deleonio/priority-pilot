import { useCallback, useMemo, useState } from 'react';
import { BalanceFigureGL } from './BalanceFigureGL';
import {
	activeTicks,
	buildHands,
	buildPetals,
	buildRays,
	CENTER,
	petalArcPoints,
	polar,
	ringTicks,
	targetRadius,
	tickLine,
	VIEW_SIZE,
	type Hand,
	type Petal,
	type Ray,
	type RingTick,
} from '../lib/balanceFigure';
import { balanceMetrics } from '../lib/balanceMetric';
import type { BalanceModel } from '../lib/heartBalance';
import type { BalanceVariant } from '../lib/balanceVariant';
import { PILLAR_RAMP_SIZE, rampClass } from '../lib/pillarRamp';
import { supportsWebGl2 } from '../lib/webgl';

/**
 * Die **Figuren-Varianten** der Lebensbalance: Strahlen, Blüte, Kristall, Zeiger — außen herum
 * immer dasselbe Zifferblatt aus 100 Strichen.
 *
 * **Alle zeigen dieselben Zahlen.** Je Säule das Verhältnis Ist zu Soll (`balanceMetric.ts`),
 * ungedeckelt: 1 heißt „genau auf Ziel", 1,5 heißt „zieht davon". Die stärkste Säule bekommt
 * überall die größte Form auf 12 Uhr — den längsten Strahl, den weitesten Lappen, den längsten
 * Zeiger. „Blüte" und „Kristall" teilen sich die Stützpunkte: Alle Säulen bilden **eine**
 * Silhouette, deren Lappen je Säule so weit reichen wie ihr Wert — weich verbunden bei der Blüte,
 * mit harten Kanten und Knoten beim Kristall. Eine gemeinsame Soll-Marke zeigt, wo „auf Ziel" läge.
 * *Außen* trägt das Zifferblatt die Gesamt-Balance: ein Strich je Prozentpunkt, dunkelrot bei 0
 * über orange bis dunkelgrün bei 100. Die Striche bis zum Wert leuchten, die übrigen bleiben
 * abgedunkelt stehen — die Skala ist immer ganz zu sehen, der Stand liest sich als Bogenlänge.
 *
 * **Warum die Formen sich bewegen:** Jede Säule atmet mit eigener Phase und eigener Periode
 * (Rechnung und Begründung in `lib/balanceFigure.ts`) — im Gleichstand bleibt so jede Farbe
 * unterscheidbar.
 *
 * **Zwei Fassungen desselben Bildauftrags:** Kann der Browser WebGL2, zeichnet `BalanceFigureGL`
 * die Figur in Neon-Glas (Shader `balance-figure.frag`) — Geometrie, Reihenfolge, Bewegung und
 * Zifferblatt identisch, das Material dazu (Saum, Glanz, Neon-Schein, Lichtpuls). Ohne WebGL (oder
 * nach Kontextverlust ohne Wiederkehr) steht das SVG hier als Rückfall — dasselbe Bild, nur ohne
 * Leuchten.
 *
 * **Warum das SVG text-, theme- und zoomfähig bleibt:** Farbrollen als Custom Properties,
 * `role="img"` mit Label, scharf bei jeder Größe — und kein Render-Loop in JavaScript: Die
 * Bewegung läuft als SMIL-Animation, der Ring ist statisch.
 */
interface BalanceFigureProps {
	/** Das gerechnete Gesamtbild aus `buildHeartBalance`. */
	balance: BalanceModel;
	/** Welche Figur gezeichnet wird. */
	figure: BalanceVariant;
	/** Bewegung erlauben (beide Animationsschalter + OS-Einstellung). */
	animated: boolean;
	/** Sekunden je Ruhepuls-Schlag; ruhiger, je ausgewogener das Bild. */
	beatSeconds: number;
	/** Zugängliches Label der Grafik. */
	ariaLabel: string;
}

/**
 * Strichfarbe als `color-mix()` zwischen zwei Theme-Tokens. Bewusst nicht als fertiger Farbwert aus
 * JavaScript: So löst der Browser die Rampe selbst auf, und ein Theme-Wechsel färbt den Ring um,
 * ohne dass React etwas davon mitbekommen muss.
 */
const tickStroke = (tick: RingTick): string =>
	`color-mix(in srgb, var(--pp-balance-ring-${tick.stop}) ${((1 - tick.mix) * 100).toFixed(1)}%, var(--pp-balance-ring-${tick.stop + 25}))`;

/** Die Spitze eines Strahls als Dreieck — innen die volle Öffnung, außen auf ein Drittel verjüngt. */
const rayPoints = (ray: Ray): string => {
	const tip = polar(ray.angle, ray.length);
	const left = polar(ray.angle - ray.spread, 0.5);
	const right = polar(ray.angle + ray.spread, 0.5);
	const tipLeft = polar(ray.angle - ray.spread * 0.34, ray.length);
	const tipRight = polar(ray.angle + ray.spread * 0.34, ray.length);
	return [left, tipLeft, tip, tipRight, right].map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
};

/**
 * Der Umriss eines Zeigers: innen schmal, außen spitz zulaufend wie der Zeiger einer Uhr —
 * quer zur Skala, statt sie wie ein Keil zu überdecken.
 */
const handPoints = (hand: Hand): string => {
	const tip = polar(hand.angle, hand.length);
	const left = polar(hand.angle - hand.spread * 0.34, 1);
	const right = polar(hand.angle + hand.spread * 0.34, 1);
	const tipLeft = polar(hand.angle - hand.spread * 0.12, hand.length);
	const tipRight = polar(hand.angle + hand.spread * 0.12, hand.length);
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
					{figure === 'strahlen' && <Rays metrics={metrics} animated={animated} />}
					{figure === 'bluete' && <Petals metrics={metrics} animated={animated} />}
					{figure === 'kristall' && <Crystal metrics={metrics} animated={animated} />}
					{figure === 'zeiger' && <Hands metrics={metrics} animated={animated} />}
				</g>
			</g>
		</svg>
	);
};

/** Figur „Strahlen": je Säule ein Lichtkeil vom Mittelpunkt, längster auf 12 Uhr. */
const Rays = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => {
	const rays = buildRays(metrics);
	return (
		<>
			{/* Soll-Kreis quer über alle Strahlen — dieselbe Marke wie bei Blüte, Kristall und Zeigern. */}
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

/** Pfadangabe aus Stützpunkten — offen (`close` falsch) für Lappenränder, geschlossen für die Kontur. */
const toPath = (points: { x: number; y: number }[], close: boolean): string =>
	`M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')}${close ? ' Z' : ''}`;

/** Spottpreis eines Farbrangs als Token-Referenz; jenseits der Rampe die Neutralfarbe. */
const neonVar = (colorIndex: number): string =>
	colorIndex < PILLAR_RAMP_SIZE ? `var(--pp-pillar-neon-${colorIndex + 1})` : 'var(--pp-border-strong)';

/** Mischfarbe zweier Farbränge als Inline-`color-mix()` aus den Tokens (Muster `tickStroke`). */
const mixVars = (a: number, b: number, dilution: number): string =>
	`color-mix(in srgb, color-mix(in srgb, ${neonVar(a)} 50%, ${neonVar(b)} 50%) ${dilution}%, var(--pp-surface-1))`;

/** Der Lichtpunkt auf einer Lappenspitze — pulsiert im Takt der Säule, still ohne Animation. */
const TipNode = ({ petal, radius, animated }: { petal: Petal; radius: number; animated: boolean }) => {
	const position = polar(petal.angle, petal.radius);
	return (
		<circle
			className={rampClass('balance-node', petal.colorIndex)}
			cx={position.x.toFixed(2)}
			cy={position.y.toFixed(2)}
			r={radius.toFixed(2)}
		>
			{animated && (
				<animate
					attributeName="r"
					values={`${(radius * 0.72).toFixed(2)};${(radius * 1.28).toFixed(2)};${(radius * 0.72).toFixed(2)}`}
					dur={`${petal.swingPeriod}s`}
					repeatCount="indefinite"
				/>
			)}
		</circle>
	);
};

/**
 * Figur „Blüte": alle Säulen als **eine** weiche Silhouette. Der Körper bleibt neutral und leicht,
 * die Farbe tragen die Lappenränder — jeder in der Neon-Farbe seiner Säule, vom Tal zur Nachbar-
 * Säule hin. Die Soll-Marke ist der gestrichelte Kreis wie bei den Strahlen.
 */
const Petals = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => {
	const petals = buildPetals(metrics);
	const lobes = petals.map((_, index) => petalArcPoints(petals, index, true));
	return (
		<>
			{petals.length > 0 && (
				<>
					<circle
						className="balance-target"
						data-testid="balance-target"
						cx={CENTER}
						cy={CENTER}
						r={targetRadius(metrics).toFixed(2)}
					/>
					{/* Körper der Blüte: die geschlossene Kontur, leicht und neutral gefüllt. */}
					<path className="balance-petal-mass" d={toPath(lobes.flat(), true)} />
				</>
			)}
			{petals.map((petal, index) => (
				<g key={petal.pillarId} data-testid="heart-column">
					<path className={rampClass('balance-petal', petal.colorIndex)} d={toPath(lobes[index], false)}>
						{animated && (
							<animate
								attributeName="opacity"
								values="0.74;1;0.74"
								dur={`${petal.swingPeriod}s`}
								repeatCount="indefinite"
							/>
						)}
					</path>
					<TipNode petal={petal} radius={1.3} animated={animated} />
				</g>
			))}
		</>
	);
};

/**
 * Figur „Kristall": dieselben Stützpunkte wie die Blüte, aber kantig — Fächerflächen aus der Mitte,
 * geradlinige Kanten und helle Knoten auf den Spitzen. Die Facette gehört der Säule, an deren Winkel
 * sie beginnt; ihre Farbe mischt deren Neon mit der des Nachbar-Stützpunkts, denn die Kante gehört
 * beiden. Bei einer einzigen Säule ist die Silhouette ein Kreis — Umriss und Knoten genügen.
 */
const Crystal = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => {
	const petals = buildPetals(metrics);
	return (
		<>
			{petals.length > 0 && (
				<circle
					className="balance-target"
					data-testid="balance-target"
					cx={CENTER}
					cy={CENTER}
					r={targetRadius(metrics).toFixed(2)}
				/>
			)}
			{petals.length === 1 && (
				<circle
					className={rampClass('balance-petal', petals[0].colorIndex)}
					data-testid="heart-column"
					cx={CENTER}
					cy={CENTER}
					r={petals[0].radius.toFixed(2)}
				/>
			)}
			{petals.map((petal, index) => {
				if (petals.length < 2) return null;
				const next = petals[(index + 1) % petals.length];
				const from = polar(petal.angle, petal.radius);
				const to = polar(next.angle, next.radius);
				return (
					<g key={petal.pillarId} data-testid="heart-column">
						<polygon
							className="balance-facet"
							style={{ fill: mixVars(petal.colorIndex, next.colorIndex, 62) }}
							points={`${CENTER},${CENTER} ${from.x.toFixed(2)},${from.y.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`}
						>
							{animated && (
								<animate
									attributeName="opacity"
									values="0.78;1;0.78"
									dur={`${petal.swingPeriod}s`}
									repeatCount="indefinite"
								/>
							)}
						</polygon>
						<line
							className="balance-facet-edge"
							style={{ stroke: mixVars(petal.colorIndex, next.colorIndex, 85) }}
							x1={from.x.toFixed(2)}
							y1={from.y.toFixed(2)}
							x2={to.x.toFixed(2)}
							y2={to.y.toFixed(2)}
						/>
						<TipNode petal={petal} radius={1.7} animated={animated} />
					</g>
				);
			})}
			{petals.length === 1 && <TipNode petal={petals[0]} radius={1.7} animated={animated} />}
		</>
	);
};

/**
 * Figur „Zeiger“: je Säule ein Zeiger auf dem gemeinsamen Zifferblatt, gleichmäßig über den
 * Kreis verteilt wie die Strahlen, aber schlanker — der längste steht auf 12 Uhr. Die Soll-
 * Marke ist der gestrichelte Kreis wie bei den Strahlen.
 */
const Hands = ({ metrics, animated }: { metrics: ReturnType<typeof balanceMetrics>; animated: boolean }) => {
	const hands = buildHands(metrics);
	return (
		<>
			{hands.length > 0 && (
				<circle
					className="balance-target"
					data-testid="balance-target"
					cx={CENTER}
					cy={CENTER}
					r={hands[0].targetLength.toFixed(2)}
				/>
			)}
			{hands.map((hand) => (
				<g key={hand.pillarId} data-testid="heart-column">
					<polygon className={rampClass('balance-hand', hand.colorIndex)} points={handPoints(hand)}>
						{animated && (
							<animate
								attributeName="opacity"
								values="0.82;1;0.82"
								dur={`${hand.swingPeriod}s`}
								repeatCount="indefinite"
							/>
						)}
					</polygon>
					{/* Helles Köpfchen auf der Spitze — das Ende der Strecke, auf die das Auge fällt. */}
					<circle
						className={rampClass('balance-node', hand.colorIndex)}
						cx={polar(hand.angle, hand.length).x.toFixed(2)}
						cy={polar(hand.angle, hand.length).y.toFixed(2)}
						r={1.1}
					/>
				</g>
			))}
		</>
	);
};
