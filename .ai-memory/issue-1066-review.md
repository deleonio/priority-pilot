# Issue 1066 — Review-Phase (2026-08-28, Runde 2 = Fixup-Nachweis ohne Fixup)

## Erledigt
- MODE = FIXUP VERIFICATION (Sammelkommentar-ID 5447797272 vorhanden, updatedAt 2026-08-28T02:52:09Z).
- Delta geprüft: `gh pr view 1071 --json commits` — KEIN Commit nach updatedAt; PR-Head = `bbe80cf1` (02:48:01Z) = exakt der Runde-1-Stand.
- Alle 5 Findings gegen Head verifiziert, alle weiter offen: F1 `tasks.ts:218` unabhängige lat/lon-Behandlung; F2 `useGeolocation.ts:132` catch nur `err.code === 1`; F3 `GeoBadge.tsx:62` catch ohne Cache-Eintrag; F4 `tasks.ts:341` `Number(req.query.lat)` ohne Leerstring-Check; F5 openapi Series-Schemas „Aufgabenorts" (3 Stellen, Serien-Ort-Zeilen ~1900–2070; Zeilennummern haben sich durch Main-Merge verschoben — grep nach `Aufgabenorts` in Series-Blöcken).
- Sammelkommentar per PATCH aktualisiert (Status needs-fixup, Review-Typ: Fixup-Nachweis, Findings unverändert 1–5).
- Titel-Gate: `feat(frontend): add nearby card with geo-distance task list` — CC-konform, kein Rename nötig.
- Verdict: needs-fixup.

## Relevante Stellen
- `server/src/express/routes/tasks.ts:218` / `series.ts:232` — F1, paarweise NULL-Normalisierung fehlt.
- `frontend/src/lib/useGeolocation.ts:132-138` — F2-Ursache, Datei NICHT im PR-Diff.
- `frontend/src/components/GeoBadge.tsx:40-66` — F3, addressCache nur im then-Zweig.
- `server/src/express/routes/tasks.ts:340-345` — F4, nearby-Query-Validierung.
- `openapi.yml` Series-Schemas — F5.

## Annahmen
- Kein Fixup eingereicht = Runde 2 darf reine Verifikation ohne neue Inline-Kommentare sein (kein neuer Diff zum Ankommentieren).

## Verworfen
- Voll-Diff-Re-Walk — SKILL step 5 Diff-Scoping; Head unverändert, Code-Spot-Checks reichten.

## Offen
- Fixup-Runde muss F1–F5 adressieren; danach wieder MODE FIXUP VERIFICATION mit PATCH auf Kommentar 5447797272.

## Nächster Schritt
- Fixup-Phase: F1 (paarweise NULL-Normalisierung + Single-Null-Test), F2 (Hook error-Status oder Card-Fallback + e2e code 3), F3 (Fehler-Cache + Serialisierung), F4 (Leerstring-Check), F5 (openapi-Text).

## Fallstricke
- Body-Datei diesmal im Repo unter `.ai-memory/review-round2-body.md` (gitignored) — `-F body=@file` funktioniert; löschen nicht nötig.
- Einzeln-Kommentare via `pulls/comments` scheitern mit 422 — gebündelte Review-API nutzen (Runde-1-Notiz, bleibt gültig).
- Finding-Nummern 1–5 stabil halten; „Behobene Anmerkungen"-Tabelle erst füllen, wenn echte Fixup-Commits existieren.
