import { cleanup, render, screen } from '@testing-library/react';
import type { Pillar } from 'client';
import type { ComponentProps } from 'react';
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

	/**
	 * Grundradien der Blasen aus dem gerenderten SVG, in Zeichenreihenfolge (groß → klein). Im
	 * Markup stehen die beiden Halbachsen der schwingenden Ellipse; weil sie gegenläufig laufen,
	 * ist ihr Mittel der Grundradius — unabhängig davon, wo in ihrer Schwingung die Blase steht.
	 */
	const orbRadii = (): number[] =>
		screen
			.getAllByTestId('heart-column')
			.map((orb) => (Number(orb.getAttribute('rx')) + Number(orb.getAttribute('ry'))) / 2);

	describe('über alle Varianten', () => {
		it('zeigt ohne gespeicherte Wahl das Herz — bestehende Nutzer finden ihr Bild vor', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} />);

			expect(screen.getByTestId('heart-balance-svg').querySelector('.heart-vessel')).not.toBeNull();
			expect(screen.queryAllByTestId('balance-tick')).toHaveLength(0);
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
			for (const value of [
				'blasen',
				'scheiben',
				'ringe',
				'strahlen',
				'bluete',
				'kristall',
				'segmente',
				'zeiger',
				'bahnen',
			] as const) {
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
			for (const value of [
				'blasen',
				'scheiben',
				'ringe',
				'strahlen',
				'bluete',
				'kristall',
				'segmente',
				'zeiger',
				'bahnen',
			] as const) {
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

		/*
		 * #2676: Bis der erste Stand freigegeben ist, stehen Bild und Ablesewert unsichtbar — der
		 * Platz bleibt (kein Layout-Shift), und die erste sichtbare Fassung zeigt sofort den echten
		 * Wert statt erst auf den lokalen Notwert zu wachsen und darauf zu springen. Die Legende
		 * bleibt sichtbar: Ihre Anteile kommen aus den Säulen, nicht vom Server-Stand.
		 */
		it('hält Bild und Ablesewert unsichtbar, bis der erste Stand freigegeben ist (#2676)', () => {
			const { container } = render(
				<HeartBalance pillars={pillars} punkteProSaeule={gleichverteilt} fill={0.42} auftaktBereit={false} />,
			);

			expect(screen.getByTestId('heart-balance-svg')).not.toBeVisible();
			expect(screen.getByTestId('heart-balance-value')).not.toBeVisible();
			// Sichtbarkeits-Gate, nicht Display: Bühne und Zeilen halten ihre Höhe.
			expect(container.querySelector('.heart-balance-stage')).not.toHaveStyle('display: none');
			expect(screen.getByTestId('heart-balance-legend')).toBeVisible();
		});

		it('zeigt mit der Freigabe sofort den echten Stand — der lokale Notwert war nie sichtbar (#2676)', () => {
			const props = { pillars, punkteProSaeule: gleichverteilt, fill: 0.42 } as const;
			const { rerender } = render(<HeartBalance {...props} auftaktBereit={false} />);

			rerender(<HeartBalance {...props} auftaktBereit />);

			expect(screen.getByTestId('heart-balance-svg')).toBeVisible();
			expect(screen.getByTestId('heart-balance-value')).toBeVisible();
			expect(screen.getByTestId('heart-balance-value').textContent).toBe('42 %');
		});

		// #2645 (docs/spec/issue-2645.md): Das Dashboard leitet die Urteilsreife aus der
		// Balance-Antwort ab (#2633-Felder) und reicht sie als optionale Prop durch — `undefined`
		// (Server-Felder fehlen) bleibt bisheriges Verhalten. Die Prop existiert noch nicht und wird
		// per Intersection-Typ deklariert (Produktiv-Typ unberührt, Muster 2026-08-23).
		it('zeigt unter der Mindestmenge den Leerzustand statt Urteil und Säulennamen (#2645/AK1)', () => {
			type PropsMitUrteilsreife = ComponentProps<typeof HeartBalance> & { urteilsreif?: boolean };
			const props: PropsMitUrteilsreife = { pillars, punkteProSaeule: schieflage, urteilsreif: false };
			const { container } = render(<HeartBalance {...props} />);

			const state = container.querySelector('.heart-balance-state');
			expect(state?.getAttribute('data-state')).toBe('leer');
			expect(state?.textContent).toBe('Noch leer');
			const hint = container.querySelector('.heart-balance-hint');
			// Leer-Hinweis statt konkreter Schieflage — keine Säule wird beim Namen genannt.
			expect(hint?.textContent).toBe('Erledige Aufgaben, damit sich das Bild füllt.');
			expect(hint?.textContent).not.toContain('Körper');
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

	describe('Figuren „Blasen" und „Scheiben"', () => {
		beforeEach(() => chooseVariant('blasen'));

		/*
		 * Die beiden teilen sich Geometrie und Bewegung und unterscheiden sich allein im Material —
		 * das muss im Markup auch so ankommen: gleiche Radien, andere Klasse.
		 */
		it('zeichnet Scheiben mit derselben Geometrie wie die Blasen, nur in anderer Klasse', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
			const blasen = orbRadii();
			expect(screen.getAllByTestId('heart-column')[0].getAttribute('class')).toContain('balance-orb');
			cleanup();

			chooseVariant('scheiben');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);
			expect(orbRadii()).toEqual(blasen);
			expect(screen.getAllByTestId('heart-column')[0].getAttribute('class')).toContain('balance-disc');
		});

		/*
		 * Die Kernaussage des Bildes: Die Säule, die am weitesten zurückliegt, ist die kleinste Blase
		 * und liegt damit ganz vorn — als letzte im DOM, also über allen anderen.
		 */
		it('stapelt die Blasen von groß nach klein, die schwächste Säule zuletzt', () => {
			render(
				<HeartBalance
					pillars={pillars}
					punkteProSaeule={
						new Map([
							[1, 9],
							[2, 1],
						])
					}
				/>,
			);

			const radii = orbRadii();
			expect(radii[0]).toBeGreaterThan(radii[1]);
		});

		it('zeigt ohne Punkte ein leeres Bild statt einer Fehlanzeige', () => {
			render(<HeartBalance pillars={pillars} punkteProSaeule={new Map()} />);

			expect(screen.getByTestId('heart-balance-value').textContent).toBe('0 %');
			// Kein Punkt vergeben heißt Verhältnis 0 — alle Blasen liegen auf dem Mindestmaß.
			for (const radius of orbRadii()) expect(radius).toBeCloseTo(R_MIN, 2);
			const leuchtend = screen
				.getAllByTestId('balance-tick')
				.filter((tick) => tick.classList.contains('balance-tick--on'));
			expect(leuchtend).toHaveLength(0);
		});

		/*
		 * Eine Säule ohne Gewicht hat dauerhaft das Verhältnis 0 (`POST /pillars` legt jede neue Säule
		 * mit `weight: 0` an). Sie darf nicht aus dem Bild verschwinden, sondern liegt als kleinste
		 * Blase ganz vorn.
		 */
		it('behält eine Säule ohne Ziel als kleinste Blase im Bild', () => {
			render(<HeartBalance pillars={[...pillars, pillar(3, 'Frisch angelegt', 0)]} punkteProSaeule={gleichverteilt} />);

			const radii = orbRadii();
			expect(radii).toHaveLength(3);
			expect(radii[2]).toBeCloseTo(R_MIN, 2);
		});
	});

	describe('Figuren „Blüte" und „Kristall"', () => {
		/** Position des Lappen-Knotens je Säule (`.balance-node` in jeder `heart-column`-Gruppe). */
		const nodePositions = (): { cx: number; cy: number }[] =>
			screen.getAllByTestId('heart-column').map((column) => {
				const node = column.querySelector('.balance-node');
				return { cx: Number(node?.getAttribute('cx')), cy: Number(node?.getAttribute('cy')) };
			});

		/*
		 * Die beiden teilen sich die Stützpunkte wie Blasen und Scheiben den Stapel — im Markup muss
		 * dasselbe ankommen: gleiche Knotenpositionen, anderes Material.
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
	});

	describe('Figur „Bahnen"', () => {
		/** Große Halbachse der Bahn-Ellipse je Säule (Attribut `rx` der Spur). */
		const orbitRadii = (): number[] =>
			screen
				.getAllByTestId('heart-column')
				.map((column) => Number(column.querySelector('.balance-orbit-track')?.getAttribute('rx')));

		it('zeichnet je Säule eine Bahn mit Komet darauf, die größte zuerst', () => {
			chooseVariant('bahnen');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);

			const columns = screen.getAllByTestId('heart-column');
			expect(columns).toHaveLength(2);
			for (const column of columns) {
				expect(column.querySelector('.balance-orbit-track')).not.toBeNull();
				expect(column.querySelector('.balance-node')).not.toBeNull();
			}
			const radii = orbitRadii();
			expect(radii[0]).toBeGreaterThan(radii[1]);
		});

		it('dreht die größte Bahn auf 12 Uhr — ihr Scheitel liegt über der Mitte', () => {
			chooseVariant('bahnen');
			render(<HeartBalance pillars={pillars} punkteProSaeule={schieflage} />);

			const [spur] = screen.getAllByTestId('heart-column');
			expect(spur.querySelector('.balance-orbit-track')).toHaveAttribute('transform', 'rotate(-90.00 50 50)');
		});
	});
});
