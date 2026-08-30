# Ausrichtung Update-/Offline-Notification auf Desktop

**Stand:** 2026-08-30

Die PWA-Update-/Offline-Notification (`.update-prompt`) wird auf Desktop-Viewports (≥ 768px) unten rechts, in der Breite begrenzt dargestellt. Auf Mobil (< 768px) bleibt das Mobile-First-Verhalten (volle Breite) unverändert.

## Verhalten

| AK  | Viewport | Erwartung                                                                                     |
| --- | -------- | --------------------------------------------------------------------------------------------- |
| AK1 | ≥ 768px  | rechtsbündig (rechte Kante am Viewport-Rand, Element in der rechten Hälfte), Elementbreite < Viewportbreite |
| AK2 | ≥ 768px  | `max-width` gesetzt und ≤ 480px                                                                |
| AK3 | 375px    | volle Breite: computed `left: 0px` und `right: 0px`                                            |
| AK4 | 375px    | Aktionsbutton vollbreit, ≥ 44px hoch                                                           |

Hinweis AK1: Computed `left` liefert die CSSOM bei positionierten Elementen als verwendeten px-Wert zurück — `left: auto` ist per `getComputedStyle()` nicht beobachtbar. Die Rechtsbündigung wird deshalb geometrisch geprüft (rechte Kante ≈ Viewport-Rand, Element in der rechten Hälfte).

## Erwartetes Ergebnis

- Desktop: Notification sitzt rechts unten, Containerbreite ≤ 480px, Cards auf Inhaltsbreite.
- Mobil: unverändert vollbreit, Tap-Targets ≥ 44px.
