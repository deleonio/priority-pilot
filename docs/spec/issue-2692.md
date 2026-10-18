# Spec: Issue 2692 — Apply-Tests für mehrere Vorlagen mit festen Sollzahlen

Quelle: Review-Finding F-12 (#2675). Reiner Testausbau in `server/src/express/templates.test.ts`
— kein Produktivcode, das Ticket IST der Testfall.

## Ziel

Die Apply-Tests behaupten Aufgaben- und Kantenzahlen als feste Literale statt sie zur Laufzeit
aus `TEMPLATES` abzuleiten (`edgeCount()`). Ein stiller Drift zwischen Vorlagendaten
(`server/src/logics/templates.ts`, von der Website mitgenutzt) und dem Übernahme-Verhalten
fällt damit laut auf, statt die Erwartungswerte mitzuschwimmen.

## Voraussetzungen

- `TEMPLATES` ist die gemeinsame Datenquelle von Server und Website (Identitätstest AK6 aus
  `docs/spec/issue-1993.md` bleibt unberührt).
- POST `/templates/:slug/apply` legt Kategorie, Aufgaben und Abhängigkeiten in einer
  Sequelize-Transaktion an.

## Schritte / Erwartungen (AK-Deckung)

- AK1: HTTP-Apply für `hausbau` (9 Aufgaben / 10 Kanten), `umzug` (8 / 8) und
  `steuererklaerung` (7 / 6) — je feste Literale für Aufgaben- und Kantenzahl plus Kategorie
  mit Vorlagentitel.
- AK2: Abhängigkeitskette einer Vorlage per Kanten-Mengenvergleich über mindestens drei
  Stufen (hausbau budget→finanzierung→bauvertrag→einzug) — vom bestehenden
  hausbau-Übernahme-Test vollständig abgedeckt; kein Duplikat (Dedup).
- AK3: Rollback-Test bleibt erhalten: injizierter Fehler mitten in der Transaktion →
  0 Aufgaben, 0 Kanten, 0 Kategorien (bestehender Test, unverändert).
- AK4: Keine Sollzahl mehr aus Quelldaten abgeleitet: `edgeCount()`-Hilfsfunktion entfällt;
  Preview-Test behauptet `dependencyCount` 10, Doppel-Apply-Test 18 Aufgaben / 20 Kanten als
  Literale. Lesezugriff auf `TEMPLATES` nur noch für Slug-/Struktur-Auswahl (Kettenvergleich).

## Offene Fragen

- keine
