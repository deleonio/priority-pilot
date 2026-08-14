# Issue 671: Scanner Behavior-Assertion Detection

## Ziel

Die hasObservableOutcome-Logik im Test-Scanner korrigieren, damit assert.equal-Calls mit nicht-leeren Meldungen korrekt als Verhaltens-Tests erkannt werden.

## Vorbedingung

- Scanner läuft über server/src/express/api.test.ts
- Zeile 502: assert.equal(remaining.length, 0, "no edges should remain")
- Zeile 513: assert.equal(deps.length, 0, "no dependencies found")

## Schritte

1. hasObservableOutcome-Logik prüfen
2. Korrektur extrahieren: assert.equal mit nicht-leeren Meldung = Verhaltens-Assertion
3. Lokaler Scanner-Lauf zur Verifikation

## Erwartetes Ergebnis

- AK1: Keine Info-Findings mehr für Zeile 502, 513
- AK2: Echte Existenz-Tests ohne Verhaltens-Assertion werden weiterhin gemeldet

## Hinweise

- ADR #567: Keine eigenen Tests für .github/scripts/, Verifikation über lokalen Scanner-Lauf
