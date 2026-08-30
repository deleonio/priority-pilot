# Issue 1130 — Review (Phase 5/7), Fixup-Verifikation Runde 2, Stand 2026-08-30

**ERGEBNIS: MODE = Fixup-Verifikation (`<!-- ai-review -->`-Kommentar IC_kwDONloM188AAAABRdk88Q, needs-fixup, Runde 1). F1–F3 alle verifiziert behoben, 3/3 Review-Threads resolved, kein neues Finding, kein Entscheidungs-Finding → VERDICT reviewed (🟢).**

## Erledigt
- Marker-Suche: genau 1 `<!-- ai-review -->`-Kommentar (id `IC_kwDONloM188AAAABRdk88Q`, created 2026-08-30T05:04:55Z, 3 offene Findings, „Review-Typ: Kreuzverhör", keine „ohne Issue"-Zeile — Closing-Issue #1130 vorhanden).
- Delta = Fixup-Commit `92c74349` (05:20:39Z) vs. reviewed Head `970921dd` (davor nur memory-Commits); Memory-Commit `4690a9ca` code-los.
- **F1 ✅** `http-error.test.ts:119` → `new SequelizeValidationError('Validation error', [items])`; `http-error.ts:14` → `error.errors.map((item) => item.message)` ohne toten Fallback. Rückgabetyp `string[]` korrekt (ValidationErrorItem.message ist string).
- **F2 ✅** `http-error.test.ts:35` → `srcRoot = new URL('../', import.meta.url)` = `server/src`; alle 13 Pfad-Strings (ROUTE_FILES 9×, INLINE_500_FILES 3×, Hardcode-Liste 3. Test) auf Präfix `express/` umgestellt. JSDoc „unter server/src" stimmt jetzt. False-Positive-Check: `grep -rnE "const (sendError|handleWriteError|parseId) =" server/src --include=*.ts` = 0 Treffer (auch http-error.ts selbst nutzt `export function`) → verbreiterter Scan grün.
- **F3 ✅** `http-error.ts:10` → `export type ErrorDto`; `routes/geoConfig.ts:89,107,137` nutzen `Response<… | ErrorDto>` statt lokaler Kopie; geoConfig hat keinen lokalen `type ErrorDto` mehr. knip: Export wird genutzt → grün.
- Review-Threads F1/F2/F3 alle `isResolved: true`.
- lokale Test-Ausführung unmöglich (kein node_modules in der Sandbox, Memory 2026-08-29) → CI verify am Fixup-Head abgewartet.
- Sammelkommentar aktualisiert („Behobene Anmerkungen" F1–F3, Offene Findings leer, Footer „Review-Typ: Fixup-Nachweis"), VERDICT `reviewed` → /tmp/claude-verdict.

## Relevante Stellen
- `server/src/express/http-error.ts` — 33 Zeilen, zentraler Fehlervertrag; `ErrorDto` exportiert, drei Helfer.
- `server/src/express/http-error.test.ts:35` — `srcRoot` jetzt `server/src`; Guard-Test 1 scannt `listSources(srcRoot)` recursive (filter nur `node_modules`) → breiter als nötig, aber ohne Treffer.
- `server/src/express/routes/geoConfig.ts` — einziger neuer Importeur von `ErrorDto` (Spec-Vorbedingung `docs/spec/issue-1130.md:22` erfüllt).
- 14 weitere lokale `type ErrorDto =`-Kopien (index.ts, series, tasks, pillars, …) — laut Runde-1-Review explizit außerhalb Ticket-Scope, bewusst NICHT als Finding.

## Annahmen
- `error-contract.test.ts` (unverändert vs. main) deckt den Produktionspfad mit echtem sequelize ab → F1-Vereinfachung verhaltensidentisch; lokale Ausführung nicht möglich, CI verify als Ersatznachweis.
- CI-`e2e (1..4)` am Head sind server-irrelevant (PR server-only); der Runde-1-Flaky `e2e/issue-969.spec.ts:113` war zwischenzeitlich grün gelaufen.

## Verworfen
- Erneutes Kreuzverhör des Gesamt-PR — MODE Fixup-Verifikation, nur Delta.
- Neue Findings zu den 14 verbleibenden ErrorDto-Kopien / `llmProviders.ts:324` (`ErrorDto | { message: string }`) — außerhalb Ticket-Scope, Runde-1-Entscheidung hält.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- -

## Nächster Schritt
- Pipeline: `ai:needs-review` entfernen / Merge-Freigabe; Ticket #1130 kann durch den PR-Merge schließen.

## Fallstricke
- Breiterer `srcRoot` scannt ALLE *.ts unter server/src inkl. api.d.ts + Tests — das Muster `const <name> =` ist absichtlich so zusammengesetzt, dass die Testdatei sich nicht selbst trifft; bei künftigen Erweiterungen (z. B. INLINE_500) ebenfalls nur Datei-Listen, keine Heuristik, verwenden.
- Fixup-Delta sauber bestimmen: reviewed Head war `970921dd`, nicht `a92b844e` — dazwischen liegen nur `memory:`-Commits.
