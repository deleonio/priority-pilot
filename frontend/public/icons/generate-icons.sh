#!/bin/bash
# Skript zum Generieren von PNG-Icons aus SVG-Vorlagen
# Benötigt: rsvg-convert (aus librsvg) oder inkscape

# Farben
BG_COLOR="#1a1a1a"

# Funktion zum Erstellen eines PNG-Icons aus SVG
create_png_from_svg() {
    local svg_file=$1
    local size=$2
    local output=$3
    
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w $size -h $size "$svg_file" -o "$output"
    elif command -v inkscape &> /dev/null; then
        inkscape --export-type=png --export-filename="$output" --export-width=$size --export-height=$size "$svg_file"
    else
        echo "Weder rsvg-convert noch inkscape gefunden. PNG-Icons können nicht generiert werden."
        echo "Installiere librsvg (rsvg-convert) oder inkscape."
        return 1
    fi
}

echo "Generiere PNG-Icons aus SVG-Vorlagen..."

# 192x192 Icons
for purpose in "" "-maskable"; do
    suffix="${purpose}"
    svg_file="icon-192x192${suffix}.svg"
    png_file="icon-192x192${suffix}.png"
    
    if [ -f "$svg_file" ]; then
        echo "Generiere ${png_file}..."
        create_png_from_svg "$svg_file" 192 "$png_file"
    else
        echo "SVG-Datei ${svg_file} nicht gefunden."
    fi
done

# 512x512 Icons
for purpose in "" "-maskable"; do
    suffix="${purpose}"
    svg_file="icon-512x512${suffix}.svg"
    png_file="icon-512x512${suffix}.png"
    
    if [ -f "$svg_file" ]; then
        echo "Generiere ${png_file}..."
        create_png_from_svg "$svg_file" 512 "$png_file"
    else
        echo "SVG-Datei ${svg_file} nicht gefunden."
    fi
done

echo "PNG-Icons generiert!"
