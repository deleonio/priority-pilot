# Issue 1083 — Review PR #1086 (Phase 5), Stand 2026-08-28

**ERGEBNIS: Runde 3 (Fixup-Verifikation) = 🟢 reviewed. Sammelkommentar 5451804266 aktualisiert (gleiche ID), alle Findings F1–F4 + N1 behoben, kein neues Finding.**

## Erledigt
- MODE = FIXUP VERIFICATION (Marker `<!-- ai-review -->` gefunden: issuecomment-5451804266, updatedAt 2026-08-28T11:34:53Z, offenes Finding N1, Zeile 2 = „Review gegen Closing-Issue" → KEIN Fall „ohne Issue").
- Delta-Review: einziger Code-Commit seit dem Review-Zeitpunkt ist `4203ddc9` (sonst nur `.ai-memory`-Commits cecfe0e3/7a31e2ab/c768ef55/a1c56deb/d775f257). Er fügt `frontend/src/components/AddressAutocomplete.test.tsx:225-239` hinzu (15 Zeilen) = exakt der N1-Vorschlag.
- Substanz des N1-Tests statisch verifiziert (nicht tautologisch): Alert-Zweig `AddressAutocomplete.tsx:121-123` rendert nur an `!loading && error`, unabhängig von `open`/Listbox (`AddressAutocomplete.tsx:136` `open &&`) → ohne F1-Zeile `useAddressSearch.ts:56` bleibt die Warnung neben der Listbox und `expect(queryByRole('alert')).toBeNull()` rotiert.
- Testdeterminismus geprüft: `afterEach(() => { mockReset(); mockResolvedValue([]) })` (Testdatei :96-100) + explizites `mockResolvedValue(MUNICH_HITS)` vor dem 2. Aufruf; `typeQuery` wartet auf den API-Aufruf (Debounce 400 ms < Timeout 2000 ms); 'munchen haupt' ≥ MIN_QUERY_LENGTH.
- Alle 5 Review-Threads resolved (F1–F4, N1; N1-Fix-Kommentar 3880649998).
- CI am PR-Head `a1c56deb`: `verify` success, `e2e (1–4)` success, `precheck` success (nur `review` = dieser Lauf). Kein roter Check.
- Sammelkommentar aktualisiert: Status 🟢 reviewed, N1 in „Behobene Anmerkungen" verschoben (Tabelle F1–F4+N1, Datum 2026-08-28), „Offene Findings" = keine, Footer `Review-Typ: Fixup-Nachweis`. Kein Inline-Review gepostet (nichts Neues).
- TITLE GATE: „feat(frontend): fuzzy address search via photon, nominatim fallback" = 67 Zeichen, Conventional Commits, lowercase-subject → unverändert, kein `gh pr edit`.
- Memory geschrieben.

## Relevante Stellen
- `frontend/src/components/AddressAutocomplete.test.tsx:225-239` — N1-Regressionstest (Fixup `4203ddc9`), ein Mount: Fehler → erfolgreiche Suche ohne Warnung.
- `frontend/src/components/AddressAutocomplete.tsx:121-123` — Alert-Zweig; entscheidend für die Fehlfähigkeit des Tests (nicht an `open` gekoppelt).
- `frontend/src/lib/useAddressSearch.ts:56` — F1-Zeile `setError(false)` im Timer-Callback, weiterhin vorhanden (nicht regressioniert).
- `frontend/src/components/AddressAutocomplete.test.tsx:96-100` — `afterEach`-Mock-Reset, Grund für die Testdeterminismus-Behauptung.

## Annahmen
- CI `verify` am Head (a1c56deb) deckt den N1-Commit (4203ddc9) ab: Head liegt 1 Memory-Commit über 4203ddc9, der Test ist Teil des verifizierten Baums.
- Lokaler Vitest-Lauf wurde NICHT geführt — Review-Sandbox ohne installierte Deps (`@vitejs/plugin-react` fehlt → `ERR_MODULE_NOT_FOUND` beim vitest-Start). Grüner CI-`verify` ist die verbindliche Bestätigung; die Substanzprüfung ist statisch erfolgt.

## Verworfen
- Eigener roter Nachweis (F1-Zeile temporär entfernen → Test rot) — würde Code-Änderung in der Review-Phase bedeuten; die Fehlfähigkeit ist aus der Renderstruktur (Alert-Zweig unabhängig von `open`) statisch beweisbar.
- Neues Inline-Review — keine Findings; ein leeres `event=COMMENT`-Review würde nur Rauschen erzeugen.
- Labels — laut Aufgabenstellung setzt die sie das Workflow automatisch.

## Offen
- Keine Findings offen. Loop-seitig: `review`-Workflow läuft (war `pending` beim Stand dieses Reviews); `gate-merge`/`fixup` skipped bis dahin.

## Nächster Schritt
- Kein weiterer Review-Durchlauf nötig — Verdict `reviewed` ist geschrieben. Nur falls CI am Head doch rot wird: neuer Fixup-Loop mit `ai:needs-changes` (F-Nummern bleiben eingefroren, nächstes Finding wäre N2).

## Fallstricke
- `gh api ... --jq '.id + " " + .updated_at'` bricht mit „cannot add: number and string", wenn das erste Element eine Zahl ist → erst `tostring` oder das ganze Array als String joinen; der PATCH selbst ist davon UNBETROFFEN (war bereits durch).
- PR-Head ist NICHT der lokale `git rev-parse HEAD` (hier Merge-Commit `d775f257`) — Check-Runs immer am `headRefOid` der PR-Abfrage prüfen.
- Review-Sandbox: `frontend/node_modules` unvollständig → vitest startet gar nicht; Gates nur über CI beurteilen, nicht über lokale Läufe behaupten.
- Delta-Scoping: Zwischen Review-`updatedAt` und dem Fixup liegen mehrere reine `.ai-memory`-Commits — über `git show --stat` aussortieren, sonst klingt der Delta-Review größer als er ist.
