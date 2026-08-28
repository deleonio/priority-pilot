# Issue 1066 — Fixup-Phase (2026-08-28, Run 2: Start NACH Deadline, keine Aktion — Stand = Run 1: F1–F5 committed+gepusht, GATE offen)

## Erledigt
- Alle 5 Review-Findings (Sammelkommentar 5447797272) in Commit **c0735603** gefixt und gepusht (bbe80cf1..c0735603):
  - **F1** `server/src/express/routes/tasks.ts` (ValidateTaskAttributes) + `series.ts`: lat/lon-Validierung zu EINEM Paar-Block zusammengefasst; wenn eines von beiden `null`/fehlt → werden BEIDE attrs auf null normalisiert (`attrs.latitude = lat !== null && lon !== null ? lat : null`). Einzel-Koordinate im Input wird damit paarweise genullt.
  - **F2** `frontend/src/lib/useGeolocation.ts`: neuer State `unavailable: boolean` (Interface, useState, Return); Intervall-catch unterscheidet jetzt `err.code === 1` (bleibt: permissionDenied + Präferenz aus) vs. Code 2/3 → `setUnavailable(true)`; Erfolg resetted (`setUnavailable(false)` im then). `NearbyCard.tsx` destrukturiert `unavailable` und zeigt es im `nearby-denied`-Zweig (`permissionDenied || !supported || unavailable`), Hinweistext auf „nicht verfügbar" erweitert.
  - **F3** `frontend/src/components/GeoBadge.tsx`: module-level `inflight = new Map<string, Promise<string>>()` serialisiert parallele reverseGeocode-Aufrufe pro Koordinate; FEHLER wird als Ergebnis `ADDRESS_UNAVAILABLE` gecacht (catch vor dem Cache-set). Effect nutzt `inflight.get(key) ?? api…`-Kette.
  - **F4** `server/src/express/routes/tasks.ts` nearby: `parseCoord(value)` — nur `typeof 'string' && trim() !== ''` → Number, sonst NaN → 400. `Number('')===0`-Loch geschlossen.
  - **F5** `openapi.yml`: `sed '1880,2070s/Aufgabenorts/Serien-Orts/g'` — nur die 3 Series-Schemas (6 Description-Zeilen: ~1918/1927/1984/1993/2046/2054) jetzt „Serien-Orts"; Task-Schemas (1177–1367) unangetastet.
- Pre-Commit-Hook lief komplett durch (format 1.45s, knip 5.6s ✔️, lint 13.1s ✔️).

## Relevante Stellen
- `frontend/src/lib/useGeolocation.ts:49,74,255` — `unavailable` (Interface/State/Return).
- `frontend/src/components/NearbyCard.tsx` — denied-Zweig jetzt 3 Bedingungen, testid `nearby-denied` unverändert.
- `frontend/src/components/GeoBadge.tsx` — inflight-Map direkt nach `addressCache`-Deklaration.
- `server/src/express/routes/tasks.ts` — Paar-Block ersetzt die zwei Einzel-ifs; `parseCoord` im nearby-Handler.

## Annahmen
- F1-Semantik: „Input berührt Koordinaten ⇒ Paar wird aus dem Input abgeleitet, undefined zählt als null" (TaskForm sendet ohnehin immer beide). PATCH-artiges „nur longitude senden, latitude behalten" ist mit dieser Validierung nicht möglich — konsistent mit Spec-Kommentar „null leert beide Werte".
- F5: Review meinte mit „3 Stellen" die 3 Series-Schemas (je latitude+longitude Description).
- Kein Regenerate von `client/src/schema.d.ts` nach openapi.yml-Textänderung nötig (Descriptions fließen nicht in Typen) — von nächstem Lauf per grep „Aufgabenorts" in `client/src/`/`server/src/api.ts` gegenprüfen.

## Verworfen
- Voll-GATE, Thread-Resolves, Review-Kommentar-PATCH, F1-Unit-Test, e2e „code 3" — Zeit: Soft-Deadline war ~5 Min. nach Start (339s), nur Hook-Teile (format/lint/knip) liefen.

## Offen
- **GATE**: `pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm test` NICHT gelaufen (nur Pre-Commit-Teile). `pnpm test` lokal an session.test.ts/Redis pre-existing rot (MEMORY.md 2026-08-27). Frontend-vitest + Server-Tests gegen die geänderten Dateien dringend.
- F1-„Single-Null-Test" (Review forderte Test: latitude gesetzt, longitude null ⇒ beide null) fehlt noch — Anhang in `server/src/express/tasks-coordinates.test.ts`.
- e2e „Geolocation code 3 → nearby-denied" fehlt (Review-Option).
- CI auf c0735603 prüfen (`gh run list --branch feat/issue-1066-nearby-card`).
- Review-Threads zu F1–F5 resolven (GraphQL `resolveReviewThread(input:{threadId})`, MEMORY 08-23) + Sammelkommentar 5447797272 per PATCH auf status: done setzen („Behobene Anmerkungen"-Tabelle: alle 5 via c0735603).

## Nächster Schritt
- Run 2: GATE komplett laufen lassen → F1-Test + ggf. e2e code 3 ergänzen → CI checken → Threads resolven + Sammelkommentar PATCH → verdict.

## Fallstricke
- F2-Python-Insert erzeugte DUPLICATE `permissionDenied,` im Return-Objekt → lint (no-dupe-keys) blockierte den Commit STILL (Output endete nach „🥊 lint"); Fix war `sed -i '257d'`. Bei ähnlichen Insert-Patterns: grep -n auf Duplikate VOR dem Commit.
- Bash-Working-Directory persistiert: nach `cd frontend` ist der nächste Call noch dort — Pfade absolut oder zurück-`cd`n.
- Hook läuft nur format/lint/knip — Tests sind NICHT abgedeckt; grüner Commit ≠ grüner GATE.
