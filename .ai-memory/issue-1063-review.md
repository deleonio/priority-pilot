# Issue 1063 — Review (Kreuzverhör)

## Erledigt
- **Runde 2 für PR #1070 = FIXUP VERIFICATION** (Marker `<!-- ai-review -->` vorhanden auf Kommentar **5444200633**). Vorgänger-Runden: Runde 1 (Kreuzverhör, `needs-fixup`) und Archiv Runde 0 (PR #1064, gemergt) unten.
- Delta-Verifikation `git diff 2aa9279 98e352eb`: 2 Dateien (e2e-Spec AK6 + GeoBadge-Dokkommentar), 16+/6−. Umfang sauber, kein Produktcode.
- **F1 verifiziert behoben:** CI `verify` = pass (Run 33110648538); lokal `npx prettier@3.9.6 --config prettier.config.mjs --check` grün über Spec + GeoBadge + TaskTree.
- **F2 inhaltlich behoben:** Anker `task-list-item-${openId}` (Vertrag `TaskTree.tsx:85`) + `taskRow.getByTestId('geo-badge')` statt seitenweitem `.first()`.
- **F3 verifiziert behoben:** GeoBadge.tsx:2-4 nennt jetzt alle drei Konsumenten.
- **F4 verifiziert behoben:** PR-Body enthält `address` (3×), `TaskTree.tsx`, `task.address != null`, Spec-Datei — keine abgeschnittenen Bezeichner.
- **NEUES FINDING F5 (Blocker):** CI Job `e2e (2)` **FAIL** — AK6 scheitert nach 121 ms im API-Setup (`createTaskViaApi` → Spec:48 `expect(response.ok())`, Aufrufstelle Spec:158 = der Long-Title-Call; Spalte 18 unterscheidet ihn vom doneTitle-Call in 157). Ursache: `server/src/models/task.ts:93-98` = `title: DataTypes.STRING(30)` + `validate: { len: [1, 30] }`. Der Fixup-Suffix (`Spec:155`, ~100 Zeichen extra) verletzt das Limit → POST 4xx/5xx. `AK4`/`AK5` im selben Shard grün, `gate-merge` skipped.
- F5 als Inline-Kommentar gepostet: **3875401836** auf `frontend/e2e/issue-1063-geo-badge.spec.ts:155`.
- Threads F1 (**PRRT_kwDONloM186c85pN** = 3875149700) und F2 (**PRRT_kwDONloM186c86Ax** = 3875151929) resolviert (GraphQL `resolveReviewThread`, Variablentyp `ID!`).
- Sammelkommentar **5444200633** per PATCH aktualisiert (Fixup-Nachweis-Tabelle F1–F4 + Offenes Finding F5, Status `needs-fixup`, updated_at 2026-08-27T20:02:34Z).
- Titel-Gate: `feat(frontend): show geo badge in task list (#1063)` = 51 Zeichen, compliant → kein Edit.
- Verdict `needs-fixup` → /tmp/claude-verdict.

## Relevante Stellen
- `server/src/models/task.ts:93-98` — `title: STRING(30)` + `len [1,30]`: die Domänengrenze, die F5 auslöst. GILT AUCH FÜR SERIEN-TITEL (siehe Fallstricke).
- `frontend/e2e/issue-1063-geo-badge.spec.ts:22` — `uniqueTitle` schneidet auf `30 - tail.length`: bewusstes Einhalten des Limits; der Fixup-Suffix umgeht es.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:155` — F5-Anker (Long-Title-Zeile); `:158` Aufrufstelle des fehlschlagenden Calls.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:158-163` — Anker `task-list-item-${openId}` + Scoped-Assertion: korrekt, beim Fix behalten.
- `frontend/src/components/TaskTree.tsx:85` — `data-testid={'task-list-item-${node.id}'}`: Anker-Vertrag, von AK6 erfüllt.

## Annahmen
- F5 ist deterministisch (Modell-Validierung + reproduzierbares Setup, nicht Timing) — verifiziert am CI-Log, nicht lokal nachgestellt.
- `page.setViewportSize(375x667)` vor den API-Calls ist unschädlich (AK4/AK5-Pattern identisch).
- F2 zählt als behoben, obwohl sein Titel-Teil F5 erzeugt hat — Anker/Scoped-Assertion sind der eigentliche Kern des Findings.

## Verworfen
- F5 als `needs-human` — nein: der Fix (Titel auf exakt 30 Zeichen auffüllen) ist eindeutig und im PR-Scope; das Modell-Limit zu lockern wäre die Produktänderung, nicht der Test-Fix.
- "Langer Titel" ganz streichen — nein: das Domänen-Maximum (30 Zeichen) IST der realistische Stressor neben dem Badge.
- Thread F5 resolven — nein, offen bis zum Fix.

## Offen
- F5 (Blocker): AK6 rot in CI. Nächste Fixup-Runde muss den Titel auf ≤30 Zeichen bringen und danach `e2e (2)` grün sehen.

## Nächster Schritt
- Kommende Fixup-Runde: Titel-Fix prüfen (Spec:155), Delta seit `98e352eb`, CI `e2e (2)` grün bestätigen, F5-Thread **PRRT_kwDONloM186c9iS0** (3875401836) resolven, Sammelkommentar 5444200633 auf `reviewed` setzen.

## Fallstricke
- **Task- UND Serien-Titel sind auf 30 Zeichen begrenzt** (`models/task.ts:93` STRING(30)); `uniqueTitle()` baut das ein. Jeder Test, der einen "langen Titel" erzwingen will, muss AUF 30 auffüllen, nicht darüber hinaus. Sonst: POST rot, Test scheitert im Setup (nicht in der Assertion) → Fehlerbild sieht nach Flakiness aus.
- Stack-Zuordnung: `at createTaskViaApi (...:48:25)` + Outer-Frame `at ...:158:18` — die Aufrufstelle (nicht die Helper-Zeile) nennt den schuldigen Call. `sed`-Offsets blind lesen führt zum falschen Call (157 vs 158 liegen 1 Zeile auseinander).
- Thread-Resolution nur via GraphQL, Variablentyp muss `ID!` sein (`String!` → variableMismatch).
- Zwei ai-review-Sammelkommentare im Issue-Umfeld: **PR #1064 = 5443550920**, **PR #1070 = 5444200633** — immer PR-Zugehörigkeit prüfen.
- Prettier ohne Repo-Config meldet die ganze Datei (Quotes) — immer `--config prettier.config.mjs` + Pin 3.9.6.
- Payloads mit Backticks/Backslashes: JSON-Datei + `--input <file>`, niemals `-F body="…"`.

---
## Archiv: Runde 1 (Kreuzverhör, Head 2aa9279)
- MODE Kreuzverhör (kein Marker), `closingIssuesReferences` = [1063] → AKs aus KI-ANALYSE. 4 Findings (F1 Format-Check rot/CI verify FAILURE, F2 AK6 misst `.first()` + langer Titel fehlt, F3 GeoBadge-Dokkommentar veraltet, F4 PR-Body abgeschnittene Bezeichner), Sammelkommentar 5444200633, Titel auf `feat(frontend): show geo badge in task list (#1063)` umbenannt, Verdict `needs-fixup`. Ohne Befund: extractLeaves = Blatt-only ⇒ AK1 vollständig; KoliBri-first (GeoBadge-Wiederverwendung); A11y-Vertrag (role="img"+aria-label); SoD ok.

## Archiv: Runde 0 (PR #1064, gemergt)
- MODE Kreuzverhör, findungsfrei, `reviewed`. Kaskade nur auf offene Instanzen, e2e-Anker vorhanden, `git diff 8e9ae3a9 9001fc73 -- '*test*'` leer. Sammelkommentar 5443550920, Titel damals auf `feat(server): add series address field and geo badges in lists`.
