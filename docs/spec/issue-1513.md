# Spec — Issue #1513: Archivo als primäre Schriftart einbinden (inkl. KoliBri-Theme-Patch)

Quelle: KI-ANALYSE-Block im Harness-Marker-Kommentar von Issue #1513 (stand=2026-09-16T00:15:31Z).

## Ziel

Archivo (Schnitte 400 + 600) ist die primäre Schriftart der App und der eingebetteten
KoliBri-Komponenten (Shadow DOM), selbst gehostet (kein Google-Fonts-CDN), im Service-Worker-
Precache enthalten, und lässt die bestehende Typo-Skala unangetastet.

## Vorbedingungen

- `frontend/src/app.css` definiert die Typo-Token in `:root` (`--pp-font-size-*`,
  `--pp-weight-regular: 400`, `--pp-weight-bold: 600`) und die `body`-Regel mit dem bisherigen
  System-UI-Font-Stack.
- `frontend/vite.config.ts` konfiguriert `VitePWA({ workbox: { ... } })` ohne explizite
  `globPatterns` (Standardabdeckung deckt keine `woff2`-Dateien ab).
- `frontend/src/main.tsx` importiert bereits Font-/Icon-CSS als direkte Asset-Importe (Muster für
  das Einbinden der Archivo-Quelle).

## Schritte / erwartetes Verhalten (AK1–AK8)

1. **AK1 — App-Text in Archivo**: `getComputedStyle(document.body).fontFamily` beginnt mit
   `Archivo`, der bisherige System-Stack bleibt dahinter als Fallback erhalten.
2. **AK2 — KoliBri-Shadow-Roots in Archivo**: Text in den Shadow-Roots von `kol-button`,
   `kol-input-text`, `kol-heading`, `kol-alert`, `kol-table` rendert mit `Archivo` als erstem
   Eintrag der berechneten `font-family` (Vererbung über Custom Property/Host-Regel oder explizite
   `kol-*`-Host-Regel).
3. **AK3 — kein externes CDN**: Kein Treffer auf `fonts.googleapis.com`/`fonts.gstatic.com` im
   Frontend-Quellstand (`app.css`, `main.tsx`); die Archivo-Quelle liegt im eigenen Origin (npm-
   Paket-Import oder lokale `@font-face`-Datei).
4. **AK4 — Offline/PWA-Precache**: `frontend/vite.config.ts` setzt `workbox.globPatterns`
   explizit und schließt `woff2` ein.
5. **AK5 — Typo-Skala unverändert**: `body` bleibt bei `font-size: 16px`
   (`--pp-font-size-base: 1rem`), `--pp-weight-regular: 400` und `--pp-weight-bold: 600` in
   `app.css` bleiben unverändert.
6. **AK6 — Dark Mode**: AK1/AK2 gelten unverändert bei `data-theme="dark"`;
   `frontend/e2e/dark-mode-contrast.spec.ts` bleibt grün.
7. **AK7 — Mobile 375px**: Bei 375px Viewport rendert das Dashboard in Archivo, kein sichtbares
   Element überragt den Viewport (`el.x + el.width <= 375`).
8. **AK8 — keine Regression**: Bestehende Frontend-Unit- und E2E-Suiten laufen unverändert grün
   weiter.

## Nicht-Ziele

- Keine UX-Beratung nötig (Schriftart/Gewichte sind vom Autor festgelegt, Typo-Skala unverändert).
- Kein Eingriff in die Dark-Mode-Bootstrap-Logik (`index.html`, `applyTheme()`).
