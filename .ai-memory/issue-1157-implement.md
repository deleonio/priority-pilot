# Issue 1157 — Implement (Phase 4), Stand 2026-09-01

## Erledigt
- Spec-Modus: Draft-PR **#1158** (Branch `ai/harness/1157`, Commits 8523a4bd/52c81709/8b5521cd) ausgecheckt; lokale untracked Notizen waren byte-identisch mit Branch-Versionen → gelöscht, sauber gewechselt. Issue-Assign via `gh issue edit --add-assignee` an GitHub-App-Token gescheitert (GraphQL: „Assigning agents is not supported") — dokumentiert, nicht blockierend.
- Quick-Check SKILL Schritt 2: Ampel 🟢, alle benannten Dateien existieren, Tests unverändert übernommen.
- Implementiert in `server/src/express/routes/series.ts` (nur diese Datei):
  - Import Z.10: `ownerScope` ergänzt.
  - `findSeriesWithPillars(id)` → `(id, userId)` mit `Series.findOne({ where: { id, ...ownerScope(userId) }, include: [Pillar] })` (Z.~292).
  - GET /series: `Series.findAll({ where: ownerScope(getUserId(req)), … })`, `_req` → `req` (Z.~316).
  - GET/PATCH/DELETE /series/:id + POST /:id/generate: je `findByPk` → `findOne` mit Scope, fremde ID → 404 (bestehende Meldung).
  - Beide `findSeriesWithPillars`-Erfolgspfade (POST-Neuanlage Z.~348, PATCH-Re-Load Z.~472) reichen `getUserId(req)` durch.
- Alle 5 roten Tests GRÜN: `NODE_ENV=test pnpm exec node --import tsx --test src/express/series-dataisolation.test.ts` → pass 5, fail 0. (Direktaufruf ohne NODE_ENV=test scheitert mit 401 — /auth/test-login ist nur bei NODE_ENV=test registriert, auth.ts:248; package.json test-Skript setzt es.)
- Gate: siehe PR-Body #1158 (Ergebnisse dort dokumentiert).

## Relevante Stellen
- `server/src/express/routes/series.ts` — komplette Scoping-Änderung (s.o.), 5 Query-Stellen.
- `server/src/express/requireAuth.ts:34` — `ownerScope(undefined) === {}` ⇒ Pass-Through bleibt.
- `server/src/express/series-dataisolation.test.ts` — Spec-Vertrag (AK1/AK2), unverändert.
- `server/src/express/routes/pillars.ts:8,164` — Muster-Vorbild.

## Annahmen
- POST /series + POST /series/generate-all bleiben unangetastet (Analyse-Randbedingung; generate-all scoping läuft über `materializeDueSeries(userId)`).
- `findSeriesWithPillars` hat keine Call-Sites außerhalb series.ts (module-lokales const, grep verifiziert).

## Verworfen
- Änderung an Tests — Separation of Duties, keine Widersprüche gefunden.
- Eigener Pass-Through-Test — Analyse-Vorgabe (series.api.test.ts deckt das ab).

## Offen
- -

## Nächster Schritt
- Review-Phase (PR #1158 nach `gh pr ready` + Body-Erweiterung).

## Fallstricke
- Test-Läufe brauchen `NODE_ENV=test` (und idealerweise `DATABASE_STORAGE=:memory:`), sonst 401 im Login-Setup.
- session.test.ts kann lokal an fehlendem Redis rot gehen (MEMORY 2026-08-29) — pre-existing, im PR-Body dokumentieren, nicht fixen.
