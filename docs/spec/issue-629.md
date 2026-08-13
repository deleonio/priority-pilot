# Issue 629: Tab-Freiheits-Checks für Fokus-Verträge

**Stand:** 2026-08-13  
**Ziel:** 7 Behavior-Coverage-Lücken in Fokus-Verträgen durch Tab-Freiheits-Checks schließen

## Problem

Aktuell fehlen in 7 Fokus-Verträgen Tab-Freiheits-Checks, sodass Fokus-Gefängnisse möglich sind. Nutzer könnten durch Tab-Taste in Dialogen "steckenbleiben" ohne klaren Fokus-Wechsel.

## Ziel

Alle 7 Fokus-Verträge haben explicit Tab-Freiheits-Checks, die sicherstellen, dass nach Tab-Taste ein fokussierbares Element den Fokus erhält.

## Vorbedingung

- Priority Pilot App ist gestartet
- E2E-Test-Umgebung ist verfügbar

## Schritte

### Test 1: Task-Löschdialog Initialfokus (delete-dialog-focus.spec.ts)

1. Task-Löschdialog öffnen
2. **Tab-Check**: Tab-Taste drücken
3. Erwarten: Bestimmtes Button-Element ist fokussiert

### Test 2: Säulen-Löschdialog Initialfokus (delete-dialog-focus.spec.ts)

1. Säulen-Löschdialog öffnen
2. **Tab-Check**: Tab-Taste drücken
3. Erwarten: Bestimmtes Button-Element ist fokussiert

### Test 3: Serien-Löschen Bestätigungsdialog (delete-dialog-focus.spec.ts)

1. Serien-Löschen-Dialog öffnen
2. **Tab-Check**: Tab-Taste drücken
3. Erwarten: Bestimmtes Button-Element ist fokussiert

### Test 4: Abbrechen gibt Fokus zurück (delete-dialog-focus.spec.ts)

1. Löschdialog öffnen
2. Abbrechen-Button drücken
3. **Tab-Check**: Tab-Taste drücken
4. Erwarten: Ursprüngliches Element ist fokussiert

### Test 5: Nach Löschen Fallback-Element (delete-dialog-focus.spec.ts)

1. Löschdialog bestätigen
2. **Tab-Check**: Tab-Taste drücken
3. Erwarten: Fallback-Element ist fokussiert

### Test 6: Säulen-Löschdialog Tab bewegt Fokus (delete-dialog-focus.spec.ts)

1. Säulen-Löschdialog öffnen
2. **Tab-Check**: Tab-Taste mehrmals drücken
3. Erwarten: Fokus bewegt sich zwischen fokussierbaren Elementen

### Test 7: Überspringen öffnet Formular (quick-capture.spec.ts)

1. Quick Capture überspringen
2. Formular öffnet sich
3. **Tab-Check**: Tab-Taste drücken
4. Erwarten: Erstes fokussierbares Element im Formular ist fokussiert

## Erwartetes Ergebnis

- Jeder der 7 Tests enthält einen expliziten Tab-Freiheits-Check: `Tab → expect(button).toBeFocused()`
- Tests laufen grün: `npm test -- frontend/e2e/delete-dialog-focus.spec.ts`
- Tests laufen grün: `npm test -- frontend/e2e/quick-capture.spec.ts`
- Keine Fokus-Gefängnisse mehr möglich durch fehlende Tab-Checks

## Akzeptanzkriterien

- **[AC1]** Alle 7 Fokus-Verträge haben Tab-Freiheits-Checks
- **[AC2]** Test-Suite läuft grün ohne Regressionen
- **[AC3]** Keine Fokus-Gefängnisse mehr möglich
