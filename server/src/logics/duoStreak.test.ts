import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// ROTER Spec-Test (#1974, docs/spec/issue-1974.md, AK3): `duoStreak.ts` existiert noch nicht.
import { berechneDuoStreak } from './duoStreak.js';

const tag = (d: string): Date => new Date(`${d}T12:00:00.000Z`);
const HEUTE = tag('2026-10-05');

describe('berechneDuoStreak (#1974 AK3)', () => {
	it('zaehlt nur Tage, an denen beide Mitglieder etwas erledigt haben', () => {
		const a = [tag('2026-10-03'), tag('2026-10-04'), tag('2026-10-05')];
		const b = [tag('2026-10-04'), tag('2026-10-05')];
		const r = berechneDuoStreak(a, b, HEUTE, 'UTC');
		assert.equal(r.aktuell, 2);
		assert.equal(r.best, 2);
	});

	it('erledigt nur einer, ist der Streak 0', () => {
		const r = berechneDuoStreak([tag('2026-10-04'), tag('2026-10-05')], [], HEUTE, 'UTC');
		assert.equal(r.aktuell, 0);
		assert.equal(r.best, 0);
	});

	it('eine Luecke eines Mitglieds bricht die Folge; best bleibt erhalten', () => {
		const a = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-04', '2026-10-05'].map(tag);
		const b = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05'].map(tag);
		const r = berechneDuoStreak(a, b, HEUTE, 'UTC');
		assert.equal(r.aktuell, 1);
		assert.equal(r.best, 3);
	});
});
