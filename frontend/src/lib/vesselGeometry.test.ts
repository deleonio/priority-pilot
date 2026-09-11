import { describe, expect, it } from 'vitest';
import { bandEdges } from './vesselGeometry';

/**
 * Spec docs/spec/issue-1302.md — Bandkanten aus kumulierter Fläche statt aus Breite.
 *
 * Die Messung hier ist bewusst **unabhängig** vom Produktionsalgorithmus: Statt `bandEdges`
 * intern zu prüfen, wird die Kolbenkontur separat als Polygon geflacht und die Fläche je Band per
 * Punkt-in-Polygon-Rasterung ausgezählt. So bestehen die Tests unabhängig davon, wie `bandEdges`
 * die Umkehrfunktion der Flächenintegration konkret bildet.
 */

const VESSEL_TOP = 6;
const VESSEL_BOTTOM = 88;
const VESSEL_LEFT = 4;
const VESSEL_RIGHT = 96;

/** Dieselbe Kontur wie `VESSEL_PATH` in `vesselGeometry.ts` — hier nur als Kontrollpunkte. */
const CUBIC_SEGMENTS: readonly [number, number, number, number, number, number, number, number][] = [
	[50, 88, 36, 88, 25, 88, 16, 88],
	[16, 88, 11.5, 87.4, 9, 84, 9, 79],
	[9, 79, 9, 60, 9, 40, 9, 20],
	[9, 20, 9, 13, 6.5, 10.5, 4, 8.4],
	[4, 8.4, 8.8, 6.6, 28, 6, 50, 6],
	[50, 6, 72, 6, 91.2, 6.6, 96, 8.4],
	[96, 8.4, 92.4, 10.2, 91, 14, 91, 20],
	[91, 20, 91, 40, 91, 60, 91, 79],
	[91, 79, 91, 84, 88.5, 87.4, 84, 88],
	[84, 88, 73, 88, 62, 88, 50, 88],
];

const cubicPoint = (
	p0: [number, number],
	p1: [number, number],
	p2: [number, number],
	p3: [number, number],
	t: number,
): [number, number] => {
	const u = 1 - t;
	const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
	const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
	return [x, y];
};

const STEPS_PER_SEGMENT = 60;

/** Flacht die Kolbenkontur zu einem geschlossenen Polygon (Nutzereinheiten). */
const flattenVesselPolygon = (): [number, number][] => {
	const points: [number, number][] = [];
	for (const [x0, y0, x1, y1, x2, y2, x3, y3] of CUBIC_SEGMENTS) {
		for (let step = 0; step < STEPS_PER_SEGMENT; step += 1) {
			const t = step / STEPS_PER_SEGMENT;
			points.push(cubicPoint([x0, y0], [x1, y1], [x2, y2], [x3, y3], t));
		}
	}
	return points;
};

const VESSEL_POLYGON = flattenVesselPolygon();

/** Ray-Casting Punkt-in-Polygon-Test (Standardalgorithmus, unabhängig vom Produktionscode). */
const isInsideVessel = (x: number, y: number): boolean => {
	let inside = false;
	for (let i = 0, j = VESSEL_POLYGON.length - 1; i < VESSEL_POLYGON.length; j = i, i += 1) {
		const [xi, yi] = VESSEL_POLYGON[i];
		const [xj, yj] = VESSEL_POLYGON[j];
		const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
};

const GRID_STEPS = 240;

/**
 * Misst je Band den Flächenanteil an der gefluteten Gesamtfläche (Kontur ∩ `y ≥ y_w`) über ein
 * feines Raster — unabhängig von jeder Integrationslogik in `bandEdges`.
 */
const measureBandShares = (edges: number[], fill: number): number[] => {
	const yWaterline = VESSEL_BOTTOM - fill * (VESSEL_BOTTOM - VESSEL_TOP);
	const dx = (VESSEL_RIGHT - VESSEL_LEFT) / GRID_STEPS;
	const dy = (VESSEL_BOTTOM - VESSEL_TOP) / GRID_STEPS;
	const bandCounts = new Array<number>(edges.length - 1).fill(0);
	let totalCount = 0;

	for (let ix = 0; ix < GRID_STEPS; ix += 1) {
		const x = VESSEL_LEFT + (ix + 0.5) * dx;
		let bandIndex = edges.findIndex((edge, index) => index < edges.length - 1 && x >= edge && x < edges[index + 1]);
		if (bandIndex === -1) bandIndex = edges.length - 2;
		for (let iy = 0; iy < GRID_STEPS; iy += 1) {
			const y = VESSEL_TOP + (iy + 0.5) * dy;
			if (y < yWaterline) continue;
			if (!isInsideVessel(x, y)) continue;
			bandCounts[bandIndex] += 1;
			totalCount += 1;
		}
	}

	if (totalCount === 0) return bandCounts.map(() => 0);
	return bandCounts.map((count) => count / totalCount);
};

describe('vesselGeometry.bandEdges', () => {
	it('teilt die Wasserfläche je Füllstand flächengetreu auf (AK1)', () => {
		const shares = [0.5, 0.3, 0.2];
		for (const fill of [0.25, 0.5, 1.0]) {
			const edges = bandEdges(shares, fill);
			const measured = measureBandShares(edges, fill);

			measured.forEach((actual, index) => {
				expect(actual).toBeCloseTo(shares[index], 1);
				expect(Math.abs(actual - shares[index])).toBeLessThanOrEqual(0.01);
			});
		}
	});

	it('teilt fünf gleiche Anteile flächengleich auf (AK2)', () => {
		const shares = [0.2, 0.2, 0.2, 0.2, 0.2];
		const fill = 0.5;
		const edges = bandEdges(shares, fill);
		const measured = measureBandShares(edges, fill);

		for (let i = 0; i < measured.length; i += 1) {
			for (let j = i + 1; j < measured.length; j += 1) {
				expect(Math.abs(measured[i] - measured[j])).toBeLessThanOrEqual(0.01);
			}
		}
	});

	it('liefert lückenlose, endliche Kanten von 4 bis 96 (AK4)', () => {
		const edges: number[] = bandEdges([0.5, 0.3, 0.2], 0.5);

		expect(edges[0]).toBeCloseTo(VESSEL_LEFT, 5);
		expect(edges[edges.length - 1]).toBeCloseTo(VESSEL_RIGHT, 5);
		edges.forEach((edge: number) => {
			expect(Number.isFinite(edge)).toBe(true);
			expect(edge).toBeGreaterThanOrEqual(VESSEL_LEFT);
			expect(edge).toBeLessThanOrEqual(VESSEL_RIGHT);
		});
		for (let i = 1; i < edges.length; i += 1) {
			expect(edges[i]).toBeGreaterThanOrEqual(edges[i - 1]);
		}
	});

	it('fällt bei Füllstand 0 auf die volle Gefäßfläche zurück, ohne durch 0 zu teilen (AK5)', () => {
		const shares = [0.5, 0.5];
		const edges: number[] = bandEdges(shares, 0);

		edges.forEach((edge: number) => expect(Number.isFinite(edge)).toBe(true));
		expect(edges[0]).toBeCloseTo(VESSEL_LEFT, 5);
		expect(edges[edges.length - 1]).toBeCloseTo(VESSEL_RIGHT, 5);

		// Rechnerisch identisch zur vollen Fläche (fill = 1) — kein Sonderpfad mit anderer Aufteilung.
		const fullEdges: number[] = bandEdges(shares, 1);
		edges.forEach((edge: number, index: number) => expect(edge).toBeCloseTo(fullEdges[index], 5));
	});

	it('erzeugt Bandbreite 0 für einen Anteil von 0 (AK5)', () => {
		const shares = [0.5, 0, 0.5];
		const edges: number[] = bandEdges(shares, 0.5);

		expect(edges[1]).toBeCloseTo(edges[2], 5);
	});
});
