#!/usr/bin/env bash
# Rendert die restaurierten Phasen-Notizen als Prompt-Block auf stdout.
#
# WARUM DAS EXISTIERT: Bis hierher lag der Memory zwar im Workspace, gelesen wurde er aber nur,
# WEIL der Prompt darum bat ("lies zuerst .ai-memory/"). Das hängt an Gehorsam und war damit
# genau so verlässlich wie ein Agent an einem schlechten Tag. Der Kontext der Vor-Phasen gehört
# WÖRTLICH in den Prompt — dann ist er geladen, Punkt. Die Dateien bleiben zusätzlich auf Platte
# liegen, für den Fall dass der Agent das Original braucht.
#
# Aufruf: bash .github/scripts/render-memory-context.sh [verzeichnis]   (Default: .ai-memory)
# Ausgabe: leer, wenn keine Notizen da sind (Erst-Phase) — der Aufrufer hängt dann nichts an.
set -uo pipefail

dir="${1:-.ai-memory}"

# Pipeline-Reihenfolge, damit der Agent den Verlauf chronologisch liest und nicht alphabetisch
# (ein "fixup" vor dem "implement" wäre irreführend). Unbekannte Phasen landen hinten.
order="triage ux spec implement fixup review documenter"

files=()
for phase in $order; do
  for f in "$dir"/issue-*-"$phase".md; do
    [ -f "$f" ] && files+=("$f")
  done
done
# Nachzügler: alles, was das Namensschema nicht trifft, aber eine Notiz ist.
for f in "$dir"/issue-*.md; do
  [ -f "$f" ] || continue
  case " ${files[*]-} " in *" $f "*) ;; *) files+=("$f") ;; esac
done

[ "${#files[@]}" -eq 0 ] && exit 0

# Deckel gegen Prompt-Explosion. Notizen liegen bei ~2-4 KB; sechs Phasen bleiben deutlich
# darunter. Reisst eine Phase aus, wird sie gekappt statt den ganzen Lauf zu sprengen —
# sichtbar, damit niemand still einen halben Kontext bekommt.
max_total=48000
max_file=12000

printf '\n═══ KONTEXT AUS DEN VORHERIGEN PHASEN DIESES TICKETS ═══\n'
printf 'Das folgende haben die Phasen vor dir hinterlassen. Es ist bereits geladen — du musst\n'
printf 'es NICHT nachlesen. Greif es auf, statt es neu zu erarbeiten: was dort als erledigt oder\n'
printf 'als bewusst verworfen steht, machst du nicht nochmal. Die Originale liegen in %s/.\n' "$dir"

total=0
for f in "${files[@]}"; do
  size=$(wc -c <"$f" | tr -d ' ')
  if [ "$total" -ge "$max_total" ]; then
    printf '\n--- %s: ÜBERSPRUNGEN (Gesamt-Deckel %s Zeichen erreicht) ---\n' "$f" "$max_total"
    continue
  fi
  printf '\n--- %s ---\n' "$f"
  if [ "$size" -gt "$max_file" ]; then
    head -c "$max_file" "$f"
    printf '\n[... gekappt bei %s von %s Zeichen — Rest steht in der Datei ...]\n' "$max_file" "$size"
    total=$((total + max_file))
  else
    cat "$f"
    total=$((total + size))
  fi
done

printf '\n═══ ENDE VOR-PHASEN-KONTEXT ═══\n\n'
