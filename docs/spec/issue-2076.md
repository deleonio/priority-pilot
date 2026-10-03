# #2076 — Server: KI schlägt Anteil und Konfidenz je Säule vor

## Ziel

Der Klassifikator liefert je Säule einen **Anteil** (ganzzahlig 5–80, Summe exakt 100) neben der
bisherigen **Konfidenz** (0–100). Die KI-Neuzuordnung speichert genau diese Anteile, Korrekturen
mit Anteilen fließen als Few-Shot-Beispiele zurück — die Anteils-Vermutung des Modells wird damit
lernbar und in der Lebensbalance sichtbar.

## Voraussetzungen

- Additive Schnittstelle: optionales `share` in `PillarSuggestion` (`openapi.yml`) — kein
  Frontend-Teil in diesem Ticket (der Frontend-Spiegel folgt mit #2078).
- Konfidenz-Semantik unverändert: `WEAK_SIGNAL_CONFIDENCE_CEILING = 60` für Sinn/Mentale
  Gesundheit bleibt; Anteile werden NICHT auf 60 gedeckelt, nur auf 80.
- Normalisierung baut auf den Bausteinen in `server/src/logics/pillarShares.ts` auf
  (`distributeWithMinimum`/`roundSharesToTotal`) — keine zweite Rundungslogik.
- Fallback: Vorschläge **ohne** Anteil (alte Stub-Klassifikatoren, Frontend bis #2078) laufen
  weiterhin über die #1601-Konfidenz-Regel (`toContributions`) — Bestands-Verträge bleiben grün.

## Verträge

- **AK1 — Antwortformat:** System-Prompt und Antwortformat verlangen ALLE Säulen mit
  ganzzahligem `share` 5–80 und Summe 100, je Säule zusätzlich `confidence` 0–100 (Deckelung der
  schwachen Säulen auf 60 bleibt). Die „leere Liste“-Regel entfällt. `extractSuggestions` (geprüft
  über `classifyPillarsWithMistral`) gibt für gültige Modell-Antworten Anteil und Konfidenz je
  Säule zurück — Anteile unverändert durchgereicht, auch wenn sie über 60 liegen.
- **AK2 — Reparatur:** Unvollständige oder ungültige Antworten (Anteile fehlen, Summe ≠ 100,
  Werte außerhalb 5–80, Teilmenge von Säulen) bringt der Server auf eine gültige Verteilung über
  ALLE Säulen: ganzzahlig, jede ≥ 5, ≤ 80 (sofern mit der Säulenzahl lösbar — eine Säule bleibt
  bei 100), Summe exakt 100.
- **AK3 — Few-Shot:** Die Few-Shot-Beispiele des Prompts tragen gültige Anteile und enthalten
  mindestens einen Fokusfall (eine Säule dominant) und einen Mischfall (Treppenform 50/20/15/10/5
  ist nicht die einzige Form). Im API-Test führen Fokus- und Misch-Aufgabe über den gestubbten
  Klassifikator zu unterschiedlich verteilten Vorschlägen.
- **AK4 — Speicherung:** `reassignTaskPillarsForUser` (eigener und Admin-Lauf) speichert die
  vorgeschlagenen (normalisierten) Anteile und Konfidenzen in den TaskPillar-Zeilen, statt die
  Anteile aus der Konfidenz umzurechnen. Ohne Anteil gilt die bisherige Regel.
- **AK5 — Feedback-Loop:** `POST /tasks/suggest-pillars/feedback` akzeptiert optional einen
  Anteil je Säule (additiv zur Konfidenz, Typ-Fehler → 400). Gespeicherte Korrekturen mit Anteil
  fließen mit Anteil als Few-Shot-Beispiele ein; alte Zeilen ohne Anteil bleiben lad- und nutzbar.

## Testfälle

- TF1 (AK1/AK2, unit): `server/src/logics/pillarShares.test.ts` — `normalizeSuggestedShares`:
  gültige Verteilung unverändert; ungültige Vorgaben auf Summe 100 · min 5 · max 80 · ganzzahlig;
  eine Säule → 100; zwanzig Säulen → 20 × 5; leer → [].
- TF2 (AK1/AK2/AK3, unit): `server/src/express/suggest-pillars.test.ts` (classify-Describe mit
  gemocktem fetch) — gültige Antwort mit Anteilen durchgereicht (Sinn-Anteil 70 bleibt 70);
  System-Prompt verlangt Anteil 5–80/Summe 100 mit `share`-Feld und gibt die „leere Liste“-Regel
  auf; Fehlerfälle (Anteile fehlen, Summe 150, Anteil 90, 2 von 5 Säulen) → Verteilung über alle
  5 Säulen innerhalb der Invarianten; Few-Shot-Payloads valide mit Fokus- und Mischfall.
- TF3 (AK1/AK3, API): `server/src/express/suggest-pillars.test.ts` (Route-Describe) — Response
  trägt je Säule einen ganzzahligen Anteil; Fokus- und Misch-Aufgabe liefern unterschiedliche
  Verteilungen.
- TF4 (AK4, API): `server/src/express/routes/reassign-own-pillars.test.ts` — Stub-Klassifikator
  mit Anteilen und Konfidenzen → TaskPillar-Zeilen tragen exakt diese Werte.
- TF5 (AK5, API): `server/src/express/suggest-pillars.test.ts` (Feedback-Describe) — POST mit
  Anteil → 201 und Anteil gespeichert; POST mit nicht-zahlreichem Anteil → 400; gelernte
  Korrektur mit Anteil erreicht den Klassifikator mit Anteil; Altzeile ohne Anteil bleibt
  gültiges Beispiel.

## Test-Pflege-Bedarf

- `server/src/express/suggest-pillars.test.ts` „parst gültige Antwort, filtert unbekannte IDs …“:
  erwartete bisher die unveränderte **Teilmenge** als Ausgabe. Ab #2076 vervollständigt der Server
  Teilmengen über ALLE Säulen (AK2) — die Erwartung wurde auf die neue Vervollständigung
  umgeschrieben; Filter unbekannter IDs und Sortierung bleiben geprüft.
