import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
	avg,
	frac,
	indexTo,
	isoWeek,
	median,
	pct,
	quantile,
	rollingMedian,
	sealWeek,
	shareWithInterval,
	trendArrow,
	weekOf,
	wilson,
	xychart,
} from './report-stats.ts';

/**
 * Die Statistik-Helfer sind die Stelle, an der ein falscher Randfall still eine ganze
 * Berichtsspalte verschiebt: ein Quantil am Array-Ende, ein Wilson-Band über 100 %, eine
 * Jahresgrenze in der ISO-Woche, eine 0 im Chart, wo „keine Kohorte" gemeint war. Geprüft
 * werden deshalb die Ränder, nicht die Mitte.
 */

describe('report-stats', () => {
	it('quantile/median: unteres Element ohne Interpolation, leer = NaN', () => {
		assert.equal(quantile([1, 2, 3, 4], 0.5), 3);
		assert.equal(quantile([1, 2, 3, 4], 0.75), 4);
		assert.equal(quantile([1, 2, 3, 4], 1), 4, 'q = 1 bleibt im Array');
		assert.equal(quantile([7], 0), 7);
		assert.ok(Number.isNaN(quantile([], 0.5)));
		assert.equal(median([9, 1, 5]), 5, 'median sortiert selbst');
	});

	it('wilson: symmetrisch um 50 %, an den Rändern innerhalb [0, 1], bei n = 0 keine Aussage', () => {
		const mid = wilson(5, 10);
		assert.ok(mid.low > 0.23 && mid.low < 0.24, `low ${mid.low}`);
		assert.ok(mid.high > 0.76 && mid.high < 0.77, `high ${mid.high}`);
		const top = wilson(10, 10);
		assert.equal(top.high, 1);
		assert.ok(top.low > 0.72 && top.low < 0.73, '10/10 heißt nicht „sicher 100 %"');
		const zero = wilson(0, 10);
		assert.equal(zero.low, 0);
		assert.ok(zero.high < 0.28);
		assert.deepEqual(wilson(0, 0), { low: 0, high: 1 });
	});

	it('shareWithInterval: Intervall erst ab 8 Beobachtungen', () => {
		assert.equal(shareWithInterval(3, 5), '3/5 = 60 %');
		assert.match(shareWithInterval(6, 10), /^6\/10 = 60 % \(31–83 %\)$/);
		assert.equal(shareWithInterval(0, 0), '—');
	});

	it('isoWeek/sealWeek: Jahresgrenze und Berlin-Zeit', () => {
		assert.equal(isoWeek('2027-01-01'), '2026-W53', 'der 1.1.2027 gehört noch zur W53 von 2026');
		assert.equal(weekOf('2026-09-06T23:00:00Z'), '2026-W37', 'Sonntag 23:00 UTC ist in Berlin schon Montag');
		assert.equal(
			sealWeek([
				{ phase: 'implement', timestamp: '2026-09-02T10:00:00Z' },
				{ phase: 'documenter', timestamp: '2026-09-07T10:00:00Z' },
			]),
			'2026-W37',
			'Abschlusswoche = Woche des Siegels, nicht des ersten Laufs',
		);
		assert.equal(sealWeek([{ phase: 'implement', timestamp: '2026-09-02T10:00:00Z' }]), undefined);
	});

	it('rollingMedian: Fenster wächst bis zur Breite und rutscht dann', () => {
		assert.deepEqual(rollingMedian([1, 9, 3, 7, 5], 3), [1, 9, 3, 7, 5]);
		assert.deepEqual(rollingMedian([1, 2, 3, 100, 100], 2), [1, 2, 3, 100, 100]);
		assert.deepEqual(rollingMedian([], 4), []);
	});

	it('indexTo/trendArrow: Index gegen Baseline, Pfeil an der rohen Änderung', () => {
		assert.equal(indexTo(4, 3), 75);
		assert.ok(Number.isNaN(indexTo(0, 3)), 'ohne Baseline kein Index');
		assert.equal(trendArrow(1, 1.0995), '→', '9,95 % ist „unter ±10 %“, nicht „↑ 10 %“');
		assert.equal(trendArrow(1, 1.25), '↑ 25 %');
		assert.equal(trendArrow(2, 1), '↓ 50 %');
		assert.equal(trendArrow(0, 1), '—');
	});

	it('Formatierer: de-DE mit Komma, Ø ohne Bezugsgröße „—"', () => {
		assert.equal(frac(1.25, 1), '1,3');
		assert.equal(avg(7, 2), '3,5');
		assert.equal(avg(7, 0), '—');
		assert.equal(pct(0.4444), '44,4 %');
	});

	it('xychart: Positionen mit NaN fallen samt Label weg, statt als 0 zu erscheinen', () => {
		const lines = xychart({
			title: 'T',
			labels: ['W35', 'W36', 'W37'],
			yLabel: '%',
			yMax: 100,
			series: [{ kind: 'bar', name: 'Rate', values: [44.4, Number.NaN, 60] }],
		});
		assert.equal(lines[3], '\tx-axis ["W35", "W37"]');
		assert.equal(lines[5], '\tbar "Rate" [44.4, 60.0]');
		assert.deepEqual(
			xychart({
				title: 'T',
				labels: ['W35'],
				yLabel: 'y',
				series: [{ kind: 'line', name: 'x', values: [Number.NaN] }],
			}),
			[],
			'ohne verbleibende Position kein Block — ein leerer xychart bricht das Rendering',
		);
	});
});
