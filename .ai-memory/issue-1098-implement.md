# Issue 1098 — Implement (Lauf 5, Fortsetzung), Stand 2026-08-28

**ERGEBNIS: VERDICT not-ready — Deadline überschritten; Server (Lauf 4) UND Frontend-Unit-Seite implementiert und GRÜN. Offen: Voll-Gate (lint/prettier/knip/tsc), e2e, `gh pr ready 1103`.** PR #1103 bleibt Draft.

## Erledigt
- **Frontend komplett implementiert (AK1–AK7), Unit-Tests GRÜN:**
  - `openapi.yml` — Pfad `/geo-config` (GET/PUT, `GeoConfig`-Schema mit Kreuz-Schranken) ergänzt; `client/src/schema.d.ts` + `server/src/api.d.ts` per `openapi-typescript` regeneriert (läuft offline, `npx openapi-typescript ../openapi.yml -o …`).
  - `frontend/src/api.ts` — `getGeoConfig()`/`updateGeoConfig(config)` (GET/PUT `/geo-config`, wirft ResponseError wie alle Methoden).
  - `frontend/src/lib/useGeolocation.ts` — `intervalMs`-State (null=Config lädt), Config-Fetch im Mount-Effekt mit Fallback `GEOLOCATION_INTERVAL_MS`; Intervall-Effekt startet erst nach Config-Auflösung (Guard `intervalMs === null`), Deps erweitert. Re-Entrancy-Guard unangetastet.
  - `frontend/src/components/SettingsPage.tsx` — 3 `KolInputRange` (Labels exakt wie Spec) unterhalb des Standort-Switches im Tab Allgemein; Kreuz-Schranken dynamisch (`_min`/`_max`), `_disabled={!geoEnabled}` mit key-Remount `key={geo-<feld>-${geoEnabled}}`, sichtbarer Wert im Light-DOM (`span.geo-range-value`: „5 km"/„1 km"/„5 Minuten"), Switch-Hint dynamisch (`intervalMinutes`), `applyGeoValue` PUT-t sofort (Best-Effort, klamped Payload).
  - `frontend/src/components/Dashboard.tsx` — eigene `useGeolocation`-Instanz, `{geoEnabled && <NearbyCard />}` (AK4).
  - `frontend/src/components/NearbyCard.tsx:84` — Distanz `({formatKm(km)} km)` (AK6, Klammern).
  - Footer: KEINE Änderung nötig — `location` ist bei `geoEnabled=false` bereits null (AK4-Footer-Assertion already green).
- **Test-Pflege (Bestands-Tests, keine Spec-Tests geändert):**
  - `PillarList.tsx` loadPillars: `setPillars(data ?? [])` — API-Double resolved undefined → `.length`-Crash bei `await act` (von AK2-Test geflushst).
  - `LlmSettings.tsx` reloadProviders: `setProviders((await …) ?? null)` — gleiche Falle (`providers !== null`-Guard lässt undefined durch).
  - `App.test.tsx` api-Mock: `getGeoConfig: vi.fn().mockResolvedValue(undefined)` ergänzt (Hook ruft sie beim Mount; ohne → TypeError in 8 App-Tests).
- `npx vitest run` (frontend, komplett): **456 passed, 13 skipped, 0 failed**. `SettingsPage.test.tsx` + `useGeolocation.test.ts`: 18/18.

## Relevante Stellen
- GET-Race-Fix: `geoUserEditedRef` in SettingsPage — der nachlaufende Config-GET darf eine bereits gemachte Regler-Änderung nicht überschreiben (AK2 wäre sonst rot: GET resolved im selben act AFTER onChange).
- `bound()` im Test liest Property VOR Attribut — KoliBri-Adapter setzt numerische Props beim Mount als Property; Post-Mount-Updates kommen als Attribut durch. Keys mit Wert-Bestandteil sind FALSH (Test hält alte Node-Referenz!) — nur `geoEnabled` im Key.

## Annahmen
- PUT bei jedem onChange (kein Debounce) — für AK7-e2e ok; Range-Slider feuern ggf. mehrfach PUT (im PR body als bekanntes Muster dokumentieren).
- GeoConfig-GET liefert immer flaches Objekt (Server-Vertrag aus Lauf 4).

## Verworfen
- key-Remount mit Wert-Bestandteil (`${displayDistanceKm}` etc.) — AK2-Test hält Node-Referenz von VOR dem act; Remount macht Assertion dann strukturell rot. Nur `geoEnabled` gehört in den Key.
- Defensiver `typeof api.getGeoConfig === 'function'`-Guard im Hook — stattdessen App.test.tsx-Mock gepflegt (Test-Pflege dokumentiert).

## Offen
- Voll-Gate: `pnpm format`, `prettier --check .`, `pnpm lint`, `pnpm knip`, `pnpm test` (server: session.test.ts ist pre-existing rot ohne Redis — Memory 2026-08-27), `tsc` (Pre-Commit-Hook läuft es ohnehin).
- e2e: `cd frontend && npx playwright test e2e/issue-1098-geo-settings.spec.ts` + `issue-1066-nearby-card.spec.ts` (Chromium ggf. erst installieren, Memory 2026-08-20); Live-Check 375/1280px.
- Danach: `gh pr ready 1103` + PR-Beschreibung erweitern (Implementierungs-Zusammenfassung, Testergebnisse, Test-Pflege-Bedarf: App.test.tsx-Mock-Erweiterung + PillarList/LlmSettings-Defensiv-Fixes).
- CSS für `.geo-range-field`/`.geo-range-value` ggf. ergänzen (aktuell ungestylt, funktional).

## Nächster Schritt
- Gate laufen lassen (frontend lint + format + tsc + server test), e2e verifizieren, dann `gh pr ready 1103` + PR-Body erweitern.

## Fallstricke
- Pre-Commit-Hook läuft `tsc --noEmit` über den Frontend-Workspace — rote Typen blockieren den Commit (Memory 2026-08-23).
- Server-Tests: `cd server && npx tsx --test src/express/<file>.test.ts` (cwd bleibt zwischen Calls NICHT erhalten).
- e2e-Filter: `npx playwright test e2e/<datei>.spec.ts` direkt im `frontend/`-Verzeichnis, nie `pnpm --filter frontend test:e2e -- <pattern>` (Memory 2026-08-26).
- TF8: Bounding-Box-Assertions statt scrollWidth (App-Shell clippt overflow-x:hidden, Memory 2026-08-24).
- Ungetrackte Wegwerf-Artefakte in `.ai-memory/` NICHT committen (issue-1098-{body,block,new,splice,ux-block,check,compose}.md) — nur triage/ux/spec/implement sind Phasen-Notizen.
