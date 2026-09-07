# Spec #1273 — Säulen-Rampe auf 7 paarweise unterscheidbare Neon-Farben verkleinern

## Ziel

Die kategoriale Säulen-Farbrampe (`--pp-pillar-*`) wird von 8 auf genau **7** Ränge je Theme
(Light und Dark) verkleinert. Die 7 verbleibenden Farben sind „grelle Neon-Farben" und je zwei
der 7 sind nebeneinander auf einen Blick unterscheidbar — auch unter Farbsehschwächen
(Protanopie, Deuteranopie, Tritanopie). Der 8. Rang entfällt komplett: kein Token, kein
Konsumenten-Selektor und keine Konstante im Code referenziert ihn noch.

Quellen: Issue #1273 (Nutzerauftrag „grelle Neon-Wirkung"), KI-UX-Block (advisory: ΔE ≥ 7 ist
Floor, Ziel bleibt Richtung 9.1/8.4 wie die alte Referenzpalette), `.ai-knowledge/ux-design.md`
§2 Regeln 3+4.

## Vorbedingung

- `frontend/src/app.css` definiert derzeit je Theme 8 Tokens (`--pp-pillar-1…8`, Light Z. 62–69,
  Dark Z. 173–180) plus Konsumenten `.heart-water--8` (Z. 2558) und `.heart-legend-dot--8`
  (Z. 2678).
- `PILLAR_RAMP_SIZE = 8` in `frontend/src/components/HeartBalance.tsx` (Z. 127) und
  `frontend/src/components/HeartGlass.tsx` (Z. 72; `BAND_SLOTS = 8` bleibt unverändert — nur die
  Rampe schrumpft).
- Ist-Palette (Dark): `#ff2d95 #00e5ff #39ff14 #fff01f #b026ff #ff6a00 #00ffc8 #ff3131`;
  das Dark-Paar `#00e5ff`/`#00ffc8` liegt unter der geforderten Paarweise-Distanz (rot-erwartend).

## Schritte / Verhalten

1. **Rampenlänge (AK1):** Je Theme definiert `app.css` genau `--pp-pillar-1` … `--pp-pillar-7`
   als Hexwerte. Die Zeichenkette `pp-pillar-8` kommt in `app.css` nirgends mehr vor (Token,
   `.heart-water--8`, `.heart-legend-dot--8`). `PILLAR_RAMP_SIZE` ist in `HeartBalance.tsx` und
   `HeartGlass.tsx` jeweils 7. Doku-Kommentare, die „ab der 9. Säule" bzw. `--pp-pillar-1…8`
   nennen (`app.css` ~Z. 2522/62, `HeartBalance.tsx` ~Z. 126/132, `heartBalance.ts`
   Interface-Doc, `.ai-knowledge/ux-design.md` Regel 3 + Token-Tabelle), werden auf
   „ab Rang 8" / `1…7` umformuliert.
2. **Paarweise Unterscheidbarkeit (AK2):** Für jedes der 21 Paare der 7 Farben gilt je Theme:
   ΔE (CIEDE2000) ≥ 7 — unter Normalsicht **und** unter CVD-Simulation (Protanopie,
   Deuteranopie, Tritanopie; Viénot-et-al.-Simulation). Der Nachweis ist ein eigenständiger
   Vitest (`frontend/src/lib/pillarPalette.test.ts`), dauerhaft im Repo verankert — das
   frühere externe `scripts/validate_palette.js` des dataviz-Skills existiert nicht im Repo.
   Der schlechteste Paarwert je Theme wird in `ux-design.md` Regel 4 dokumentiert (Nachfolger
   der alten Werte 9.1 hell / 8.4 dunkel) — passiert in der Impl-Phase, wenn die konkreten
   Werte feststehen.
3. **Neon-Charakter (AK3):** Dark-Farben mit HSL-Sättigung ≥ 0.7 und Lightness ≥ 0.5 (volle
   Leuchtkraft). Light-Farben behalten den Hue des Dark-Gegenstücks derselben Rangstelle
   (± 15°, zirkular) und werden nur so weit gebrochen, wie Nachbar-Unterscheidbarkeit und
   Fläche (`#ffffff`) es verlangen. Die Relief-Regel (Säulenname immer als Text daneben,
   BITV 1.4.1) bleibt unangetastet — Säulenfarben sind Kategoriefarbe, kein Text, und müssen
   keine 4.5:1 gegen die Fläche erreichen.
4. **Rampen-Overflow (AK4):** Säulen ab Rang 8 laufen neutral zusammen (`--pp-border-strong`,
   Basisklasse statt Rampenklasse). Herz, Legende und Konfetti greifen nur auf Rang 1–7 zu.
   Rangvergabe bleibt an der Säulen-ID gebunden (`heartBalance.ts`, Umsortieren färbt nicht um).
   Alle bestehenden Herz-/Konfetti-Tests und `heart-balance.spec.ts` bleiben grün.

## Erwartetes Ergebnis

- `pnpm --filter frontend test -- pillarPalette` ist grün, sobald die neuen Token-Werte und
  `PILLAR_RAMP_SIZE = 7` umgesetzt sind; vorher rot (AK1 an der Token-/Konstanten-Assertion,
  AK2 am Dark-Paar `#00e5ff`/`#00ffc8`, das die ΔE-Schwelle reißt).
- Nutzer mit 8+ Säulen: die 8. Säule verliert ihre Farbe und läuft neutral zusammen —
  sichtbare Verhaltensänderung, angelsbündig mit ux-design.md Regel 3, kein Migrations-Dialog.
- Konfetti (`confetti.ts` nutzt nur Rang 1/3/4) bleibt ohne Eingriff gültig.

## Abgrenzung (Impl-Phase)

- Welche der 8 Ist-Farben entfällt und welche 7 Werte gewählt werden, ist Design-Arbeit der
  Umsetzung — getrieben vom Paarweise-ΔE-Test (TF2), nicht Teil dieser Spec.
- `ux-design.md` (Regel 3/4, Token-Tabelle) und die Code-Kommentar-Umformulierungen gehören in
  den Impl-PR (Spec-PR enthält nur `docs/spec/*.md` + rote Tests).
