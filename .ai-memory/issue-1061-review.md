# Review PR #1061 — Adressfeld + Forward Geocoding fuer Aufgaben

MODE: KREUZVERHOER (Runde 1; kein `<!-- ai-review -->`-Kommentar beim Start vorhanden).
Kein Closing-Issue (`closingIssuesReferences` = []) → **Review ohne Issue**, PR-Beschreibung
ist massgebend, keine AK-Verifikation moeglich.

## Erledigt

- Modus bestimmt: `gh api repos/{owner}/{repo}/issues/1061/comments` → kein ai-review-Marker.
- Vollen Diff gelesen (`gh pr diff 1061`, 955 Zeilen, 16 Dateien, +626/-14).
- TITLE-GATE: Titel war deutsch/kein Conventional Commit → umbenannt via `gh pr edit 1061 --title`
  auf `feat(server): add task address field with forward geocoding search` (66 Zeichen).
- Inline-Review mit 4 Findings gepostet: Review-ID **5043062314**, `event=COMMENT`.
- Sammelkommentar gepostet: Comment-ID **5441983273** (traegt `<!-- ai-review -->` als Zeile 1).
- Verdict: **needs-fixup** (in /tmp/claude-verdict + letzte Ausgabezeile).

## Relevante Stellen

- `server/src/logics/nominatim.ts:10` — `createNominatimRateLimiter()` ist eine FACTORY; jede Route
  ruft sie selbst auf (`reverseGeocode.ts:16`, `geocodeSearch.ts:136`) → zwei getrennte Maps. F2.
- `frontend/src/lib/useAddressSearch.ts:27` (useEffect) und `:57` (Cleanup, nur clearTimeout),
  `:14/:24/:61` (`loading` wird exportiert). F1 + F3.
- `frontend/src/components/TaskForm.tsx:887` KolCombobox-Adressfeld (nur Task-Modus),
  `:271` konsumiert nur `suggestions`. F3/F4.
- `frontend/src/components/TaskForm.test.tsx:56ff` — KolCombobox-Mock ist ein nacktes `<input>`,
  `:175` `geocodeSearch: vi.fn().mockResolvedValue([])` ohne Aufruf-Assert. Basis fuer F1/F4.
- Server-Tests, die GUT abdecken (nicht anfassen): `tasks-address.test.ts` (6), `geocode-search.test.ts` (5),
  `migrate.test.ts:474-510` (3 × migrateTaskAddress).

## Annahmen

- CI-Status nicht separat abgefragt; PR-Body behauptet gruen (server 698 passed, frontend 417 passed).
- KolCombobox `_suggestions` als korrekte KoliBri-Prop nicht per kolibri-mcp gegengeprueft (Zeitbudget).

## Verworfen

- „`/geocode-search` ohne requireAuth" — WIDERLEGT: `app.use(requireAuth)` liegt global auf
  `server/src/express/index.ts:180`, die Route wird auf ~218 registriert.
- „`client.GET as unknown as … & { __unsafe: true }` ist ein neuer Cast-Hack" — WIDERLEGT:
  identisches Muster steht bereits auf `frontend/src/api.ts:510` (Reverse-Geocode #866).
- „Generierte API-Typen fehlen im Diff" — WIDERLEGT: `frontend/src/api.ts` importiert aus dem
  Workspace-Paket `client`, keine committete `api.d.ts` noetig.
- Globale Nominatim-Outbound-Drosselung (N Nutzer → N req/s an Nominatim) als eigenes Finding:
  vorbestehend aus #866, nicht von diesem PR eingefuehrt. Nur als Randnotiz in F2 erwaehnt.
- `lat`/`lon` in `GeocodeSearchResult` werden vom Frontend nicht genutzt (Task speichert nur
  `address`): als Finding zu duenn — der PR-Body sagt ausdruecklich „optionales Ortsfeld", nicht
  Geoposition. Falls doch Koordinaten gewuenscht sind, waere das ein Scope-Thema fuer einen Menschen.

## Offen

- Nichts blockiert. Wartet auf Fixup-Runde.

## Naechster Schritt

- (Fixup-Runde) Delta-Review nach SKILL.md Schritt 5: nur Commits mit
  `committedDate > updatedAt` von Comment 5441983273 pruefen, F1–F4 abhaken, Nummern NICHT neu vergeben.

## Fallstricke

- Findings-Nummern F1..F4 sind ueber Runden STABIL — beim Update des Sammelkommentars behobene
  Punkte in die Tabelle „✅ Behobene Anmerkungen" verschieben, nicht umnummerieren.
- Zeile 2 des Sammelkommentars MUSS „Review ohne Issue — PR-Beschreibung ist massgebend" tragen.
- `Write` nach `/tmp` wird abgelehnt; Review-/Kommentar-Bodies deshalb als Datei unter
  `.ai-memory/issue-1061-*.md|json` ablegen und mit `--body-file` / `--input` uebergeben
  (Klammern im Text brechen sonst den Bash-Parser).
