import { describe, expect, it } from 'vitest';
import { formatDate } from './journalDate';

// Spec-Tests #2775 (Spec `docs/spec/issue-2775.md`): `formatDate` ist die einzige
// Definitionsstelle für kurzes UND langes Datum — Kalendertag (`YYYY-MM-DD`) und ISO-Instant
// (Import-Vorschau) zeigen beide den UTC-Kalendertag. Die `{ format }`-Option ist Teil der
// Signatur, Aufrufe erfolgen direkt ohne Cast (#2797, Spec `docs/spec/issue-2797.md`).

describe('formatDate (#2775, Spec docs/spec/issue-2775.md)', () => {
	it('formatiert Kalendertage weiterhin im Langformat (JournalTab/JournalStats unverändert)', () => {
		expect(formatDate('2026-11-02')).toBe('2. November 2026');
	});

	it('nimmt volle ISO-Instants an und bleibt im Langformat tagstabil (UTC-Kalendertag, nicht Runner-Zeitzone)', () => {
		expect(formatDate('2026-11-02T00:00:00.000Z')).toBe('2. November 2026');
	});

	it('liefert das kurze Zahlenformat der Import-Vorschau (de, ohne führende Nullen, tagstabil über timeZone UTC)', () => {
		expect(formatDate('2026-11-02T00:00:00.000Z', { format: 'short' })).toBe('2.11.2026');
	});

	it('bedient Kalendertag und ISO-Instant über dieselbe Definitionsstelle', () => {
		expect(formatDate('2026-11-02', { format: 'short' })).toBe('2.11.2026');
	});
});

describe('formatDate (#2797, Spec docs/spec/issue-2797.md)', () => {
	it('verzweigt nach Format statt Stringlänge: 10 Zeichen ohne Kalendertag-Format gehen durch new Date', () => {
		// `2026/11/02` ist 10 Zeichen (alter Längen-Pfad: `new Date('2026/11/02T00:00:00Z')` →
		// Invalid Date), matcht aber nicht ^\d{4}-\d{2}-\d{2}$ → Instant-Pfad. Läuft als lokale
		// Mitternacht = UTC-Mitternacht unter dem TZ=UTC-Pin (vitest.config.ts, #2730).
		expect(formatDate('2026/11/02')).toBe('2. November 2026');
	});

	it('ordnet ISO-Instant mit Offset dem UTC-Kalendertag zu (Langformat): 2026-11-02T00:00+02:00 → 1. November 2026', () => {
		expect(formatDate('2026-11-02T00:00:00+02:00')).toBe('1. November 2026');
	});

	it('ordnet ISO-Instant mit Offset dem UTC-Kalendertag zu (Kurzformat): 1.11.2026', () => {
		expect(formatDate('2026-11-02T00:00:00+02:00', { format: 'short' })).toBe('1.11.2026');
	});
});
