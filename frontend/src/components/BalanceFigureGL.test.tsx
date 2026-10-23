import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toSlots } from '../lib/webglStage';
import { buildOrbs } from '../lib/balanceFigure';
import type { BalanceMetrics } from '../lib/balanceMetric';
import { BalanceFigureGL } from './BalanceFigureGL';

/**
 * Die Brücke zwischen Rechnung und Shader: `toSlots` legt die Formen auf die acht Uniform-Plätze.
 * Zwei Dinge dürfen dabei nicht verrutschen — die Farbzuordnung (jede Säule bekommt ihren eigenen
 * Rang aus der Neon-Rampe, ab dem 8. Rang neutral) und die Reihenfolge: Slot 0 ist die **stärkste**
 * Säule. Kippte sie, läge bei den Blasen die stärkste Säule vorn und verdeckte alle anderen — die
 * Aussage des Bildes wäre die umgekehrte.
 *
 * Kein Render-Test: WebGL gibt es in jsdom nicht, die Bühne zeigt dort das SVG (siehe
 * `HeartBalance.test.tsx`).
 */

/** ThemeColors strukturell: 7 Rampenfarben, 5 Ring-Stützstellen, Kartenfarbe und Neutralfarbe. */
const colors = {
	pillars: Array.from({ length: 7 }, (_, i): [number, number, number] => [i / 7, 0.5, 1 - i / 7]),
	ring: Array.from({ length: 5 }, (_, i): [number, number, number] => [i / 5, 0, 0]),
	surface: [1, 1, 1] as [number, number, number],
	neutral: [0.1, 0.1, 0.1] as [number, number, number],
};

/** Kennzahlen von Hand, ohne den Umweg über `buildHeartBalance`. */
const metricsOf = (ratios: number[]): BalanceMetrics => {
	const scale = Math.max(1, ...ratios);
	const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
	return {
		pillars: ratios.map((ratio, index) => ({
			pillarId: index + 1,
			colorIndex: index,
			ratio,
			scaled: ratio / scale,
			actualShare: total > 0 ? ratio / total : 0,
		})),
		targetMark: 1 / scale,
		scale,
	};
};

const stateOf = (
	metrics: BalanceMetrics,
	figure:
		| 'blasen'
		| 'scheiben'
		| 'ringe'
		| 'strahlen'
		| 'bluete'
		| 'kristall'
		| 'segmente'
		| 'zeiger'
		| 'bahnen'
		| 'meteore'
		| 'pendel',
) => ({
	figure,
	metrics,
	activeTicks: 50,
	beatSeconds: 2,
});

describe('BalanceFigureGL toSlots', () => {
	it('gibt jeder Säule ihre Rampenfarbe und behält die Reihenfolge stärkste → schwächste', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		expect(slots.colors).toHaveLength(3);
		// Reihenfolge aus `buildOrbs`: Säule 2 (1.0), Säule 3 (0.6), Säule 1 (0.2).
		expect(slots.colors).toEqual([colors.pillars[1], colors.pillars[2], colors.pillars[0]]);
		expect(slots.orbRadius[0]).toBeGreaterThan(slots.orbRadius[2]);
	});

	it('übernimmt die Bewegung unverändert aus der Rechnung', () => {
		const metrics = metricsOf([0.4, 0.8]);
		const orbs = buildOrbs(metrics);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		slots.motions.forEach((motion, index) => {
			expect(motion.phase).toBe(orbs[index].phase);
			expect(motion.swingPeriod).toBe(orbs[index].swingPeriod);
			expect(motion.rotPeriod).toBe(orbs[index].rotPeriod);
			expect(motion.rotDirection).toBe(orbs[index].rotDirection);
		});
	});

	it('färbt ab dem 8. Rang neutral — wie das SVG, das dort nicht mehr einfärbt', () => {
		const slots = toSlots(stateOf(metricsOf(Array(8).fill(1)), 'blasen'), colors);

		slots.colors.slice(0, 7).forEach((color, index) => expect(color).toEqual(colors.pillars[index]));
		expect(slots.colors[7]).toEqual(colors.neutral);
	});

	/*
	 * Mehr Säulen als Plätze: Abgeschnitten wird hinten, bei den schwächsten. Die stärksten tragen
	 * das Bild; fehlten sie, stünde es auf dem Kopf.
	 */
	it('behält bei mehr als acht Säulen die acht stärksten Formen', () => {
		const metrics = metricsOf([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
		const slots = toSlots(stateOf(metrics, 'blasen'), colors);

		expect(slots.colors).toHaveLength(8);
		expect(slots.orbRadius).toEqual(
			buildOrbs(metrics)
				.slice(0, 8)
				.map((orb) => orb.radius),
		);
	});

	/* Scheiben sind Blasen in anderem Material — die Slots müssen deshalb identisch belegt sein. */
	it('belegt die Slots für Scheiben genau wie für Blasen', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const blasen = toSlots(stateOf(metrics, 'blasen'), colors);
		const scheiben = toSlots(stateOf(metrics, 'scheiben'), colors);

		expect(scheiben.orbRadius).toEqual(blasen.orbRadius);
		expect(scheiben.colors).toEqual(blasen.colors);
		expect(scheiben.target).toBe(blasen.target);
	});

	it('füllt je Figur nur deren eigene Felder', () => {
		const metrics = metricsOf([1, 0.5]);

		const blasen = toSlots(stateOf(metrics, 'blasen'), colors);
		expect(blasen.orbRadius).toHaveLength(2);
		expect(blasen.arcRadius).toHaveLength(0);
		expect(blasen.rayLength).toHaveLength(0);

		const ringe = toSlots(stateOf(metrics, 'ringe'), colors);
		expect(ringe.arcSweep).toEqual([1, 0.5]);
		expect(ringe.orbRadius).toHaveLength(0);

		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);
		expect(strahlen.rayAngle[0]).toBe(-90);
		expect(strahlen.arcRadius).toHaveLength(0);

		const bluete = toSlots(stateOf(metrics, 'bluete'), colors);
		expect(bluete.rayAngle[0]).toBe(-90);
		expect(bluete.rayLength).toHaveLength(2);
		expect(bluete.orbRadius).toHaveLength(0);
		expect(bluete.arcRadius).toHaveLength(0);
	});

	/* Blüte und Kristall teilen sich die Stützpunkte wie Blasen und Scheiben ihren Stapel. */
	it('belegt die Slots für Kristall genau wie für die Blüte', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const bluete = toSlots(stateOf(metrics, 'bluete'), colors);
		const kristall = toSlots(stateOf(metrics, 'kristall'), colors);

		expect(kristall.rayAngle).toEqual(bluete.rayAngle);
		expect(kristall.rayLength).toEqual(bluete.rayLength);
		expect(kristall.colors).toEqual(bluete.colors);
		expect(kristall.target).toBe(bluete.target);
	});

	/* Die Soll-Marke kommt in der Einheit der jeweiligen Figur — Radius, Bogenanteil oder Länge. */
	it('liefert die Soll-Marke in der Einheit der jeweiligen Figur', () => {
		const metrics = metricsOf([2, 1]);

		// Blasen: der Radius, den die Säule auf Ziel hat.
		expect(toSlots(stateOf(metrics, 'blasen'), colors).target).toBeCloseTo(
			toSlots(stateOf(metrics, 'blasen'), colors).orbRadius[1],
			6,
		);
		// Ringe: der Bogenanteil (0,5 bei Skala 2).
		expect(toSlots(stateOf(metrics, 'ringe'), colors).target).toBeCloseTo(0.5, 6);
		// Strahlen: die Länge der Säule auf Ziel.
		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);
		expect(strahlen.target).toBeCloseTo(strahlen.rayLength[1], 6);
		// Blüte und Kristall: der Radius der Lappenspitze auf Ziel.
		const bluete = toSlots(stateOf(metrics, 'bluete'), colors);
		expect(bluete.target).toBeCloseTo(bluete.rayLength[1], 6);
	});

	/* Segmente belegen eigene Uniform-Plätze; ihre Slots dürfen keine Strahlen-/Bogen-Felder tragen. */
	it('belegt die Slots für Segmente mit Mitte, Halbbreite und Radien', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const slots = toSlots(stateOf(metrics, 'segmente'), colors);
		expect(slots.colors).toHaveLength(3);
		expect(slots.wedgeMid).toHaveLength(3);
		expect(slots.wedgeHalf).toHaveLength(3);
		expect(slots.wedgeInner).toHaveLength(3);
		expect(slots.wedgeOuter).toHaveLength(3);
		expect(slots.orbRadius).toHaveLength(0);
		expect(slots.rayAngle).toHaveLength(0);
		expect(slots.arcRadius).toHaveLength(0);
		// Reihenfolge stärkste → schwächste: Das größte Stück gehört zur stärksten Säule.
		expect(slots.wedgeOuter[0]).toBeGreaterThan(slots.wedgeOuter[2]);
	});

	/* Zeiger belegen die Strahlen-Plätze — aber mit ihrer eigenen, schmaleren Geometrie. */
	it('belegt die Slots für Zeiger auf den Strahlen-Plätzen, schmaler als Strahlen', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const hands = toSlots(stateOf(metrics, 'zeiger'), colors);
		const rays = toSlots(stateOf(metrics, 'strahlen'), colors);
		// Winkel wie die Strahlen, Länge und Öffnung aber aus der eigenen Geometrie.
		expect(hands.rayAngle).toEqual(rays.rayAngle);
		expect(hands.rayLength[0]).toBeGreaterThan(hands.rayLength[2]);
		expect(hands.raySpread[0]).toBeLessThan(rays.raySpread[0]);
		expect(hands.wedgeMid).toHaveLength(0);
	});

	/* Bahnen, Meteore und Pendel teilen sich die Bahn-Geometrie: Alle drei belegen die
	 * Strahlen-Plätze mit Winkel und großer Halbachse — die Bewegung wählt der Shader (u_figure). */
	it('belegt die Slots der drei Bahn-Figuren identisch auf den Strahlen-Plätzen', () => {
		const metrics = metricsOf([0.2, 1, 0.6]);
		const strahlen = toSlots(stateOf(metrics, 'strahlen'), colors);

		for (const figur of ['bahnen', 'meteore', 'pendel'] as const) {
			const slots = toSlots(stateOf(metrics, figur), colors);
			expect(slots.rayAngle, figur).toEqual(strahlen.rayAngle);
			expect(slots.rayLength[0]).toBeGreaterThan(slots.rayLength[2]);
			expect(slots.raySpread).toHaveLength(0);
			expect(slots.orbRadius).toHaveLength(0);
			expect(slots.wedgeMid).toHaveLength(0);
			// Soll-Marke in Radius-Einheit: die Bahn der Säule auf Ziel (hier die stärkste)
			// berührt den Strichelkreis mit ihrem Scheitel.
			expect(slots.target).toBeCloseTo(slots.rayLength[0], 6);
		}
	});
});

/**
 * #2770 AK2: Nach `webglcontextrestored` baut `onRestored` die Engine neu und muss dieselbe
 * Auftakt-Politik anwenden wie der laufende Effekt — `!(auftaktBereit === false && animated)`.
 * Der bisher übergebene rohe `stateRef`-Wert leerte das Standbild nach jeder Wiederherstellung:
 * Ohne Bewegung zeigt die Politik den fertigen Stand, auch wenn der echte Balance-Wert fehlt.
 *
 * Kein Render-Test im üblichen Sinn — WebGL gibt es in jsdom nicht: Der Test fährt die echte
 * Komponente über einen minimalen WebGL2-Ersatz an `canvas.getContext` (kompiliert
 * „erfolgreich“, protokolliert Uniform-Werte) und löst die Kontext-Events am Canvas aus.
 */
describe('BalanceFigureGL — Auftakt-Politik bei Kontext-Wiederherstellung (#2770)', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	/** Minimaler WebGL2-Ersatz: kompiliert „erfolgreich“, protokolliert uniform1f je Name. */
	const fakeGl = (uniforme: Map<string, number>): WebGL2RenderingContext =>
		({
			createShader: () => ({}),
			shaderSource: () => undefined,
			compileShader: () => undefined,
			getShaderParameter: () => true,
			getShaderInfoLog: () => '',
			createProgram: () => ({}),
			attachShader: () => undefined,
			linkProgram: () => undefined,
			useProgram: () => undefined,
			getProgramParameter: () => true,
			getProgramInfoLog: () => '',
			createBuffer: () => ({}),
			bindBuffer: () => undefined,
			bufferData: () => undefined,
			getAttribLocation: () => 0,
			enableVertexAttribArray: () => undefined,
			vertexAttribPointer: () => undefined,
			getUniformLocation: (_program: unknown, name: string) => ({ name }),
			uniform1f: (location: { name: string }, value: number) => {
				uniforme.set(location.name, value);
			},
			uniform1fv: () => undefined,
			uniform1i: () => undefined,
			uniform2f: () => undefined,
			uniform3fv: () => undefined,
			enable: () => undefined,
			blendFunc: () => undefined,
			clearColor: () => undefined,
			clear: () => undefined,
			drawArrays: () => undefined,
			viewport: () => undefined,
			deleteBuffer: () => undefined,
			deleteProgram: () => undefined,
			ARRAY_BUFFER: 34962,
			STATIC_DRAW: 34962,
			COMPILE_STATUS: 35713,
			LINK_STATUS: 35714,
			VERTEX_SHADER: 35633,
			FRAGMENT_SHADER: 35632,
			FLOAT: 5126,
			BLEND: 3042,
			ONE: 1,
			ONE_MINUS_SRC_ALPHA: 771,
			COLOR_BUFFER_BIT: 16384,
			TRIANGLES: 4,
		}) as unknown as WebGL2RenderingContext;

	it('gibt nach webglcontextrestored als Standbild sofort frei — dieselbe Politik wie der laufende Effekt', () => {
		// jsdom kennt beide Observer nicht; die Engine legt sie bei jedem Aufbau an.
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe(): void {}
				disconnect(): void {}
				unobserve(): void {}
			},
		);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe(): void {}
				disconnect(): void {}
				unobserve(): void {}
			},
		);
		const uniforme = new Map<string, number>();
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
			fakeGl(uniforme) as unknown as CanvasRenderingContext2D,
		);
		const onGiveUp = vi.fn();

		const { getByTestId } = render(
			<BalanceFigureGL
				figure="blasen"
				metrics={metricsOf([1])}
				activeTicks={50}
				beatSeconds={2}
				animated={false}
				auftaktBereit={false}
				ariaLabel="Test"
				onGiveUp={onGiveUp}
			/>,
		);

		// Laufender Effekt, Standbild: Der fertige Stand wird sofort gezeigt, obwohl der echte
		// Balance-Wert noch fehlt (u_rise = 1 = freigegeben).
		expect(onGiveUp).not.toHaveBeenCalled();
		expect(uniforme.get('u_rise')).toBe(1);

		getByTestId('heart-balance-canvas').dispatchEvent(new Event('webglcontextlost'));
		getByTestId('heart-balance-canvas').dispatchEvent(new Event('webglcontextrestored'));

		// Nach der Wiederherstellung gilt dieselbe Politik — der rohe stateRef-Wert (false) würde
		// das Bild hier leer machen (u_rise = 0).
		expect(uniforme.get('u_rise')).toBe(1);
	});
});
