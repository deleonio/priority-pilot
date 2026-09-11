import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1362, Spec docs/spec/issue-1362.md): `berechneMeilensteine` existiert noch nicht.
// Der Import schlägt fehl, bis `server/src/logics/milestones.ts` die Funktion bereitstellt.
import { berechneMeilensteine } from './milestones.js';

/**
 * Vertrag für die Meilenstein-Berechnung (AK2/AK3/AK4/AK6, #1362).
 *
 * `berechneMeilensteine({ bestStreak, punkteSumme })` liefert genau eine Stufe je Definition
 * (Streak 3/7/14/30/100 Tage, dann Punkte 50/250/1000/5000), jeweils mit `schluessel`, `typ`
 * (`streak`|`punkte`), `schwelle` und `erreicht` (boolean).
 */

const STREAK_SCHWELLEN = [3, 7, 14, 30, 100];
const PUNKTE_SCHWELLEN = [50, 250, 1000, 5000];

describe('berechneMeilensteine', () => {
	it('AK2: liefert genau eine Stufe je Definition, in definierter Reihenfolge (Streak vor Punkte)', () => {
		const result = berechneMeilensteine({ bestStreak: 0, punkteSumme: 0 });
		assert.equal(result.length, STREAK_SCHWELLEN.length + PUNKTE_SCHWELLEN.length);
		assert.deepEqual(
			result.map((stufe) => stufe.schwelle),
			[...STREAK_SCHWELLEN, ...PUNKTE_SCHWELLEN],
		);
		assert.deepEqual(
			result.map((stufe) => stufe.typ),
			[...STREAK_SCHWELLEN.map(() => 'streak'), ...PUNKTE_SCHWELLEN.map(() => 'punkte')],
		);
		// Jede Stufe braucht einen eindeutigen Schlüssel (Rendering-Key im Frontend).
		const schluessel = result.map((stufe) => stufe.schluessel);
		assert.equal(new Set(schluessel).size, schluessel.length, 'schluessel müssen eindeutig sein');
	});

	it('AK3: Streak-Stufe bei bestStreak = Schwelle ist erreicht, bei Schwelle - 1 nicht', () => {
		const genauAufSchwelle = berechneMeilensteine({ bestStreak: 7, punkteSumme: 0 });
		const stufe7Erreicht = genauAufSchwelle.find((s) => s.typ === 'streak' && s.schwelle === 7);
		assert.equal(stufe7Erreicht?.erreicht, true, 'bestStreak = 7 muss die 7-Tage-Stufe erreichen');

		const knappDrunter = berechneMeilensteine({ bestStreak: 6, punkteSumme: 0 });
		const stufe7NichtErreicht = knappDrunter.find((s) => s.typ === 'streak' && s.schwelle === 7);
		assert.equal(stufe7NichtErreicht?.erreicht, false, 'bestStreak = 6 darf die 7-Tage-Stufe nicht erreichen');
	});

	it('AK3: Punkte-Stufe bei punkteSumme = Schwelle ist erreicht, bei Schwelle - 1 nicht', () => {
		const genauAufSchwelle = berechneMeilensteine({ bestStreak: 0, punkteSumme: 250 });
		const stufe250Erreicht = genauAufSchwelle.find((s) => s.typ === 'punkte' && s.schwelle === 250);
		assert.equal(stufe250Erreicht?.erreicht, true, 'punkteSumme = 250 muss die 250-Punkte-Stufe erreichen');

		const knappDrunter = berechneMeilensteine({ bestStreak: 0, punkteSumme: 249 });
		const stufe250NichtErreicht = knappDrunter.find((s) => s.typ === 'punkte' && s.schwelle === 250);
		assert.equal(stufe250NichtErreicht?.erreicht, false, 'punkteSumme = 249 darf die 250-Punkte-Stufe nicht erreichen');
	});

	it('AK4: Streak-Stufen werden gegen bestStreak geprüft, nicht gegen den aktuellen (gerissenen) Streak', () => {
		// aktuell=0 fließt gar nicht erst in die Funktion ein — nur bestStreak=30 wird übergeben.
		const result = berechneMeilensteine({ bestStreak: 30, punkteSumme: 0 });
		const streakStufen = result.filter((s) => s.typ === 'streak');
		assert.deepEqual(
			streakStufen.filter((s) => s.schwelle <= 30).map((s) => s.erreicht),
			[true, true, true, true],
			'die Stufen 3, 7, 14 und 30 müssen bei bestStreak=30 erreicht sein',
		);
		const stufe100 = streakStufen.find((s) => s.schwelle === 100);
		assert.equal(stufe100?.erreicht, false, 'die 100-Tage-Stufe darf bei bestStreak=30 nicht erreicht sein');
	});

	it('AK6: rückwirkende Auswertung — Bestandsdaten oberhalb mehrerer Schwellen markieren beim ersten Aufruf alle überschrittenen Stufen als erreicht', () => {
		const result = berechneMeilensteine({ bestStreak: 45, punkteSumme: 1200 });

		const streakErreicht = result.filter((s) => s.typ === 'streak').map((s) => s.erreicht);
		assert.deepEqual(streakErreicht, [true, true, true, true, false], '3/7/14/30 erreicht, 100 nicht');

		const punkteErreicht = result.filter((s) => s.typ === 'punkte').map((s) => s.erreicht);
		assert.deepEqual(punkteErreicht, [true, true, true, false], '50/250/1000 erreicht, 5000 nicht');
	});

	it('ohne jegliche Bestandsdaten ist keine Stufe erreicht', () => {
		const result = berechneMeilensteine({ bestStreak: 0, punkteSumme: 0 });
		assert.equal(
			result.every((stufe) => stufe.erreicht === false),
			true,
		);
	});
});
