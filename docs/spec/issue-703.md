# Issue 703 – Tabs bei schmalen Viewports

**Stand:** 2026-08-17
**Ziel:** Tabs bleiben auch bei schmalen Viewports bedienbar, ohne Umbruch oder Überlappung.

---

## Problem

Tabs werden bei schmalen Viewports mehrzeilig, UX leidet.

## Akzeptanzkriterien

- Tabs bleiben auch bei schmalem Viewport sauber nebeneinander
- Bei Platzmangel alternatives Menü (z.B. Dropdown/Stack)
- Konsistentes UX-Verhalten

## Testfälle

- Viewport < 768px: Tabs kompakt/alternativ
- Viewport ≥ 768px: Tabs nebeneinander
- Kein Umbruch/Überlappung

## Spezifikation

### Ziel

Tabs sind bei allen Viewport-Größen bedienbar, ohne Layout-Zerbruch oder Überlappung.

### Vorbedingung

- Eine Seite mit Tabs ist geöffnet (z.B. Settings, Serien)
- Tabs sind sichtbar und interaktiv

### Schritte

1. **Viewport < 768px prüfen**
   - Browser-Fenster auf < 768px Breite verkleinern (Mobile-Viewport)
   - Tabs sind weiterhin sichtbar und bedienbar
   - Tabs zeigen alternatives Layout (z.B. Dropdown, Stack, oder kompakte Darstellung)

2. **Viewport ≥ 768px prüfen**
   - Browser-Fenster auf ≥ 768px Breite (Desktop-Viewport)
   - Tabs sind nebeneinander angeordnet
   - Tabs sind ohne Umbruch oder Überlappung

3. **Viewport-Übergang prüfen**
   - Browser-Fenster schrittweise von < 768px auf ≥ 768px vergrößern
   - Tabs wechseln nahtlos zwischen alternativen und nebeneinander-Darstellung
   - Kein Layout-Zerbruch während des Übergangs

### Erwartetes Ergebnis

- Tabs sind bei < 768px in alternativer Darstellung (Dropdown/Stack/kompakt)
- Tabs sind bei ≥ 768px nebeneinander
- Kein Umbruch, Überlappung oder Layout-Zerbruch bei beliebiger Viewport-Größe
- Konsistentes, bedienbares Verhalten über alle Viewport-Größen

---

## Randfälle & Fehler

| Situation                                | Erwartetes Verhalten                              |
| ---------------------------------------- | ------------------------------------------------- |
| Extrem schmaler Viewport (< 320px)       | Tabs sind noch bedienbar (alternatives Menü)      |
| Viewport-Wechsel während Tab-Interaktion | Kein Layout-Zerbruch, Tabs bleiben bedienbar      |
| Sehr viele Tabs (> 5)                    | Alternatives Menü aktiv, kein horizontaler Scroll |

---

## Hinweise zur Implementierung

- **Format:** Spezifikation ist implementierungsagnostisch – beschreibt beobachtbares Verhalten, nicht den technischen Pfad.
- **Test-Strategie:** Aus dieser Spezifikation werden E2E-Tests für viewport-spezifisches Tab-Verhalten abgeleitet.
- **Referenz:** Orientierung an bestehenden Tab-Implementierungen (Settings, Serien) für Konsistenz.

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #703. Tabs responsive Verhalten spezifiziert.
- **v1.1** (2026-08-17): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: app.css Zeile 143+ hat CSS-Regeln für Tabs bei < 768px (vertikale Anordnung).

---

## Status

**ABGESCHLOSSEN** — Tabs responsive Verhalten ist implementiert und in Produktion.
