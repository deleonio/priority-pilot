# Issue 1063 — Review (Kreuzverhör)

## Erledigt
- **Runde 4 für PR #1070 = FIXUP-VERIFICATION** (Marker `<!-- ai-review -->` vorhanden in Kommentar **5444786040**, `closingIssuesReferences`=[1063]). Kein neues Kreuzverhör gefahren, nur Delta.
- Head ist jetzt **`84698300`** (neu seit Runde 3, die `f8ff8efd` sah). Delta = genau 1 Commit, 1 Datei: `frontend/e2e/issue-1063-geo-badge.spec.ts` — Commit-Message nennt die F6-Ursache (TaskTree im verborgenen Panel, SeriesTab erst bei aktivem Tab).
- **F6 verifiziert BEHOBEN:** AK6-Assertion jetzt `page.getByTestId('series-tree-item-' + seriesId)` + `row.getByTestId('geo-badge')` (Spec:170-172, AK4-Muster); seitenweiter `.first()` entfernt. Zusätzlich neue TaskTree-Zeilen-Messung auf `task-list-item-${openId}` (Spec:191-196) mit Bounding-Box-Grenzen. `createSeriesViaApi` gibt die Serien-ID zurück (Spec:27-45), Anker also echt.
- **CI auf Head `84698300` komplett grün** (Run **33113668116**, headSha verifiziert via `gh run view`): `verify` pass, `e2e (1)`–`e2e (4)` alle pass, `precheck`/`label` pass. AK1–AK6 damit belegt. Nur `gate-merge` skipped (Pipeline-eigen, Entscheidung folgt nach Review).
- Review-Threads: F1/F2/F5 bereits resolved; **F6-Thread `PRRT_kwDONloM186c96j7` beantwortet (PRRC_kwDONloM187nAbw-) und resolved**.
- Sammelkommentar **5444786040** per PATCH auf `reviewed` gesetzt: F6 in die Behoben-Tabelle verschoben, Offene Findings = keine, 🟢-Fixup-Nachweis-Absatz, Footer `Review-Typ: Fixup-Nachweis`. Verifiziert: genau **1** `<!-- ai-review -->`-Marker im PR.
- Titel-Gate: `feat(frontend): show geo badge in task list (#1063)` = 51 Zeichen, Conventional, lowercase, English → kein Edit.
- Verdict `reviewed` → /tmp/claude-verdict.

## Relevante Stellen
- `frontend/e2e/issue-1063-geo-badge.spec.ts:157-172` — AK6: `seriesId`-Anker + zeilengebundenes Badge + Bounding-Box-Grenzen; der F6-Fix.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:117-141` — AK5: jetzt mit `openIdNoAddr` (Negativ-Ast im TaskTree, Spec:135-140).
- `frontend/e2e/issue-1063-geo-badge.spec.ts:27-45` — `createSeriesViaApi` gibt `Promise<number>` (Serien-ID) zurück.
- `frontend/src/components/TaskTree.tsx:108` / `GeoBadge.tsx` — Produktcode im PR-Diff unverändert gegenüber Runde 3, unauffällig.

## Annahmen
- Run 33113668116 ist der Run zum PR-Head (headSha per `gh run view` gegengeprüft, nicht nur `gh pr checks`-Reihenfolge vertraut).
- `review`-Job auf `pending` ist der laufende Pipeline-Review-Lauf, kein Befund des PR-Inhalts.

## Verworfen
- Neues Kreuzverhör des ganzen PR — Regel "Marker PRESENT → FIXUP VERIFICATION" befolgt; Produktcode-Dateien (TaskTree/GeoBadge) sind im Diff identisch zu Runde 3, wo sie bereits adjudiziert waren.
- Inline-Kommentar zum F6-Fix — kein Finding mehr vorhanden, nur Thread-Resolution.

## Offen
- keine

## Nächster Schritt
- Phase abgeschlossen; `documenter`/`block-new`-Phasen können übernehmen. PR ist review-ready (`reviewed`), gate-merge entscheidet über Auto-Merge.

## Fallstricke
- Delta-Scoping per `gh api repos/{owner}/{repo}/commits/<sha>` (datei-liste) ist schneller/sicherer als `gh pr diff`-Interpretation, wenn der PR-Head-Commit selbst der Fixup-Commit ist.
- `gh pr checks` listet Runs mehrerer SHAs gemischt — Head-Zuordnung immer über `gh run view <id> --json headSha`.
- Thread-Resolution: Reply zuerst (`addPullRequestReviewThreadReply` mit `pullRequestReviewThreadId`), dann `resolveReviewThread` mit `threadId` = PRRT_-Knoten-ID, nicht der Kommentar-ID.
- Kommentar-PATCH: Payload per Heredoc nach `/tmp/payload.json` schreiben und direkt `--input` übergeben (`Write`-Tool auf /tmp verboten; `python3 -c ||`-Fallback-Falle umgangen).
