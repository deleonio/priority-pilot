# Issue 1073 — Fixup-Phase (PR #1076)

## Erledigt
- Findings gelesen: 1 × 🟡 inline (F1, `minWidth: 0` wirkungslos auf non-replaced inline Span), 1 × nicht-blockierende Beobachtung (° N/° E bei negativen Koordinaten falsch — präexistierend, laut Review bewusst KEIN Fixup-Punkt, separates Ticket falls relevant).
- F1 behoben in **76c6d488**: `frontend/src/components/Footer.tsx:13` — `minWidth: 0` aus dem style-Objekt entfernt, `overflowWrap: 'anywhere'` bleibt (trägt AK6-Schutz allein). `docs/spec/issue-1073.md:29-31` — Umsetzungshinweis auf `overflow-wrap: anywhere` ohne `min-width: 0` korrigiert (mit Begründung).
- Gate vor Push grün: `pnpm format` + prettier --check ✅, lint (server+frontend inkl. tsc) ✅, knip ✅, `pnpm --filter frontend test` → 426 passed ✅ (Footer.test.tsx 8/8).
- Review-Kommentar 3876063057 beantwortet (Fixup-Nachweis mit SHA) und Thread `PRRT_kwDONloM186c_Ncr` via GraphQL `resolveReviewThread` resolved.
- CI nach Push angestoßen (run 33119654412), war beim Soft-Deadline-Abriss noch pending (verify + 4×e2e).

## Relevante Stellen
- `frontend/src/components/Footer.tsx:13` — behobener Span (nur noch `overflowWrap: 'anywhere'`).
- `docs/spec/issue-1073.md:28-33` — AK6-Umsetzungshinweis, Doku-Korrektur Teil des Findings.
- PR-Body erwähnt `min-width: 0` evtl. ebenfalls — NICHT geändert (nur Code + Spec laut Vorschlag); falls der Reviewer den PR-Body auch bemängelt, dort nachziehen.

## Annahmen
- PR-Body-Doku (`min-width: 0`-Erwähnung) gehört nicht zum Vorschlagsumfang des Reviewers.

## Verworfen
- ° N/° E Hemisphere-Beobachtung — Review sagt explizit "nicht blockierend, kein Fixup-Punkt"; nur-zu-gemeldete Findings fixen.

## Offen
- CI run 33119654412 (verify + e2e 1–4) noch pending bei Turn-Ende — nächster Lauf muss prüfen, ob grün (erwartbar ja, nur trivialer Style-Input-Entferner).

## Nächster Schritt
- Falls neuer Lauf aufgerufen wird: `gh pr checks 1076` prüfen; bei rotem Job Log lesen; sonst PR ist fixup-seitig fertig (kein needs-human, kein already-done → kein Verdict).

## Fallstricke
- Git-Identity fehlt in der Sandbox: Commit nur mit `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit` möglich (lefthook pre-commit läuft dabei durch, ~18s).
- Thread-Resolve heißt im GraphQL `resolveReviewThread` (NICHT `resolvesReviewThread`), Feld `threadId` mit der Thread-Node-ID (`PRRT_…`), nicht der Kommentar-ID.
- Reply auf Review-Kommentar: REST `POST /pulls/{n}/comments/{id}/replies` funktioniert, liefert aber KEIN Resolve — Resolve geht nur über GraphQL.
