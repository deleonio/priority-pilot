# journalDate: ISO-Verzweigung robust machen (Format statt Stringlänge)

**Stand:** 2026-10-20

`formatDate` (`frontend/src/lib/journalDate.ts:35`) verzweigt aktuell nach Stringlänge
(`date.length > 10`), nicht nach Format. Ziel: die Verzweigung erkennt den Kalendertag am
Format (Regex `^\d{4}-\d{2}-\d{2}$` → `T00:00:00Z` anhängen), alles andere geht als ISO-Instant
durch `new Date(date)`. Der Vertrag aus #2775 bleibt unverändert: Kalendertag und ISO-Instant
zeigen beide den UTC-Kalendertag (`timeZone: 'UTC'`). Die sichtbaren Ausgaben ändern sich nicht.

## Verhalten (Kontrakt)

- Exakter Kalendertag `YYYY-MM-DD` (10 Zeichen): UTC-Mitternacht-Pfad, wie bisher
  (`new Date(date + 'T00:00:00Z')`).
- Alles andere: `new Date(date)` — volle ISO-Instants mit `Z` oder Offset, aber auch
  nicht-ISO-Eingaben. Der Kalendertag ist **nicht** an `date.length > 10` erkennbar, sondern am
  Format: `2026/11/02` ist zwar 10 Zeichen, matcht aber nicht → Instant-Pfad (`new Date`), statt
  invalidem `new Date('2026/11/02T00:00:00Z')`.
- Grenzfall Offset-Instant: `2026-11-02T00:00:00+02:00` → Instant `2026-11-01T22:00Z` →
  UTC-Kalendertag `1. November 2026` (Langformat) bzw. `1.11.2026` (Kurzformat). Verhalten ist
  identisch vor/nach der Umstellung (beide Male `new Date(date)`) — die Tests sichern es als
  Vertragssperre gegen versehentliche Pfad-Änderungen.
- Kurzformat-Tests rufen `formatDate(..., { format: 'short' })` direkt typisiert auf — der
  `formatDateWithFormat`-Cast und der Hilfstyp `FormatOptions` (Spec-Brücke aus #2775) entfallen,
  da die Option inzwischen Teil der Signatur ist.
- Verbraucher (`JournalTab.tsx:193`, `JournalStats.tsx:85-86`, `TaskImportCard.tsx:360`) und die
  lokalen `formatDate`-Helfer in `PaypalPurchase.tsx`/`PlayPurchase.tsx` bleiben unangetastet.

## Testabdeckung

| AK  | Test                                                                                     | Anlaufzustand                                      |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AK1 | `journalDate.test.ts` — `2026/11/02` (10 Zeichen, kein Regex-Match) → `2. November 2026` | rot (`Invalid Date` über den alten Längen-Pfad)    |
| AK3 | `journalDate.test.ts` — Offset-Instant Lang- und Kurzformat → UTC-Kalendertag            | grün (Vertragssperre, Verhalten alt/neu identisch) |
| AK2 | die vier #2775-Tests bleiben unverändert grün                                            | grün                                               |
| AK4 | gleiche Datei — Kurzformat-Aufrufe ohne Cast direkt                                      | grün (AUFRUFE kompilieren, Hilfstyp entfernt)      |

Der AK1-Test nutzt V8s legacy parsing von `2026/11/02` (lokale Mitternacht = UTC-Mitternacht
unter dem `TZ: 'UTC'`-Pin aus `vitest.config.ts:45`, etabliert mit #2730) und beweist damit die
Format- statt Längen-Verzweigung: am alten Code scheitert er mit `Invalid Date`.
