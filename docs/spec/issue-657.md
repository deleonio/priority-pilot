# Issue 657: Rollen-Konzept für agentischen Workflow

## Ziel

Rollen-Konzept für den agentischen Workflow definieren (Triage → Spec → Umsetzung → Review → Fixup).

## Vorbedingung

- GitHub Repository mit Issues und PRs
- Labels für Rollen-Übergänge verfügbar (siehe Issue #658)

## Rollen und Zuständigkeiten

### Triage

- **Zweck**: Issue aufnehmen, Kategorisierung, Reihenfolge bestimmen
- **Zuständigkeiten**:
  - Issue-Titel und -Beschreibung auf Klarheit prüfen
  - Zuordnung zu Theme/Component vornehmen
  - Priorität und Dringlichkeit einschätzen
  - Blocker identifizieren
- **Eingabe**: Neues Issue oder gepushtes Issue
- **Ausgabe**: Kategorisiertes, priorisiertes Issue mit Label `triaged`
- **Übergang an**: Spec

### Spec

- **Zweck**: Akzeptanzkriterien und Testfälle definieren
- **Zuständigkeiten**:
  - Akzeptanzkriterien aus Issue-Body extrahieren
  - Lücken im Requirement identifizieren und klären
  - Testfälle (rot) als Vertrag schreiben
  - Technischen Ansatz skizzieren
- **Eingabe**: Getriagedes Issue mit Label `triaged`
- **Ausgabe**: Spec-Dokument in `docs/spec/issue-NNN.md`, rote Tests, Label `spec-ready`
- **Übergang an**: Umsetzung

### Umsetzung

- **Zweck**: Akzeptanzkriterien erfüllen, Tests grün machen
- **Zuständigkeiten**:
  - Code schreiben, der Akzeptanzkriterien erfüllt
  - Rote Tests zu grün bringen
  - UX-Patterns beachten (z.B. Sequential Confirmation)
  - Format, Lint, Knip erfüllen
- **Eingabe**: Spec-Document mit Label `spec-ready`
- **Ausgabe**: PR mit Implementierung, alle Tests grün, Label `needs-review`
- **Übergang an**: Review

### Review

- **Zweck**: Qualitätssicherung, Architektur-Konsistenz
- **Zuständigkeiten**:
  - Code-Review nach Projekt-Standards
  - Architektur-Konsistenz prüfen
  - Sicherheitsaspekte betrachten
  - Testabdeckung validieren
- **Eingabe**: PR mit Label `needs-review`
- **Ausgabe**: Review-Kommentare, `approve`/`request-changes`, Label `approved` oder `needs-fixup`
- **Übergang an**: Fixup (bei `needs-fixup`) oder Merge (bei `approved`)

### Fixup

- **Zweck**: Review-Feedback aufarbeiten
- **Zuständigkeiten**:
  - Review-Kommentare adressieren
  - Nachbesserungen umsetzen
  - Tests weiterhin grün halten
- **Eingabe**: PR mit Label `needs-fixup`
- **Ausgabe**: Aktualisierter PR, Label `needs-review` (erneut)
- **Übergang an**: Review (Schleife bis `approved`)

## Lebenszyklus-Übergänge

```
Neues Issue → Triage → Spec → Umsetzung → Review → (Fixup → Review)* → Merge
```

1. **Triage → Spec**: Label `triaged` → `spec-ready`
2. **Spec → Umsetzung**: Draft-PR mit roten Tests → `needs-review` (nach Implementierung)
3. **Umsetzung → Review**: Label `needs-review`
4. **Review → Fixup**: Label `needs-fixup`
5. **Fixup → Review**: Label `needs-fixup` → `needs-review`
6. **Review → Merge**: Label `approved`

## Erwartetes Ergebnis

- Rollen sind klar definiert mit Zuständigkeiten
- Lebenszyklus ist als gerichteter Graph mit Übergängen dokumentiert
- Übergänge erfolgen über Labels

## Testfall

### Szenario: Rollen-Übergang durchspielen

1. **Start**: Neues Issue wird erstellt
2. **Triage**: Rollen-Agent prüft Issue, setzt Label `triaged`
3. **Spec**: Rollen-Agent erstellt Spec-Dokument mit roten Tests, setzt Label `spec-ready`
4. **Umsetzung**: Rollen-Agent erstellt Branch, macht Tests grün, öffnet PR mit Label `needs-review`
5. **Review**: Rollen-Agent prüft PR, findet Mangel, setzt Label `needs-fixup`
6. **Fixup**: Rollen-Agent behebt Mangel, aktualisiert Label auf `needs-review`
7. **Review**: Rollen-Agent genehmigt, setzt Label `approved`
8. **Merge**: PR wird gemergt

**Erwartung**: Jeder Schritt folgt dem definierten Übergang, Labels korrekt gesetzt.

## Implementierungshinweise

- Rollen sind nicht an Personen gebunden, sondern an Agenten/Tasks
- Jede Rolle hat klare Input/Output-Kriterien
- Labels sind die einzige Schnittstelle zwischen Rollen (lose Kopplung)
- Fixup-Review-Schleife kann mehrfach durchlaufen werden
