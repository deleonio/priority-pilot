# Spec: Issue 1795 — Fürsorge-Hinweis bei Überlast

**Stand:** 2026-09-29 (Spec-Phase)
**Quellen:** Harness-Kommentar (KI-ANALYSE stand=2026-09-29T14:51:30Z), `docs/fuersorge-tonalitaet.md`, `docs/spec/issue-1790.md`, `docs/spec/issue-1791.md`, `docs/spec/issue-1793.md`.

## Ziel

Trägt eine Säule mehr als `UEBERLAST_ANTEIL` des jüngeren Aufwands (`bewerteCareDefizit(...).ueberlast`), schlägt der Fürsorge-Hinweis Ausgleich oder Pause vor statt einer Aufgabe der überwiegenden Säule.

## Vertrag (Testsaum)

- `GET /scores/care-suggestions`: jeder Eintrag trägt `anlass: 'defizit' | 'ueberlast'` (OpenAPI `CareVorschlag`).
- Bei mindestens einer Überlast-Säule stehen VOR den Defizit-Vorschlägen Erholungsvorschläge (`anlass: 'ueberlast'`, `typ: 'vorlage'`): nicht abgelehnte Vorlagen der Säulen Körper (1) und Mentale Gesundheit (2) sowie die neue Pause-Vorlage `pause-1` (10 Sprachen in `CARE_VORLAGEN`).
- Ohne Überlast: Antwort unverändert, nur `anlass: 'defizit'`.
- `CareHint`: `anlass: 'ueberlast'` → Erholungs-Rahmensatz (Ton: Fürsorge-Tonalität), nicht „… kam diese Woche zu kurz"; `defizit` behält den Satz. Aktionen unverändert.

## Schritte / erwartetes Ergebnis

| Schritt                                     | Erwartung                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Überlast (eine Säule > 50 %), Antwort lesen | Position 0: `anlass: ueberlast`, Säule 1/2 oder `pause-1`, keine Aufgabe der Säule (AK1) |
| `?sprache=en`                               | Erholungsvorschläge in en; `pause-1` in allen zehn Sprachen vorhanden (AK2)              |
| Keine Überlast                              | alle Einträge `anlass: defizit`, Reihenfolge/Inhalt wie zuvor (AK3)                      |
| `CareHint` mit `ueberlast` / `defizit`      | Erholungs-Rahmensatz ohne „zu kurz" / bisheriger Satz (AK4)                              |
| Dashboard bei 375 px mit Überlast           | Hinweis vollständig im Viewport, Aktionen ≥ 44 px (AK5)                                  |
