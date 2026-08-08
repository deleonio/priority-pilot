# App Icons für Priority Pilot

Dieses Verzeichnis enthält die App-Icons für Priority Pilot in verschiedenen Größen und Formaten.

## Quelle

Die Icons werden aus dem Marken-Logo generiert: `../logo/logo.png` (2048×2048, transparenter
Hintergrund, quadratisches Icon-Element mit Farbverlauf-Motiv aus Abhängigkeits-Knoten + Herz/Pfeil).
Das Wortmarken-Logo (Icon + Schriftzug) liegt daneben als `../logo/logo-with-name.horizontal.png` und
`../logo/logo-with-name.vertical.png`. Seit #485 bindet der App-Header das **Icon** `../logo/logo.png`
als klickbaren Logo-Button („Zum Dashboard") ein (siehe `frontend/src/App.tsx`); die beiden Wortmarken
liegen als Assets bereit, sind aber aktuell **nicht in der App eingebunden** und werden nur noch von
`frontend/src/lib/logo-transparency.test.ts` referenziert. Beide Wortmarken haben einen
per Chroma-Key entfernten Vanille-Hintergrund (#FEFAF6), sodass sie transparent auf beliebigem
Untergrund sitzen.

## Dateien

`logo.png` zeigt das Motiv (Knoten-Kette + Pfeil/Herz) auf einer eigens gerenderten Karte mit
abgerundeten Ecken und Schlagschatten – das ist Teil des Bild-Assets, nicht der eigentliche Icon-Inhalt.
Alle Icons schneiden diese Karte/den Schatten daher per zentriertem 1400×1400-Crop (aus den 2048×2048
der Quelle) weg, bevor skaliert wird, damit nur das Motiv selbst bis an den Rand sichtbar ist.

- `icon-512x512.png`, `icon-192x192.png` – Haupt-Icons (PWA-Manifest, `purpose: any`), aus dem
  kartenfreien Crop skaliert, Motiv füllt den Rahmen. **Transparente Hintergründe** (alpha=0 an den Ecken).
- `icon-512x512-maskable.png`, `icon-192x192-maskable.png` – Maskable-Varianten (`purpose: maskable`):
  Inhalt auf ~70 % der Canvas verkleinert und mit **weißem Hintergrund** aufgefüllt, damit die zentrale
  80 %-Safe-Zone bei Android-Icon-Masken (Kreis/Squircle-Beschnitt) sicher erhalten bleibt.

Zusätzlich referenziert `frontend/index.html`/`frontend/public/apple-touch-icon.png` (180×180, ohne
Transparenz – iOS füllt sonst mit Schwarz) sowie `favicon-32x32.png`/`favicon-16x16.png` im Root von
`public/` (liegen dort, nicht hier, da Browser Favicons standardmäßig auf Root-Ebene suchen). Die Favicons
haben **transparente Hintergründe** und funktionieren damit auf dunklen wie hellen Browsertabs.

## Generierung

Alle PNGs sind **eingecheckt** (kein `.gitignore` mehr für dieses Verzeichnis) – es gibt keinen
Build-Schritt, der sie herstellt. Bei einer Logo-Änderung lokal neu erzeugen:

```bash
bash generate-icons.sh
```

Das Skript nutzt `sips` (macOS-Bordmittel): schneidet zunächst die Karte/den Schatten aus
`../logo/logo.png` (zentrierter 1400×1400-Crop) und skaliert/pad-t davon ausgehend auf alle
Zielgrößen. Das ist macOS-only.

Unter Linux/CI sollte stattdessen `generate-icons-linux.mjs` verwendet werden – ein reines Node.js-Skript
(keine externen Dependencies), das den Chroma-Key für transparent/any/favicon-Icons durchführt und
White-Compositing für maskable/apple-touch-Icons vornimmt. Identische Zielgrößen und Logik wie das
bash-Skript, aber plattformunabhängig.

## Maskable-Icons

Die Maskable-Icons sind für Android PWA optimiert:

- Wichtiger Inhalt in der zentralen **80 % Safe-Zone**
- Vollflächiger, matter Hintergrund (keine Transparenz)
- Funktioniert mit Kreis-/Squircle-Beschnitt

## Verwendung

Die Icons werden in folgenden Dateien referenziert:

- `frontend/vite.config.ts` – PWA-Manifest (`icons`, `shortcuts`)
- `frontend/public/push-sw.js` – Push-Notification `icon`/`badge`
- `frontend/index.html` – Favicon/Apple-Touch-Icon (Dateien liegen im `public/`-Root, siehe oben)

## Historie

Vor diesem Update bestand das Icon-Set aus einem eigens gestalteten SVG-Platzhalter (Kompass/Ring mit
5 Lebensbalance-Segmenten, Ticket #340), solange kein reales Marken-Logo vorlag. Mit den echten
Logo-Assets in `../logo/` wurde das Set durch die oben beschriebenen, aus dem Logo generierten PNGs
ersetzt.
