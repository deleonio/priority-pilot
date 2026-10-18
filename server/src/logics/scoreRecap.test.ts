import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#2689): Das Recap-Logikmodul existiert noch nicht. Der Import schlägt fehl,
// bis `server/src/logics/scoreRecap.ts` die hier eingeklagte Schnittstelle bereitstellt (AK3).
import {
	letzterTagVon,
	mittagDesTags,
	rundeAufZehntel,
	saeulenDifferenz,
	staerksteSaeuleVon,
	vormonatVon,
} from './scoreRecap.js';

/**
 * Vertrag für die verschobene Recap-Fachlogik (#2689, Spec docs/spec/issue-2689.md): die Fenster-,
 * Rundungs- und Aggregationshelfer der Recap-Endpunkte als reine Funktionen. Das Verhalten wird
 * byte-genau aus `routes/scores.ts` gespiegelt — die Endpunkt-Tests (scores-monthly/yearly-recap)
 * bleiben der Verhaltens-Spiegel und laufen unverändert.
 */
interface SaeulenStand {
	id: number;
	name: string;
	punkte: number;
}

describe('letzterTagVon', () => {
	it('AK3: letzter Kalendertag inkl. Schalttag (Date.UTC-Trick)', () => {
		assert.equal(letzterTagVon('2024-02'), '2024-02-29');
		assert.equal(letzterTagVon('2026-01'), '2026-01-31');
		assert.equal(letzterTagVon('2026-04'), '2026-04-30');
	});
});

describe('vormonatVon', () => {
	it('AK3: Jahreswechsel-sicher (2026-01 → 2025-12)', () => {
		assert.equal(vormonatVon('2026-01'), '2025-12');
		assert.equal(vormonatVon('2026-07'), '2026-06');
	});
});

describe('mittagDesTags', () => {
	// Die Stichtage der Route: `letzterTagVon(monat)` im Monatsrückblick, `${jahr}-12-31` im
	// Jahresrückblick — Berlin liegt im Sommer (CEST, UTC+2) bzw. Winter (CET, UTC+1) unterschiedlich.
	it('AK3: DST-Naht Europe/Berlin — Sommermittag 10:00 UTC', () => {
		assert.equal(mittagDesTags('2026-07-31', 'Europe/Berlin').toISOString(), '2026-07-31T10:00:00.000Z');
	});

	it('AK3: DST-Naht Europe/Berlin — Wintermittag 11:00 UTC', () => {
		assert.equal(mittagDesTags('2026-12-31', 'Europe/Berlin').toISOString(), '2026-12-31T11:00:00.000Z');
	});
});

describe('rundeAufZehntel', () => {
	it('AK3: rundet auf eine Dezimalstelle und schneidet FP-Dreck ab', () => {
		assert.equal(rundeAufZehntel(0.1 + 0.2), 0.3);
		assert.equal(rundeAufZehntel(2.34), 2.3);
		assert.equal(rundeAufZehntel(2.36), 2.4);
	});
});

describe('saeulenDifferenz', () => {
	it('AK3: Differenz je Säule, gerundet auf Zehntel', () => {
		const start: SaeulenStand[] = [
			{ id: 1, name: 'Bewegung', punkte: 1.2 },
			{ id: 2, name: 'Erholung', punkte: 4 },
		];
		const ende: SaeulenStand[] = [
			{ id: 1, name: 'Bewegung', punkte: 3.5 },
			{ id: 2, name: 'Erholung', punkte: 4.06 },
		];
		assert.deepEqual(saeulenDifferenz(start, ende), [
			{ id: 1, name: 'Bewegung', punkte: 2.3 },
			{ id: 2, name: 'Erholung', punkte: 0.1 },
		]);
	});

	it('AK3: fehlender Startstand zählt als 0 (Fenstereintritt ohne Säulenstand)', () => {
		const ende: SaeulenStand[] = [{ id: 3, name: 'Neu', punkte: 4.86 }];
		assert.deepEqual(saeulenDifferenz([], ende), [{ id: 3, name: 'Neu', punkte: 4.9 }]);
	});
});

describe('staerksteSaeuleVon', () => {
	it('AK3: eindeutiges Maximum gewinnt', () => {
		const saeulen: SaeulenStand[] = [
			{ id: 1, name: 'Bewegung', punkte: 2.3 },
			{ id: 2, name: 'Erholung', punkte: 5.1 },
		];
		assert.deepEqual(staerksteSaeuleVon(saeulen), { id: 2, name: 'Erholung', punkte: 5.1 });
	});

	it('AK3: alle gleich ⇒ null', () => {
		const saeulen: SaeulenStand[] = [
			{ id: 1, name: 'Bewegung', punkte: 3 },
			{ id: 2, name: 'Erholung', punkte: 3 },
		];
		assert.equal(staerksteSaeuleVon(saeulen), null);
	});

	it('AK3: leer ⇒ null', () => {
		assert.equal(staerksteSaeuleVon([]), null);
	});

	it('AK3: nur negative Werte ⇒ null (Basislinie 0 der bestehenden Reduce-Semantik)', () => {
		const saeulen: SaeulenStand[] = [
			{ id: 1, name: 'Bewegung', punkte: -5 },
			{ id: 2, name: 'Erholung', punkte: -2 },
		];
		assert.equal(staerksteSaeuleVon(saeulen), null);
	});
});
