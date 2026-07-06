#!/bin/bash
# Skript zum Generieren von PNG-Icons aus SVG-Vorlagen
# Benötigt: rsvg-convert (aus librsvg) oder inkscape

# Farben
BG_COLOR="#1a1a1a"
FG_COLOR="#ffffff"

# Funktion zum Erstellen eines PNG-Icons
create_icon() {
    local size=$1
    local output=$2
    local viewbox=$3
    local rx=$4
    local path_data=$5
    
    # Erstelle temporäre SVG-Datei
    cat > /tmp/icon_temp.svg << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $viewbox $viewbox" role="img" aria-label="Priority Pilot">
	<rect width="$viewbox" height="$viewbox" rx="$rx" fill="$BG_COLOR" />
	<path d="$path_data" fill="$FG_COLOR" />
</svg>
SVGEOF
    
    # Konvertiere zu PNG
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w $size -h $size /tmp/icon_temp.svg -o $output
    elif command -v inkscape &> /dev/null; then
        inkscape --export-type=png --export-filename=$output --export-width=$size --export-height=$size /tmp/icon_temp.svg
    else
        echo "Weder rsvg-convert noch inkscape gefunden. PNG-Icons können nicht generiert werden."
        echo "Installiere librsvg (rsvg-convert) oder inkscape."
        exit 1
    fi
    
    rm /tmp/icon_temp.svg
}

# 192x192 Icon
echo "Generiere icon-192x192.png..."
create_icon 192 "icon-192x192.png" 192 36 "M96 36 L144 164 H120 L96 104 L72 164 H48 Z"

# 512x512 Icon
echo "Generiere icon-512x512.png..."
create_icon 512 "icon-512x512.png" 512 96 "M256 96 L400 416 H320 L256 272 L192 416 H112 Z"

# Maskable Icons (gleiche Größe, aber für maskable purpose)
cp icon-192x192.png icon-192x192-maskable.png
cp icon-512x512.png icon-512x512-maskable.png

echo "Icons generiert!"
