# Issue 1098 — Spec (Phase 3), Stand 2026-08-28T18:40Z

## Erledigt
- Branch `ai/harness/1098` ausgecheckt (Resume-Hint befolgt; ungetrackte Phasen-Notizen aus main mussten weggestapelt werden, Inhalt identisch verifiziert).
- Spec neu: `docs/spec/issue-1098.md` (AK1–AK7, Endpoint `GET/PUT /api/v1/geo-config`, Feldnamen `displayDistanceKm`/`alarmDistanceKm`/`intervalMinutes`, Labels der drei InputRanges festgezurrt).
- TF5: `server/src/express/geo-config.test.ts` NEU (Defaults, PUT, 6 Schranken-Verstöße → 400, Dataisolation, 401).
- TF6: `server/src/express/tasks-nearby.test.ts` erweitert (Radius-Filter) + Bestands-Tests gepflegt (Sort-Test auf 1/3/5-km-Punkte + Config 50 km umgestellt, Cap-Test Config 50 km).
- TF1–TF3: `frontend/src/components/SettingsPage.test.tsx` erweitert (api-Mock auf gecachten Proxy umgestellt — Bestands-Tests bleiben grün).
- TF4: `frontend/src/lib/useGeolocation.test.ts` erweitert (getGeoConfig-Mock via `vi.hoisted`; Fallback-Fall durch #845-Block gedeckt → dedup).
- TF7/TF8: `frontend/e2e/issue-1098-geo-settings.spec.ts` NEU (4 Tests).
- Test-Pflege: `frontend/e2e/issue-1066-nearby-card.spec.ts` AK8-Test (nearby-preference-off) → Card-Count-0; AK2/AK3-Test auf Klammer-Format + 5-km-Punkte umgestellt.
- Verifiziert rot: `npx vitest run src/components/SettingsPage.test.tsx src/lib/useGeolocation.test.ts` → 4 failed (AK1/AK2/AK3: Felder fehlen; AK5: Hook lädt keine Config), 14 passed (keine Bestands-Tests gebrochen). Server- und e2e-Tests NICHT ausgeführt (Deadline) — serverseitig rot, weil `GET/PUT /geo-config` 404 liefert.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:235-292` — Geo-Switch-Block; neuer Geo-Block DARUNTER, `_disabled`-Muster :338, key-Remount :266-272.
- `frontend/src/lib/useGeolocation.ts:5,162` — `GEOLOCATION_INTERVAL_MS` + setInterval → konfigurierbar machen.
- `frontend/src/components/Dashboard.tsx:222` — `<NearbyCard />` bedingungslos → AK4.
- `frontend/src/components/NearbyCard.tsx` — `{formatKm(km)} km` OHNE Klammern → AK6 rot (e2e).
- `server/src/express/routes/tasks.ts:331-344` — nearby ohne Radius-Filter → TF6.
- `server/src/express/routes/llmProviders.ts` + `routes/llmProviders.test.ts` — Muster für Geo-Config-Route (requireAuth, per-User, Validierung).

## Annahmen
- Labels/DTO: „Anzeige-Entfernung (km)", „Alarm-Entfernung (km)", „Aktualisierungsintervall (Minuten)"; Feldnamen wie oben. Implementierung darf sie nur mit Spec-Änderung abweichen lassen.
- Unit-TF2 treibt KoliBri-`onChange` über die Host-Element-Property `_on` an (Adapter `attachProps` setzt `_on` als Property, verifiziert in `frontend/node_modules/@public-ui/react-v19/dist/index.mjs:23-27`).
- E2E-AK3 liest `_disabled` als Host-Attribut (wie `_label`); Klammer-Format `(\d+,\d km)` de-DE.

## Verworfen
- Unit-Assertion auf PUT-Aufruf (`api.updateGeoConfig`) — Methodenname wäre implementierungsabhängig spröde; Server-Persistenz deckt TF5, UI-Persistenz deckt der e2e-Reload-Test (AK7).
- Dashboard-Unit-Test für AK4 — dedup mit TF7-e2e (Card nicht im DOM).

## Offen
- Server-Tests und e2e-Tests wurden vor Commit nicht ausgeführt (Soft-Deadline); Folgelauf/Impl: erst `pnpm --filter server test` und e2e-Datei isoliert laufen lassen.

## Nächster Schritt
- Impl-Phase: Spec `docs/spec/issue-1098.md` + rote Tests umsetzen (Geo-Config-Route + Model, Radius-Filter, Settings-Block, Hook-Intervall, NearbyCard-Klammern, Dashboard/Footer-Bedingung).

## Fallstricke
- Bestands-Tests von #1066 (sort/cap, Server UND e2e) nutzen jetzt Config `displayDistanceKm=50` bzw. 1–5-km-Punkte — wer den Default-Filter ohne Pflege umbaut, bricht sie.
- `nearby-preference-off`-Test existiert nicht mehr (durch Card-Count-0 ersetzt) — nicht wiederherstellen.
- Bestands-#845-Test assertet `setInterval(..., GEOLOCATION_INTERVAL_MS)`: Hook MUSS ohne Config auf 5 min fallen, sonst rot aus falschem Grund.
- KoliBri setzt numerische Props teils als Property, teils als Attribut → Test-Helfer `bound()` liest Property mit Attribut-Fallback.
- E2E: 375px per Bounding-Box prüfen (App-Shell clippt overflow-x:hidden, Memory 2026-08-24).
