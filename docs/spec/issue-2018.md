# Spec: [P1] Gruppe: Pipeline- und Teststabilität (#2018)

**Stand:** 2026-10-03
**Ziel:** Klären, was für die Gruppe #2018 an roten Tests ableitbar ist — und was bewusst nicht.

## Kontext

#2018 ist ein **Sammelticket** (Zwischenebene des Epics #2016): Es bündelt vier Blatt-Issues
(#1952, #1954, #1953, #1939) und trägt selbst laut Issue-Text die Vorgabe
**„nicht in die Pipeline geben"** — es hat keine eigene Umsetzung, keinen App-Code und keine App-UI.
Der KI-UX-Block im Harness-Kommentar bestätigt das: keine eigene UI-Fläche, der Fortschrittsbalken
ist das GitHub-native Sub-Issue-Progress-Element des Eltern-Tickets (Plattform-Funktion).

## Akzeptanzkriterien und Testbarkeit

| AK  | Text (Issue)                                                           | Testbarkeit                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | „Alle Blatt-Issues des Themas sind unter dieser Gruppe versammelt"     | GitHub-Sub-Issue-Struktur — Repo-/Plattform-Zustand, kein Anwendungscode. Ein Check darauf wäre ein Zustandsabfrage-Skript gegen die GitHub-API, kein auswertbarer App-Test (ADR 0001). |
| 2   | „Der Fortschrittsbalken der Gruppe zeigt den Stand ihrer Blatt-Issues" | GitHub-natives Progress-Element des Sub-Issue-Features — reine Plattform-Funktion, kein App-Code, nicht testbar.                                                                        |

**Ergebnis: Kein AK ist als ausführbarer Anwendungs-Test ableitbar.** Nach Skill-Regel
(„Non-application code → write no test") entstehen daher **keine roten Tests**; das ist die
spezifizierte, bewusste Entscheidung dieser Phase — kein Rückstand.

## Ergebnis der Spec-Phase

- `docs/spec/issue-2018.md` (diese Datei) als Vertrag: dokumentiert die beiden AKs und ihre
  Begründung, warum sie keinen App-Test tragen.
- Keine Testdateien, kein Produktivcode, keine Konfiguration.

## Offene Fragen (für den PR-Body)

- #2018 ist trotz „nicht in die Pipeline geben" über die Label-Kette in die Spec-Phase gelangt.
  Die eigentlichen Pipeline- und Test-Themen sind die Blatt-Issues #1952, #1954, #1953 und #1939 —
  dort laufen UX/Spec/Impl jeweils eigenständig.
