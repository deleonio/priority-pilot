# Issue 612: No-Progress-Erkennung für Fixup-Runs

## Ziel

Fixup-Runs ohne echte HEAD-Bewegung erkennen und verhindern, dass sie in einer Endlosschleife laufen.

## Vorbedingung

- Issue #611 ist CLOSED (Progress-Metrik verfügbar)
- Git-Repository mit CI-Run
- Progress-Metrik kann berechnet werden (Anzahl Commits zwischen base und HEAD)

## Schritte

1. **Fixup-Run überwachen**: Während eines Fixup-Runs die Progress-Metrik aus #611 abrufen
2. **No-Progress erkennen**: Wenn Metrik = 0 (keine Commits seit Start), dann „no progress"-Verdict zurückgeben
3. **Self-Loop verhindern**: Bei „no progress" den Fixup-Run nicht wiederholen, sondern abbrechen
4. **Memory persistieren**: Erkennungsstatus in Memory `fixup-no-progress-loop` speichern

## Erwartetes Ergebnis

- Fixup-Run ohne HEAD-Bewegung (Metrik = 0) → „no progress"-Verdict statt Self-Loop
- Fixup-Run mit echter HEAD-Bewegung (Metrik > 0) → normaler Ablauf
- Kein `ARTIFACTS_OK`-Fallback als Fortschritts-Indikator
- Memory `fixup-no-progress-loop` hält den Status

## Testfälle

1. **Fixup-Run ohne HEAD-Bewegung**: 0 Commits seit Start → „no progress"-Verdict
2. **Fixup-Run mit echter HEAD-Bewegung**: >0 Commits → normaler Ablauf
3. **No-Progress False-Positive check**: Bei regulärem Fortschritt tritt No-Progress NICHT auf

## Implementierungshinweise

- Progress-Metrik aus Issue #611 nutzen: `git rev-list --count base..HEAD`
- Schwellenwert: 0 Commits = no progress (nicht 2+ Läufe wie in #611, hier sofortiger Abbruch)
- `ARTIFACTS_OK` NICHT als Fortschritts-Indikator verwenden
- Memory-Key: `fixup-no-progress-loop` für Persistenz
