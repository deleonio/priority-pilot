# Spec #2011 — Tag/Woche-Umschalter auf dem Dashboard eindeutiger beschriften

**Stand:** 2026-10-04 · Quelle: Issue #2011 (Teil von #2016, P3/S) und KI-UX-Block im Harness-Kommentar.

## Ziel

Über dem Dashboard schaltet ein einziges Bedienelement zwischen Tages- und Wochenansicht um: eine
Radiogruppe mit den kurzen, eindeutigen Bezeichnungen **„Heute"** und **„Woche"** (endgültige
Bezeichnungswahl im KI-UX-Block; Repo-Muster `AppearanceSetting.tsx`/`HeaderPositionSetting.tsx` —
`KolInputRadio`, `_orientation="horizontal"`, zugänglicher Gruppenname „Ansicht"). Die aktive
Ansicht ist am **checked-Zustand** erkennbar — semantisch statt rein über die Variant-Farbe
(WCAG 1.4.1). Der Deep-Link-Vertrag `?planview=week` aus #1617 bleibt unverändert.

## Vorbedingungen

- Nutzer ist in der App und sieht den Dashboard-Tab (Standard-Ansicht).

## Ablauf und erwartetes Ergebnis

### AK1 — Ein Umschalter, aktive Ansicht erkennbar

- Im Umschalter-Bereich (`.dashboard-view-switch`) gibt es genau ein Bedienelement: eine
  Radiogruppe mit genau zwei Optionen „Heute" und „Woche". Die beiden Einzelschaltflächen
  „Tagesansicht"/„Wochenansicht" entfallen.
- Ohne Interaktion ist „Heute" gewählt (Tagesansicht, Standard).
- Wahl von „Woche" zeigt die Wochenansicht (`.week-view-grid`) und setzt „Woche" auf checked;
  die Rückwahl auf „Heute" stellt die Tagesansicht wieder her.

### AK2 — Gespeicherte Links funktionieren weiter (unveränderter #1617-Vertrag)

- Direktes Öffnen von `/?planview=week` zeigt die Wochenansicht mit gewählter Option „Woche".
- Öffnen von `/` ohne Parameter zeigt die Tagesansicht mit gewählter Option „Heute".

### AK3 — Mobil einzeilig ohne Overflow (375 px)

- Bei 375 px Viewport bleibt der Umschalter eine Zeile: beide Optionen stehen auf gleicher Höhe
  (kein Umbruch der Bezeichnungen), und die Umschalter-Gruppe ragt nicht über den Viewport
  (Bounding-Box `x + width ≤ 375`; Bounding-Box statt `scrollWidth`, da die App-Shell
  `overflow-x: hidden` clippt).

## Test-Pflege am Bestand

- `frontend/e2e/issue-1617-week-view.spec.ts` klickt viermal die Schaltfläche „Wochenansicht" —
  die Klicks werden auf die Radio-Option „Woche" umgestellt (Ablauf unverändert).
