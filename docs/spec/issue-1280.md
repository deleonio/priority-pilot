# Spec: Issue 1280 — Geocode-Rate-Limiter durch express-rate-limit ersetzen

## Ziel

Der Eigenbau-Rate-Limiter (`rateLimitMap`/`isGeocodeRateLimited` in `server/src/logics/nominatim.ts`)
wächst unbeschränkt (Map ohne Cleanup) und liegt falsch in der Logics-Schicht. Er wird durch EINE
geteilte `express-rate-limit`-Instanz in der Express-Schicht ersetzt (Vorbild: `transit.ts`).
Das nach außen sichtbare Verhalten bleibt unverändert: Drosselung = **200 + leere Antwort**
(leere Liste bei `/geocode-search`, leere Adresse bei `/reverse-geocode`), nie 429.

## Vertrag (unverändert geltendes Verhalten)

- Kontingent: 1 Request je (IP + `x-session-token`) pro 1-s-Fenster, **geteilt** über beide
  Endpunkte (Nominatim-Policy).
- Drosselung: `/geocode-search` → `200 []`; `/reverse-geocode` → `200 {address: ''}`.
- Fensterablauf: nach >1 s ohne Request liefert ein erneuter Request wieder echte Daten.
- Bereits abgesicherte Fälle: Suche→Suche gedrosselt (`geocode-search.test.ts:214`),
  Suche→Reverse geteilt (`:239`).

## Akzeptanzkriterien → Tests

| AK              | Test (server/src/express/geocode-search.test.ts)                                                  | Erwartung                       |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------- |
| AK1 (Struktur)  | NEU: `isGeocodeRateLimited` ist kein Export von `logics/nominatim.ts` mehr                        | rot heute, grün nach Entfernung |
| AK2 (Fenster)   | NEU: gleiche Session, zwei Suchen >1 s auseinander → zweite liefert wieder Treffer                | Vertragssicherung               |
| AK2 (Reverse)   | NEU: zweite `/reverse-geocode` derselben Session binnen 1 s → `200 {address: ''}`                 | Vertragssicherung               |
| AK3 (geteilt)   | bestehend `:239` — bleibt unverändert grün                                                        | —                               |
| AK4 (lint/grep) | `pnpm --filter server lint` + `test` grün; `grep -rn isGeocodeRateLimited server/src` → 0 Treffer | Implementierungsphase           |

## Struktur (Implementierungsphase)

- `nominatim.ts`: nur `NOMINATIM_USER_AGENT` bleibt; kein Map-/Cache-Zustand, kein express-rate-limit-Import.
- Neue geteilte Instanz (z. B. `server/src/express/routes/geocodeRateLimit.ts`): `windowMs: 1000`,
  `max: 1`, `keyGenerator: ip + x-session-token`, `standardHeaders: true`, `legacyHeaders: false`,
  Handler antwortet je Mount mit leerer Liste bzw. leerer Adresse.
- `server/src/express/index.ts`: dieselbe Instanz vor `geocodeSearchRouter` und
  `reverseGeocodeRouter` montieren (`trust proxy` steht bereits).

## Offene Fragen

- keine.
