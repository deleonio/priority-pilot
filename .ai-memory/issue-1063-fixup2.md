# Issue 1063 — Fixup Runde 2 (PR #1070, F5) — gepusht, CI läuft

## Erledigt
- F5 (Blocker aus Review Runde 2) gefixt und als **`f8ff8efd`** auf `vibe/issue-1063-tasktree-geo-badge` gepusht.
  - `frontend/e2e/issue-1063-geo-badge.spec.ts:150-153` — `const openTitle = uniqueTitle('MobilOffen').padEnd(30, 'x');`
  - Bisher: ~100-Zeichen-Suffix an `uniqueTitle()` → verletzte `title STRING(30)` + `len [1,30]`
    (`server/src/models/task.ts:93-98`) → POST `/api/v1/tasks` 4xx → AK6 starb im Setup (CI Run 33110648538, Job `e2e (2)`).
  - Kommentar nennt jetzt explizit die Modellgrenze als Grund fürs Auffüllen AUF 30 statt darüber hinaus.
- Gate lokal vor dem Push: `pnpm format` ✔, `prettier --check .` ✔, `pnpm lint` ✔ (tsc+eslint), `pnpm knip` ✔ (nur
  pre-existing Configuration-hints: reactCellRoot.ts, push-sw.js, main.tsx). `pnpm test` NICHT gefahren — nur e2e-Spec geändert, Soft-Deadline.
- Thread F5 **PRRT_kwDONloM186c9iS0** (Kommentar 3875401836) via GraphQL `resolveReviewThread` resolvt → `isResolved: true`.
- Sammelkommentar **5444200633** per PATCH aktualisiert: Fixup-Tabelle F1–F5, F5 mit SHA `f8ff8efd`, Status „in Arbeit (Runde 2)“, keine Entscheidungs-Findings.

## Relevante Stellen
- `frontend/e2e/issue-1063-geo-badge.spec.ts:150-153` — die eigentliche F5-Stelle (padEnd auf Domänen-Maximum).
- `frontend/e2e/issue-1063-geo-badge.spec.ts:158-163` — AK6-Anker `task-list-item-${openId}` + Scoped-Assertion unverändert (Kern von F2) beibehalten.
- `server/src/models/task.ts:93-98` — `title: STRING(30)` + `len [1,30]`: die Grenze, die F5 auslöste.
- `/tmp/p.json` + `--input` — Comment-Update-Pfad (direkt `-F body=@file` scheitert mit „Problems parsing JSON“).

## Annahmen
- AK6 misst Layout, nicht Textinhalt — `padEnd(30,'x')` ist als Stressor gleichwertig zum früheren Langtitel (Zeichenanzahl ist der Stressor, keine Semantik).
- `padEnd`-Ergebnis ist deterministisch 30 Zeichen, weil `uniqueTitle('MobilOffen')` = 22 Zeichen liefert (`head` 20 + tail `#3`) → padEnd füllt 8× `x`.

## Verworfen
- Modell-Limit STRING(30) lockern — Produktänderung, klar ausserhalb des PR-Scopes (bereits in Runde 2 verworfen, bestätigt).
- Long-Suffix-Ansatz (Runde 1) — Ursache von F5; nicht wiederholen.

## Offen
- CI für `f8ff8efd`: Run **33112124577** (Jobs `verify`, `e2e (1)`–`e2e (4)`) lief bei Deadline noch `in_progress`; `gate-merge` folgt danach.
  Grün-Bestätigung für `e2e (2)` steht aus.

## Nächster Schritt
- Run 33112124577 abwarten/prüfen: `e2e (2)` muss grün sein, dann Sammelkommentar 5444200633 auf „reviewed“ setzen. Bei Rot: Log lesen (die Assertion-Kette ist unverändert, ein neuer Fehler wäre im PadEnd-Bereich zu suchen).

## Fallstricke
- `git commit` scheiterte mit „Author identity unknown“ → Identity aus dem letzten Commit des Branches übernehmen:
  `git config user.name "$(git log -1 --pretty=format:'%an' <sha>)"` (+ `%ae`), NICHT --global.
- GitHub-Issues-Comment-Update: `gh api -X PATCH ... -F body=@file` parse-failed; Umweg über `python3 -c json.dump` → `--input /tmp/p.json`.
- Run 33112124671 ist nur „Validiere Trigger-Event“ (success, gleiches Head-Sha) — nicht mit dem echten CI-Lauf verwechseln; Jobliste erst über `gh run view <id> --json jobs`.
- `uniqueTitle()` schneidet auf `30 - tail.length`, liefert hier aber nur 22 Zeichen → padEnd ist der verlässliche Weg zu exakt 30.
- Kein `/tmp/claude-verdict` geschrieben: Fix ist gepusht, Commits bestimmen den Fortschritt ⇒ NO verdict.
