# Spec: Hauptsäulen-Modus für die Säulenverteilung (#1962)

> **Ablöst:** Der hier beschriebene Hauptsäulen-Modus (Einzelsäule mit share 100) ist mit #2077
> durch die Vollverteilung ersetzt (je 5–80 %, Summe 100) — siehe `docs/spec/issue-2077.md`.

## Ziel

Eine Aufgabe ist mit genau einer gewählten Hauptsäule speicherbar (Anteil 100 %). Die Verteilung
der übrigen Säulen ist kein Zwang mehr, sondern ein übernehmbarer Vorschlag: der KI-Vorschlag
(`suggestPillars`), wenn verfügbar, sonst die feste Regel „Hauptsäule 80 %, Rest gleichmäßig mit
je mindestens 5 %“. Wert- und Balance-Berechnung bleibt unverändert proportional (`share/100`).

## Voraussetzungen

- Die fünf Säulen sind fest (#1573); der Server akzeptiert die Einzel-Form bereits
  (`validatePillars` erzwingt die Summe 100 nur bei nicht-leerer Beitragsliste).
- Der Client darf die Einzel-Form nicht mehr künstlich verhindern: das heutige
  Vorbelegen aller fünf Säulen beim Mount (`fillContributions`) entfällt im Anlege-Flow.

## Verhalten

### Hauptsäule wählen (AK2)

1. Der Aufgaben-Dialog bietet eine Auswahlliste „Hauptsäule“ mit den fünf Säulen.
2. Ohne Wahl rendert der Säulen-Editor **keine** Beitragszeilen (keine stillen Vorbelegungen).
3. Nach Wahl der Hauptsäule zeigt der Editor **genau eine** Beitragszeile (die Hauptsäule,
   Anteil 100 %). „Anlegen“ ist absendbar; das Payload enthält genau einen Beitrag
   `{ pillarId, share: 100, confidence: 100 }`.

### Restverteilung als Vorschlag (AK3)

4. Nach Wahl der Hauptsäule zeigt der Dialog einen Vorschlags-Block mit den Schaltflächen
   „Vorschlag übernehmen“ und „Verwerfen“. Herkunft des Vorschlags steht als Text dabei
   („KI-Vorschlag“ bzw. „Regelvorschlag“); der Regel-Fallback ist synchron immer verfügbar.
5. **Regel-Fallback:** `suggestMainDistribution(mainPillarId, pillars)` (Frontend,
   `frontend/src/lib/pillar.ts`) bzw. der Spiegel `suggestMainShares(mainIndex, count)`
   (Server, `server/src/logics/pillarShares.ts`) liefert: Hauptsäule 80 %, jede übrige Säule
   gleichmäßig mit je mindestens 5 % (bei fünf Säulen `[80, 5, 5, 5, 5]`), ganzzahlig, Summe
   exakt 100, `confidence` 100. Unbekannte Hauptsäule → leere Liste; eine einzige Säule → 100 %.
6. „Übernehmen“ wendet den Vorschlag an (fünf Beitragszeilen); „Verwerfen“ behält den
   Ein-Säulen-Zustand — das anschließende Speichern enthält nur die Hauptsäule.
7. Ist der KI-Vorschlag verfügbar (Entitlement + gelungener `suggestPillars`-Aufruf), wird er
   als Vorschlag angezeigt statt der Regel; die Übernahme-Mechanik ist identisch
   (`suggestionsToContributions`, unverändert).

### Feinverteilung (AK4)

8. Die Schieberegler bleiben: ein Reglerzug hält die Summe exakt 100 und jeden Anteil ≥ 5 %
   (`redistributeShares`, unverändert — durch bestehende Tests gesichert).

### Berechnung (AK5)

9. Wert (`value`), Score, Herzbalance und Fürsorge-Defizit gewichten Beiträge proportional
   (`share/100`) und laufen für beide Speicherformen (Einzel-Säule und Verteilung) fehlerfrei —
   durch bestehende Tests gesichert (value.test.ts #423 AK1/AK3), kein neues Verhalten.

### Mobile (AK6)

10. Bei 375 px bleiben Hauptsäulen-Auswahl, Vorschlags-Block und Speichern bedienbar; nichts
    ragt horizontal über den Viewport (Bounding-Box-Prüfung).

## Server (AK1)

- `POST /tasks` (und `PATCH /tasks/:id`) speichern Beiträge mit genau einer Säule
  (share 100) als genau eine `task_pillars`-Zeile; vollständige Verteilungen (Summe 100)
  bleiben unverändert akzeptiert, Summe ≠ 100 bei mehreren Zeilen bleibt 400.

## Testabdeckung

| AK  | Test                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| AK1 | `server/src/express/api.test.ts` — POST mit einer Säule share 100 → 201, genau eine Zeile                                      |
| AK2 | `frontend/src/components/TaskForm.test.tsx` — keine Vorbelegung, genau eine Zeile, Payload mit genau einem Beitrag             |
| AK3 | `frontend/src/lib/pillar.test.ts` + `server/src/logics/pillarShares.test.ts` (Regel) und TaskForm-Tests (Übernehmen/Verwerfen) |
| AK4 | bestehende `redistributeShares`-Tests (dedup, kein neuer Test)                                                                 |
| AK5 | bestehende value/Balance-Tests (dedup, kein neuer Test)                                                                        |
| AK6 | `frontend/e2e/issue-1962-hauptsaule.spec.ts` (375 px, Bounding-Box)                                                            |

## Offene Fragen

- (keine blockierenden) Wie in der Analyse: die Einzel-Form wird beim Speichern **nicht**
  automatisch zur Vollverteilung ergänzt — „beide Formen“ bleiben als gespeicherte Form gültig.
