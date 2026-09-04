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
			'Herz-Füllstand 100 Prozent — Im Gleichgewicht',
		);
	});

	it('zeigt ohne Punkte ein leeres Herz statt einer Fehlanzeige', () => {
		render(<HeartBalance pillars={pillars} punkteProSaeule={new Map()} />);

		expect(screen.getByTestId('heart-balance-value').textContent).toBe('0 %');
		expect(screen.getAllByTestId('heart-column')).toHaveLength(2);
	});
});
