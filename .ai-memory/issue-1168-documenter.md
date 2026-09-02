# Issue 1168 — Documenter (Phase 6), Stand 2026-09-02

## Erledigt
- PR #1170 (`feat(frontend): replace dashboard start button with done dialog`, gemergt, Autor my-github-action-bot) analysiert; `/tmp/doc.json` geschrieben und per `jq` validiert (classification=improved, 7 files).
- Kern-Diff gelesen: `frontend/src/components/CompleteTaskDialog.tsx` (neu, Modal-Basis, Fehler-Alert, Initialfokus Abbrechen), `frontend/src/App.tsx` (Dialog-Variante `complete`, `completeTask` = PATCH `TaskStatus.Done` über `api.updateTask`, `onCompleted` → bestehendes `afterMutation`), `frontend/src/components/Dashboard.tsx` (Button „Jetzt starten“/fa-play → „Erledigt“/fa-check, Prop `onStartTask` → `onCompleteTask`).
- Bewusst KEIN `internal`: User-sichtbares Verhalten (Button-Label + Bestätigungsdialog), Skill-Regel „im Zweifel nicht internal“.

## Relevante Stellen
- `frontend/src/components/CompleteTaskDialog.tsx` — neue Dialog-Komponente, zentraler Baustein des PR.
- `frontend/src/App.tsx:373,425-442,628,803` — Dialog-Variante `complete` + `completeTask`; kein sticky-Pfad (`DONE_REMOVAL_DELAY_MS`), stattdessen Panel-Reload.
- `frontend/src/components/Dashboard.tsx:195-203` — Button-Umstellung im Signal-Panel.
- e2e: `issue-1168-dashboard-done-button.spec.ts` (neu), Anpassungen an `issue-1042-…` und `issue-1118-…` Specs.

## Annahmen
- Titel `feat(frontenend)`-konform und Typ `feat` passt → `title`/`title_reason` leer (lauf-übergreifende Vorgabe „title compliant = true, type/scope = feat/frontend“).
- `Closes #1168` laut PR-Body; Issue #1168 ist der UI-Anteil, der PR selbst enthält auch spec-phase-Tests.
- Migration: keiner nötig (kein API-/Datenvertrag-Change).

## Verworfen
- `classification: new` — Bestätigungsdialog ist UX-Verbesserung eines bestehenden Panels, kein neues Feature-Ende-zu-Ende; `improved` trifft besser (Skill: Extension/UX).
- Title-Rename — bestehender Titel konventionskonform.
- Dateien `.ai-memory/*` und `docs/spec/issue-1168.md` in `files` — Harness-/Spec-Artefakte, nicht für Release-Notes relevant.

## Offen
- -

## Nächster Schritt
- Aufrufer liest `/tmp/doc.json` (Phase 6 vollständig, kein Folge-Schritt in diesem Ticket).

## Fallstricke
- `gh pr diff` akzeptiert nur 1 Datei-Argument — Dateifilter per `awk` über den vollen Diff, nicht per Pfad-Argumente.
