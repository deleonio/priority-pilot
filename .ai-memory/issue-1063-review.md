# Issue 1063 — Review (Kreuzverhör)

## Erledigt
- **Runde 1 für PR #1070** („Geo-Badge in Aufgabenliste“, Branch `vibe/issue-1063-tasktree-geo-badge`, Head `2aa9279`). Vorgänger-Runde für PR #1064 (gemergt) ist unten dokumentiert.
- MODE: kein `<!-- ai-review -->` auf PR 1070 → Kreuzverhör. `closingIssuesReferences` = [1063] → AKs aus dem KI-ANALYSE-Block (Revision 2026-08-27, bindend).
- Diff gelesen: 2 Dateien — `frontend/src/components/TaskTree.tsx` (GeoBadge-Import + Render in `.task-tree-badges`) und `frontend/e2e/issue-1063-geo-badge.spec.ts` (AK5-Flip + AK6-Erweiterung).
- **F1 verifiziert:** `prettier@3.9.6` mit `prettier.config.mjs` meldet `frontend/e2e/issue-1063-geo-badge.spec.ts` (Zeile 147, AK6-Titel zu lang → Signatur muss umbrechen). CI: `verify` FAILURE am Schritt `Format-Check` (Run 33107926716), `gate-merge` skipped. Wichtig: **ohne** Repo-Config meldet prettier fälschlich alles (Quotes) — erst mit `--config prettier.config.mjs` laufen lassen.
- **F2:** AK6-Aufgabenliste misst `.first()`-`li`, prüft Badge aber seitenweit (`page.getByTestId('geo-badge').first()`), und der Issue-Testfall „langer Titel“ fehlt.
- **F3:** `GeoBadge.tsx:2-3` Dokkommentar nennt nur zwei Konsumenten (außerhalb des Diffs → kein Inline-Kommentar möglich).
- **F4:** PR-Body hat abgeschnittene Inline-Code-Bezeichner („eine  definiert hat“).
- Inline-Kommentare gepostet: F1 = 3875149700, F2 = 3875151929.
- Sammelkommentar gepostet: **issuecomment-5444200633**, Review-Status `needs-fixup`, Footer „Review-Typ: Kreuzverhör“.
- Titel-Gate: `feat: Geo-Badge in Aufgabenliste anzeigen (#1063)` (deutsch, groß) → `feat(frontend): show geo badge in task list (#1063)`.
- Verdict: `needs-fixup` → /tmp/claude-verdict.
- Ohne Befund geprüft: extractLeaves = Blatt-only ⇒ AK1 vollständig; KoliBri-first (Wiederverwendung GeoBadge, Abweichung begründet); A11y-Vertrag (`role="img"`+aria-label) unverändert; SoD ok (Spec-Test-Flip ist vom Issue gefordert); kein Server-Delta (gemäß Issue).

## Relevante Stellen
- `frontend/src/components/TaskTree.tsx:108` — neue Badge-Zeile `task.address != null && <GeoBadge …/>`; konsistent mit `task.seriesId != null` (gleiche Datei) und `SeriesTab.tsx:148` / `CompletedTasksTable.tsx:127`.
- `frontend/src/components/TaskTree.tsx:224` — `extractLeaves(forest)`: TaskTree listet NUR Blatt-Tasks ⇒ kein zweites Row-Rendering, das das Badge bräuchte.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:82-85` — `openTasksView` wählt „Erledigte Aufgaben“ ab (deshalb ist `.first()` heute zufällig richtig).
- `frontend/src/components/GeoBadge.tsx:2-3` — veralteter Dokkommentar (F3).
- `prettier.config.mjs` + Repo-Pin `prettier@3.9.6` — nötig für reproduzierbaren Format-Check.

## Annahmen
- E2e-Matrix (4 Jobs, pending bei Review-Ende) läuft grün; F1 betrifft nur `Format-Check`.
- Fixup-Runde setzt `ai:needs-changes` via pr-gate-merge (verify rot) — Label-Handling komplett beim Workflow.

## Verworfen
- Inline-Kommentar auf `GeoBadge.tsx` (F3) — Datei ist nicht Teil des Diffs, kein Anker; nur im Sammelkommentar.
- F2 als Blocker — das `.first()`-Idiom ist im gemergten Serien-Block identisch; nur der neue Block sollte den stabilen Anker `task-list-item-<id>` nutzen.
- MEMORY.md-Eintrag — kein neues Scheitern/Lösungsmuster meines Prozesses (CI-Fang ist Normalfall, strenges Aufnahmekriterium).

## Offen
- keine

## Nächster Schritt
- Falls Fixup-Push auf PR 1070 kommt: FIXUP VERIFICATION — Sammelkommentar **5444200633** per PATCH updaten (KEIN neuer Kommentar; 5443550920 gehört zu PR #1064), nur Delta-Diff seit Head `2aa9279` prüfen, F1–F4 abhaken.

## Fallstricke
- Zwei ai-review-Sammelkommentare im Issue-Umfeld: **PR #1064 = 5443550920**, **PR #1070 = 5444200633**. Beim Fixup immer die PR-Zugehörigkeit prüfen (`in_reply_to`/PR-Diff), nicht die alte ID recyceln.
- Prettier ohne Repo-Config meldet die gesamte Datei (Single-vs-Double-Quotes) — das ist kein echtes Finding; immer `--config prettier.config.mjs` bzw. Repo-Pin 3.9.6.
- `gh pr edit` kennt kein `--json` (nur `gh pr view --json`) — Titel-Verifikation separat.
- `gh api -F body="…"` mit Backticks/Backslashes bricht in der Shell; Payload als JSON-Datei + `--input <file>` verwenden.
- Längere Test-Titel (hier: „… und Aufgabenliste“) drücken die Zeile über die Print-Width → prettier will die `async ({ page })`-Signatur umbrechen. Beim Umbenennen von Testnamen Format-Check mitdenken.

---
## Archiv: Runde 0 (PR #1064, gemergt)
- MODE Kreuzverhör, findungsfrei, `reviewed`. Vollständiger Diff (877 Zeilen) geprüft: Kaskade nur auf offene Instanzen (`openInstancesWhere`, `status != 'Done'`), e2e-Anker vorhanden, `git diff 8e9ae3a9 9001fc73 -- '*test*'` leer (Spec-Tests unverändert). Sammelkommentar **5443550920**, Titel damals auf `feat(server): add series address field and geo badges in lists` umbenannt. KolBadge-Abweichung + Migration über `SERIES_TABLE_COLUMNS` waren im PR-Body begründet ⇒ keine Findings.
