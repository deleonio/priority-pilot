# Issue 1622 — Fokus-Outline der Header-Buttons wird am Viewport-Rand abgeschnitten

## Ziel

Der sichtbare Fokus-Ring eines per Tastatur fokussierten äußeren Header-Buttons liegt
vollständig innerhalb des Viewports — oben wie unten, mobil wie Desktop. Die
Randbündigkeit der Leistenfläche selbst (#1587) bleibt unverändert.

## Ausgangslage

- Seit #1587 hängt `.app-header` `fixed` an der Viewport-Kante.
- Mobil (< 48rem) ist `--pp-bar-pad-block: 0px` (`frontend/src/app.css:303`) — die
  Buttons stoßen direkt an die Leistenkante. Der Fokus-Ring (`outline-width` +
  `outline-offset`) liegt außerhalb der Button-Box und fällt hinter die Viewport-Kante.
- Kein Vorfahr clippt (kein `overflow: hidden` an `.app-header`/`.app-header__bar`) —
  der Bildschirmrand selbst schneidet den Ring ab.
- Im Modus Unten gilt dasselbe an der Unterkante (`app.css:509-514` liest denselben
  Token).
- Ab 48rem steht `--pp-bar-pad-block: var(--pp-space-2)` (8px) — dort ist der Ring frei.

## Akzeptanzkriterien → Vertrag

### AK1: Oberkante frei (375px, Kopfzeile Oben)

Bei 375px Breite, Kopfzeile Oben, mit fokussiertem äußerem Header-Button (Hilfe):
`buttonBox.y - (outlineWidth + outlineOffset) >= 0`.

### AK2: Unterkante frei (375px, Kopfzeile Unten)

Bei 375px Breite, Kopfzeile Unten, für denselben Button:
`buttonBox.y + buttonBox.height + outlineWidth + outlineOffset <= viewportHeight`.

### AK3: Inline-Kanten frei

Der Ring bleibt auch inline vollständig im Viewport:
`buttonBox.x - (outlineWidth + outlineOffset) >= 0` und
`buttonBox.x + buttonBox.width + outlineWidth + outlineOffset <= viewportWidth`.

### AK4: Randbündigkeit der Leiste bleibt (Regression, Bestandsvertrag)

`.app-header__bar` beginnt bei x = 0 und endet bei der Viewport-Breite; im Modus Oben
berührt `.app-header` y = 0, im Modus Unten die Unterkante — Vertrag
`frontend/e2e/issue-1587-header-fullwidth.spec.ts` bleibt unverändert grün.

### AK5: Mobile-first-Höhendeckel bleibt (Regression, Bestandsvertrag)

`.app-header` bleibt bei 375px höchstens 64px hoch und einzeilig — Vertrag
`frontend/e2e/mobile-shell.spec.ts:39-55` bleibt unverändert grün.

### AK6: Desktop (≥ 48rem) unverändert korrekt

Bei 1024px Breite sind AK1–AK3 erfüllt, ohne dass sich die dortige Leistenhöhe ändert.

## Tests

- Neu: `frontend/e2e/issue-1622-header-focus-outline.spec.ts` — TF1 (AK1, 375×812
  Oben), TF2 (AK2, 375×812 Unten via `addInitScript` auf `pp-header-position`, Muster
  `issue-1587-header-fullwidth.spec.ts:37-41`), TF3 (AK3, Inline-Kanten), TF6 (AK6,
  Wiederholung TF1/TF3 bei 1024×800). Ringgeometrie-Messung analog
  `issue-1336-tabs-focus-outline.spec.ts:73-111`, Box-Nachmessung analog `stableBox()`
  aus `issue-1587-header-fullwidth.spec.ts:47-62`.
- Bestand: AK4 (`issue-1587-header-fullwidth.spec.ts`) und AK5
  (`mobile-shell.spec.ts:39-55`) bleiben unverändert grün — keine neuen Tests.
