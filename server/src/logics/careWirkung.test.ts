import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneCareWirkung, type CareWirkungEingabe } from './careWirkung.js';

/**
 * #1798 AK3/AK4 mit steuerbarer Uhr: „ignoriert“ erst für Wochen, deren Ende ≥ 7 Tage zurückliegt;
 * Bindung je Push-Stand in der Zielwoche (Verlauf vor aktuellem Wert), Zellen < 5 unterdrückt.
 */
const TAG = 86_400_000;
const kohorte = new Date('2026-01-05T10:00:00Z'); // Montag
const inWoche = (n: number, tag = 1): Date => new Date(Date.parse('2026-01-05') + (n * 7 + tag) * TAG);

describe('berechneCareWirkung (#1798)', () => {
	it('AK3: ignoriert = angezeigt − übernommen − abgelehnt, erst für Wochen ≥ 7 Tage zurück', () => {
		const eingabe: CareWirkungEingabe = {
			ereignisse: [
				{ woche: '2026-01-05', reaktion: 'angezeigt', anzahl: 10 },
				{ woche: '2026-01-05', reaktion: 'uebernommen', anzahl: 2 },
				{ woche: '2026-01-05', reaktion: 'abgelehnt', anzahl: 3 },
				{ woche: '2026-01-12', reaktion: 'angezeigt', anzahl: 4 },
			],
			nutzer: [],
			pushWechsel: [],
			erledigungen: [],
		};
		const { wochen } = berechneCareWirkung(eingabe, new Date('2026-01-19T00:00:00Z'));
		assert.deepEqual(
			wochen.map((w) => [w.woche, w.ignoriert]),
			[
				['2026-01-05', 5],
				['2026-01-12', 0],
			],
		);
	});

	it('AK4/AK5: Bindung nach Push-Stand in der Zielwoche, kleine Gruppe unterdrückt', () => {
		const nutzer = [1, 2, 3, 4, 5, 6].map((id) => ({ id, registriertAm: kohorte, carePushEnabled: id < 5 }));
		const eingabe: CareWirkungEingabe = {
			ereignisse: [],
			// Nutzer 5 schaltet erst nach Woche 12 ab → in beiden Zielwochen „an"; Nutzer 6 schon vor Woche 4.
			nutzer: [...nutzer, { id: 7, registriertAm: inWoche(12), carePushEnabled: true }],
			pushWechsel: [
				{ userId: 6, aktiv: false, geaendertAm: inWoche(0, 2) },
				{ userId: 5, aktiv: false, geaendertAm: inWoche(20) },
			],
			erledigungen: [
				{ userId: 1, zeitpunkt: inWoche(4) },
				{ userId: 2, zeitpunkt: inWoche(4, 6) },
				{ userId: 3, zeitpunkt: inWoche(12) },
				{ userId: 4, zeitpunkt: inWoche(5) },
			],
		};
		const { bindung } = berechneCareWirkung(eingabe, inWoche(14));
		assert.deepEqual(bindung.push_an, {
			w4: { nutzer: 5, aktiv: 2, quote: 0.4 },
			w12: { nutzer: 5, aktiv: 1, quote: 0.2 },
		});
		assert.deepEqual(bindung.push_aus, { w4: 'unterdrueckt', w12: 'unterdrueckt' });
	});
});
