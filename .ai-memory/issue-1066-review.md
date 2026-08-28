# Issue 1066 — Review-Phase (2026-08-28, Kreuzverhör Runde 1)

## Erledigt
- MODE bestimmt: Kreuzverhör (kein `<!-- ai-review -->`-Kommentar auf PR #1071 vorhanden).
- Full Diff gelesen (24 Dateien, +1208/−24); AKs aus Issue-Body-KI-ANALYSE-Block (im Kontext geladen). Closing Issue #1066 verifiziert (length=1).
- Route-Reihenfolge verifiziert: `GET /tasks/nearby` (tasks.ts:340) liegt VOR `GET /tasks/:id` (:410) — OK.
- `frontend/src/lib/useGeolocation.ts` gelesen: Fehler mit code ≠ 1 werden still verschluckt (nur code 1 → permissionDenied+enabled=false) → Grund für Finding 2.
- Review gepostet (Review-ID 5047526740, event=COMMENT) mit 6 Inline-Kommentaren (F1 doppelt: tasks.ts+series.ts).
- Sammelkommentar `<!-- ai-review -->` erstellt: https://github.com/deleonio/priority-pilot/pull/1071#issuecomment-5447797272 — Status needs-fixup, 5 offene Findings, stabile Nummern 1–5.
- Titel-Gate: PR-Titel (Issue-Titel wörtlich, nicht CC-konform) umbenannt zu `feat(frontend): add nearby card with geo-distance task list`.
- Verdict: needs-fixup (alle Findings fixbar, keine Entscheidungs-Findings → keine „Entscheidungs-Findings"-Sektion).

## Relevante Stellen
- `server/src/express/routes/tasks.ts:218` / `series.ts:232` — lat/lon-Validierung behandelt Felder unabhängig (F1: Spec „und/oder → beide NULL" verletzt).
- `frontend/src/components/NearbyCard.tsx:69` — Lade-Hinweis; bei Geolocation-Fehler code 2/3 bleibt Card hier hängen (F2, AK4).
- `frontend/src/lib/useGeolocation.ts:132-138` — locate()-catch reagiert nur auf err.code===1 (Ursache F2, Datei NICHT im Diff).
- `frontend/src/components/GeoBadge.tsx:62` — catch ohne Cache-Eintrag: Fehlschläge nicht gemerkt, parallele Requests (F3, Nominatim 1 req/s).
- `server/src/express/routes/tasks.ts:341` — `Number(req.query.lat)`: `Number('')===0`, `?lat=&lon=` passieren als 0/0 (F4).
- `openapi.yml:1918,~1984,~2046` — Series-Schemas sagen „Aufgabenorts" statt „Serien-Orts" (F5, kosmetisch).

## Annahmen
- CI war beim Review `pending` (e2e/verify) — Ampel rein inhaltlich; Pipeline degradiert selbst bei roten Checks.
- PR-Body-Verifikation (vitest 422 passed, e2e 6/6) nicht lokal nachgerechnet — Zeitbudget; als Dokumentation akzeptiert.

## Verworfen
- In-Memory-Sort im Nearby-Endpoint (findAll aller offenen Tasks statt SQL-Sortierung): bei SQLite ohne Geo-Funktionen und Personal-App-Skalierung akzeptabel — kein Finding.
- KoliBri-First-Verstoß der Custom-Liste in NearbyCard: spec-begründet (zweispaltige Zeile Titel/Distanz, 44px), KolCard wird verwendet — kein Finding.
- „Koordinaten gehen beim Editieren des Adresstexts verloren" im TaskForm: konsistent mit Coordinates-only (Koordinate nur bei Vorschlags-Match, AK1/AK10) — bewusst kein Finding.

## Offen
- Fixup-Runde muss F1–F5 adressieren; danach MODE FIXUP VERIFICATION (Sammelkommentar-ID 5447797272 per PATCH updaten, Findings in „Behobene Anmerkungen" verschieben).

## Nächster Schritt
- Fixup-Phase: F1 (paarweise NULL-Normalisierung + Single-Null-Test), F2 (Hook error-Status oder Card-Fallback + e2e code 3), F3 (Fehler-Cache + Serialisierung), F4 (Leerstring-Check), F5 (openapi-Text).

## Fallstricke
- Einzeln-Kommentare via `repos/.../pulls/comments` scheitern jetzt mit 422 („positioning wasn't supplied") — stattdessen gebündelte Review-API `pulls/<pr>/reviews` mit `comments[]` nutzen (funktionierte problemlos).
- `-F body=@file` Syntax (nicht `-F body@file`); Payload per python3 nach /tmp/review-payload.json schreiben, `--input` übergeben — Heredoc direkt im Bash-Tool scheitert oft.
- Sammelkommentar-Anker: Issue-Kommentar-ID 5447797272, Finding-Nummern 1–5 und Option-IDs stabil halten.
