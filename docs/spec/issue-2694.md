# Spec #2694 — Verteilungs-Logik pinnen (Spiegel-Tests, ADR 0025)

## Ziel

Server (`server/src/logics/pillarShares.ts`) und Frontend (`frontend/src/lib/pillar.ts`) tragen
dieselben Verteilungsregeln als bewusstes Duplikat ([ADR 0025](../adr/0025-geteilte-fachlogik-duplikat-spiegel-tests.md)).
Damit die Fassungen nicht auseinanderdriften, pinnen Spiegel-Testblöcke in beiden Suiten
**dieselben Eingabe-Fälle gegen identische (harte) Ausgaben**. Referenz-Vertrag ist die
Server-Fassung; weicht das Frontend ab, wird es in der Umsetzung angeglichen.

## Vorbedingung

- `suggestRankedShares` (Server) und `distributionFromRankOrder` (Frontend) implementieren die
  Rang-Treppe 50/20/15/10/5 (`SHARE_TOTAL` = 100, `SHARE_MIN` = 5).
- Bekannte Drift (deckt der Spiegel auf): Bei mehr als 5 gerankten Säulen pinnt der Server
  Ränge ab 6 auf 5 % bzw. kippt in die Gleichverteilung, das Frontend behandelt Ränge ab 6 als
  unrankt — bei sehr vielen Säulen rutscht der unrankte Anteil dort unter `SHARE_MIN`.

## Fälle des Spiegel-Blocks (in BEIDEN Suiten identisch)

| Fall                                   | Eingabe                          | Erwartung (Server-Referenz)                                       |
| -------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| Gleichverteilung 5                     | keine Ränge, n=5                 | `[20, 20, 20, 20, 20]`                                            |
| Gleichverteilung 7                     | keine Ränge, n=7                 | `[15, 15, 14, 14, 14, 14, 14]`                                    |
| Rundungsreste mit Gleichstand          | Ränge 1, n=5                     | `[50, 13, 13, 12, 12]` (Rest-Gleichstand → Listenordnung)         |
| Kippen unter `SHARE_MIN` (Rang-Treppe) | Ränge 1–3, n=7                   | `[15, 15, 14, 14, 14, 14, 14]` (Rest 15/4 < 5 → Gleichverteilung) |
| Mehr als 5 Ränge, Rest unrankt         | Ränge 1–5, n=7                   | `[15, 15, 14, 14, 14, 14, 14]`                                    |
| Sechs Ränge                            | Ränge 1–6, n=7                   | `[15, 15, 14, 14, 14, 14, 14]`                                    |
| Kippen unter `SHARE_MIN` (Vorgabe)     | Basis `[90, 0, 0, 0, 0]`         | `[80, 5, 5, 5, 5]`                                                |
| Rundungsreste (Vorgabe)                | Basis `[33.4, 33.3, 33.3, 0, 0]` | `[30, 30, 30, 5, 5]`                                              |

Zugriff über die jeweilige öffentliche API: Server `suggestRankedShares` /
`distributeWithMinimum`; Frontend `distributionFromRankOrder` / `evenShares` /
`fillContributions` (Vorgabe-Fälle über bestehende Beiträge mit `share` = Basis).

## Erwartetes Ergebnis

- Beide Suiten fordern für jede Zeile der Tabelle exakt dieselbe Ausgabe.
- Server-Suite: grün (Referenz wird gepinnt).
- Frontend-Suite: rot bei den Drift-Fällen (Rang-Treppe mit n=7 und mehr als 5 Rängen) —
  die Umsetzung gleicht das Frontend an die Server-Fassung an.

## Von der Umsetzung zu liefern (nicht Teil des Spec-PRs)

- AK2: Kommentar-Bindung beider Quellfassungen auf ADR 0025 (Server = Referenz, Leserichtung
  Server → Frontend, Pflicht zur Übertragung in die Gegenseite) — Quelltextänderung, gehört in
  den Umsetzungs-PR (Spec-PR darf keinen Produktivcode ändern).
- AK3: Einmaliger Mutationstest-Nachweis im Umsetzungs-PR (z. B. `Math.ceil` statt
  Largest-Remainder in genau einer Fassung → Spiegel-Tests dieser Seite rot).
- Angleichung der Frontend-Abweichungen (Drift-Fälle oben) an die Server-Referenz.
