import { cleanup, render, screen } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it } from 'vitest';
import { HeartBalance } from './HeartBalance';

afterEach(cleanup);

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

/**
 * Prüft, was am Bild überhaupt nachvollziehbar ist: dass je Säule genau eine Wassersäule entsteht,
 * dass jede Farbe einen Namen als Text daneben hat (Relief-Regel, ux-design.md §2) und dass der
 * Füllstand auch für Screenreader ankommt. Die Mathematik selbst prüft `lib/heartBalance.test.ts`.
 */
describe('HeartBalance', () => {
	const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];

	it('zeichnet je Säule genau ein Segment', () => {
		render(
			<HeartBalance
				pillars={pillars}
				punkteProSaeule={
					new Map([
						[1, 5],
						[2, 5],
					])
				}
			/>,
		);

		expect(screen.getAllByTestId('heart-column')).toHaveLength(2);
	});

	it('nennt jede Säule als Text in der Legende', () => {
		render(
			<HeartBalance
				pillars={pillars}
				punkteProSaeule={
					new Map([
						[1, 5],
						[2, 5],
					])
				}
			/>,
		);

		const legend = screen.getByTestId('heart-balance-legend');
		expect(legend.textContent).toContain('Körper');
		expect(legend.textContent).toContain('Geist');
	});

	it('gibt den Füllstand sichtbar und als Label der Grafik aus', () => {
		render(
			<HeartBalance
				pillars={pillars}
				punkteProSaeule={
					new Map([
						[1, 5],
						[2, 5],
					])
				}
			/>,
		);

		expect(screen.getByTestId('heart-balance-value').textContent).toBe('100 %');
		expect(screen.getByTestId('heart-balance-svg')).toHaveAttribute(
			'aria-label',
			'Herz-Füllstand 100 Prozent — In Balance',
		);
	});

	it('zeigt ohne Punkte ein leeres Herz statt einer Fehlanzeige', () => {
		render(<HeartBalance pillars={pillars} punkteProSaeule={new Map()} />);

		expect(screen.getByTestId('heart-balance-value').textContent).toBe('0 %');
		expect(screen.getAllByTestId('heart-column')).toHaveLength(2);
	});

	/**
	 * Spec docs/spec/issue-1302.md: Bandkanten müssen jetzt vom Füllstand abhängen (kumulierte
	 * Wasserfläche unterhalb der Wasserlinie `y_w`, die mit `fill` steigt), nicht mehr nur von den
	 * Ist-Anteilen. Zwei Szenarien mit identischer Ist-Anteil-Verteilung [0.3, 0.7], aber
	 * unterschiedlichem Füllstand (0.8 vs. 1.0, über unterschiedliche Soll-Gewichte erzwungen),
	 * müssen deshalb unterschiedliche Kanten ergeben. Die aktuelle, rein breitenproportionale
	 * Rechnung (`HeartBalance.tsx:213-224`) ignoriert `balance.fill` komplett und rendert in
	 * beiden Fällen exakt dieselbe Kante — das ist der Fehler, den diese Spec beheben soll. Die
	 * eigentliche Flächenkorrektheit prüft `heartGeometry.test.ts` unabhängig vom DOM.
	 */
	it('berechnet die Bandkante abhängig vom Füllstand, nicht nur vom Ist-Anteil (AK1/AK4)', () => {
		// Szenario A: Soll 50/50, Ist 3/7 → Ist-Anteile [0.3, 0.7], fill = min(.5,.3)+min(.5,.7) = 0.8.
		const scenarioA = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
		const { unmount } = render(
			<HeartBalance
				pillars={scenarioA}
				punkteProSaeule={
					new Map([
						[1, 3],
						[2, 7],
					])
				}
			/>,
		);
		const edgeA = Number(
			screen.getByTestId('heart-balance-svg').querySelectorAll('clipPath rect')[0].getAttribute('width'),
		);
		unmount();

		// Szenario B: Soll 30/70, Ist 3/7 → dieselben Ist-Anteile [0.3, 0.7], aber fill = 0.3+0.7 = 1.0.
		const scenarioB = [pillar(1, 'Körper', 30), pillar(2, 'Geist', 70)];
		render(
			<HeartBalance
				pillars={scenarioB}
				punkteProSaeule={
					new Map([
						[1, 3],
						[2, 7],
					])
				}
			/>,
		);
		const edgeB = Number(
			screen.getByTestId('heart-balance-svg').querySelectorAll('clipPath rect')[0].getAttribute('width'),
		);

		// Gleiche Ist-Anteile, unterschiedlicher Füllstand → die Kante darf nicht identisch bleiben.
		expect(edgeA).not.toBeCloseTo(edgeB, 3);
	});

	it('fällt ohne WebGL auf das SVG zurück, statt ohne Bild dazustehen', () => {
		// jsdom stellt kein WebGL bereit — genau der Rückfallpfad, den dieser Test sichert.
		render(
			<HeartBalance
				pillars={pillars}
				punkteProSaeule={
					new Map([
						[1, 3],
						[2, 7],
					])
				}
			/>,
		);

		expect(screen.getByTestId('heart-balance-svg')).toBeInTheDocument();
		expect(screen.queryByTestId('heart-balance-canvas')).not.toBeInTheDocument();
	});
});
