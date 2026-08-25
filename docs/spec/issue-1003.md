# Issue 1003 — Test-Fix #945/A: useGeolocation #933-AK3 auf Observable Outcomes umstellen

Teil von #945 (test-maintenance-Report 2026-08-24, Finding 1). Der bestehende AK3-Test
des Geolocation-Hooks assertet ausschließlich Mock-Calls (`getCurrentPosition` toHaveBeenCalledTimes,
`api.reverseGeocode` toHaveBeenCalledWith). Eine solche Mock-Zählung bleibt grün, selbst wenn der
Hook die ermittelte Position **verwirft** — der Initial-Fetch-Vertrag aus #933 AK3 („Mount mit
gespeichertem `enabled=true` holt sofort eine Position") wäre damit ungetestet.

## Ziel

Der Test „AK3: Mount mit enabled=true ermittelt sofort Position + Reverse Geocoding (Initial-Fetch)"
in `frontend/src/lib/useGeolocation.test.ts` sichert den Initial-Fetch-Vertrag am **sichtbaren
Hook-State** ab — nicht mehr ausschließlich an Mock-Calls.

## Vorbedingung

- `localStorage['pp-geolocation-enabled'] = 'true'` (Simuliert Reload mit aktivierter Einstellung).
- `navigator.geolocation.getCurrentPosition` mocked, resolved sofort mit
  `{ coords: { latitude: 48.137, longitude: 11.575 } }`.
- `api.reverseGeocode` (Datei-Mock) resolved `{ address: 'Musterstraße 1, 10117 Berlin' }`.

## Schritte

1. Hook per `renderGeoHook()` mounten — kein `toggle()`, kein Intervall-Tick, kein Timer-Advance.
2. Warten, bis der durch den Mount allein ausgelöste Initial-Fetch durchgelaufen ist.
3. Hook-State über das zurückgegebene `result`-Objekt prüfen.

## Erwartetes Ergebnis

- **E1 (Observable Outcomes):** `result.current.position` ist `{ latitude: 48.137, longitude: 11.575 }`
  und `result.current.address` ist der Reverse-Geocoding-Wert aus dem api-Mock
  (`'Musterstraße 1, 10117 Berlin'`) — d. h. der Hook übernimmt Position UND Adresse in seinen State.
- **E2 (Mock-Assertions erhalten):** Die bestehenden Mock-Assertions bleiben unverändert:
  `getCurrentPosition` genau 1×, `api.reverseGeocode` aufgerufen mit `{ lat: 48.137, lon: 11.575 }`.
- **E3 (Suite grün):** `pnpm --filter frontend test` ist insgesamt grün — der Hook verhält sich
  korrekt, nur der Test war unzureichend.
- **E4 (Mutations-Probe):** Entfernt man probehalber die Positions-Übernahme im Hook
  (`setPosition`), wird der Test rot. Vorher (nur Mock-Assertions) blieb er grün — der
  Report-Befund aus #945.

## Abgrenzung

- Kein Produktivcode-Änderung: Der Hook selbst bleibt unangetastet (Verhalten ist korrekt).
- Der #845-Block am Dateikopf und der `vi.mock('../api')` werden nicht verändert.
