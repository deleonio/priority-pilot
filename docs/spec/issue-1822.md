# Issue 1822 — Säulen-Mindestanteil von 5 % auf allen Wegen erzwingen

Basis: Issue #1822 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-29T09:40:55Z).

## Ziel

`PUT /pillars/weights` und das MCP-Werkzeug `pillar_weights_set` (ruft denselben Endpunkt) lehnen jede
Verteilung ab, in der eine Säule unter 5 % liegt. Der UI-Regler erzwingt 5 % bereits; der Server prüft heute nur die Summe.

## Voraussetzungen

- Untergrenze: vorhandene Konstante `SHARE_MIN` (`server/src/logics/pillarShares.ts`), keine neue.
- Prüfung nach der Struktur-/Abdeckungsprüfung, mit der Summen-Toleranz `SUM_EPSILON` (Float-Verteilungen wie 33,33/33,33/33,34 bleiben gültig).
- Bestehende Fehlertexte (Summe, Abdeckung) bleiben unverändert.

## Akzeptanzkriterien

- **AK1:** Vollständige Abdeckung, Summe 100, eine Säule unter 5 % (100/0/0/0/0, 4,99) → HTTP 400, deutsche `message` mit „5 %“, Gewichte unverändert.
- **AK2:** `pillar_weights_set` mit derselben Verteilung → Fehler mit derselben Meldung (HTTP 400), nichts gespeichert.
- **AK3:** Exakt 5 % für eine Säule (80/5/5/5/5) → 200/Erfolg, persistiert (API und MCP).
- **AK4:** Die Beschreibung von `pillar_weights_set` nennt den Mindestanteil von 5 % je Säule.

## Test-Pflege

Die Tests „#1663 AK5" (`scores-balance.test.ts`, Körper-Gewicht 0: dritter Fall entfernt) und MCP-AK5/AK6 (`tools.test.ts`, Rest-Säulen 0) setzten
Gewichte unter 5 %; sie widersprechen AK1 und sind auf ≥ 5 % je Säule angepasst.
