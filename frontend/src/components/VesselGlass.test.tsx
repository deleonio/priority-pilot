import { cleanup, render, screen } from '@testing-library/react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it } from 'vitest';
import { VesselBalance } from './VesselBalance';
import { toSlotBands } from './VesselGlass';

afterEach(cleanup);

/** ThemeColors strukturell: 7 Rampenfarben plus Gefäß-, Kontur-, Fugen- und Neutral-Farbe. */
const colors = {
	pillars: Array.from({ length: 7 }, (_, i): [number, number, number] => [i / 7, 0.5, 1 - i / 7]),
	vessel: [0.9, 0.9, 0.9] as [number, number, number],
	outline: [0.2, 0.2, 0.2] as [number, number, number],
	seam: [1, 1, 1] as [number, number, number],
	neutral: [0.1, 0.1, 0.1] as [number, number, number],
};

interface GlassBand {
	pillarId: number;
	colorIndex: number;
	x0: number;
	x1: number;
}

/** Bänder über die sichtbare Gefäßbreite (x 4–96) mit kumulierten Ist-Anteilen — wie das `bands`-useMemo. */
const spanBands = (shares: number[]): GlassBand[] => {
	const bands: GlassBand[] = [];
	let cum = 0;
	shares.forEach((share, index) => {
		const x0 = 4 + 92 * cum;
		cum += share;
		bands.push({ pillarId: index + 1, colorIndex: index, x0, x1: 4 + 92 * cum });
	});
	return bands;
};

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });
const SHARES = [0.49, 0.14, 0.14, 0.11, 0.1, 0.02];
const vesselPillars = SHARES.map((_, index) => pillar(index + 1, `Säule ${index + 1}`, 1));
const punkte = new Map(SHARES.map((share, index) => [index + 1, Math.round(share * 100)]));

/**
 * Spec docs/spec/issue-1284.md — Band-Kanten-Semantik des Glas-Gefäßes.
 *
 * Der Shader liest `u_band_edges[i]` als linke Kante von Farbe i; `toSlotBands` muss deshalb die
 * linke Band-Kante (`x0`) normiert auf die sichtbare Breite liefern — nicht die rechte (`x1`),
 * sonst malt jedes Band die Spanne seines Nachfolgers (Ticket-Fehler).
 */
describe('VesselGlass toSlotBands', () => {
	it('legt jede Slot-Kante auf die linke Kante ihres Bandes (AK1)', () => {
		const bands = spanBands(SHARES);
		const slots = toSlotBands(bands, colors);

		expect(slots).toHaveLength(6);
		// Kumulierte Anteile: 0 / 0.49 / 0.63 / 0.77 / 0.88 / 0.98 — die Legende im Glas.
		const expected = [0, 0.49, 0.63, 0.77, 0.88, 0.98];
		slots.forEach((slot, index) => expect(slot.edge).toBeCloseTo(expected[index], 5));
		// Farbe 0 endet an der rechten Kante von Band 0 (= linke Kante von Band 1).
		expect(slots[1].edge).toBeCloseTo((bands[0].x1 - 4) / 92, 5);
	});

	it('zeichnet jedes Band in eigener Rampenfarbe, auch das größte und das kleinste (AK2)', () => {
		const slots = toSlotBands(spanBands(SHARES), colors);

		slots.forEach((slot, index) => expect(slot.color).toEqual(colors.pillars[index]));
		// Das kleinste Band (2 %) beginnt unterhalb von 1.0 und behält so Fläche bis zur Rechten.
		expect(slots[5].edge).toBeLessThan(1);
	});

	it('führt den Overflow bei mehr als 8 Bändern neutral ab der 8. Band-Kante zusammen (AK1)', () => {
		const bands = spanBands(Array(9).fill(1 / 9));
		const slots = toSlotBands(bands, colors);

		expect(slots).toHaveLength(8);
		slots.slice(0, 7).forEach((slot, index) => expect(slot.color).toEqual(colors.pillars[index]));
		expect(slots[7].color).toEqual(colors.neutral);
		// Erste nicht mehr einzeln geführte Kante — sonst färbte Farbe 6 das 8. Band in deren Farbe.
		expect(slots[7].edge).toBeCloseTo((bands[7].x0 - 4) / 92, 5);
	});

	it('legt die Glas-Fugen exakt an die Kanten der SVG-Band-Rects (AK3)', () => {
		render(<VesselBalance pillars={vesselPillars} punkteProSaeule={punkte} />);
		const svg = screen.getByTestId('vessel-balance-svg');
		const rects = Array.from(svg.querySelectorAll('clipPath rect'));

		expect(rects).toHaveLength(6);
		const bands: GlassBand[] = rects.map((rect, index) => ({
			pillarId: index + 1,
			colorIndex: index,
			x0: Number(rect.getAttribute('x')),
			x1: Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')),
		}));
		const slots = toSlotBands(bands, colors);

		slots.forEach((slot, index) => {
			expect(slot.edge).toBeCloseTo((bands[index].x0 - 4) / 92, 5);
			if (index > 0) expect(slot.edge).toBeCloseTo((bands[index - 1].x1 - 4) / 92, 5);
		});
	});
});
