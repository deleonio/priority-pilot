# Spec #2689 — Recap-Fachlogik aus `routes/scores.ts` in `logics/` verschieben

## Ziel

Die Fenster-, Rundungs- und Aggregationslogik der Recap-Endpunkte (`/scores/monthly-recap`,
`/scores/yearly-recap`) wandert aus `server/src/express/routes/scores.ts` in ein neues reines
Modul `server/src/logics/scoreRecap.ts` (Schnittstellen-Muster `balanceHistory.ts`/`score.ts`:
Plain-Data rein, DB-Zugriff und Antwort bleiben in der Route). Nach außen sichtbares Verhalten
bleibt unverändert — identische API-Antworten.

## Vorbedingungen

- Bestandstests `server/src/express/scores-monthly-recap.test.ts` und
  `server/src/express/scores-yearly-recap.test.ts` bleiben unverändert und laufen grün
  (Verhaltens-Spiegel).
- `berechneBalanceVerlauf`, `meilensteinStandVon`, `berechneStreak` liegen bereits in `logics/`
  und wandern nicht. Einfache Anzeige-Rundungen wie `fuellstandProzent` in `/scores/balance`
  sind nicht Teil des Findings.

## Vertrag `server/src/logics/scoreRecap.ts`

| Export               | Signatur                                                          | Semantik (byte-genau aus der Route übernommen)                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `letzterTagVon`      | `(monat: string) => string`                                       | Letzter Kalendertag von `JJJJ-MM` als `YYYY-MM-DD` (Schaltjahr inklusive).                                                                                                                                       |
| `vormonatVon`        | `(monat: string) => string`                                       | Vormonat von `JJJJ-MM` als `JJJJ-MM`, jahreswechsel-sicher (`2026-01` → `2025-12`).                                                                                                                              |
| `mittagDesTags`      | `(tag: string, zeitZone: string) => Date`                         | UTC-Zeitpunkt 12:00 des lokalen Kalendertags in `zeitZone`; Offset über `Intl` an genau dieser Stelle zurückgerechnet (DST-Naht-fest: Berlin Sommer 10:00Z, Winter 11:00Z).                                      |
| `rundeAufZehntel`    | `(wert: number) => number`                                        | `Math.round(wert * 10) / 10` — eine Dezimalstelle, FP-Dreck wird abgeschnitten.                                                                                                                                  |
| `saeulenDifferenz`   | `(start: SaeulenStand[], ende: SaeulenStand[]) => SaeulenStand[]` | Differenz je Säule: `ende.punkte − start.punkte` (fehlender Start ⇒ 0), gerundet auf Zehntel. Deckt `monatsSaeulen` (Fenster: Monatsende minus Fenstereintritt) und `saeulenDifferenz` des Jahresrückblicks ab.  |
| `staerksteSaeuleVon` | `(saeulen: SaeulenStand[]) => SaeulenStand \| null`               | Größte Punktedifferenz; `null` bei leerer Liste, wenn alle gleich sind **oder** kein Wert über der Basislinie 0 liegt (bestehende Reduce-Semantik `punkte > beste?.punkte ?? 0` — Verhalten bleibt unverändert). |

`SaeulenStand = { id: number; name: string; punkte: number }`.

## Schritte / erwartetes Ergebnis

1. Die Route importiert die sechs Helfer aus `logics/scoreRecap.js`; `letzterTagVon`,
   `vormonatVon` und `mittagDesTags` sind dort nicht mehr definiert (AK1 — Struktur-Kriterium,
   Grep/Review, kein eigener Test).
2. Die Unit-Tests in `server/src/logics/scoreRecap.test.ts` verankern den Vertrag (AK3):
   - `vormonatVon` Jahreswechsel `2026-01` → `2025-12` sowie Normalfall;
   - `mittagDesTags` DST-Naht in `Europe/Berlin`: `2026-07-31` → `10:00Z` (CEST),
     `2026-12-31` → `11:00Z` (CET) — exakt die Stichtage der Route;
   - `rundeAufZehntel` inkl. Fließkomma-Falle (`0.1 + 0.2` → `0.3`);
   - `saeulenDifferenz` mit Rundung und fehlendem Startstand;
   - `staerksteSaeuleVon`: eindeutiges Maximum, alle gleich ⇒ `null`, leer ⇒ `null`,
     nur negative Werte ⇒ `null` (Basislinie 0).
3. Beide Recap-Endpunkttests laufen unverändert grün (AK2 — Spiegel-Test, in dieser Phase nicht
   angerührt).
4. `docs/fachlogik-inventar.md` erhält den Tabelleneintrag mit neuem Ort (AK4 — gehört in die
   Umsetzungsphase, da er das noch nicht existierende Modul referenziert).
