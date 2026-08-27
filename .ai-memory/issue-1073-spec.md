# Issue 1073 — Spec-Phase

## Erledigt
- Branch `feat/issue-1073-footer-address` erstellt, rote Tests + `docs/spec/issue-1073.md` committet, Draft-PR erstellt.
- Unit-Tests: `frontend/src/components/Footer.test.tsx` erweitert — `vi.mock('../lib/useGeolocation')` mit kontrollierbarem Mock-Return (Default: `enabled:false, position:null, address:null`); neue Tests AK1 (Adresse statt Koordinaten), AK2a (Fallback Koordinaten bei address=null), AK2b (address leerer String → Fallback), AK3 (Separator " | " bei Adresse und bei Fallback).
- e2e: `frontend/e2e/issue-1073-footer-address.spec.ts` — AK1/AK3 via `test.use({geolocation, permissions:['geolocation']})` + Route-Mock `**/reverse-geocode` (Antwort `{address: "..."}`), AK6 Bounding-Box-Prüfung bei 375px mit langer Adresse (Memory 2026-08-24: scrollWidth ist wegen app.css `overflow-x:hidden` zahnlos).
- Dedup: AK4/AK5 sind durch bestehende Tests in `Footer.test.tsx` (#290: Version + contentinfo) bereits abgedeckt → keine Duplikate, im PR-Body vermerkt.

## Relevante Stellen
- `frontend/src/components/Footer.tsx:4` — konsumiert bisher nur `{enabled, position}`; Impl muss `address` dazu nehmen.
- `frontend/src/lib/useGeolocation.ts:241-251` — Hook-Return inkl. `address`, `addressLoading`; Mock muss die volle Shape liefern (cast).
- `frontend/src/api.ts:509` — `reverseGeocode` ruft Backend `/reverse-geocode` → e2e-Mock-Pfad `**/reverse-geocode*`.
- `frontend/src/lib/useGeolocation.ts:17` — localStorage-Schlüssel `pp-geolocation-enabled`; e2e setzt Preference via `addInitScript`.
- `frontend/e2e/footer-version.spec.ts` — Namens-/Stil-Vorbild der neuen Spec.

## Annahmen
- Separator exakt `" | "` (Pipe mit Leerzeichen).
- Fallback-Format bleibt `toFixed(4)` + `° N/° E` (wie bisherige Anzeige).

## Verworfen
- scrollWidth-Overflow-Assertion für AK6 — Mutation-geprüft zahnlos (App-Shell clippt, Memory 2026-08-24).
- KolAlert/Skeleton-Tests — laut KI-UX-Block stiller Fallback, kein Ladezustand.

## Offen
- -

## Nächster Schritt
- Impl-Phase: `address` in Footer.tsx konsumieren, Separator `" | "`, `min-width:0` + `overflow-wrap`, 📍-Emoji `aria-hidden` oder streichen (KI-UX-Block).

## Fallstricke
- `vi.mock` auf Hook-Ebene: Mock-Return muss die ganze `UseGeolocationResult`-Shape liefern — per Helper + `as unknown as ReturnType` casten (Memory 2026-08-23: pre-commit `tsc --noEmit` über ganzen Workspace).
- Rote Unit-Tests müssen an der Assertion scheitern, nicht an Import/Typfehler — Footer existiert bereits, also echte Rot-Assertions nutzen.
