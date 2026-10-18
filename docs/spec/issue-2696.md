# Spec #2696 — WebGL-Gerüst und Farb-Packing in ein geteiltes Modul

## Ziel

Das WebGL-Gerüst (Programmaufbau mit Compile/Link-Prüfung, Fullscreen-Dreieck-Puffer,
Uniform-Helfer, Resize mit Backing-Größen-Guard und DPR-Klemme 2) und die Farb-Packing-Routinen
(`toSlots`, `toSlotBands`) stehen in genau einem Modul (`frontend/src/lib/webglStage.ts`,
Arbeitstitel laut Analyse). `BalanceFigureGL.tsx` und `HeartGlass.tsx` pflegen keine eigene Kopie
mehr. Reines Refactoring: das gerenderte Bild beider Figuren bleibt unverändert.

## Vorbedingungen

- Beide Komponenten enthalten aktuell doppelt: `parseColor`, Shader-Programm-Aufbau
  (`gl.createShader`/`gl.createProgram`), Fullscreen-Dreieck `[-1, -1, 3, -1, -1, 3]`,
  Resize mit `Math.min(window.devicePixelRatio || 1, 2)`, WebGL2-Kontext.
- Kontextoptionen unterscheiden sich bewusst: `premultipliedAlpha: true` (BalanceFigureGL) vs.
  `false` (HeartGlass) — die Fabrik wird parametrisiert, nicht vereinheitlicht.
- HeartGlass präfixiert den Fragment-Shader mit `#define GLASS_APP 1` — Shader-Quellen bleiben
  Figuren-Eigentum.

## Schritte

1. Neues Modul `frontend/src/lib/webglStage.ts` mit dem Gerüst und den Packing-Routinen;
   `PILLAR_RAMP_SIZE` wird importiert, nicht neu deklariert (Spiegel-Test
   `pillarPalette.test.ts` liest beide Komponenten-Quelltexte).
2. Beide Komponenten importieren Gerüst und Packing aus dem Modul; Shader, Zeichenroutinen und
   Rise-Logik bleiben je Figur.

## Erwartetes Ergebnis

- AK1: Gerüst-Symbole (Programmaufbau, Fullscreen-Dreieck, Uniform-Helfer, Resize mit
  Backing-Größe, DPR-Klemme 2) und die Packing-Routinen existieren genau einmal im geteilten
  Modul; keine eigene Kopie mehr in den Komponenten. Geprüft durch einen Quelltext-Spiegel-Test
  im Muster von `pillarPalette.test.ts`: er liest beide Komponenten und das neue Modul und
  verneint Gerüst-Symbole (`const parseColor`, `export const toSlots`/`toSlotBands`,
  Fullscreen-Dreieck-Literal, `gl.createShader`, DPR-Klemme, `getContext('webgl2')`) in den
  Komponenten und bejaht sie im Modul.
- AK2: Beide Figuren rendern unverändert. Die bestehenden Unit-Tests
  (`BalanceFigureGL.test.tsx`, `HeartGlass.test.tsx`) und die Zifferblatt-/Startseiten-E2E-Specs
  (`heart-balance.spec.ts`, `balance-variant.spec.ts`, `issue-2009-balance-variant.spec.ts`)
  bleiben ohne inhaltliche Änderung der Erwartungen grün; nur Import-Pfade der Packing-Routinen
  dürfen sich ändern.
- Kein neuer E2E-Test: reines Refactoring ohne Verhaltensänderung.

## Testumfang

| TF  | AK  | Ebene                    | Ort                                         |
| --- | --- | ------------------------ | ------------------------------------------- |
| TF1 | AK1 | Unit (Quelltext-Spiegel) | `frontend/src/lib/webglStage.test.ts`       |
| TF2 | AK2 | Unit (Bestand)           | bestehende Packing-Suiten, unverändert grün |
| TF3 | AK2 | E2E (Bestand)            | bestehende Specs, unverändert grün          |
