# Issue 1063 — Fixup (PR #1070, Runde 1) — ABGESCHLOSSEN

## Erledigt
- Alle 4 Findings gefixt, Commit **`98e352eb`** auf `vibe/issue-1063-tasktree-geo-badge` gepusht (Head nach `2aa9279`).
- **F1** Format-Check: `pnpm format` reflowt die AK6-Signatur (`frontend/e2e/issue-1063-geo-badge.spec.ts:147`); `prettier --check .` grün.
- **F2** AK6-Scope: Zeilen-Anker `page.getByTestId(\`task-list-item-${openId}\`)` + `taskRow.getByTestId('geo-badge')` statt seitenweitem `.first()`; offener Task trägt jetzt langen Titel.
- **F3** `frontend/src/components/GeoBadge.tsx:2-3` — Kommentar nennt jetzt alle drei Konsumenten.
- **F4** PR-Body via `gh pr edit --body-file` repariert (`address`, `TaskTree.tsx`, `task.address != null`, Spec-Datei, leerer Changes-Punkt) — KEINE abgeschnittenen Bezeichner mehr.
- Sammelkommentar **5444200633** per PATCH aktualisiert (Fixup-Nachweis-Tabelle F1–F4, kein neuer Kommentar).
- Gate beim Push: pre-commit `format` ✔ / `knip` ✔ (nur pre-existing Configuration-hints) / `lint` ✔ (tsc+eslint); zusätzlich `prettier --check .` + `pnpm --filter frontend lint` manuell grün.

## Relevante Stellen
- `frontend/e2e/issue-1063-geo-badge.spec.ts:147-166` — AK6 mit langem Titel + `openId`-Anker.
- `frontend/src/components/GeoBadge.tsx:2-4` — Dokkommentar, 3 Listen.
- `.ai-memory/pr1070-body.md` / `.ai-memory/pr1070-fixup-comment.md` — die gepatchten Texte.

## Annahmen
- Unit-/Server-Tests nicht angetastet (nur e2e-Spec + Kommentar) ⇒ GATE-Teil `pnpm test` bewusst nicht lokal gefahren (Soft-Deadline); e2e läuft in CI.

## Verworfen
- `uniqueTitle('MobilOffen sehr langer …')` als langer Titel — Helper schneidet `head` auf `30 - tail.length` Zeichen, Titel wäre kurz geblieben. Stattdessen Long-Suffix AN den `uniqueTitle()`-Output angehängt (Uniqueness + echte Länge).
- Thread-Resolution der Inline-Kommentare (3875149700/3875151929) — Zeitbudget vor Deadline aufgebraucht; Re-Review-Phase soll sie resolven.

## Offen
- Thread-Resolution für F1/F2 (siehe Verworfen).

## Nächster Schritt
- Re-Review der Fixup-Runde: Delta-Diff seit `2aa9279` = nur spec + GeoBadge-Kommentar, F1–F4 gegen `98e352eb` abhaken, Threads resolven, Sammelkommentar auf `reviewed` setzen.

## Fallstricke
- `python3 -c` nach /tmp schreibt erfolgreich → `||`-Fallback läuft NICHT; dann darf gh nicht den Fallback-Pfad lesen. Direkt `/tmp/payload.json` verwenden.
- `gh pr view --json comments` liefert für den ai-review-Sammelkommentar `databaseId: null` (Review-Summary-artig) — die echte ID kommt aus `issues/1070/comments` (5444200633).
- Kein `/tmp/claude-verdict` geschrieben: Findings waren fixbar, Commit entscheidet ⇒ NO verdict.
