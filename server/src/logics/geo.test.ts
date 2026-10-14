import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinate } from './geo.js';

/**
 * Unit-Vertrag des zentralen Koordinaten-Parsers (#2553 AK4, Spec docs/spec/issue-2553.md):
 * `parseCoordinate(value, limit)` akzeptiert endliche Zahlen und numerische, getrimmte,
 * nicht-leere Strings und erzwingt `[-limit, limit]` (90 für Breite, 180 für Länge); alles
 * andere → `null`. Konsolidiert die drei bisherigen Parse-Stellen (geoConfig, tasks/nearby,
 * placeFavorites) — die `Number('') === 0`-Falle (#1101 F1) bleibt abgedeckt.
 */
describe('parseCoordinate (#2553 AK4)', () => {
	it('akzeptiert endliche Zahlen', () => {
		assert.equal(parseCoordinate(52.5219, 90), 52.5219);
		assert.equal(parseCoordinate(-13.4, 180), -13.4);
		assert.equal(parseCoordinate(0, 90), 0);
	});

	it('akzeptiert numerische, getrimmte, nicht-leere Strings (Query-Parameter)', () => {
		assert.equal(parseCoordinate('52.5', 90), 52.5);
		assert.equal(parseCoordinate('  13.4  ', 180), 13.4);
		assert.equal(parseCoordinate('-90', 90), -90);
	});

	it('erzwingt Breite ∈ [-90, 90]', () => {
		assert.equal(parseCoordinate(90, 90), 90);
		assert.equal(parseCoordinate(-90, 90), -90);
		assert.equal(parseCoordinate(90.1, 90), null);
		assert.equal(parseCoordinate(-90.1, 90), null);
	});

	it('erzwingt Länge ∈ [-180, 180]', () => {
		assert.equal(parseCoordinate(180, 180), 180);
		assert.equal(parseCoordinate(-180, 180), -180);
		assert.equal(parseCoordinate(180.1, 180), null);
		assert.equal(parseCoordinate(-180.1, 180), null);
	});

	it('weist Ungültiges mit null ab (u. a. Number("")-Falle, Arrays)', () => {
		assert.equal(parseCoordinate('', 90), null);
		assert.equal(parseCoordinate('   ', 90), null);
		assert.equal(parseCoordinate('abc', 180), null);
		assert.equal(parseCoordinate(null, 90), null);
		assert.equal(parseCoordinate(undefined, 90), null);
		assert.equal(parseCoordinate(Number.NaN, 90), null);
		assert.equal(parseCoordinate(Number.POSITIVE_INFINITY, 90), null);
		assert.equal(parseCoordinate([52.5], 90), null);
	});
});
