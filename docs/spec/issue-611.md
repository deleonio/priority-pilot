# Issue 611: CI Fortschrittsmetrik

## Ziel

Reproduzierbare Metrik für "Fortschritt im CI-Lauf" definieren.

## Vorbedingung

- Git-Repository mit CI-Run
- Git-Verlauf ist verfügbar

## Schritte

1. **Metrik berechnen**: Anzahl der Commits zwischen `base` (Run-Start) und `HEAD` (aktueller Stand)
2. **Schwellenwert definieren**: 0 Commits in 2+ aufeinanderfolgenden Läufen gilt als "no progress"
3. **Reproduzierbarkeit sicherstellen**: Metrik muss bei gleichem Git-Status identisch sein

## Erwartetes Ergebnis

- Metrik ist eine ganze Zahl (Anzahl Commits)
- 0 = kein Fortschritt
- > 0 = Fortschritt vorhanden
- Metrik ist deterministisch und reproduzierbar

## Testfälle

1. **Kein Fortschritt**: Fixup-Run ohne Commits seit Start → Metrik = 0
2. **Fortschritt**: Fixup-Run mit echten Commits → Metrik > 0
3. **Reproduzierbarkeit**: Metrik ist reproduzierbar bei gleichem Git-Status

## Implementierungshinweise

- Metrik muss über `git rev-list --count base..HEAD` berechenbar sein
- Schwellenwert: 0 Commits über 2+ Läufe = "no progress"
- Keine heuristischen Annäherungen – deterministische Git-basierte Berechnung
