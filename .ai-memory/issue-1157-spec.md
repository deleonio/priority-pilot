# Issue 1157 — Spec (Phase 3), Stand 2026-09-01

## Erledigt
- Harness-Kommentar (KI-ANALYSE, Ampel 🟢) gelesen; Branch `ai/harness/1157` ausgecheckt (existierte schon, nur Triage-Notiz `8523a4bd` drauf, kein Draft-PR vorhanden → keine Idempotenz-Hürde).
- Dedup-Check: keine bestehende Suite deckt Serien-Datenisolation ab (`series-title-length.test.ts` = Validierung, `series-generate-all-auth.test.ts` = nur generate-all, `api-auth-protection.test.ts` = 401-Schutz). Keine Test-Widersprüche → keine Test-Pflege nötig.
- Spec `docs/spec/issue-1157.md` geschrieben (Ziel/Vorbedingungen/Verhalten/AK-Abdeckung/Abgrenzungen).
- Rote Tests `server/src/express/series-dataisolation.test.ts` — 5 Tests, alle 5 ROT verifiziert
  (`node --import tsx --test`, exit 1: 200/201/204 statt 404, Liste ungefiltert):
  - AK1: GET /series mit Alice-Cookie sieht nur eigene Serie (fremde ID fehlt, Länge 1).
  - AK2: GET/PATCH/DELETE /series/:id + POST /series/:id/generate auf Bobs Serie → je 404,
    je mit Positivfall eigene Serie (200/200/204/201) gegen Über-Scoping.
- AK3 bewusst ohne eigenen Testfall (Nachweis = Suite-Lauf + CI-Gate, wie Analyse es vorgibt).
- Commit + Draft-PR (Schritt 4).

## Relevante Stellen
- `server/src/express/routes/series.ts` — 5 unscoped Stellen: GET /series (Z.~313 findAll), `findSeriesWithPillars` (Z.290, von GET/:id + POST genutzt), PATCH /:id (Z.~384 findByPk), DELETE /:id (Z.~483 findByPk), POST /:id/generate (Z.~517 findByPk). `getUserId` ist Z.10 schon importiert; `ownerScope` aus `../requireAuth.js` fehlt im Import.
- `server/src/express/routes/tasks.ts:120` (`findOwnTask`) und `pillars.ts:164` — Muster für die Impl.
- `server/src/express/pillars-dataisolation.test.ts` — Vorbild der neuen Suite (Login-Reihenfolge, GOOGLE_ALLOWED_EMAILS-Override-Begründung Z.11-14).
- `server/src/express/routes/series.ts:336` POST /series schreibt `userId: getUserId(req) ?? null` → Setup legt Serien über die API an, userId stimmt automatisch.
- `server/src/express/series.api.test.ts` + `series-generate-all-auth.test.ts` — müssen grün bleiben (Pass-Through unverändert).

## Annahmen
- `ownerScope(undefined) === {}` (Analyse verifiziert an requireAuth.ts:34) → Pass-Through-Verhalten bleibt ohne eigenen Test unverändert, abgesichert durch die bestehenden Unauth-Suiten.
- Fremde Serie = 404 (nicht 403), wie bei Tasks/Pillars — Analyse-Vorgabe.
- Serien-DTO enthält kein `userId` → AK1-Assertion über IDs statt userId-Feld.

## Verworfen
- Eigener Pass-Through-Test (Auth aus, Liste ungefiltert) — redundant zu `series.api.test.ts` (läuft ohne Cookie/Scope), Analyse-Vorgabe „kein eigener Testfall" für AK3-Pass-Through.
- Direktes Model-Seeding (`Series.create` mit userId) — API-Anlegen ist robuster (userId-Bindung getestet implicitly) und braucht kein Model-Wissen.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `ownerScope` in series.ts importieren + die 5 Stellen scopen; rote Tests müssen grün werden, `series.api.test.ts`/`series-generate-all-auth.test.ts` bleiben grün.

## Fallstricke
- `POST /series/generate-all` und `POST /series` NICHT anfassen (bereits korrekt gescopet, Analyse- Randbedingung).
- `findSeriesWithPillars` wird auch vom POST-Erfolgspfad (Z.~340, frisch angelegte eigene Serie) genutzt — Scope dort darf den eigenen Fall nicht brechen; ggf. userId-Parameter mit eigener ID durchreichen.
- generate-Route braucht gültiges `until` im Body, sonst 400 statt 404 (Test nutzt festes Datum).
- startDate muss nicht zu mon..sun-Rhythmen passen; `weekly` ist frei (Test nutzt 2030-01-07, ein Montag — auch für spätere rhythm-Umbauten sicher).
