# Issue 1244 — Documenter (Phase 6), Stand 2026-09-06

## Erledigt
- PR 1244 (merged, Author deleonio) analysiert: `gh pr view 1244` + `gh pr diff 1244` (Diff-Output 22.3 KB, Preview + PR-Body ausgewertet; 6 Dateien, MODIFIED).
- `/tmp/doc.json` geschrieben und mit `jq` verifiziert (classification=improved, title leer — Compliant-Flag `true` vertraut, bestehender Titel `feat(frontend): separate balance switch from recompute button (#1220)` ist CC-konform; 6 files, 1 issue). Inhaltlich gespiegelt nach `.ai-memory/issue-1244-doc.json` (Write-Tool kann nicht nach /tmp, Memory 2026-08-26 → `cp` als Workaround).
- Klassifikation `improved`: Verhaltens-/UX-Nachbesserung zu #1220 (keine API-Änderung, kein Bugfix im klassischen Sinne — Zuständigkeits-Trennung + Veraltet-Hinweis), issue note „Refines #1220" (Body enthält kein Closes/Fixes).
- Diese Phasen-Notiz angelegt. Kein gh pr edit/comment/label, Code tabu — eingehalten.

## Relevante Stellen
- `frontend/src/App.tsx` — Kernänderung: Schalter nur Sichtwechsel, Button ersetzt nur den Stand, PointerEnter-Prefetch + flushSync entfernt.
- `frontend/src/lib/balancePriority.ts` — neue reine Funktion `balancePrioritiesEqual` (Veraltet-Erkennung).
- `frontend/src/lib/balancePriority.test.ts` — 5 neue Unit-Tests für `balancePrioritiesEqual`.
- `frontend/e2e/issue-1220-balance-mode.spec.ts` — neues AK6 + Veraltet-Hinweis-Test, AK5 375-px-Erweiterung.
- `docs/spec/issue-1220.md` — Spec an neue Aufgabenteilung/Button-Namen/AK6 gezogen.
- `frontend/src/app.css` — 1-Zeilen-Änderung (Ladezustand/Button), marginal — im files-Array enthalten.

## Annahmen
- Kein Linked-Issue-Kontext geliefert; #1220 aus Titel/Body als Referenz genommen (`Refines #1220` statt Closes/Fixes, da Body keines enthält).
- title_compliant=true exakt übernommen → `title: ""` ohne `title_reason`.
- `improved` statt `fixed`: PR-Body beschreibt Überlappung+Fehler („darunter lag ein Fehler") — trotzdem improved, da der Nutzerwert in klarerer Bedienung/Signalisierung besteht und #1220 selbst erst kürzlich gemergt war (Follow-up-Verfeinerung, kein Regressions-Fix etablierten Verhaltens).

## Verworfen
- `fixed` als Klassifikation — grenzwertig (Body nennt „Fehler"), aber Follow-up unmittelbar nach Merge von #1220; Zielbild ist verbesserte Zuständigkeits-Trennung, nicht Fehlerbehebung eines ausgelieferten Regressions.
- Titel-Vorschlag — bestehender Titel bereits konform (Flag=true).
- MEMORY.md-Eintrag — kein neuer Fehler; der /tmp-Write-Workaround ist bereits als 2026-08-26-Learning verankert.

## Offen
- Wegwerf-Artefakt `.ai-memory/issue-1244-doc.json` (Spiegel für /tmp/doc.json) ist untracked — NICHT committen; nur diese Datei ist die Phasen-Notiz. Bestehendes `issue-1244-review.md` lag schon untracked vor.

## Nächster Schritt
- `-` (letzte Phase; Output steht in /tmp/doc.json).

## Fallstricke
- Write-Tool schreibt nicht nach /tmp → Datei im Repo ablegen (passt auf kein Git-Muster) und per `cp` nach /tmp bringen; jq-Check gegen /tmp/doc.json fahren.
- PR-Body ist lang und enthält Tabellen/Emojis mit Klammern — als JSON-String via Write-Tool, NICHT per Bash-Heredoc (Parser-Falle, Memory 2026-08-26).
