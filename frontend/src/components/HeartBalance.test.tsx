import { cleanup, render, screen } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HeartBalance } from './HeartBalance';
import { R_MIN, TICK_COUNT } from '../lib/balanceFigure';
import { BALANCE_VARIANTS, type BalanceVariant } from '../lib/balanceVariant';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

/** Bild wählen, bevor gerendert wird — `useBalanceVariant` liest `localStorage` beim Mounten. */
const chooseVariant = (variant: BalanceVariant): void => localStorage.setItem('pp-balance-variant', variant);

/**
 * Prüft, was am Bild überhaupt nachvollziehbar ist: dass die Variantenwahl greift, dass jede
 * Variante je Säule genau ein Segment zeichnet, dass das Zifferblatt so weit leuchtet, wie die Zahl
 * daneben sagt, dass jede Farbe einen Namen als Text daneben hat (Relief-Regel, ux-design.md §2)
 * und dass die Balance auch für Screenreader ankommt. Die Geometrie prüft `balanceFigure.test.ts`,
 * die Kennzahl `balanceMetric.test.ts`, die Mathematik `heartBalance.test.ts`.
 *
 * In jsdom gibt es kein WebGL — gerendert wird hier also stets die SVG-Fassung, der Rückfallpfad.
 */
describe('HeartBalance', () => {
	const pillars = [pillar(1, 'Körper', 50), pillar(2, 'Geist', 50)];
	const gleichverteilt = new Map([
		[1, 5],
		[2, 5],
	]);
	const schieflage = new Map([
		[1, 8],
		[2, 2],
	]);

	/** Position des Lappen-Knotens je Säule (`.balance-node` in jeder `heart-column`-Gruppe). */
	const nodePositions = (): { cx: number; cy: number }[] =>
		screen.getAllByTestId('heart-column').map((column) => {
			const node = column.querySelector('.balance-node');
			return { cx: Number(node?.getAttribute('cx')), cy: Number(node?.getAttribute('cy')) };
		});

	/** Abstand der Lappenspitzen vom Mittelpunkt, stärkste Säule zuerst. */
	const petalRadii = (): number[] => nodePositions().map(({ cx, cy }) => Math.hypot(cx - 50, cy - 50));

	describe('über alle Varianten', () => {
		it('zeigt ohne gespeicherte Wahl die Blüte', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} />);

			expect(screen.getByTestId('heart-balance-svg').querySelector('.balance-petal-mass')).not.toBeNull();
		});

		it('zeichnet in jeder Variante je Säule genau ein Segment', () => {
			for (const { value } of BALANCE_VARIANTS) {
				chooseVariant(value);
				render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} />);
				expect(screen.getAllByTestId('heart-column'), value).toHaveLength(2);
				cleanup();
			}
		});

		/*
		 * Das Zifferblatt ist der gemeinsame Rahmen aller Figuren: Bild und Zahl dürfen sich nicht
		 * widersprechen — ein Strich ist ein Prozentpunkt, und die Zahl der leuchtenden Striche ist
		 * dieselbe Zahl, die unter dem Bild steht.
		 */
		it('gibt jeder Figur dasselbe Zifferblatt mit 100 Strichen', () => {
			for (const { value } of BALANCE_VARIANTS) {
				chooseVariant(value);
				render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);

				const ticks = screen.getAllByTestId('balance-tick');
				expect(ticks, value).toHaveLength(TICK_COUNT);
				const prozent = Number(screen.getByTestId('heart-balance-value').textContent?.replace(/\D/g, ''));
				expect(
					ticks.filter((tick) => tick.classList.contains('balance-tick--on')),
					value,
				).toHaveLength(prozent);
				cleanup();
			}
		});

		/* Die Soll-Marke sagt in jeder Figur dasselbe: „hier stünde die Säule genau auf ihrem Ziel". */
		it('markiert in jeder Figur, wo das Soll liegt', () => {
			for (const { value } of BALANCE_VARIANTS) {
				chooseVariant(value);
				render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
				expect(screen.getAllByTestId('balance-target').length, value).toBeGreaterThan(0);
				cleanup();
			}
		});

		it('nennt jede Säule als Text in der Legende', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} />);

			const legend = screen.getByTestId('heart-balance-legend');
			expect(legend.textContent).toContain('Körper');
			expect(legend.textContent).toContain('Geist');
		});

		it('gibt die Balance sichtbar und als Label der Grafik aus', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} />);

			expect(screen.getByTestId('heart-balance-value').textContent).toBe('100 %');
			expect(screen.getByTestId('heart-balance-svg')).toHaveAttribute('aria-label', 'Balance 100 Prozent — In Balance');
		});

		it('zeigt einen übergebenen Server-Füllstand statt des lokal gerechneten (#1638)', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} fill={0.42} />);

			expect(screen.getByTestId('heart-balance-value').textContent).toBe('42 %');
			expect(screen.getByTestId('heart-balance-svg').getAttribute('aria-label')).toMatch(/^Balance 42 Prozent — /);
		});

		it('weist je Säule die Abweichung vom Ziel in Prozentpunkten aus', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);

			const deltas = screen.getAllByTestId('heart-balance-legend-delta');
			expect(deltas.map((delta) => delta.textContent)).toEqual([
				'+30 pp Abweichung vom Ziel',
				'−30 pp Abweichung vom Ziel',
			]);
			expect(deltas[0]).toHaveAttribute('data-abweichung', 'stark');
		});

		it('fällt ohne WebGL in jeder Variante auf das SVG zurück, statt ohne Bild dazustehen', () => {
			// jsdom stellt kein WebGL bereit — genau der Rückfallpfad, den dieser Test sichert.
			for (const { value } of BALANCE_VARIANTS) {
				chooseVariant(value);
				render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
				expect(screen.getByTestId('heart-balance-svg'), value).toBeInTheDocument();
				expect(screen.queryByTestId('heart-balance-canvas'), value).not.toBeInTheDocument();
				cleanup();
			}
		});
	});

	describe('Figuren „Blüte" und „Kristall"', () => {
		/*
		 * Die beiden teilen sich die Stützpunkte — im Markup muss dasselbe ankommen: gleiche
		 * Knotenpositionen, anderes Material.
		 */
		it('zeichnet Kristall mit denselben Stützpunkten wie die Blüte, nur in anderer Klasse', () => {
			chooseVariant('bluete');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
			const bluete = nodePositions();
			expect(screen.getAllByTestId('heart-column')[0].querySelector('.balance-petal')).not.toBeNull();
			cleanup();

			chooseVariant('kristall');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
			expect(nodePositions()).toEqual(bluete);
			expect(screen.getAllByTestId('heart-column')[0].querySelector('.balance-facet')).not.toBeNull();
		});

		it('stellt den Knoten der stärksten Säule auf 12 Uhr — über der Mitte', () => {
			chooseVariant('kristall');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);

			const [staerkste] = nodePositions();
			expect(staerkste.cx).toBeCloseTo(50, 1);
			expect(staerkste.cy).toBeLessThan(50);
		});

		it('zeigt ohne Punkte ein leeres Bild statt einer Fehlanzeige', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={new Map()} />);

			expect(screen.getByTestId('heart-balance-value').textContent).toBe('0 %');
			// Kein Punkt vergeben heißt Verhältnis 0 — alle Lappen liegen auf dem Mindestmaß.
			for (const radius of petalRadii()) expect(radius).toBeCloseTo(R_MIN, 1);
			const leuchtend = screen
				.getAllByTestId('balance-tick')
				.filter((tick) => tick.classList.contains('balance-tick--on'));
			expect(leuchtend).toHaveLength(0);
		});

		/*
		 * Eine Säule ohne Gewicht hat dauerhaft das Verhältnis 0 (`POST /pillars` legt jede neue Säule
		 * mit `weight: 0` an). Sie darf nicht aus dem Bild verschwinden, sondern bleibt als kleinster
		 * Lappen stehen.
		 */
		it('behält eine Säule ohne Ziel als kleinsten Lappen im Bild', () => {
			render(<HeartBalance pillars={[...pillars, pillar(3, 'Frisch angelegt', 0)]} punkteProSaeule={gleichverteilt} />);

			const radii = petalRadii();
			expect(radii).toHaveLength(3);
			expect(radii[2]).toBeCloseTo(R_MIN, 1);
		});
	});
});
