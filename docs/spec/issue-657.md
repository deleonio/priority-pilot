# Agentic Workflow Rollen-Konzept – Priority Pilot

**Stand:** 2026-08-14  
**Ziel:** Rollen und Zuständigkeiten für agentischen GitHub-Workflow definieren (Issue #657, Teil von #655)

Dieses Konzept definiert die Rollen im agentischen Workflow zur automatisierten Ticket-Bearbeitung über GitHub Issues, Pull Requests und Labels.

---

## Rolle 1: Triage

### Zuständigkeit

- Eingehende Issues analysieren und kategorisieren
- Akzeptanzkriterien extrahieren und klären
- Priorität und Aufwand abschätzen
- Entscheidung: Umsetzbar oder Rückfrage an Nutzer needed

### Übergabe

- Bei klaren Anforderungen → Label `spec-ready` setzen → an Spec-Rolle übergeben
- Bei Unklarheiten → Label `needs-clarification` → Nutzerantwort abwarten

---

## Rolle 2: Spec

### Zuständigkeit

- Aus Akzeptanzkriterien Spezifikation erstellen (docs/spec/issue-XXX.md)
- User Journeys/Verhalten spezifizieren (Ziel/Vorbedingung/Schritte/Erwartetes Ergebnis)
- Rote Tests aus Spec ableiten (Test-Konzept: Auswertung, Spiegel, Schutz)

### Übergabe

- Spec vollständig erstellt → Commit mit roten Tests → Branch pushen → Draft-PR erstellen
- Label `spec-ready` im PR-Body oder automatisiert setzen → an Umsetzungs-Rolle übergeben

---

## Rolle 3: Umsetzung

### Zuständigkeit

- Rote Tests zu grünen Tests machen (Implementierung)
- Feature-Code schreiben (server/src/**, frontend/src/**)
- Bestehende Tests anpassen bei Widerspruch zu Akzeptanzkriterien

### Übergabe

- Alle Tests grün → PR als Draft aufheben → Label `needs-review` setzen → an Review-Rolle übergeben

---

## Rolle 4: Review

### Zuständigkeit

- Code-Review auf Qualität, Sicherheit, Performance
- Akzeptanzkriterien-Erfüllung validieren
- Test-Qualität prüfen (Mutations-Test: Verhalten brechen, Test muss rot werden)

### Übergabe

- Review bestanden → Label `approved` setzen → Merge freigeben
- Review nicht bestanden → Label `fixup-needed` setzen → an Fixup-Rolle übergeben

---

## Rolle 5: Fixup

### Zuständigkeit

- Review-Feedback umsetzen
- Defekte beheben
- Test-Probleme lösen

### Übergabe

- Fixtures umgesetzt → Label `needs-review` erneut setzen → zurück an Review-Rolle

---

## Lebenszyklus-Übergänge

### Startpunkt

- Issue erstellt → `triage`-Label (automatisch oder manuell)

### Normalfall

1. **Triage** → `spec-ready` → **Spec**
2. **Spec** → Draft-PR mit roten Tests → `needs-review` → **Umsetzung**
3. **Umsetzung** → Alle Tests grün → `approved` → **Review**
4. **Review** → `approved` → **Merge**
5. **Review** → `fixup-needed` → **Fixup** → zurück zu **Review**

### Ausnahmepfade

- Triage → `needs-clarification` → Nutzerantwort → zurück zu Triage
- Review → `fixup-needed` → Fixup → zurück zu Review
- Umsetzung → Implementierungsblocker → `blocked` → manuelle Intervention

---

## Testfall: Rollen-Übergang durchspielen

### Ziel

Den vollständigen Workflow einer Aufgabe durch alle Rollen nachspielen und Übergänge validieren.

### Vorbedingung

- GitHub Repository mit agentischem Workflow eingerichtet
- Test-Issue kann erstellt werden

### Schritte

1. **Issue erstellen**
   - Neues Issue mit Titel und Beschreibung anlegen
   - Automatisches Label `triage` wird gesetzt

2. **Triage-Rolle simulieren**
   - Issue analysieren: Anforderungen klar?
   - Bei Klarheit: Label `spec-ready` manuell setzen
   - Erwartetes Ergebnis: Issue trägt Label `spec-ready`

3. **Spec-Rolle simulieren**
   - Spec-Datei docs/spec/issue-XXX.md erstellen
   - Rote Tests schreiben (ableitet aus Spec, Bezug auf Spec oder AK)
   - Commit: "test: rote Spec-Tests für XXX"
   - Branch pushen: feat/issue-XXX-<kurzname>
   - Draft-PR erstellen mit Closes XXX im Body
   - Erwartetes Ergebnis: Draft-PR existiert, rote Tests im Branch, Issue nicht geschlossen

4. **Umsetzung-Rolle simulieren**
   - Rote Tests zu grün machen (Implementierung)
   - Alle Tests bestanden
   - Draft-Status aufheben
   - Label `needs-review` setzen
   - Erwartetes Ergebnis: PR ist kein Draft mehr, trägt `needs-review`

5. **Review-Rolle simulieren**
   - Code Review durchführen
   - Akzeptanzkriterien prüfen
   - Mutations-Test: Verhalten brechen, Test muss rot werden
   - Bei Erfolg: Label `approved` setzen
   - Erwartetes Ergebnis: PR trägt `approved`, Merge möglich

6. **Merge ausführen**
   - PR merge (squash-merge)
   - Issue wird durch Closes XXX automatisch geschlossen
   - Erwartetes Ergebnis: Issue geschlossen, Code im main-Branch

### Erwartetes Ergebnis

- Vollständiger Durchlauf durch alle Rollen funktioniert
- Jede Übergabe korrekt durch Label-Wechsel signalisiert
- Issue wird am Ende automatisch geschlossen
- Rollen arbeiten kooperativ über GitHub-Infrastructure

---

## Randfälle & Fehler

| Situation                                      | Erwartetes Verhalten                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Issue ohne klar definierte Akzeptanzkriterien  | Triage setzt `needs-clarification`, wartet auf Nutzerantwort      |
| Spec-Datei verweist auf nicht-existierende AKs | Review weist zurück, Spec muss korrigiert werden                  |
| Rote Tests nicht auf Spec/AK bezogen           | Review weist zurück, Tests müssen gelöscht oder korrigiert werden |
| Umsetzung mit bestehenden Tests in Widerspruch | Alter Test muss entfernt werden, Begründung im PR-Body            |
| Review findet Mutations-Probe nicht bestanden  | `fixup-needed`, Test verbessert oder Verhalten gesichert          |
| Fixup führt zu neuen Problemen                 | Review erneut `fixup-needed`, Schleife bis bestanden              |

---

## Hinweise zur Nutzung

- **Label-getrieben:** Der gesamte Workflow wird über GitHub-Labels gesteuert, nicht über manuelle Übergabe.
- **Asynchron:** Jede Rolle kann unabhängig arbeiten, sobald das entsprechende Label gesetzt ist.
- **Nachvollziehbar:** Alle Übergänge sind über Issue-/PR-Historie und Labels nachvollziehbar.
- **Automatisierbar:** Label-Wechsel können über GitHub Actions automatisiert werden (siehe Issue #659).

---

## Versionierung

- **v1.0** (2026-08-14): Initialefassung für Issue #657. Fünf Rollen (Triage, Spec, Umsetzung, Review, Fixup) definiert, Lebenszyklus-Übergänge dokumentiert, Testfall für Rollen-Übergang spezifiziert.
