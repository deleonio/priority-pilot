import { describe, expect, it } from 'vitest';
import { seriesBadge } from './series';

/**
 * Rote Spec-Tests (#142, AK 2) für die reine Ableitungslogik der Instanz-Kennzeichnung.
 *
 * `seriesBadge` leitet allein aus `seriesId`/`isException` eines Tasks ab, ob — und wie — er in der
 * Aufgaben-Tabelle als zu einer Serie gehörig gekennzeichnet wird. Drei Fälle (siehe Triage #142):
 *   - Einzelaufgabe (`seriesId == null`)           → **kein** Badge (`null`).
 *   - Reguläre Serien-Instanz (`isException` false) → Badge `variant: 'instance'`.
 *   - Geänderte Instanz / Ausnahme (`isException`)  → Badge `variant: 'exception'`.
 *
 * Bewusst als reine Funktion getestet (kein DOM): die Tabelle (`TaskTable.tsx`) konsumiert das
 * Ergebnis nur noch fürs Rendern. Rot, weil `./series` noch nicht existiert; grün, sobald die
 * Umsetzung die Funktion mit genau diesem Vertrag liefert.
 */
describe('seriesBadge', () => {
	it('liefert kein Badge für eine gewöhnliche Einzelaufgabe (seriesId null)', () => {
		expect(seriesBadge({ seriesId: null, isException: false })).toBeNull();
	});

	it('liefert kein Badge, wenn seriesId fehlt (undefined)', () => {
		expect(seriesBadge({ seriesId: undefined, isException: false })).toBeNull();
	});

	it('kennzeichnet eine reguläre Serien-Instanz als zur Serie gehörig', () => {
		const badge = seriesBadge({ seriesId: 7, isException: false });

		expect(badge).not.toBeNull();
		expect(badge?.variant).toBe('instance');
		// Sichtbares, deutsches Label, das die Serien-Zugehörigkeit ausweist.
		expect(badge?.label).toMatch(/Serie/);
	});

	it('kennzeichnet eine individuell geänderte Instanz als Ausnahme', () => {
		const badge = seriesBadge({ seriesId: 7, isException: true });

		expect(badge).not.toBeNull();
		expect(badge?.variant).toBe('exception');
		// Die Ausnahme wird als „geändert" gegenüber dem Template ausgewiesen.
		expect(badge?.label).toMatch(/geändert/);
	});

	it('unterscheidet reguläre Instanz und Ausnahme sichtbar voneinander', () => {
		const instance = seriesBadge({ seriesId: 7, isException: false });
		const exception = seriesBadge({ seriesId: 7, isException: true });

		expect(instance?.variant).not.toBe(exception?.variant);
		expect(instance?.label).not.toBe(exception?.label);
	});

	it('behandelt eine fehlende isException-Angabe wie eine reguläre Instanz', () => {
		// `isException` ist im Vertrag optional mit Default `false` — ohne Angabe gilt: keine Ausnahme.
		const badge = seriesBadge({ seriesId: 7 });

		expect(badge?.variant).toBe('instance');
	});
});
