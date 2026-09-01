# Issue 1157 — Triage (Phase 1), Stand 2026-09-01T04:26:23Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar, 0 Kommentare). Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (issuecomment-5488882425), Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert). Kein Ping, kein Titel-Edit (traegt), kein Body-Edit (ADR 0009), kein Split (eine Datei + Test = ein PR). Kein Auto-Close: Code auf main unscoped verifiziert.

## Erledigt
- Issue geladen: nightly-arch-opt-Ticket (Run #33468477823), Datenisolation-Luecke in Serien-CRUD.
- Alle Body-Behauptungen per recherche-Subagent gegen main verifiziert (s. Relevante Stellen) — keine Abweichung, nur Nuance: Z.373 laeuft ueber `findSeriesWithPillars` (Z.290), nicht direkt findByPk; Issue nennt das selbst ("analog erweitern").
- Harness-Kommentar (`.ai-memory/issue-1157-comment.md` als Vorlage) gepostet; Header `### Testfälle` mit Umlaut wie im Skill-Template.

## Relevante Stellen
- `server/src/express/routes/series.ts:313` — GET /series `Series.findAll({ order, include:[Pillar] })` ohne Scope (AK1).
- `series.ts:290` — `findSeriesWithPillars` = unscoped findByPk+include; genutzt von GET /series/:id (Z.373).
- `series.ts:384,483,517` — PATCH/DELETE /:id + POST /:id/generate je unscoped `findByPk` (AK2).
- `series.ts:10` — `getUserId` bereits importiert; nur `ownerScope` fehlt im Import.
- `series.ts:321` (POST /series, `userId: getUserId(req) ?? null`) und `:355` (generate-all → `materializeDueSeries`) — bereits korrekt, NICHT anfassen.
- `server/src/express/requireAuth.ts:34` — `ownerScope(userId)` → `{}` bei undefined ⇒ Pass-Through bleibt erhalten.
- `server/src/express/routes/tasks.ts:120` — `findOwnTask`-Muster (`findOne({ where:{ id, ...ownerScope(userId) } })`), 404-Behandlung :413,495.
- `server/src/express/routes/pillars.ts:8,164` — Import- + `where: ownerScope(userId)`-Vorbild.
- `server/src/express/pillars-dataisolation.test.ts:16,24-25,46-52` — Test-Vorlage (`applyTestAuthEnv('iso-test')`, zwei Cookies, seed-Helper).
- `server/src/express/series.api.test.ts`, `series-generate-all-auth.test.ts` — muessen gruen bleiben (AK3).

## Annahmen
- `ownerScope`/`getUserId` aus `../requireAuth.js` (Issue schrieb beide importieren — getUserId war schon da; nur ownerScope ergaenzen).
- Kein UX-Lauf: reines Backend, DTO/Route unveraendert, keine UI-Aenderung.
- Routing (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) folgt etabliertem Muster.

## Verworfen
- Titel-Edit — "[arch-opt] Series-Routen ohne Eigentümer-Scope — Datenisolation-Lücke im Serien-CRUD" ist korrekt.
- Split — 5 Query-Stellen in einer Datei + eine Testdatei, ein PR.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience, Kriterium nicht erfuellt.

## Offen
- `.ai-memory/issue-1157-body-orig.md` + `.ai-memory/issue-1157-comment.md` sind Wegwerf-Artefakte, NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests in neuer Datei `server/src/express/series-dataisolation.test.ts` nach AK1–AK3 (Vorbild pillars-dataisolation.test.ts).

## Fallstricke
- Pass-Through-Modus (ohne Auth) muss unangetastet bleiben: ownerScope({}) = kein Filter — keine hardcodierte userId-Bedingung bauen.
- Fremde ID = 404 (nicht 403/401) — Konsistenz mit Tasks/Pillars.
- Positivfall (eigene Serie → 200) mittesten, sonst faengt Ueber-Scopung niemand.
- `findSeriesWithPillars` wird evtl. an zweiter Stelle genutzt — beim Scoping-Parameter-Signaturwechsel alle Call-Sites pruefen.
- server-Tests lokal: session.test.ts braucht Redis (MEMORY 2026-08-29) — gezielt `pnpm --filter server test -- series` laufen lassen.
