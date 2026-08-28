# Issue 1091 — Review (Phase 5), Stand 2026-08-28 (Runde 2: Fixup-Verifikation)

## Erledigt
- Runde 1 (Kreuzverhör): needs-fixup, 1 Inline-Finding (`useAddressSearch.test.ts` State-Assertion tautologieschwach), Sammelkommentar `<!-- ai-review -->` angelegt (issuecomment-5454298375), Titel 105→62 Zeichen umbenannt.
- Runde 2 (Fixup-Verifikation, dieser Lauf): MODE anhand vorhandenen Markers bestimmt. Delta geprüft = Commits nach 15:16:54Z: 8bdd6017 (Fix) + 9239e560 (nur Phase-Notiz) — KEIN Voll-Review erneut.
- Fixup 8bdd6017 verifiziert am Dateistand: `geocodeSearchMock.mockResolvedValue(results(['Musterstraße 1, Musterstadt']))`, Assertion `expect(result.current.suggestions).toEqual(treffer)`; Helper `results` (test.ts:35) liefert `[{address, lat, lon}]`, Hook-Initial-State `suggestions = []` (useAddressSearch.ts:32) → Assertion hat Biss, Finding 1 wirklich behoben.
- Sammelkommentar per PATCH auf **reviewed / 🟢** aktualisiert (Statuszeile nennt PR #1093 + Issue #1091, Behobene-Anmerkungen-Historie erhalten, Footer `Review-Typ: Fixup-Nachweis`).
- Titel-Gate Runde 2: CC-konform (62 Zeichen), kein Rename nötig. Verdict-Datei /tmp/claude-verdict = reviewed geschrieben.

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.test.ts:61-84` — fixup-Verifizierungsanker (Mock + State-Assertion).
- `frontend/src/lib/useAddressSearch.ts:32` — Initial-State `[]`, Beleg für die Unterscheidbarkeit.
- `.ai-memory/issue-1091-fixup.md` — Fixup-Phase-Notiz im PR (Mutation-Check-Dokumentation).

## Annahmen
- CI (verify/e2e/review) war bei Abgabe IN_PROGRESS, nicht rot → 🟢 zulässig; Merge-Gate degradiert bei späterem Rot selbst zu ai:needs-changes (SKILL.md Schritt 5).
- Fixup-Agenten-Angabe „447 passed" nicht selbst nachgefahren (Zeit); CI-verify läuft ohnehin und ist die autoritative Instanz.

## Verworfen
- Erneutes Voll-Kreuzverhör des PR-Diffs — MODE Fixup-Verifikation verbietet es (nur Delta seit Sammelkommentar).
- Warten auf grüne CI — Deadline knapp; Gate hält ai:ready-to-merge zurück, bis CI grün ist.

## Offen
- `.ai-memory/issue-1091-review-comment.md` ist ein Wegwerf-Artefakt (Sammelkommentar-Body für den PATCH) und gehört NICHT in einen Commit.

## Nächster Schritt
- keiner aus Review-Sicht — Pipeline: Gate wartet auf grüne CI, dann ai:ready-to-merge/Auto-Merge; bei roter CI Fixup-Runde.

## Fallstricke
- GraphQL-Node-ID (IC_kwDO…) ist für den REST-Endpoint issues/comments/<id> unbrauchbar (404) — numerische ID via issues/1093/comments-Listing holen.
- Der Sammelkommentar war schon einmal gepatcht (Interims-Stand „fixup-angewendet, 🟡") — Struktur (Behobene-Anmerkungen-Historie) beim Update wieder mitführen, nicht verwerfen.
