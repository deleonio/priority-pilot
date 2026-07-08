#!/bin/bash
# Generiert die App-Icons (PWA-Manifest, Favicon, Apple-Touch-Icon) aus dem Marken-Logo
# `../logo/logo.png`. Nutzt `sips` (macOS-Bordmittel). Unter Linux/CI ersatzweise ImageMagick
# (`convert`/`magick`) mit denselben Zielgrößen/Optionen verwenden.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v sips &>/dev/null; then
	echo "sips nicht gefunden (nur auf macOS verfügbar). Für Linux/CI ImageMagick verwenden." >&2
	exit 1
fi

SRC="../logo/logo.png"
CROPPED="/tmp/pp-icon-cropped.png"
# Mattenfarbe, mit der sips transparente Bereiche beim Skalieren/Padding auffüllt (aus dem
# Logo-Hintergrund abgetastet), damit "any"- und "maskable"-Varianten optisch konsistent sind.
MATTE="FEFAF6"

if [ ! -f "$SRC" ]; then
	echo "Quelle ${SRC} nicht gefunden." >&2
	exit 1
fi

echo "Schneide die Karten-Umrandung/den Schatten aus dem Logo (zentrierter 1400x1400-Crop)..."
# logo.png ist 2048x2048 und zeigt das Icon-Motiv auf einer eigens gerenderten Karte mit
# abgerundeten Ecken + Schlagschatten. Diese Karte ist selbst Teil des Bild-Assets (kein
# UI-Element) und soll NICHT in den App-Icons erscheinen — nur das Motiv (Knoten + Pfeil/Herz)
# zählt als Icon. Ein zentrierter 1400x1400-Crop entfernt Karte/Schatten vollständig und lässt
# nur einen schmalen, gleichmäßigen Rand um das volle Motiv (empirisch verifiziert: 1500px zeigt
# noch einen Hauch der Rundung, 1400px ist sauber).
sips -c 1400 1400 "$SRC" --out "$CROPPED"

echo "Generiere any-purpose Icons..."
sips -z 512 512 "$CROPPED" --out icon-512x512.png
sips -z 192 192 "$CROPPED" --out icon-192x192.png

echo "Generiere maskable Icons (Inhalt auf ~70% verkleinert + auf Safe-Zone gepaddet)..."
sips -z 340 340 "$CROPPED" --out /tmp/pp-icon-inner-512.png
sips -p 512 512 --padColor "$MATTE" /tmp/pp-icon-inner-512.png --out icon-512x512-maskable.png

sips -z 128 128 "$CROPPED" --out /tmp/pp-icon-inner-192.png
sips -p 192 192 --padColor "$MATTE" /tmp/pp-icon-inner-192.png --out icon-192x192-maskable.png
rm -f /tmp/pp-icon-inner-512.png /tmp/pp-icon-inner-192.png

echo "Generiere Apple-Touch-Icon..."
sips -z 180 180 "$CROPPED" --out ../apple-touch-icon.png

echo "Generiere Favicons..."
sips -z 32 32 "$CROPPED" --out ../favicon-32x32.png
sips -z 16 16 "$CROPPED" --out ../favicon-16x16.png

rm -f "$CROPPED"
echo "Icons generiert."
