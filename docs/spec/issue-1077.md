# Spec: Ausrichtung Notifikation im Desktop (#1077)

## Ziel

Die PWA-Update-/Offline-Notification (`.update-prompt`) wird auf Desktop-Viewports
(≥ 768px) unten rechts, in der Breite begrenzt dargestellt. Auf Mobil (< 768px) bleibt
das Mobile-First-Verhalten (volle Breite, #353/#1034) unverändert.

## Vorbedingungen

- `.update-prompt` ist `position: fixed; bottom: 0; right: 0` (Basisregel, `frontend/src/app.css`)
- Der bestehende `@media (min-width: 768px)`-Block für `.update-prompt` existiert und wird erweitert.
- Reine CSS-Änderung; `UpdatePrompt.tsx` bleibt unangetastet.

## Verhalten (AK1–AK4)

| AK  | Viewport | Erwartung                                                                                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| AK1 | ≥ 768px  | rechtsbündig (rechte Kante am Viewport-Rand, Element in der rechten Hälfte), Elementbreite < Viewportbreite        |
| AK2 | ≥ 768px  | `max-width` gesetzt und ≤ 480px (Empfehlungswert 480px, Feinjustierung erlaubt)                                    |
| AK3 | 375px    | volle Breite: computed `left: 0px` und `right: 0px` (unverändert)                                                  |
| AK4 | 375px    | Aktionsbutton vollbreit, ≥ 44px hoch — durch bestehende #1034-Tests abgedeckt (Regressionsschutz, kein neuer Test) |

Hinweis AK1: Computed `left` liefert die CSSOM bei positionierten Elementen als verwendeten
px-Wert zurück — `left: auto` ist per `getComputedStyle()` nicht beobachtbar. Die Rechtsbündigung
wird deshalb geometrisch geprüft (rechte Kante ≈ Viewport-Rand, Element in der rechten Hälfte).

## Schritte

1. Stellvertreter-Element mit Klasse `.update-prompt` in das geladene Dokument injizieren
   (CSS-Kontrakt-Muster aus `frontend/e2e/pwa-update-prompt.spec.ts`, #373).
2. Computed Styles (`left`, `right`, `max-width`) und `getBoundingClientRect()` auslesen.

## Erwartetes Ergebnis

- Desktop: Notification sitzt rechts unten, Containerbreite ≤ 480px, Cards auf Inhaltsbreite.
- Mobil: unverändert vollbreit, Tap-Targets ≥ 44px (#1034-Tests bleiben grün).

## Testmapping

- AK1, AK2, AK3 → `frontend/e2e/pwa-update-prompt.spec.ts` (CSS-Kontrakt, Stellvertreter-Element).
- AK4 → bestehende #1034-Testfälle in derselben Datei (Dedup: kein neuer Test).
