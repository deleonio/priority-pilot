# Issue 1092 — Triage (Phase 1), Stand 2026-08-28

## Erledigt
- Initial-Triage (kein KI-ANALYSE-Block; einziger Kommentar = github-actions-Qualitätscheck, keine Entscheidungen). Analyse-Block + Routing-Tabelle in den Body geschrieben (`.ai-memory/issue-1092-body.md` = gesendeter Stand), Titel korrigiert („Adressbücher defekt" → „Adress-Autovervollständigung: keine Vorschläge bei korrekter Eingabe" — alter Titel inhaltlich falsch), Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-ux-ui` gesetzt. Ampel 🟢, keine offenen Fragen, KEIN Ping-Kommentar (Prompt-Regel: Body+Label ist die komplette Kommunikation).
- Code-Recherche: PR #1086 (Issue #1083) ist um 13:16Z gemerged, Issue #1092 um ~14:00Z erstellt → Fehlerbericht betrifft den NEUEN Code (Photon primär + AddressAutocomplete). Server/Frontend-Stand auf origin/main gelesen (geocodeSearch.ts, useAddressSearch.ts, AddressAutocomplete.tsx, nominatim.ts, useGeolocation.ts, api.ts).
- Ursachenanalyse (4 Kandidaten, priorisiert im Issue-Body): stilles Rate-Limit (200 `[]`), stiller Upstream-Fehler (200 `[]`), Photon ohne User-Agent, `x-session-token` wird nie gesendet.

## Relevante Stellen
- `server/src/express/routes/geocodeSearch.ts:55-58` — Rate-Limit → `res.json([])` mit HTTP 200: HAUPTURSACHE 1 (Eingabe-Verfeinerung <1s → „Keine Treffer").
- `server/src/express/routes/geocodeSearch.ts:71-75,131-133` — Upstream-Fehler beider Provider → 200 `[]`: HAUPTURSACHE 2 (vom Ticket geforderte Unterscheidung existiert serverseitig nicht).
- `server/src/express/routes/geocodeSearch.ts:82` — Photon-Fetch OHNE User-Agent (Nominatim-Aufruf hat ihn, Zeile 126): URsache 3.
- `server/src/logics/nominatim.ts:14` — `isGeocodeRateLimited`: geteilt mit Reverse-Geocoding; `reverseGeocode.ts:66` nutzt denselben Limiter — Geolocation-Initial-Fetch (`frontend/src/lib/useGeolocation.ts:170-181`) frisst das Budget beim Formular-Öffnen. NICHT brechen.
- `frontend/src/lib/useAddressSearch.ts:5` — DEBOUNCE_MS=400 < 1s-Limiter-Fenster → Burst-Tippen löst Mehrfachsuchen aus; abgebrochene Suchen zählen serverseitig trotzdem.
- `frontend/src/components/AddressAutocomplete.tsx:121-126` — Warn-/Leerzustand existieren im Frontend bereits; es fehlt nur das serverseitige Signal (AK2 ist deshalb primär Server-Arbeit).
- `frontend/src/api.ts:527-539` — `geocodeSearch` wirft `ResponseError` bei `!response.ok` → ein 502/429 des Servers landet automatisch im bestehenden error-State des Hooks (Frontend-Seite von AK2 fast gratis).

## Annahmen
- Produktions-Fehlerbild entsteht aus Ursache 1–3 (Screenshot zeigt 200-mit-leerer-Liste-Pfad = „Keine Treffer"-Rendering; keine Server-Logs der Umgebung verfügbar). Externe Reachability-Tests (curl auf photon.komoot.io/nominatim) sind in der Sandbox blockiert — Diagnose bleibt Code-gestützt.
- Routing (ux ja/sonnet/medium, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) ist für Folgephasen verbindlich; ux=ja weil AK3 ein UX-Decision ist (Warnhinweis vs. Auto-Retry).
- Die vom Ticket geforderte Unterscheidung verlangt eine API-Vertragsänderung (Fehlerstatus statt 200 `[]`) — OpenAPI-DTO `GeocodeSearchResult` bleibt, Fehlerantwort läuft über bestehendes Error-DTO.

## Verworfen
- Body-Copyedit — Issue-Body bereits präzise strukturiert (kein pro-forma-Edit).
- Split in Server-/Frontend-Issues — wie #1083: API-Vertrag + Zustands-Rendering gehören zu einem PR.
- needs-human — ACs sind ohne menschliche Entscheidung formulierbar (AK1/AK3 lassen bewusst zwei Lösungswege zu, Festlegung in UX/Spec-Phase).
- Live-Probe der Upstreams (curl) — Sandbox blockiert externe Calls; als offene Diagnose im Analyse-Block dokumentiert statt zu raten.

## Offen
- Exakte Produktions-Ursache nicht verifizierbar (keine Logs, kein Egress aus der Sandbox) — decken die AKs bewusst über alle `[]`-Pfade ab.

## Nächster Schritt
- Phase 2 (UX) über `ai:needs-ux-ui`: Decision AK3 (Rate-Limit-Feedback: Warnhinweis vs. Auto-Retry nach ~1s) + AK2/AK5-Zustandsdarstellung; danach Spec gemäß Routing-Tabelle.

## Fallstricke
- `isGeocodeRateLimited` NICHT pro Route trennen — Nominatim-Policy gilt für UPSTREAM-Calls insgesamt; Entkopplung nur via serverseitigem Queueing/Short-Wait, sonst Policy-Verstoß.
- 200-mit-0-Photon-Treffern bleibt ein legitimes „Keine Treffer" (#1083 AK3) — Fehlerstatus NUR bei technischem Scheitern beider Provider, nicht bei leerer Trefferliste.
- Reverse-Geocoding teilt den Limiter — Änderungen an `nominatim.ts` müssen `reverseGeocode.ts`-Tests grün halten.
- E2E/stub-Tests können das Produktions-Problem nicht reproduzieren (API wird gestubbt) — der Akzeptanz-Nachweis von AK1 braucht den Server-API-Test mit zwei Back-to-Back-Calls.
- Temp-Dateien `tmp-1092.json` + `issue-1092-body.md` in `.ai-memory/` sind Wegwerf-Artefakte (Body-Zusammenbau) — NICHT committen, löschen wenn Phase läuft.
