# Issue 902: @axe-core/playwright für gezielte E2E-A11y-Tests

**Stand:** 2026-08-18  
**Ziel:** @axe-core/playwright als devDependency etablieren und für gezielte A11y-Scans in bestehenden und neuen E2E-Tests nutzen

---

## Journey 1:axe-core/playwright Dependency installieren

### Ziel

@axe-core/playwright als devDependency in frontend/package.json etablieren.

### Vorbedingung

- frontend/package.json existiert
- Node.js/npm verfügbar

### Schritte

1. **Dependency hinzufügen**
   - `npm install --save-dev @axe-core/playwright` in frontend/
   - Dependency in package.json unter devDependencies

### Erwartetes Ergebnis

- @axe-core/playwright in frontend/package.json als devDependency
- Version ist current/compatible mit Playwright-Version
- `npm install` läuft ohne Fehler

---

## Journey 2: Bestehenden E2E-Test zu AxeBuilder migrieren

### Ziel

Mindestens ein bestehender E2E-Test (dark-mode-contrast.spec.ts ODER issue-787.spec.ts) nutzt AxeBuilder statt handgerollter Kontrast-Messung.

### Vorbedingung

- @axe-core/playwright ist installiert
- dark-mode-contrast.spec.ts und issue-787.spec.ts existieren mit handgerollter Kontrastmessung

### Schritte

1. **Zieltest wählen**
   - dark-mode-contrast.spec.ts (misst Kontrast im Dunkelmodus)
   - ODER issue-787.spec.ts (kontrast-Prüfungen im Header)

2. **Handgerollte Logik ersetzen**
   - Import von AxeBuilder aus @axe-core/playwright
   - measureContrast-Funktion entfernen
   - AxeBuilder-Scan mit Shadow-DOM-Konfiguration

3. **KoliBri Shadow-DOM Konfiguration**
   - AxeBuilder mit exclude-Regeln für nicht scannbare Shadow-Hosts
   - Scoped Scan pro Komponente (nicht ganze App)

### Erwartetes Ergebnis

- Gewählter Test nutzt AxeBuilder statt handgerollter measureContrast
- Test bleibt grün (Kontrast-Anforderungen werden erfüllt)
- Shadow-DOM-Kompatibilität ist gewährleistet (exclude-Regeln)

---

## Journey 3: Pattern-Dokumentation für axe-core mit KoliBri Shadow DOM

### Ziel

Pattern-Doc/Kommentar: wie axe-core korrekt mit KoliBri Shadow DOM genutzt wird.

### Vorbedingung

- @axe-core/playwright ist installiert
- Mindestens ein Test nutzt AxeBuilder

### Schritte

1. **Pattern-Doc erstellen**
   - Neue Datei frontend/public/docs/e2e-a11y-pattern.md (im Browser unter `/docs/e2e-a11y-pattern.md` erreichbar)
   - ODER Inline-Kommentar im ersten migrierten Test

2. **Pattern-Elemente**
   - AxeBuilder-Setup für Shadow DOM
   - exclude-Regeln für nicht scannbare Shadow-Hosts
   - Scoped Scan pro Komponente (nicht ganze App)
   - Beispiel-Code

### Erwartetes Ergebnis

- Pattern-Doc existiert (frontend/public/docs/e2e-a11y-pattern.md ODER Inline-Kommentar)
- Entwickler können Pattern für neue A11y-Tests nutzen
- Shadow-DOM-Herausforderungen sind dokumentiert

---

## Journey 4: Test-Stabilität sicherstellen

### Ziel

Alle E2E-Tests bleiben grün nach axe-core Integration.

### Vorbedingung

- @axe-core/playwright ist installiert
- Mindestens ein Test nutzt AxeBuilder
- Pattern-Doc existiert

### Schritte

1. **Alle E2E-Tests laufen**
   - `npm run test:e2e` ausführen
   - Keine Test-Regressionen durch axe-core Integration

2. **Kontrast-Tests verifizieren**
   - dark-mode-contrast.spec.ts bleibt grün
   - issue-787.spec.ts bleibt grün (sofern migriert)

### Erwartetes Ergebnis

- Alle E2E-Tests laufen erfolgreich
- Keine Regressionen durch axe-core Integration
- axe-core Scans sind stabil (keine flaky Tests)

---

## Randfälle & Fehler

| Situation                              | Erwartetes Verhalten                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| @axe-core/playwright nicht installiert | Dependency fehlt → Test schlägt mit klarer Meldung              |
| Shadow-DOM ohne exclude-Regeln         | False-Positives durch Shadow-Hosts → Test ist rot               |
| axe-core Version inkompatibel          | npm install schlägt fehl → Version anpassen                     |
| Pattern-Doc fehlt                      | Entwickler können axe-core nicht richtig nutzen → Doc erstellen |

---

## Hinweise zur Nutzung

- **Shadow-DOM:** KoliBri nutzt Shadow DOM; axe-core benötigt exclude-Regeln für Shadow-Hosts
- **Scoped Scans:** Kein flächendeckender App-Scan (zu fragil) → gezielte Scans pro Komponente
- **Bestehende Tests:** Handgerollte Kontrastmessung wird ersetzt, nicht ergänzt
- **Pattern-First:** Pattern-Doc vor weiteren Migrationen erstellen

---

## Versionierung

- **v1.0** (2026-08-18): Initialefassung für Issue #902. Vier Journeys dokumentiert.
- **v1.1** (2026-08-23): Pattern-Doc-Pfad korrigiert (frontend/public/docs/, Review-Finding #2).
  Umsetzung nach Besitzer-Entscheidung „Test ganz machen“: ein einziger echter AxeBuilder-Scan
  als Vertrag — Repo-Struktur-Assertions (page.request auf package.json/Spec-Dateien) sind
  bewusst kein E2E-Gegenstand (Anti-Pattern, Review-Finding #1).
