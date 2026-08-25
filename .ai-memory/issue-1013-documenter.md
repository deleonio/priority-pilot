# Documenter PR #1013 (docs(spec): sync specs to actual state 2026-08-25)

## Erledigt
- PR-Diff und PR-Details gelesen (gh pr diff/view #1013).
- Klassifikation: `internal` (Sync von veralteten Specs, kein Nutzer-Impact).
- Analyse: 18 Dateien, 11 gelöscht, 7 modifiziert — alles docs/spec/*.
- /tmp/doc.json geschrieben und mit jq validiert ✓.
- KLASSIFIKATION: internal (Dokumentations-Pflege, keine API-/Funktionsänderungen).
- TITEL: Leer (PR-Titel bereits konform: "docs(spec): sync specs to actual state 2026-08-25").
- RELEASE NOTE: "No user-facing changes. This is a documentation maintenance update..."
- FILES: 8 relevante Dateien dokumentiert (4 gelöscht, 4 modifiziert).
- ISSUES: Leer (keine verlinkten Issues im PR-Body).

## Relevante Stellen
- docs/spec/issue-1003.md — gelöscht (Arbeitsauftrag zu abgeschlossenem Ticket).
- docs/spec/issue-1004.md — gelöscht (Arbeitsauftrag zu abgeschlossenem Ticket).
- docs/spec/issue-742.md — gelöscht (veralteter Model-Selection-Dialog).
- docs/spec/issue-749.md — gelöscht (veralteter Provider-Schalter).
- docs/spec/issue-788.md — gelöscht (veraltetes LLM-Einstellungsmenü).
- docs/spec/issue-824.md — gelöscht (Arbeitsauftrag ESLint-Guard).
- docs/spec/issue-861.md — gelöscht (veraltete contextLength-Anforderung).
- docs/spec/issue-862.md — gelöscht (veraltete contextLength-Anzeige).
- docs/spec/issue-902.md — gelöscht (Arbeitsauftrag Axe-Pattern).
- docs/spec/issue-965.md — gelöscht (veralteter KI-Modell-Toolbar-Button).
- docs/spec/issue-972.md — gelöscht (veraltetes LLM-Tab-Layout).
- docs/spec/issue-620.md — modifiziert (KI-Dienst-Meldungen, Retry-Umfang).
- docs/spec/issue-691.md — modifiziert (Toolbar-Buttons).
- docs/spec/issue-704.md — modifiziert (Tab-Label "Wald").
- docs/spec/issue-787.md — modifiziert (umfassende Überarbeitung).
- docs/spec/issue-951.md — modifiziert (Ist-Stand-Sync).
- docs/spec/issue-969.md — modifiziert (Status-Zeile entfernt).
- docs/spec/user-journeys.md — modifiziert (Randfälle-Tabelle, Journeys).

## Annahmen
- PR-Titel ist bereits konform ("docs(spec): sync specs to actual state 2026-08-25").
- Keine verlinkten Issues (PR-Body ohne "Closes #"/"Fixes #").
- Keine Migration nötig (internal, kein Breaking Change).

## Verworfen
-

## Offen
-

## Nächster Schritt
- Nichts. Documenter abgeschlossen — /tmp/doc.json liegt vor, JSON gültig.

## Fallstricke
- Prettier-Formatierung in user-journeys.md (aus fixup-Commit efd9e5ee, ~Zeile 189–204).
- Nur Dateien aus docs/spec/* relevant, keine Code-Änderungen.
