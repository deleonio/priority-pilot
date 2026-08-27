# Issue 1063 — Review (Kreuzverhör)

## Erledigt
- **Runde 3 für PR #1070 = KREUZVERHÖR** (Marker `<!-- ai-review -->` war VOR dem Start NICHT auffindbar). Grund: der Fixup-Kommentar (`<!-- ai-fixup-decisions -->`, "Fixup-Status: in Arbeit (Runde 2)") hat die Issue-Kommentar-ID **5444200633** komplett ÜBERSCHRIEBEN — der alte ai-review-Text ist weg, nur die ID blieb. PR-Reviews (5044846621/5044849099/5045135665) haben leere Bodies (nur Inline-Kommentare). Regel befolgt: Marker fehlt → Kreuzverhör, aber mit Memory-Wissen über F1–F5.
- `closingIssuesReferences` = [1063] → AKs aus KI-ANALYSE-Block (Delta-Fassung): AK1 TaskTree-Badge bei `address`/keins ohne, AK2 375px kein Überlauf, AK3 Bestand aus PR #1064.
- Diff gelesen: 3 Dateien (`TaskTree.tsx` +GeoBadge, `GeoBadge.tsx` Doku, e2e-Spec AK5-Flip + AK6-Aufgabenliste).
- **F5 verifiziert BEHOBEN:** `padEnd(30, 'x')` (Spec:156) füllt `uniqueTitle('MobilOffen')` (~12-13 Zeichen) auf exakt 30 → POST geht durch; AK4 und AK5 im selben Shard **grün** (Run 33112124577: 1.1s / 1.6s).
- **NEUES FINDING F6 (Blocker):** derselbe Run, AK6 failed JETZT bei `expect(locator).toBeVisible()` → `unexpected value "hidden"`, 14× resolved auf `<span role="img" class="geo-badge">`. Anker: Spec:159 (neuer offener Task mit `address`) — die scheiternde Zeile 172 ist unverändertes Diff-Kontext und nicht verankerbar (422 "could not be resolved"), daher F6 auf 159. Inline-Kommentar **3875554131**.
- Ursache verifiziert am Code: `App.tsx:645` rendert `<SeriesTab>` nur bei `activeTab === 2`, aber `TaskTree` (`App.tsx:599`/`613`) bleibt im verborgenen Tab-Panel gemountet. Das Panel liegt vor tab-2 im DOM → seitenweiter `.first()` (Spec:172) greift das versteckte TaskTree-Badge statt des Serien-Badges. Neu seit diesem PR, weil AK6 vorher keinen offenen Task mit Adresse anlegte.
- Sonst kein Befund: `verify` grün, `e2e (1)/(3)/(4)` grün, `gate-merge` skipped (wegen rotem e2e (2)).
- Neuer ai-review-Sammelkommentar **5444786040** erstellt (es existierte keiner mehr); verifiziert: genau EIN `<!-- ai-review -->`-Marker im PR. Titel-Gate: `feat(frontend): show geo badge in task list (#1063)` = 51 Zeichen, compliant → kein Edit.
- Memory aktualisiert (diese Datei), Verdict `needs-fixup` → /tmp/claude-verdict.

## Relevante Stellen
- `frontend/e2e/issue-1063-geo-badge.spec.ts:156` — `padEnd(30, 'x')`: der F5-Fix, korrekt und sicher (uniqueTitle max ~13 Zeichen).
- `frontend/e2e/issue-1063-geo-badge.spec.ts:159` — F6-Anker: `const openId = await createTaskViaApi(` = der neue offene Task MIT Adresse.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:172` — `expect(page.getByTestId('geo-badge').first()).toBeVisible()`: die eigentlich schuldige Zeile, seitenweit, unverändert im Diff.
- `frontend/src/App.tsx:599,613,645` — TaskTree immer gemountet (nur an `taskViewMode` geknüpft), SeriesTab nur bei `activeTab === 2`: die DOM-Reihenfolge-Ursache von F6.
- `frontend/src/components/TaskTree.tsx:104,108` — `task-list-item-<id>`-Anker + `task !== null && task.address != null && <GeoBadge …/>` in `.task-tree-badges`: erfüllt den Issue-Vertrag exakt.
- `frontend/src/lib/extractLeaves.ts` — TaskTree rendert Blätter; Runde 1 hatte das bereits ohne Befund geprüft (Vertrag = Blattzeilen).

## Annahmen
- F6 ist deterministisch (DOM-Struktur + Playwright-Visibility, kein Timing) — 14 konsistente "hidden"-Resolves über 5s.
- Der vergrabene Fixup-Kommentar 5444200633 darf stehen bleiben (Fixup-Phase-Record); der ai-review-Status liegt jetzt in EINEM neuen Kommentar. Genau ein `<!-- ai-review -->`-Marker ist damit weiterhin gegeben.
- `padEnd(30)` bleibt künftigsicher, solange `uniqueTitle`-Labels ≤ ~17 Zeichen bleiben.

## Verworfen
- MODE Fixup Verification — nein: der geforderte Marker fehlt objektiv; Regel "Marker MISSING → CROSS-EXAMINATION" befolgt. Das Kreuzverhör hat F1–F5 trotzdem abgehakt.
- 375px-CSS-Hypothese (Badge kollabiert bei schmalem Viewport) — widerlegt: Zeile 172 ist unverändert und lief in PR #1064 grün; nur das neu hinzugekommene TaskTree-Badge erklärt das Bild.
- F6 als Produkt-Bug — nein: Badge im verborgenen Tab-Panel ist korrektes Tab-Verhalten; der Test misst falsch.
- extractLeaves/Blatt-only als Finding — Runde 1 bereits ohne Befund adjudiziert; Issue-Anker ist explizit die Blattzeile (`task-list-item-<id>`).
- KolBadge statt span/GeoBadge — Abweichung in Runde 0 im PR-Body begründet (Label im Shadow-DOM, Testid-Vertrag).

## Offen
- F6 (Blocker): AK6 rot in CI. Nächste Fixup-Runde muss Spec:172 auf `series-tree`/`series-tree-item-<id>` scope-n und danach `e2e (2)` grün sehen.

## Nächster Schritt
- Kommende Runde: Delta seit `f8ff8efd` (nur Spec:172-Scoping erwartet), CI `e2e (2)` grün bestätigen, F6-Thread (3875554131) resolven, ai-review-Kommentar auf `reviewed` setzen.

## Fallstricke
- **Inline-Kommentare lassen sich NUR auf Diff-Zeilen setzen** — unveränderte Kontextzeilen (hier Spec:172) geben 422 "pull_request_review_thread.line could not be resolved". Ursprungszeile über die nächste hinzugefügte Zeile verankern und im Text die echte Zeile nennen.
- **Fixup-Kommentar und ai-review-Kommentar teilen sich ID 5444200633:** der Fixup-Text hat den ai-review-Body überschrieben. "EXACTLY ONE ai-review" heißt hier: zählen nach Marker, nicht nach ID — ein neuer Kommentar war nötig.
- Playwright-`toBeVisible` auf seitenweite `.first()`-Locator ist fragil, sobald versteckte Tab-Panels dasselbe `data-testid` tragen (hier: `geo-badge` in TaskTree + CompletedTasksTable + SeriesTab gleichzeitig im DOM). Immer auf den Listen-Container oder die konkrete Zeile scope-n.
- `git status` zeigt dettached HEAD/"Merge …" im Repo-Snapshot — PR-Zustand (`state: OPEN`, `headRefOid`) ist die verlässliche Quelle, nicht der lokale Log.
- CI-Run dem Head zuordnen: `gh run view <id> --json headSha` — `gh pr checks` listet auch Runs älterer SHAs.
- Payloads per Heredoc + `--input <file>`; `Write`-Tool auf /tmp ist in dieser Umgebung nicht erlaubt (Permission-Fehler), `python3 -c`/Heredoc schon.
