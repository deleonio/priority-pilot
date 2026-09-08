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

	it('spannt die Band-Rects über die sichtbare Herzbreite, je Anteil proportional (AK2)', () => {
		// Anteile 49/14/14/11/10/2 % — größtes und kleinstes Band der Legende müssen Fläche behalten.
		const shares = [0.49, 0.14, 0.14, 0.11, 0.1, 0.02];
		const sixPillars = shares.map((_, index) => pillar(index + 1, `Säule ${index + 1}`, 1));
		const punkte = new Map(shares.map((share, index) => [index + 1, Math.round(share * 100)]));
		render(<HeartBalance pillars={sixPillars} punkteProSaeule={punkte} />);

		const rects = Array.from(screen.getByTestId('heart-balance-svg').querySelectorAll('clipPath rect'));
		expect(rects).toHaveLength(6);

		// Sichtbare Gefäßbreite x 4–96: erstes Band an der linken Kontur, letztes endet an der rechten.
		expect(Number(rects[0].getAttribute('x'))).toBeCloseTo(4, 5);
		const last = rects[5];
		expect(Number(last.getAttribute('x')) + Number(last.getAttribute('width'))).toBeCloseTo(96, 5);

		// Breite je Ist-Anteil, keines der Bänder kollabiert auf null.
		rects.forEach((rect, index) => {
			expect(Number(rect.getAttribute('width')) / 92).toBeCloseTo(shares[index], 5);
			expect(Number(rect.getAttribute('width'))).toBeGreaterThan(0);
		});
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
