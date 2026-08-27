# PR 1053 — Fixup (Finding F1, 2026-08-27)

## Erledigt
- F1 vollständig behoben, Commit **d83c8e72** auf `chore/spec-sync-all` gepusht:
  - `docs/spec/issue-787.md:50-56` — neue „Abgrenzung: Tab-Leisten über alle Viewports“: beide Tab-Leisten (Ansichten „Dashboard / Aufgaben / Serien / Wald“, Settings „Allgemein / Säulen / KI-Provider“) bleiben <768px nebeneinander, Umbruch statt Überlauf; bewusste Abweichung von „eine primäre Aktion pro Zeile“ für Tab-Leisten.
  - `docs/spec/issue-619.md` (Randfälle-Tabelle) — Prettier-Tabellenformat nachgezogen (driftete im Sync-Commit), sonst wäre `prettier --check` am neuen HEAD rot.
  - PR-Body via `gh pr edit 1053 --body-file` erweitert: Report-Abschnitte `## issue-865.md — ENTFERNT (Redundanz)` und `## issue-968.md — ENTFERNT (konsolidiert)` vor dem issue-931-Abschnitt.
- Threads resolved: PRRT_kwDONloM186crSgX (issue-968.md) + PRRT_kwDONloM186crSgg (issue-865.md), jeweils mit Reply inkl. Fix-SHA.
- ai-review-Kommentar (id 5433590967) gepatcht: Status `needs-fixup` → `fixup-done`, Abschnitt „✅ Behobene Findings“ ergänzt.
- GATE lokal komplett grün: format, prettier --check, lint, knip, test (685 server + 205 frontend Tests).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:27/:146` — Settings-Tabs-Labels/KolTabs-Host (Quelle der Formulierung).
- `frontend/src/App.tsx:53/:515` — VIEW_TABS / KolTabs `app-tabs`.
- `frontend/src/app.css:1398-1411` — `.settings-tabs` + CSS-Kommentar mit #703-Revisions-Begründung (verifiziertes Verhalten).
- GraphQL-Helfer: `/tmp/m1.graphql`, `/tmp/m2.graphql` (Thread-Replies), `/tmp/q3.json` (resolveReviewThread), `/tmp/pr1053-body-new.md`, `/tmp/ai-review-new.md`.

## Annahmen
- Lokal grüner GATE genügt als Nachweis; CI-E2E läuft beim Turn-Ende noch ( vorheriger Lauf auf inhaltlich identischem Code: e2e 1–4 alle pass). Kein neuer Push geplant.
- Redis-Fail beim ersten `pnpm test` war lokal umgebungsbedingt (siehe Verworfen/Learnings), kein Produktfehler.

## Verworfen
- Verhalten in `user-journeys.md` erfassen — Datei umfasst nur die vier Kern-Journeys + Randfälle; Tab-Layout ist Struktur/Navigation und gehört zu issue-787 (Kopf-/Struktur-Kontext).
- issue-968.md wiederherstellen — Review akzeptiert explizit Konsolidierung; Abgrenzung in issue-787.md reicht.
- issue-703.md-Referenz im Text — #703 ist repo-weit nirgends mehr referenziert; Deviation deshalb ohne Ticket-Referenz formuliert.
- Nur-Report-Lösung (Option b des Findings) — Verhalten ist extern sichtbar und war sonst unerdokumentiert, daher Option a (erfassen) gewählt.

## Offen
- `-`

## Nächster Schritt
- Re-Review-Runde (review-kreuzverhoer): prüfen, dass F1 abgearbeitet ist (`issue-787.md:50-56`, PR-Body-Report) und keine neuen Findings im Fix-Diff entstehen. Falls CI verify/e2e doch rot wird: Log lesen (Docs-only → erwartet grün).

## Fallstricke
- Commit nur mit lokalem git identity möglich: `git -c user.name="my-github-action-bot[bot]" -c user.email="my-github-action-bot[bot]@users.noreply.github.com" commit …` (CI importiert keine Identität; letzter Sync-Commit trägt denselben Namen).
- `pnpm format` reformatiert betroffene Specs zusätzlich zum eigenen Edit — Diff vor Commit lesen, unnötige Fileänderungen ggf. reverten (hier: issue-619.md bewusst übernommen).
- `gh api graphql -f query=@file` funktioniert nicht (kein @-Support); stattdessen JSON-Payload bauen (`{"query": ...}`) und `--input file` nutzen. GraphQL-Mutation braucht vollständige Selection Sets inkl. Klammern.
- Lokaler Redis fehlt → Server-Test AK-5 schlägt fehl (401 vs. 200): vor dem GATE `docker run -d --rm -p 6379:6379 redis:8` starten, danach `docker stop`.
