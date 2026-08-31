# Issue 1142 / PR #1150 — Review (Fixup-Verifikation Runde 3), Stand 2026-08-31T06:17Z

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.**

## Erledigt
- MODE bestimmt: Marker `<!-- ai-review -->` vorhanden (Kommentar-ID 5474180270, Stand vor dieser Runde: 2026-08-31T05:50:51Z, Runde 2, bereits 🟢) → MODE = FIXUP VERIFICATION.
- Delta-Check: `git diff --stat 805b7cfa..2a22d376 -- ':!.ai-memory'` = leer. Zwischen dem letzten Review-Stand und HEAD (`2a22d376`) liegen nur zwei Memory-Notiz-Commits (`6154dd26`, `2a22d376`) der Fixup-Runde 3 — kein Produktions-/Testcode geändert.
- Fixup-Runde-3-Nachweis geprüft (`.ai-memory/issue-1142-fixup.md` + ai-fixup-decisions-Kommentar id 5474482372): keine offenen Findings nach Runde 2, F1–F3 weiter bestätigt behoben, neuer Punkt F4 (`e2e (4)` rot auf `frontend/e2e/tasks-tab-filter.spec.ts:212`, außerhalb PR-Diff) per Rerun `33362012636` grün — Einstufung Flake plausibel (PR-Diff laut `gh pr diff 1150 --name-only` nur `server/src/**/*.test.ts` + `.ai-memory/*`).
- TITLE GATE geprüft: „refactor(server): central auth and request test helpers (#1142)" — 63 Zeichen, type(scope): subject, englisch, lowercase Subjekt → erfüllt Conventional Commits, keine Umbenennung nötig.
- Sammelkommentar (id 5474180270) aktualisiert: Runde-3-Vermerk (Delta leer, F4 in die Behobene-Anmerkungen-Tabelle ergänzt), Ampel 🟢 bestätigt, Footer-Datum aktualisiert.
- **Fallstrick live erlebt:** `gh api --method PATCH ... -f body=@/tmp/datei.md` schreibt den LITERALEN String `@/tmp/datei.md` als Body (kurzzeitig live auf GitHub gestanden, sofort korrigiert) — `-f` liest KEINE `@file`-Syntax, dafür ist `-F` (bzw. `--field` mit Typinferenz) nötig. Korrigiert via `gh api --method PATCH ... -F body=@/tmp/datei.md` (verifiziert: Body kam korrekt an).
- CI zum Prüfzeitpunkt: neuer Run auf `2a22d376` (`33363369983`) `in_progress` (verify + e2e 1-4); letzter inhaltlich relevanter grüner Stand war `33362012636` auf `805b7cfa` (alle Jobs ✅ nach Flake-Rerun). Kein Code-Grund für erneutes Rot erwartet (Diff seitdem leer) — Merge-Gate bleibt Sache von `gate-merge`, nicht dieser Review-Runde.

## Relevante Stellen
- `server/src/test/helpers.ts:79` — `registerResponse`-Helfer, Kern des Refactors (unverändert seit Runde 2).
- `server/src/express/auth-avatar.test.ts` — F1-Fixstelle (Runde 2, Commit `024b9368`), in Runde 3 nicht erneut angefasst.
- `frontend/e2e/tasks-tab-filter.spec.ts:212` — Flake-Quelle F4, außerhalb des PR-Diffs, nur per CI-Rerun behandelt.

## Annahmen
- F4 (tasks-tab-filter-Flake) ist tatsächlich ein Timing-Flake und kein durch den PR verursachter Regressionsfehler — gestützt auf `gh pr diff 1150 --name-only` (keine Frontend-Dateien im Diff) und den Rerun-Erfolg; nicht am Code selbst nachverifiziert (außerhalb Scope: PR ändert nur Server-Test-Helfer).
- Der neue CI-Run auf `2a22d376` (zum Zeitpunkt dieser Notiz `in_progress`) wird grün, da kein Code seit dem letzten grünen Lauf geändert wurde — nicht abgewartet (Merge-Gate ist ohnehin ein separater deterministischer Schritt).

## Verworfen
- Erneutes volles Kreuzverhör des gesamten PR-Diffs — MODE ist Fixup-Verifikation (Marker vorhanden), SKILL-Schritt 5 verlangt nur den Delta-Check seit dem letzten Review-Stand.
- Warten auf den laufenden CI-Run (`33363369983`) bis zum Abschluss — Delta ist leer, inhaltlich nichts zu verifizieren; würde nur Zeit kosten ohne neuen Erkenntnisgewinn.

## Offen
- -

## Nächster Schritt
- Keiner aus Review-Sicht (🟢, keine offenen Findings). Merge hängt nur noch am deterministischen CI-Gate (`gate-merge`) für den laufenden Run auf `2a22d376`.

## Fallstricke
- `gh api -f body=@datei` liest die Datei NICHT ein (postet den literalen `@pfad`-String) — für Dateiinhalt als Feldwert `-F`/`--field` verwenden (macht Typ-/`@file`-Inferenz). Kurzzeitig fehlerhaft live auf PR #1150 gestanden, sofort per PATCH korrigiert.
- `mergeStateStatus: UNSTABLE` bei diesem PR kam bereits in Runde 3 ausschließlich vom Flake-Rerun, nicht von Konflikten (`mergeable: MERGEABLE`) — nicht als Blocker fehlinterpretieren.
