# Spec: Symmetrisches horizontales Padding im Tab „Allgemein“ der Einstellungen (#969)

Status: Spec-Phase (rote Tests) · Issue: #969 · Verwandt: #843 (Settings Screen Layout), #271 (Einstellungen-Seite)

## Ziel

Auf `/settings/general` schließt der Content links und rechts mit gleichem horizontalem Abstand
zum Viewport ab. Heute beträgt der linke Abstand ≈ 2,5rem (1rem `.settings-page` + 1,5rem
`.settings-general`), der rechte nur 1rem — das Panel wirkt nach links eingerückt.

## Vorbedingung

- App läuft, Route `/settings/general` ist erreichbar, Tab „Allgemein“ ist aktiv.
- Ursache verifiziert im Code: `frontend/src/app.css` — `.settings-page` (ca. Zeile 1330) hat
  symmetrisches Padding `max(1rem, env(safe-area-inset-*))`, `.settings-general` (ca. Zeile 1389)
  setzt zusätzlich `padding-left: 1.5rem` ohne rechtes Gegenstück.
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

## Abgrenzungen / Test-Pflege

- Keine Änderung an `useShadowDOMLayout`, `.settings-page`, `.settings-tabs` oder anderen
  Seiten — nur `.settings-general` bekommt ein symmetrisches horizontales Padding.
- Nach dem Fix ist zu prüfen, dass die Controls in der 800px-max-width ohne horizontalen
  Overflow passen (`overflow-x: hidden` auf `.settings-page` versteckt Überlauf sonst
  unbemerkt).
- UX-Beratung (Issue-Body, `ux-ready`): rein technisches CSS-Problem, symmetrisches Padding
  ist die Lösung; Touch-Targets, Kontraste und A11y sind von Padding unberührt.
