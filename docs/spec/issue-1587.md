# Issue 1587 — Kopfleiste über die volle Breite mit durchgehender Kante

## Ziel

Die sichtbare Kopfleiste (`.app-header__bar`) hört auf, eine eingerückte Pille zu sein:
Sie läuft ohne seitliche Einrückung über die volle Shell-Breite, trägt keinen Radius
mehr und wird zur Inhaltsseite durch eine durchgehende 1px-Kante abgegrenzt — analog zur
Kante des Seitenfußes (`.app-footer`, `border-top: 1px solid var(--pp-border)`).

## Ausgangslage

- Die seitliche Einrückung kommt vom Shell-Container `.app` (`app.css:376-391`:
  `max-width: 80rem` + `padding-inline` je Breakpoint), nicht vom Header selbst.
- Die Leiste trägt heute `border-radius: var(--pp-radius-md)` und einen inset-Box-Shadow
  rundum (`app.css:529-531`).
- Das Höhenbudget @375px ist ausgereizt (8+44+8=60px von 64px, Kommentar `app.css:485-486`)
  — die Kante darf die Zeile nicht zweizeilig brechen (deshalb heute schon inset-Schatten
  statt `border`).
- Position Oben/Unten wird über `useHeaderPosition` gesteuert (localStorage
  `pp-header-position`); der Sticky-Rahmen `.app-header` mit Abstandsschild bleibt
  unverändert.

## Akzeptanzkriterien → Vertrag

### AK1: Keine seitliche Einrückung

Die Bounding-Box der Leiste ist horizontal identisch mit der Bounding-Box von `.app`
(x UND width gleich) — bei 375px und bei ≥48rem Desktop-Breite (1024px geprüft).

### AK2: Durchgehende Kante zur Inhaltsseite, kein Radius

- `getComputedStyle(.app-header__bar).borderRadius` ist `0px`.
- Auf der Inhaltsseite existiert eine messbare 1px-Kante: Position Oben → Unterkante der
  Leiste, Position Unten → Oberkante. Als Kante zählt ein `border` (≥1px
  Seitenbreite) oder ein inset-Box-Shadow — die Umsetzung bleibt offen, solange die
  Kante ohne Layout-Wirkung (Höhenbudget!) durchgehender ist als die heutige Pille.

### AK3: Kante bleibt beim Scrollen sichtbar

Sticky-Verhalten unverändert: die bestehenden Blöcke `frontend/e2e/mobile-shell.spec.ts:216-269`
(aus #1575) bleiben grün — sie messen bereits, dass der Header in beiden Positionen
pinnt und der Schild den Inhalt übermalt. Keine neuen Tests; Bestandsvertrag.

### AK4: 375px-Einzeiler ohne Overflow bleibt erhalten

`mobile-shell.spec.ts:55` (Höhe ≤64px) und `:58-65` (kein horizontaler Overflow)
bleiben grün. Keine neuen Tests; Bestandsvertrag.

## Tests

- Neu: `frontend/e2e/issue-1587-header-fullwidth.spec.ts` — TF1 (AK1, Geometrie bei
  375px und 1024px) und TF2 (AK2, computed styles je Position; Unten-Modus via
  `addInitScript` auf `pp-header-position='bottom'`, Muster `mobile-shell.spec.ts:245`).
- Bestand: AK3/AK4 siehe oben.
