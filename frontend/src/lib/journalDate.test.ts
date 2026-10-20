import { describe, expect, it } from 'vitest';
import { formatDate } from './journalDate';

// Rote Spec-Tests für #2775 (Spec `docs/spec/issue-2775.md`, AK2/AK3): `formatDate` wird die
// einzige Definitionsstelle für kurzes UND langes Datum. Neu sind (a) volle ISO-Instants als
// Eingabe (Import-Vorschau, UTC-Mitternacht) und (b) die `{ format: 'short' }`-Option. Das
// Langformat bleibt unverändert (Verbraucher JournalTab/JournalStats).

/** Die `{ format }`-Option liefert die Umsetzungsphase (#2775) — bis dahin erweitert tippen. */
type FormatOptions = { format?: 'long' | 'short' };
const formatDateWithFormat = formatDate as unknown as (date: string, options?: FormatOptions) => string;

describe('formatDate (#2775, Spec docs/spec/issue-2775.md)', () => {
	it('formatiert Kalendertage weiterhin im Langformat (JournalTab/JournalStats unverändert)', () => {
		expect(formatDate('2026-11-02')).toBe('2. November 2026');
	});

	it('nimmt volle ISO-Instants an und bleibt im Langformat tagstabil (UTC-Kalendertag, nicht Runner-Zeitzone)', () => {
		expect(formatDate('2026-11-02T00:00:00.000Z')).toBe('2. November 2026');
	});

	it('liefert das kurze Zahlenformat der Import-Vorschau (de, ohne führende Nullen, tagstabil über timeZone UTC)', () => {
		expect(formatDateWithFormat('2026-11-02T00:00:00.000Z', { format: 'short' })).toBe('2.11.2026');
	});

	it('bedient Kalendertag und ISO-Instant über dieselbe Definitionsstelle', () => {
		expect(formatDateWithFormat('2026-11-02', { format: 'short' })).toBe('2.11.2026');
	});
});
