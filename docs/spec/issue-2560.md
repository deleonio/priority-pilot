# Spec #2560 — Badge-Farben und Shadow-DOM-Observer konsolidieren

## Ziel

Gleiche Optik, einheitliches Muster: Badge-Farben aus benannter Konstante statt Hex-Literal am JSX, Shadow-DOM-Beobachtung entprellt wie `useShadowDOMLayout`.

## AK1 — Keine Hex-Literale an `_color`

- Vorbedingung: `TaskTree.tsx`, `SeriesTab.tsx`.
- Erwartung: kein `_color="#…"` mehr; Werte (`#c66a00`, `#2e7d32`, `#005b99`) kommen aus einer benannten Konstante mit Token-Kommentar und bleiben unverändert (bestehende Render-Tests sichern die Optik).

## AK2 — Entprellter Observer in `BalanceVariantSetting`

- Vorbedingung: Radiogruppe mit Shadow-Root, Optionen-Wrapper `.kol-form-field__input`.
- Schritte: Shadow-DOM mutiert.
- Erwartung: Raster (`display: grid`) wird erst nach 100 ms Ruhe gesetzt (ein Apply), nicht je Mutation.

## AK3

Bestehende Vitest-/E2E-Tests bleiben grün (kein eigener Test).

## Nachtrag #2618 — Meilenstein-Badges

- `MilestoneBadges.tsx` setzt `_color` über `BADGE_COLOR.progress` (erreicht) und eine neue benannte `BADGE_COLOR`-Konstante (`#9e9e9e`, nicht erreicht); sichtbare Farben unverändert.
- Der Guard `badge-colors.guard.test.ts` prüft zusätzlich `MilestoneBadges.tsx` und erkennt Hex-Literale auch innerhalb eines `_color={…}`-Ausdrucks (Ternary).
