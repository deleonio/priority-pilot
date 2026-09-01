# Issue 1153 — Fixup PR #1156 (Runde 1), Stand 2026-09-01

## Erledigt
- Beide Findings aus dem ai-review-Kommentar (needs-fixup, Runde 1) behoben, keine Entscheidungs-Findings:
  - **Finding #1 (🔴 fixup.md:10):** REST-Endpunkt `pulls/{pr}/threads` (existiert nicht, 404) ersetzt durch die vom Reviewer vorgeschlagene GraphQL-Query `repository.pullRequest.reviewThreads` (mit `isResolved`, damit der Fixup aufgelöste Threads überspringen kann). Query VOR dem Einbau live gegen PR #1156 verifiziert (lieferte beide Thread-IDs + path/line). Hinweis „threads are GraphQL-only" in die Prompt-Zeile aufgenommen.
  - **Finding #2 (🟡 ux.md:1):** `(sources: SKILL.md step 4)` → `(sources: step 4)` (ticket-ux SKILL.md hat keine nummerierten Steps; gemeint ist ux.md PROCEDURE-Schritt 4). PR-Body Rang-3-Begründung korrigiert: „KERN existiert im Repo nirgends" war falsch — `frontend/DESIGN.md:7` dokumentiert KERN UX; jetzt „KERN ist in keiner UX-Phasen-Quelle verankert (…); steht nur in frontend/DESIGN.md". PR-Body per /tmp-Datei + `gh pr edit --body-file` gepatcht.
- Gate: prettier ✓ auf beiden geänderten Dateien, `pnpm test:scripts` 251 pass, frontend `pnpm test` 491 pass. Knip rot (`fetchProviderModelsFromUpstream server/src/express/routes/llmProviders.ts:223`) — per `git stash`-Gegenprobe auf sauberem HEAD identisch rot → pre-existing, unrelated. Server-Tests lokal ohne Redis bekannt rot (MEMORY 2026-08-29), vom Markdown-Change unberührt.
- Beide Review-Threads via `resolveReviewThread` aufgelöst (IDs PRRT_kwDONloM186d9nh_ = fixup.md:10, PRRT_kwDONloM186d9niz = ux.md:1).

## Relevante Stellen
- `.github/prompts/fixup.md:10` — neuer Thread-Lookup: GraphQL-Query + `isResolved`-Skip + GraphQL-only-Hinweis; danach unverändert die `resolveReviewThread`-Mutation.
- `.github/prompts/ux.md:1` — Quellen-Referenz jetzt „(sources: step 4)" = eigener PROCEDURE-Schritt 4.
- `frontend/DESIGN.md:7` — Beleg, dass KERN UX im Repo dokumentiert ist (Grund für die PR-Body-Korrektur).

## Annahmen
- PR-Body-Edit (Rang-3-Zeile) ist vom Reviewer explizit als Fix vorgeschlagen und verändert keine anderen Body-Teile (python-replace mit assert auf exakten String).

## Verworfen
- Knip-Fix für llmProviders.ts — pre-existing auf HEAD (Stash-Gegenprobe), außerhalb der gemeldeten Findings („Only fix reported findings").

## Offen
- -

## Nächster Schritt
- Re-Review (Runde 2) durch den Workflow; keine offenen Findings dieser Runde übrig.

## Fallstricke
- Threads NIE per REST `pulls/{pr}/threads` listen — GitHub hat diese Route nicht (404 trotz gültiger Auth); nur GraphQL `reviewThreads` liefert Thread-IDs.
- Die GraphQL-Query braucht `-F n=` (Int), nicht `-f` — sonst Typfehler.
