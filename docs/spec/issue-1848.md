# Spec #1848 — Säulen-Stammdaten zentral über `key`

Ziel: Beschreibung und Wochen-Soll der fünf Standard-Säulen kommen aus **einem** Katalog im Code
(`server/src/models/pillarData.ts`), nicht aus der pro Nutzer kopierten DB-Zeile. Pro Nutzer wird nur
noch die Gewichtung gelesen.

## Vertrag

- `SEED_PILLARS`-Einträge tragen zusätzlich `key` (ASCII, eindeutig) und `rhythmusProWoche`
  (5/3/3/5/1 für Körper/Mentale Gesundheit/Beziehungen/Wirksamkeit/Sinn).
- `pillars.key` (nullbar): Seed und Konto-Anlage setzen ihn; `migratePillarKey(db)` (`migrate.ts`)
  backfillt Bestandszeilen nach Name, idempotent, No-op ohne Tabelle, Fremdnamen bleiben `null`.
- `PillarDto.key` (nullbar, additiv). `GET /pillars`, KI-Vorschlag und Säulen-Berater liefern für
  Zeilen mit bekanntem `key` die Katalog-Beschreibung, unabhängig von der DB-Spalte.
- `berechneLebensbalanceNachKadenz`: Rhythmus über `saeule.key` (Fallback 1×/Woche ohne `key`).
- Frontend `PillarList`: `t('pillars.<key>.description')` (Namespace `common`), Fallback auf die
  Server-Beschreibung, wenn der Schlüssel fehlt.

## Szenarien (AK → Test)

| AK  | Ergebnis                                                            | Test                             |
| --- | ------------------------------------------------------------------- | -------------------------------- |
| 1   | zwei Nutzer erhalten je Säule `key` + Katalog-Beschreibung          | `express/pillar-catalog.test.ts` |
| 2   | leere/abweichende DB-`description` → Katalogtext                    | `express/pillar-catalog.test.ts` |
| 3   | Migration setzt `key`, idempotent, Fremdname `null`                 | `logics/pillar-key.test.ts`      |
| 4   | Klassifikator und Berater bekommen Katalogtext bei leerer DB-Spalte | `express/pillar-catalog.test.ts` |
| 5   | Wochen-Soll über `key` (umbenannte Säule behält 5/Woche)            | `logics/pillar-key.test.ts`      |
| 6   | Gewichtung `PUT /pillars/weights` unverändert                       | bestehende `pillars.test.ts`     |
| 7   | `PillarList` zeigt Übersetzung, sonst Server-Text                   | `components/PillarList.test.tsx` |
