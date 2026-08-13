# Spec Issue #628: Tautologische Tests in Push-Modulen beheben

**Stand:** 2026-08-13  
**Ziel:** 4 tautologische Tests in Push-Modulen durch echte Observable-Outcome-Assertions ersetzen

## Hintergrund

Die betroffenen Tests prüfen nur Mock-Aufrufe (`.toHaveBeenCalledWith`, `.not.toHaveBeenCalled`) ohne echte Observable Outcomes wie State-Änderungen, DOM-Effekte oder echte API-Antworten.

## Ziel

Alle 4 Tests haben echte Assertions auf Observable Outcomes (DOM, API-Response, State, `.toBe`/`.toEqual`/`assert.*`).

## Vorbedingung

- Test-Files existieren: `frontend/src/lib/push-sw.test.ts`, `frontend/src/lib/push.test.ts`
- Tests sind aktuell tautologisch (prüfen nur Mock-Aufrufe)

## Schritte

### 1. push-sw.test.ts — AK1/T1: Push-Event Notification

**Aktuell:** Prüft nur `showNotification`-Mock-Aufrufe
**Soll:** Echte Observable-Outcome-Assertion hinzufügen

**Observable Outcome:**

- Notification wird tatsächlich angezeigt (nicht nur Mock gerufen)
- Notification hat korrekten Titel und Body
- Genau EINE Notification pro Push-Event

### 2. push-sw.test.ts — AK2/T2: Keine zweite Notification

**Aktuell:** Prüft nur, dass `showNotification` einmal gerufen wurde
**Soll:** Echte Observable-Outcome-Assertion hinzufügen

**Observable Outcome:**

- Keine zweiten Notification-Channels werden genutzt
- `clientsMatchAll` wird nicht gerufen (verifiziert, dass kein Nebenkanel genutzt wird)
- `openWindow` wird nicht gerufen

### 3. push.test.ts: Backend-Abmeldung

**Aktuell:** Prüft nur `mockedApi.unsubscribePush`-Aufrufe
**Soll:** Echte Observable-Outcome-Assertion hinzufügen

**Observable Outcome:**

- Nach `disablePush()` ist `hasActiveSubscription()` = `false` (State-Änderung)
- Subscription ist tatsächlich im Browser gekündigt

### 4. push.test.ts: No-op ohne Subscription

**Aktuell:** Prüft nur, dass Backend nicht gerufen wurde (tautologisch)
**Soll:** Echte Observable-Outcome-Assertion hinzufügen

**Observable Outcome:**

- Vorher: `hasActiveSubscription()` = `false`
- Nachher: `hasActiveSubscription()` = `false` (State unverändert)
- Exception wird nicht geworfen

## Erwartetes Ergebnis

- Alle 4 Tests haben echte Assertions auf Observable Outcomes
- Tests prüfen State-Änderungen, nicht nur Mock-Aufrufe
- Test-Suite läuft grün ohne Regressionen
- Keine Tests wurden entfernt — nur repariert

## Test-Konzept

Ein Test gehört nur in den PR, wenn er mindestens EINES leistet:

1. **Auswertung:** Rechnet etwas aus, das nicht wörtlich in der Quelle steht
2. **Spiegel:** Sichert Konsistenz zwischen Dateien, Sollwert aus führender Quelle
3. **Schutz:** Vor stillen/teuren Ausfällen (Datenverlust, Secret-Leak, Endlosschleife)

KEIN Change-Detector: „Datei enthält den String, den ich geschrieben habe" (findet per Konstruktion keinen Fehler).
