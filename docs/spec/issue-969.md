# Spec: Symmetrisches horizontales Padding im Tab „Allgemein“ der Einstellungen (#969)

**Stand:** 2026-08-25
**Version:** v1.1 (2026-08-25): Nightly-Sync — umgesetzt (`.settings-general` mit beidseitigem `padding-inline: 1.5rem` im Code); Spec-Phasen-Status entfernt.
Issue: #969 · Verwandt: #843 (Settings Screen Layout), #271 (Einstellungen-Seite)

## Ziel

Auf `/settings/general` schließt der Content links und rechts mit gleichem horizontalem Abstand
zum Viewport ab: `1rem` `.settings-page`-Padding plus `1.5rem` `.settings-general`-Padding je
Seite.

## Vorbedingung

- App läuft, Route `/settings/general` ist erreichbar, Tab „Allgemein“ ist aktiv.
- Im Code: `frontend/src/app.css` — `.settings-page` hat symmetrisches Padding
  `max(1rem, env(safe-area-inset-*))`, `.settings-general` zusätzlich beidseitiges
  `padding-inline: 1.5rem` (24dp); die linke Control-Position (24dp) bleibt dadurch erhalten.
- `useShadowDOMLayout` (`frontend/src/lib/useShadowDOMLayout.ts`, genutzt in
  `SettingsPage.tsx` und `AppearanceSetting.tsx`) justiert das Alignment der Controls
  untereinander und bleibt unverändert.

## Schritte

1. `/settings/general` laden und stabil abwarten (`waitForStableView`).
2. Computed Style von `.settings-general` prüfen: `padding-left` und `padding-right`.
3. Bounding Box von `.settings-general` gegen die Viewportbreite messen: linker Abstand
   (`box.x`) und rechter Abstand (`viewportWidth − (box.x + box.width)`).
4. Tab „Säulen“ (`slot="tab-1"`) und „LLM“ (`slot="tab-2"`) öffnen: deren Insets müssen
   weiterhin exakt dem computed Padding von `.settings-page` entsprechen.
5. Bestehende Suite `frontend/e2e/issue-843.spec.ts` ausführen.

## Erwartetes Ergebnis

- **AK1:** `.settings-general` hat identisches horizontales Padding — computed
  `padding-left` === `padding-right` (beidseitig inkl. safe-area-inset, im headless Test
  ohne Insets also derselbe Pixelwert).
- **AK2:** Der Content des Tabs „Allgemein“ hat links und rechts denselben Abstand zum
  Viewportrand (boundingBox-messbar, ±1px Toleranz).
- **AK3:** Die #843-Regressionstests bleiben grün: Alignment aller Controls auf gleicher
  linker Position, 16dp-Vertikal-Gaps (`issue-843.spec.ts` — bereits vorhanden, hier nicht
  dupliziert).
- **AK4:** Tabs „Säulen“ und „LLM“ zeigen keine Layout-Änderung: Ihre horizontalen Insets
  entsprechen weiterhin exakt dem `.settings-page`-Padding (Fix wirkt nur auf
  `.settings-general`).

## Abgrenzungen

- `useShadowDOMLayout`, `.settings-page`, `.settings-tabs` und andere Seiten sind unberührt —
  das symmetrische Padding wirkt nur auf `.settings-general`.
- `overflow-x: hidden` auf `.settings-page` versteckt möglichen Überlauf der Controls in der
  800px-max-width unbemerkt.
