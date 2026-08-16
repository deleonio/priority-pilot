# Issue 720: Fokus-Tab-Ergänzungen für Lektorat-Diff-Modal

## Ziel

Test-Optimierung basierend auf Test-Optimization-Report 2026-08-16. Die bestehenden Fokus-Management-Tests im Lektorat-Diff-Modal sollen um Tab-Prüfung erweitert werden, um Fokus-Gefängnisse sicherzustellen.

## Vorbedingung

- Lektorat-Diff-Modal ist implementiert und getestet (Issue 687)
- Bestehende Fokus-Tests prüfen nur `toBeFocused()`, ohne Tab-Freiheit

## Schritte

### Journey 1: Fokus-Management beim Modal-Öffnen mit Tab-Prüfung

1. Task-Formular öffnen und Titel ausfüllen
2. "Titel lektorieren" klicken
3. Diff-Modal erscheint
4. **Übernehmen-Button ist fokusiert**
5. **Tab-Taste drücken**
6. **Übernehmen-Button ist weiterhin fokusiert** (kein Fokus-Gefängnis)

### Journey 2: Fokus-Management nach Abbrechen mit Tab-Prüfung

1. Task-Formular öffnen und Titel ausfüllen
2. "Titel lektorieren" klicken
3. Diff-Modal erscheint
4. "Abbrechen" klicken
5. **Lektorat-Button ist fokusiert**
6. **Tab-Taste drücken**
7. **Lektorat-Button ist weiterhin fokusiert** (kein Fokus-Gefängnis)

## Erwartetes Ergebnis

- Beide Fokus-Tests prüfen nicht nur den initialen Fokus, sondern auch dass Tab-Tasten-Drücke nicht zum Fokus-Verlust führen
- Erfüllung der Behavior-Coverage-Lücke aus Test-Optimization-Report

## Referenz

- Test-Optimization-Report 2026-08-16 (generiert von `.github/workflows/test-optimization.yml`)
- UX-Pattern: Sequential Confirmation (docs/ux-pattern-sequential-confirmation.md)
- Basis-Spec: docs/spec/issue-687.md (Lektorat-Diff-Modal Basisfunktionalität)
