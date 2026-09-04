# Issue 1211 — Fixup PR #1214 (Runde 1), Stand 2026-09-04

## Erledigt
- Finding #1 (🔴 Blocker, PATCH-Vertragsbruch `name` Pflicht vs. OpenAPI optional) behoben:
  `server/src/express/routes/groups.ts:155-173` — PATCH baut jetzt ein `changes`-Objekt und
  validiert/übernimmt `name` nur bei `body.name !== undefined` (400 weiterhin bei vorhandenem,
  ungültigem Namen), `description` nur bei Anwesenheit (String→trim, leer→null).
- Server-Tests ergänzt in `server/src/express/groups.api.test.ts` (2 Tests): „PATCH nur mit
  description → 200, Name unverändert“ + „PATCH nur mit name → 200, Beschreibung unverändert;
  leerer name → 400“.
- e2e-Edit-Schritt ergänzt in `frontend/e2e/groups.spec.ts` („Bearbeiten: nur geänderte
  Beschreibung speichern hält den Namen (AK6)“): Name-Feld unangetastet, nur Beschreibung
  füllen → Speichern → Karte zeigt neue Beschreibung UND alten Namen.
- Gate komplett grün via gate-runner: format/prettier/lint/knip (nur Config-Hints =
  bekannt)/`pnpm test` 274 pass/0 fail (Redis-Skip-Problem diesmal nicht aufgetreten)/
  `npx playwright test e2e/groups.spec.ts` 6 passed.
- Review-Thread (groups.ts:156) per GraphQL resolveReviewThread aufgelöst.

## Relevante Stellen
- `server/src/express/routes/groups.ts:143` — PATCH-Handler; Kommentar ab :156 erklärt den
  GroupUpdate-Vertrag (alle Felder optional) und verweist auf Review PR #1214 Finding 1.
- `frontend/src/components/GroupFormDialog.tsx:60-66` — sendet im Edit-Modus nur geänderte
  Felder (`groupUpdate.name` nur bei Änderung) — Ursache, warum der Bug in der UI auftrat.
- `openapi.yml:1383` — Schema `GroupUpdate`: „alle Felder optional“ (Vertragsquelle).
- `server/src/express/groups-dataisolation.test.ts:81` — bestehender PATCH-404-Test bleibt
  unberührt grün (sendet `name`, trifft weiterhin den Validierungspfad).

## Annahmen
- Nits (N+1 bei memberCount, findMembership-Join, Array.isArray-Guard, fehlende GET-Sortierung)
  bewusst NICHT angegangen — Review markiert sie als nicht blockierend; Fixup-Scope ist nur
  Finding #1.
- Leerer PATCH-Body (kein Feld) → 200 ohne Änderung; vom GroupUpdate-Vertrag gedeckt, nicht
  extra getestet.

## Verworfen
- Frontend-Änderung (z. B. immer `name` mitsenden) — Review-Vorschlag ist serverseitig und
  Vertrag-konform; Frontend-Verhalten (nur geänderte Felder) ist gewollt.

## Offen
- -

## Nächster Schritt
- Follow-up-Review liest die ✅-Tabelle im ai-fixup-decisions-Kommentar (PR #1214) als
  Claim-Checkliste; erwartetes Ergebnis 🟢.

## Fallstricke
- `pnpm format` hat den description-Ternär wieder einzeilig umgebrochen (Zeile :171) — kein
  manueller Revert, das ist der Formatter-Zustand.
- Bei künftigen PATCH-Tests: Pass-Through-Modus ohne Auth-Env reicht (groups.api.test.ts-
  Muster), Isolation deckt groups-dataisolation.test.ts mit Cookie-Login ab.
