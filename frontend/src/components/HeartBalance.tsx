import type { Pillar } from 'client';
import { useMemo, type CSSProperties } from 'react';
import { BalanceFigure } from './BalanceFigure';
import { HeartVessel } from './HeartVessel';
import { buildHeartBalance, heartHealth } from '../lib/heartBalance';
import { useBalanceVariant } from '../lib/balanceVariant';
import { useAnimationsEnabled } from '../lib/animations';
import { useHeartAnimationEnabled } from '../lib/heartAnimation';
import { usePrefersReducedMotion } from '../lib/reducedMotion';
import { rampClass } from '../lib/pillarRamp';

/**
 * Die Lebensbalance auf der Startseite: **ein** gerechnetes Ergebnis, vier mögliche Bilder davon.
 *
 * Diese Komponente rechnet und beschriftet; gezeichnet wird in `HeartVessel` (das Herz-Gefäß) oder
 * `BalanceFigure` (Blasen, Ringe, Strahlen). Welches Bild läuft, wählt der Nutzer in den
 * Einstellungen — wie das Zifferblatt einer Uhr (`lib/balanceVariant.ts`, Default „Herz").
 *
 * **Was über allen Varianten gleich bleibt**, und zwar absichtlich:
 *
 * - Die **Zahl** unter dem Bild, ihr Zustandstext und der konkrete Hinweis. Das Bild ist die
 *   Lesart, nicht die Auskunft — die Auskunft steht als Text da und kann dem Bild nicht
 *   widersprechen.
 * - Die **Legende**: je Säule Farbe, Name, Ist-Anteil, Ziel und Abweichung. Sie macht die Farben
 *   im Bild überhaupt erst zuordenbar und trägt die Relief-Regel (ux-design.md §2, Regel 4) —
 *   der Säulenname steht immer als Text neben der Farbe, in jeder Variante.
 * - Die **Bewegungsschalter**: Master „Animationen" (#1183), Feinschalter „Herz animieren" und die
 *   OS-Einstellung „Bewegung reduzieren", die Vorrang hat.
 *
 * Rechnung, Randfälle und das Balance-Maß stehen in `lib/heartBalance.ts`.
 */
interface HeartBalanceProps {
	/** Die Lebenssäulen — je Säule ein Segment im Bild, in Anzeigereihenfolge. */
	pillars: Pillar[];
	/** Punktestand je Säule (`pillarId → Punkte`), dieselbe Quelle wie „Gesamtguthaben". */
	punkteProSaeule: ReadonlyMap<number, number>;
}

/** Ganze Prozent für die Anzeige (die Rechnung selbst bleibt ungerundet). */
const asPercent = (share: number): number => Math.round(share * 100);

/** Ab dieser Abweichung ist eine Säule keine Delle mehr, sondern eine Schieflage (Prozentpunkte). */
const DELTA_STARK = 5;

export const HeartBalance = ({ pillars, punkteProSaeule }: HeartBalanceProps) => {
	const balance = useMemo(() => buildHeartBalance(pillars, punkteProSaeule), [pillars, punkteProSaeule]);
	const health = heartHealth(balance);
	const { variant } = useBalanceVariant();

	/*
	 * Das Bild bewegt sich nur, wenn beide Schalter es erlauben: der Master „Animationen“ (#1183)
	 * und der Feinschalter „Herz animieren“. Die OS-Einstellung „Bewegung reduzieren“ hat Vorrang
	 * und schaltet hier mit ab — Wellen wie Blasenschwingung laufen per SMIL und lassen sich nicht
	 * per CSS-Media-Query ausnehmen (Auftakt und Puls bleiben trotzdem im CSS abgesichert).
	 */
	const { enabled: animationsEnabled } = useAnimationsEnabled();
	const { enabled: heartAnimationEnabled } = useHeartAnimationEnabled();
	const prefersReducedMotion = usePrefersReducedMotion();
	const animated = animationsEnabled && heartAnimationEnabled && !prefersReducedMotion;

	const fillPercent = asPercent(balance.fill);
	const ariaLabel = `Balance ${fillPercent} Prozent — ${health.label}`;

	/*
	 * Ruhepuls: Je ausgewogener das Bild, desto langsamer schlägt es (1,5 s leer bis 2,6 s voll).
	 * Der Wert geht als Custom Property ins CSS (Herzschlag, Blasen-Atmen) und als Uniform in den
	 * Blasen-Shader — alle Varianten atmen im selben Takt.
	 */
	const beatSeconds = 1.5 + balance.fill * 1.1;

	const stageClasses = ['heart-balance-stage'];
	if (variant === 'herz') stageClasses.push('heart-balance-stage--herz');
	if (!animated) stageClasses.push('heart-balance-stage--still');

	return (
		<div className="heart-balance">
			<div
				className={stageClasses.join(' ')}
				data-variante={variant}
				style={{ '--pp-heart-beat': `${beatSeconds.toFixed(2)}s` } as CSSProperties}
			>
				{variant === 'herz' ? (
					<HeartVessel balance={balance} animated={animated} ariaLabel={ariaLabel} />
				) : (
					<BalanceFigure
						balance={balance}
						figure={variant}
						animated={animated}
						beatSeconds={beatSeconds}
						ariaLabel={ariaLabel}
					/>
				)}
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
			 * die Farben im Bild überhaupt zuordenbar macht.
			 */}
			<ul className="heart-balance-legend" data-testid="heart-balance-legend">
				{balance.segments.map((segment) => {
					/*
					 * Abweichung aus den **angezeigten** Prozenten, nicht aus den rohen Anteilen: Sonst
					 * steht neben „16 % · Ziel 20 %" womöglich „−5 pp", weil beide Zahlen einzeln gerundet
					 * wurden. Die Zeile muss in sich aufgehen.
					 */
					const delta = asPercent(segment.actualShare) - asPercent(segment.targetShare);
					return (
						<li key={segment.pillar.id} className="heart-balance-legend-row" data-testid="heart-balance-legend-row">
							<span className={rampClass('heart-legend-dot', segment.colorIndex)} aria-hidden="true" />
							<span className="heart-balance-legend-name">{segment.pillar.name}</span>
							<span className="heart-balance-legend-value">
								{asPercent(segment.actualShare)} % · Ziel {asPercent(segment.targetShare)} %
							</span>
							{delta !== 0 && (
								<span
									className="heart-balance-legend-delta"
									data-abweichung={Math.abs(delta) >= DELTA_STARK ? 'stark' : 'leicht'}
									data-testid="heart-balance-legend-delta"
								>
									{delta > 0 ? '+' : '−'}
									{Math.abs(delta)} pp<span className="visually-hidden"> Abweichung vom Ziel</span>
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
};
