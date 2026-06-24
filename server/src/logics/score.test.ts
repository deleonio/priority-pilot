import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#121): Das Gamification-Scoring-Modul existiert noch nicht. Der Import schlägt
// fehl, bis `server/src/logics/score.ts` die hier eingeklagte Schnittstelle bereitstellt.
import { berechneScore, aggregierePunkteProSaeule } from './score.js';

/**
 * Vertrag für das Gamification-Scoring (Konzept §4.4), unabhängig vom Wertbeitrag (`value.ts`).
 *
 * `berechneScore(deadline, erledigtAm)` liefert `{ punkte, pünktlich }`:
 *  - pünktlich (vor/zur Deadline oder ohne Deadline) ⇒ volle Punktzahl, `pünktlich = true`.
 *  - verspätet (nach der Deadline) ⇒ reduzierte Punktzahl (< voll, >= 0), `pünktlich = false`.
 *
 * Die exakte Punktekurve ist in §11 bewusst offen; der Test fixiert daher **Invarianten**
 * (volle Punkte sind positiv und über alle pünktlichen Fälle gleich; verspätet ist echt reduziert),
 * nicht eine konkrete Abschlagsformel.
 */
describe('berechneScore', () => {
	const erledigtAm = new Date('2026-06-24T12:00:00.000Z');

	// Referenz für „volle Punktzahl": ein Task ohne Deadline gilt als pünktlich (AK3).
	const vollePunktzahl = berechneScore(null, erledigtAm).punkte;

	it('AK3: ohne Deadline gilt als pünktlich und gibt volle Punkte', () => {
		const result = berechneScore(null, erledigtAm);
		assert.equal(result.pünktlich, true);
		assert.ok(result.punkte > 0, 'volle Punktzahl muss positiv sein');
	});

	it('AK1: Erledigung vor der Deadline ist pünktlich und gibt volle Punkte', () => {
		const deadline = new Date('2026-06-30T00:00:00.000Z'); // Zukunft relativ zu erledigtAm
		const result = berechneScore(deadline, erledigtAm);
		assert.equal(result.pünktlich, true);
		assert.equal(result.punkte, vollePunktzahl);
	});

	it('AK1 (Grenzfall): Erledigung exakt zur Deadline ist pünktlich (erledigt_am <= deadline)', () => {
		const result = berechneScore(erledigtAm, erledigtAm);
		assert.equal(result.pünktlich, true);
		assert.equal(result.punkte, vollePunktzahl);
	});

	it('AK2: Erledigung nach der Deadline ist verspätet und gibt reduzierte Punkte', () => {
		const deadline = new Date('2026-06-20T00:00:00.000Z'); // Vergangenheit relativ zu erledigtAm
		const result = berechneScore(deadline, erledigtAm);
		assert.equal(result.pünktlich, false);
		assert.ok(result.punkte < vollePunktzahl, 'verspätet muss echt weniger Punkte als pünktlich geben');
		assert.ok(result.punkte >= 0, 'Punkte dürfen nicht negativ werden');
	});
});

/**
 * AK4: Punkte verteilen sich anteilig (über `share` aus `task_pillars`) auf die Säulen und werden
 * je Säule aufsummiert. Eingabe: je erledigtem Task die vergebenen `punkte` und seine Säulen-Anteile
 * `{ pillarId, share }` (share in Prozent, Summe je Task = 100). Ausgabe: Summe je `pillarId`.
 */
describe('aggregierePunkteProSaeule', () => {
	it('verteilt die Punkte eines Tasks anteilig nach share auf die Säulen', () => {
		const summen = aggregierePunkteProSaeule([
			{
				punkte: 100,
				beitraege: [
					{ pillarId: 1, share: 60 },
					{ pillarId: 2, share: 40 },
				],
			},
		]);
		assert.equal(summen.get(1), 60);
		assert.equal(summen.get(2), 40);
	});

	it('summiert die Säulen-Anteile über mehrere Tasks', () => {
		const summen = aggregierePunkteProSaeule([
			{ punkte: 100, beitraege: [{ pillarId: 1, share: 100 }] },
			{
				punkte: 50,
				beitraege: [
					{ pillarId: 1, share: 50 },
					{ pillarId: 2, share: 50 },
				],
			},
		]);
		assert.equal(summen.get(1), 125); // 100 + 25
		assert.equal(summen.get(2), 25); //   0 + 25
	});

	it('liefert für einen Task ohne Säulen keine Säulen-Summen', () => {
		const summen = aggregierePunkteProSaeule([{ punkte: 100, beitraege: [] }]);
		assert.equal(summen.size, 0);
	});
});
