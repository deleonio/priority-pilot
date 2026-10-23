import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { berechneAboUebersicht, type AboZeile } from './aboUebersicht.js';

/** #1338 AK7: „laufend" zählt gekündigt mit Restlaufzeit, nicht nach Laufzeitende, nie `approval_pending`. */
const TAG = 86_400_000;
const now = new Date('2026-10-19T12:00:00Z');
const inTagen = (tage: number): Date => new Date(now.getTime() + tage * TAG);
const abo = (status: string, tage: number, plan = 'plus', period = 'monthly'): AboZeile => ({
	plan,
	period,
	status,
	currentPeriodEnd: inTagen(tage),
});

describe('berechneAboUebersicht (#1338)', () => {
	it('AK7: zählt je Paket × Status, laufend, überfällig, Restlaufzeit und bald endend', () => {
		const uebersicht = berechneAboUebersicht(
			[
				abo('active', 10),
				abo('active', 60, 'pro', 'yearly'),
				abo('past_due', 3),
				abo('suspended', -2),
				abo('cancelled', 5),
				abo('cancelled', -1),
				abo('approval_pending', 30),
			],
			now,
		);
		assert.deepEqual(uebersicht, {
			byPlanAndStatus: {
				plus: { active: 1, past_due: 1, suspended: 1, cancelled: 2, approval_pending: 1 },
				pro: { active: 1 },
			},
			running: { plus: { monthly: 4 }, pro: { yearly: 1 } },
			overdue: 2,
			cancelledWithRemainingTerm: 1,
			endingWithin30Days: 3,
		});
	});
});
