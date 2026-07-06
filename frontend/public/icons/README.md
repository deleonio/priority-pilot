# App Icons für Priority Pilot

Dieses Verzeichnis enthält die App-Icons für Priority Pilot in verschiedenen Größen und Formaten.

## Icon-Design

Das Icon kombiniert zwei Kernkonzepte von Priority Pilot:
- **Lebensbalance-Säulen**: 5 farbige Segmente (Körper, Beziehungen, Sinn, Mentale Gesundheit, Wirksamkeit)
- **Kompass/Pilot**: Ringförmige Anordnung mit hervorgehobenem "nächsten Schritt" (Wirksamkeit-Segment + Chevron)

### Farben
- Hintergrund: `#1a1a1a` (dunkel, konsistent mit App-Theme)
- Säulen-Segmente:
  - Körper: `#4a90e2` (Blau)
  - Beziehungen: `#50c878` (Grün)
  - Sinn: `#ff6b6b` (Rot)
  - Mentale Gesundheit: `#ffd93d` (Gelb)
  - Wirksamkeit: `#ffffff` (Weiß, hervorgehoben)
- Chevron/Pfeil: `#ffffff` (Weiß)
- Zentrum: `#ffffff` (Weiß)

## Dateien

### SVG-Icons (primär)
- `icon-512x512.svg` - Haupt-Icon (512×512)
- `icon-192x192.svg` - Kleineres Icon (192×192)
- `icon-512x512-maskable.svg` - Maskable-Version (512×512, Safe-Zone)
- `icon-192x192-maskable.svg` - Maskable-Version (192×192, Safe-Zone)

### PNG-Icons (Fallback)
- `icon-512x512.png` - PNG-Fallback (512×512)
- `icon-192x192.png` - PNG-Fallback (192×192)
- `icon-512x512-maskable.png` - Maskable PNG-Fallback (512×512)
- `icon-192x192-maskable.png` - Maskable PNG-Fallback (192×192)

> **Hinweis**: Die PNG-Dateien sind aktuell Platzhalter. Zur Generierung der echten PNGs aus den SVGs:

## PNG-Generierung

### Methode 1: Mit rsvg-convert (empfohlen)
```bash
# Installiere librsvg (Debian/Ubuntu)
sudo apt-get install librsvg2-bin

# Generiere alle PNGs
bash generate-icons.sh
```

### Methode 2: Mit Inkscape
```bash
# Installiere Inkscape
# Dann manuell exportieren oder Skript anpassen
```

### Methode 3: Online-Tools
- [SVG to PNG Online](https://svgtopng.com/)
- [CloudConvert](https://cloudconvert.com/svg-to-png)

## Maskable-Icons

Die Maskable-Icons sind für Android PWA optimiert:
- Wichtiger Inhalt in der zentralen **80% Safe-Zone**
- Vollflächiger Hintergrund (keine Transparenz)
- Funktioniert mit Kreis-/Squircle-Beschnitt

## Verwendung

Die Icons werden in folgenden Dateien referenziert:
- `frontend/vite.config.ts` - PWA-Manifest
- `frontend/index.html` - Favicon

## Wortmarke/Logo

Zusätzlich gibt es ein Logo für Header/Login:
- `../logo.svg` - Wortmarke mit Icon-Element

## Akzeptanzkriterien (Ticket #340)

- [x] Neues Icon-Design mit Bezug zu Kernkonzepten (Säulen-Balance + Pilot)
- [x] Funktioniert als Favicon (16–32 px)
- [x] Maskable-tauglich für PWA
- [x] Konsistent mit Light/Dark-Theme
- [x] SVG-Format (primär)
- [x] PNG-Fallbacks (Platzhalter, zu generieren)
- [x] Barrierefreiheit (`role="img"`, `aria-label="Priority Pilot"`)
- [ ] Build-Verifikation (`pnpm --filter frontend build`)
