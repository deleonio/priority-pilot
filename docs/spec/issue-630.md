# Issue 630: Test-Pflege – Duplikat-Entfernung

**Stand:** 2026-08-13
**Ziel:** Entfernung von 14 redundanten Tests und 3 Info-Level-Tests ohne Funktionsverlust oder Coverage-Einbruch

## Ziel

Die Test-Suite von redundanten Duplikaten reinigen, während die vollständige Abdeckung aller Akzeptanzkriterien erhalten bleibt.

### Vorbedingung

- Test-Suite läuft aktuell grün (`npm test`)
- Coverage-Baseline liegt vor

### Schritte

1. **Duplikate identifizieren**
   - 14 Tests mit gleicher Signatur finden (gleiche Test-Beschreibung + gleiches Assertion-Verhalten)
   - 3 Info-Level-Tests finden (reine Existenz-Prüfungen ohne Behavior-Assertionen)

2. **Stärkste Formulierung behalten**
   - Für jedes Duplikat-Paar die stärkste/klarste Formulierung identifizieren
   - Alle schwächeren Duplikate entfernen

3. **Info-Tests ergänzen oder entfernen**
   - Für jeden Info-Test prüfen: kann er mit einer echten Behavior-Assertion ergänzt werden?
   - Falls nein: Test komplett entfernen

4. **Verifizierung**
   - Test-Suite läuft weiterhin grün
   - Coverage ist nicht signifikant gesunken

### Erwartetes Ergebnis

- **AC1:** Alle 14 redundanten Duplikate entfernt (stärkste Formulierung behalten)
- **AC2:** Alle 3 Info-Tests entfernt oder mit Behavior-Assertionen ergänzt
- **AC3:** Test-Suite läuft grün ohne Regressionen
- **AC4:** Coverage nicht signifikant gesunken (durch stärkste Formulierung abgedeckt)

## Test-Strategie für die Test-Pflege

Für die Test-Pflege selbst werden **Verify-Tests** geschrieben, die nach der Entfernung der Duplikate validieren:

1. **Stabilitäts-Test:** `npm test` läuft grün (keine Regressionen)
2. **Coverage-Stabilitäts-Test:** Coverage-Report zeigt keinen signifikanten Verlust
3. **Funktionalität-Test:** Alle ursprünglichen Akzeptanzkriterien sind weiterhin abgedeckt

## Randfälle & Fehler

| Situation                         | Erwartetes Verhalten                            |
| --------------------------------- | ----------------------------------------------- |
| Duplikat ist stärker als Original | Stärkere Version behalten, schwächere entfernen |
| Info-Test hat echtes Behavior     | Behavior-Assertion ergänzen, Test behalten      |
| Coverage sinkt signifikant        | Ursache analysieren, ggf. neuen Test schreiben  |
| Test-Suite läuft nicht mehr grün  | Regression identifizieren und beheben           |

## Spezifische Dateien und Aktionen

### Redundante Tests (14)

- `frontend/e2e/header-logo.spec.ts`: AK5 Logo sichtbar bei 375px (2×)
- `frontend/e2e/voice-autostart.spec.ts`: AK3 Einstellung an, SR nicht verfügbar (2×)
- `server/src/express/api.test.ts`: 200 mit leerer Liste (2×)
- `server/src/express/api.test.ts`: 404 wenn nicht gefunden (3×)
- `server/src/express/pillars.test.ts`: 401 ohne Auth (2×)
- `server/src/express/series.api.test.ts`: 404 für unbekannte Serie (3×)
- `server/src/logics/migrate.test.ts`: idempotent: erneuter Aufruf (2×)
- `server/src/models/title-length-schema.test.ts`: DB-Validierung 31/30 Zeichen (je 2×)
- `frontend/src/api.test.ts`: ResponseError bei 400/404 (je 2×)

### Info-Tests (3)

- `server/src/express/api.test.ts`: 204 bei vorhandener Kante
- `server/src/express/api.test.ts`: 404 wenn Kante nicht existiert
- `frontend/src/lib/logo-transparency.test.ts`: Eckpixel haben alpha ≈ 0
