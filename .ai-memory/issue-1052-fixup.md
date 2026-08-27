# Fixup PR #1052 — docs(user-guide)-Sync

## Erledigt
- Beide Review-Findings (Inline-Kommentar-IDs 3868569634/3868569639) in docs/user-guide.md
  behoben, exakt nach Vorschlag des Reviews:
  - Finding 1 (guide.md:377ff): Bullet → „fließen ins **Dashboard-Gesamtguthaben** ein,
    verteilt nach deiner Säulen-Gewichtung — in der Erledigt-Tabelle zeigen sie 0 Punkte
    je Spalte.“
  - Finding 2 (guide.md:430ff): → „als **je eine gebündelte Nachricht**: … — sowie
    **separat** deine drei wichtigsten offenen Aufgaben (nach Priorität).“
- GATE: format/prettier/lint/knip grün; `pnpm test` rot NUR an server session.test.ts
  AK-5 (Redis-Store) — bekanntes Sandbox-ohne-Redis-Rot (MEMORY.md 2026-08-25), CI hat
  redis:8-Service. Docs-only-Change, kein Zusammenhang.
- Commit + Push: **45463a16** „docs: address review findings in user guide (PR #1052)“.
- Beide Review-Threads per GraphQL resolveReviewThread aufgelöst:
  - Finding 1: PRRT_kwDONloM186csFrz → isResolved true
  - Finding 2: PRRT_kwDONloM186csFr2 → isResolved true

## Relevante Stellen
- docs/user-guide.md:377-379 (Finding 1), :430-433 (Finding 2).
- Sammelkommentar des Reviews: issues/comments/5434142764 (PATCHen, nicht neu anlegen).

## Annahmen
- Fixes als unambiguous übernommen (Reviews eigene Vorschläge wortgleich umgesetzt).
- Redis-Test-Rot ist umgebungsbedingt, kein Fix-Ziel.

## Verworfen
- Keine erneute Titel-Änderung (schon in Review-Phase umbenannt).

## Offen
- CI-Runs für Commit 45463a16 wurden NICHT abgewartet (Soft-Deadline) — beim nächsten
  Lauf `gh pr checks 1052` bzw. `gh run list --branch chore/user-guide-sync` prüfen.

## Nächster Schritt
- CI für 45463a16 prüfen; falls rot: Log lesen (Real failure → fix; FLAKY → rerun --failed).
  Danach ggf. Sammelkommentar 5434142764 auf Fixup-Status aktualisieren.

## Fallstricke
- GraphQL: Argumente mit `:` schreiben (`first:1`), nicht `=`; Variablen-Int via `-F`.
- Threads des PRs via GraphQL reviewThreads holen (REST pulls/{n}/threads → 404).
- git-Identität im Runner vor Commit setzen (Learning 2026-08-23/25).
