# Issue 1034 / PR 1035 — Kreuzverhör (Review-Phase)

## Erledigt

- MODUS bestimmt: kein `<!-- ai-review -->`-Marker in den PR-1035-Kommentaren gefunden →
  Erstreview (Kreuzverhör), vollständiger Diff geprüft (`gh pr diff 1035`).
- TITEL-GATE: Titel war deutsch/nicht Conventional-Commits-konform
  („PWA-Update-/Offline-Hinweis: mobile Bedienbarkeit + beschreibende Texte (#1034)") →
  umbenannt zu `feat(frontend): improve pwa update/offline prompt tap targets and copy`
  (`gh pr edit 1035 --title …`).
- Finding 1 (🟡, needs-fixup) als Inline-Review-Kommentar gepostet:
  `frontend/src/app.css:1577` — `@media (max-width: 767px)` verstößt gegen die explizite
  Mobile-First-Regel in `.ai-knowledge/project.md` (Zeile 61-64: Basis-Styles für schmalsten
  Viewport, nur `min-width`-Aufwärtskaskade, kein `max-width`-Downgrade). Repo hat bereits an
  Zeile 977 dasselbe Anti-Pattern (Präzedenzfall, aber kein Freifahrtschein für neue Instanzen).
  Review gepostet über `gh api .../pulls/1035/reviews` (Review-ID `5026261217`, `event=COMMENT`).
  **Fallstrick dabei:** `-f body=@/tmp/datei.txt` liest die Datei NICHT ein (anders als curl) —
  Ergebnis war der literale String `@/tmp/review-body.txt` im Review-Body. Korrigiert per
  `gh api --method PUT repos/.../pulls/1035/reviews/5026261217 -f body="…"` (Inline-String statt
  `@file`). Der Inline-Kommentar selbst (via `-f "comments[][body]=$(cat datei.txt)"`) kam korrekt an.
- KoliBri-Alternative geprüft: `mcp__kolibri-mcp__fetch spec/button` zeigt `kol-button` hat
  `_inline` (Default `false`, erzwingt bereits ≥44px), aber **keine** `_block`/Vollbreiten-Prop
  (anders als das unrelated `mcp__kern-mcp__get_button`, das ein `block`-Flag hat — anderes
  Design-System, nicht das hier verwendete KoliBri). Eigenes CSS für `width: 100%` ist also
  sachlich gerechtfertigt, nur Begründung im PR-Body fehlt (als Randnotiz im Sammelkommentar
  vermerkt, kein eigenes Finding).
- Sammelkommentar `<!-- ai-review -->` neu angelegt (`gh pr comment 1035 --body-file …`,
  https://github.com/deleonio/priority-pilot/pull/1035#issuecomment-5419837914) mit Status
  `needs-fixup`, Finding 1, Randnotiz, „Sonstiges"-Abschnitt (Tests/TDD-Trennung/Titel-Fix), Footer
  `Review-Typ: Kreuzverhör`.

## Relevante Stellen

- `frontend/src/app.css:1574-1587` — die neue Media-Query, Gegenstand von Finding 1.
- `.ai-knowledge/project.md:56-70` — die verletzte Mobile-First-Konvention (min-width-Pflicht).
- `frontend/src/app.css:977-981` — bestehender Präzedenzfall desselben Anti-Patterns (nicht Teil
  dieses Diffs, nur als Kontext für die Begründung zitiert).
- `docs/spec/issue-1034.md` „Test-Pflege-Bedarf" — bestätigt, dass die drei entfernten/angepassten
  Tests in `UpdatePrompt.test.tsx` bereits in der Spec-Phase begründet waren (kein neuer Fund nötig).

## Annahmen

- AK1 (375px) und AK3 (1280px, prüft nur `position`/`bottom` von `.update-prompt`, nicht die
  Button-Breite) legen sich nicht auf eine Media-Query-Richtung fest — ein Umbau auf
  Mobile-First (`min-width: 768px`-Override statt `max-width: 767px`-Regel) sollte beide e2e-Tests
  unverändert grün lassen. **Nicht selbst verifiziert** (reiner Review, kein Code geändert) —
  Fixup-Phase sollte das nach dem Umbau bestätigen.

## Verworfen

- Kein `needs-human`: Finding 1 ist eine reine CSS-Umbau-Frage (Mobile-First-Konvention), keine
  Architektur-/Produktentscheidung — braucht keinen Menschen.
- Kein eigenes Finding für die fehlende KoliBri-Begründung im PR-Body — nach Prüfung sachlich
  gerechtfertigt (keine Vollbreiten-Prop vorhanden), nur als Randnotiz vermerkt.
- Kein Finding zu `min-height: 44px` als „redundant" (KolButton `_inline=false` garantiert laut
  Spec-Doku bereits ≥44px) — der PR-Body dokumentiert einen **live gelaufenen** e2e-Test (7/7
  grün) vor UND wäre ohne die CSS-Regel rot gewesen (Spec: „Rot im Status quo"), also ist die
  Regel empirisch nötig (Host-Element vermutlich nicht automatisch block-level/44px, nur das
  Shadow-DOM-Innenelement) — nicht widerlegt, nicht als Finding aufgenommen.

## Offen

- Fixup zu Finding 1 steht aus (Mensch/Fixup-Agent muss `app.css` umbauen).
- Scratch-Datei `.ai-memory/issue-1034-review-body-scratch.md` liegt im Working Tree (passt auf
  `.gitignore`-Muster `.ai-memory/issue-*.md`, sollte nicht committed werden — analog zum
  Fallstrick aus der Triage-Phase).

## Nächster Schritt

- Fixup-Runde: `frontend/src/app.css:1574-1587` auf Mobile-First (`min-width: 768px`-Override)
  umstellen, danach `npx playwright test e2e/pwa-update-prompt.spec.ts` (AK1/AK3) erneut grün
  bestätigen. Danach Folge-Review (FIXUP-NACHWEIS-Modus, da Marker jetzt existiert) nur den
  Fixup-Diff seit `updatedAt` des Sammelkommentars prüfen.

## Fallstricke

- `gh api ... -f body=@/tmp/datei` liest die Datei **nicht** ein wie bei curl — Ergebnis ist der
  literale String. Für Review-Summary-Bodies entweder `-f body="$(cat datei)"` (Command-Substitution)
  verwenden, oder nach dem Posten mit `gh api --method PUT .../reviews/<id> -f body="…"` korrigieren.
  Bei `comments[][body]` (Array-Feld) funktionierte `$(cat …)` inline direkt korrekt.
- `kern-mcp` und `kolibri-mcp` sind zwei unterschiedliche, unabhängige MCP-Server (KERN- vs.
  KoliBri-Designsystem) — beim Prüfen von „gibt es eine native Vollbreiten-Prop" unbedingt
  `mcp__kolibri-mcp__*` verwenden, nicht `mcp__kern-mcp__*` (letzteres hat ein `block`-Flag, das
  aber zu einem anderen, hier nicht verwendeten Designsystem gehört und in die Irre führen kann).
