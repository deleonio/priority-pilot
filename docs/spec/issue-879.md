# Issue 879: Tautologische Tests in useGeolocation.test.ts

## Ziel

Tautologische Tests in `frontend/src/lib/useGeolocation.test.ts` identifizieren und korrigieren. Diese Tests prüfen nur Implementation Details (Mocks/haveBeenCalled) statt beobachtbarem Verhalten.

## Vorbedingung

- Test-Datei `frontend/src/lib/useGeolocation.test.ts` existiert mit 2 tautologischen Tests
- Tests prüfen nur Mock-Aufrufe, keine Observable Outcomes

## Schritte

1. Aktuelle Test-Datei analysieren
2. AK1 bewerten: "Default ist aus – navigator.geolocation wird nicht aufgerufen"
3. AK2 bewerten: "Bei granted Permission wird erste Position ermittelt und Intervall gestartet"
4. Entscheidung: Tests mit Observable-Outcome-Assertions ergänzen ODER entfernen
5. Tests entsprechend anpassen

## Erwartetes Ergebnis

- Keine tautologischen Tests mehr vorhanden
- Alle Tests prüfen beobachtbares Verhalten (State-Werte, API-Responses, DOM-Changes)
- Test-Suite läuft grün ohne Warnungen
- Keine Mock-only-Assertions mehr vorhanden

## Testabdeckung

- Nach Fix: Tests prüfen tatsächliches Verhalten (State, Observable), nicht nur Mock-Aufrufe
- Focus auf Observable Outcomes: toBe(), toEqual(), assert.* statt haveBeenCalled()
