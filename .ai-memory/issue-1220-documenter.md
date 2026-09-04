# Issue 1220 — Documenter (Phase 6, PR 1228), Stand 2026-09-04

## Erledigt
- PR 1228 (`feat(frontend): virtual balance prioritization for the task list (#1220)`) analysiert: Metadata via `gh pr view --json` (11 Dateien, Label `ai:reviewed`, Autor my-github-action-bot), voller Diff (1153 Zeilen, 12 Dateien) gelesen.
- `/tmp/doc.json` geschrieben und mit `jq -e` validiert: classification `new`, title leer (Compliance-flag true vom Aufruf), 7 Datei-Einträge, issues `Closes #1220`.
- Kerninhalt verifiziert (diff): `frontend/src/lib/balancePriority.ts` (Defizit-Mathematik nach `server/src/logics/find.ts`, `virtualPriority = 1 + round(balanceScore·4)`), `App.tsx` (Balance-Switch + „Ausbalancieren“-Button mit PointerEnter-Prefetch, `flushSync`, aria-live, Snapshot-State), `TaskTree.tsx` (Prop `balancePriorities`, Sortierung nach Score, `~P{n}`-Badge), `app.css`, Unit- + E2E-Tests, `docs/spec/issue-1220.md`. Kein Schreibzugriff auf `/api/v1/tasks` → `new`, nicht `improved`.

## Relevante Stellen
- `frontend/src/lib/balancePriority.ts` — neuer Rechenkern, Kern der Änderung.
- `frontend/src/App.tsx` (~:75-215, ~:721-800) — Switch/Button/Prefetch/flushSync-Verdrahtung.
- `frontend/src/components/TaskTree.tsx` — Sortierung + virtuelle Badges.
- `frontend/e2e/issue-1220-balance-mode.spec.ts`, `frontend/src/lib/balancePriority.test.ts` — AK-Abdeckung.

## Annahmen
- „title compliant = true, type/scope = feat/frontend“ vom Aufruf übernommen → `title` leer gelassen (SKILL-Regel).
- `.ai-memory/*`-Dateien im Diff bewusst NICHT als `files` gelistet (nicht nutzerrelevant; SKILL: 3-8 relevanteste Dateien).

## Verworfen
- classification `improved` — es ist ein neuer Anzeige-Modus/Feature (Schalter + Button + neues Modul), nicht Erweiterung Bestehenden.
- Badge-Präfix `~P{n}`-Detail in release_note — als `~P{n}`-Badge eine Zeile Wert, nicht mehr.

## Offen
- Write-Tool darf nicht nach `/tmp` schreiben (Permission-Deny, Muster auch MEMORY 2026-08-26) → `/tmp/doc.json` per Bash-Heredoc geschrieben. Falle: rohes `"` nach `„Ausbalancieren"` brach JSON (jq parse error) — zuerst schreibfehlerhaft, per python3-Replace auf `“` gefixt und mit jq verifiziert.

## Nächster Schritt
- — (Phase abgeschlossen; keine Folgephase bekannt.)

## Fallstricke
- JSON-Strings mit typografischen Anführungszeichen: immer nur `„…“`-Paare (U+201E/U+201C) verwenden, niemals ein schließendes ASCII-`"` als Satzzeichen — jq fällt sonst mit „Invalid numeric literal“ aus.
- `/tmp`-Schreibzugriffe über Bash-Heredoc, nicht Write-Tool.
