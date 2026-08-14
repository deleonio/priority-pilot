# Issue 658: Label-Chain und Übergaben zwischen Rollen definieren

## Ziel

Konkrete Label-Chain für den agentischen Workflow definieren, basierend auf dem Rollen-Konzept aus Issue #657.

## Vorbedingung

- Issue #657 (Rollen-Konzept) ist definiert
- Grundlegende Rollen sind bekannt: Triage, Spec, Umsetzung, Review, Fixup

## Label-Chain

### Primäre Labels

1. **`triaged`**
   - Rolle: Triage
   - Bedeutung: Issue wurde kategorisiert, priorisiert und ist bereit für Spec-Phase
   - Setzt: Triage-Agent
   - Entfernt: Spec-Agent (beim Start der Spec-Phase)

2. **`spec-ready`**
   - Rolle: Spec
   - Bedeutung: Spec-Dokument mit roten Tests ist erstellt
   - Setzt: Spec-Agent
   - Entfernt: Umsetzungs-Agent (beim Branch erstellen)

3. **`needs-review`**
   - Rolle: Umsetzung → Review
   - Bedeutung: Implementierung ist fertig und benötigt Review
   - Setzt: Umsetzungs-Agent
   - Entfernt: Review-Agent (bei Entscheidung)

4. **`needs-fixup`**
   - Rolle: Review → Fixup
   - Bedeutung: Review findet Mängel, Nachbesserung erforderlich
   - Setzt: Review-Agent
   - Entfernt: Fixup-Agent (bei erneuter Review-Anforderung)

5. **`approved`**
   - Rolle: Review
   - Bedeutung: PR ist zur Merge bereit
   - Setzt: Review-Agent
   - Entfernt: Merge-Process (automatisch beim Merge)

### Übergangs-Chain

```
Neues Issue → triaged → spec-ready → needs-review → (needs-fixup → needs-review)* → approved → merged
```

## Übergaberegeln

### 1. Triage → Spec (Label `triaged`)

- **Wann**: Issue ist kategorisiert, priorisiert, keine offenen Fragen
- **Wer**: Triage-Agent
- **Aktion**: Label `triaged` setzen, Issue an Spec-Phase übergeben
- **Eingabe**: Neues Issue oder ungetriagedes Issue
- **Ausgabe**: Issue mit Label `triaged`

### 2. Spec → Umsetzung (Label `spec-ready`)

- **Wann**: Spec-Dokument existiert, rote Tests sind erstellt
- **Wer**: Spec-Agent
- **Aktion**: Label `spec-ready` setzen, Draft-PR erstellen (optional)
- **Eingabe**: Issue mit Label `triaged`
- **Ausgabe**: Spec-Dokument, rote Tests, Label `spec-ready`

### 3. Umsetzung → Review (Label `needs-review`)

- **Wann**: Alle Tests grün, Akzeptanzkriterien erfüllt
- **Wer**: Umsetzungs-Agent
- **Aktion**: Label `needs-review` setzen
- **Eingabe**: Spec mit Label `spec-ready`
- **Ausgabe**: PR mit grünen Tests, Label `needs-review`

### 4. Review → Fixup (Label `needs-fixup`)

- **Wann**: Review findet Mängel, Nachbesserung erforderlich
- **Wer**: Review-Agent
- **Aktion**: Label `needs-fixup` setzen, Review-Kommentare hinzufügen
- **Eingabe**: PR mit Label `needs-review`
- **Ausgabe**: PR mit Label `needs-fixup`, Review-Kommentare

### 5. Fixup → Review (Label `needs-fixup` → `needs-review`)

- **Wann**: Nachbesserungen sind umgesetzt
- **Wer**: Fixup-Agent
- **Aktion**: Label `needs-fixup` entfernen, Label `needs-review` setzen
- **Eingabe**: PR mit Label `needs-fixup`
- **Ausgabe**: PR mit Label `needs-review`

### 6. Review → Merge (Label `approved`)

- **Wann**: Review ist zufrieden, alle Kriterien erfüllt
- **Wer**: Review-Agent
- **Aktion**: Label `approved` setzen
- **Eingabe**: PR mit Label `needs-review`
- **Ausgabe**: PR mit Label `approved`

## Rollen-zu-Label Matrix

| Rolle     | Setzt Label               | Entfernt Label |
| --------- | ------------------------- | -------------- |
| Triage    | `triaged`                 | -              |
| Spec      | `spec-ready`              | `triaged`      |
| Umsetzung | `needs-review`            | `spec-ready`   |
| Review    | `needs-fixup`, `approved` | `needs-review` |
| Fixup     | `needs-review`            | `needs-fixup`  |

## Testfall

### Szenario: Kompletter Label-Flow

1. **Start**: Neues Issue #999 wird erstellt
2. **Triage**: Agent analysiert Issue, setzt Label `triaged`
3. **Spec**: Agent erstellt Spec-Dokument, rote Tests, setzt Label `spec-ready`, entfernt `triaged`
4. **Umsetzung**: Agent macht Tests grün, öffnet PR, setzt Label `needs-review`, entfernt `spec-ready`
5. **Review 1**: Agent prüft PR, findet Mangel, setzt Label `needs-fixup`, entfernt `needs-review`
6. **Fixup**: Agent behebt Mangel, setzt Label `needs-review`, entfernt `needs-fixup`
7. **Review 2**: Agent genehmigt, setzt Label `approved`, entfernt `needs-review`
8. **Merge**: PR wird gemergt, Label `approved` wird automatisch entfernt

**Erwartung**:

- Jede Phase hat genau das korrekte Label
- Labels werden in der richtigen Sequenz gesetzt und entfernt
- Keine Phase wird übersprungen
- Review-Fixup-Schleife funktioniert korrekt

### Edge Case: Direkte Genehmigung

1. **Start**: PR mit Label `needs-review`
2. **Review**: Agent ist sofort zufrieden, setzt Label `approved`, entfernt `needs-review`

**Erwartung**: Übergang direkt von `needs-review` zu `approved` ohne Fixup-Schleife.

### Edge Case: Mehrfache Fixup-Review-Schleifen

1. **Review 1**: Setzt `needs-fixup`
2. **Fixup 1**: Setzt `needs-review`
3. **Review 2**: Setzt erneut `needs-fixup` (weitere Mängel)
4. **Fixup 2**: Setzt erneut `needs-review`
5. **Review 3**: Setzt `approved`

**Erwartung**: Schleife kann mehrfach durchlaufen werden, bis `approved` erreicht ist.

## Erwartetes Ergebnis

- Label-Chain ist vollständig dokumentiert
- Übergaberegeln sind pro Rolle definiert
- Testfälle decken Happy Path und Edge Cases ab
- Konkrete Label-Namen sind definiert
- Rollen-zu-Label-Zuordnung ist klar

## Implementierungshinweise

- Labels sind exklusiv pro Phase (nicht mehrere Labels gleichzeitig)
- Übergänge sind unidirektional (keine Rückwärts-Übergänge außer Fixup-Review-Schleife)
- Labels werden von Agenten gesetzt/entfernt, nicht von Personen
- Label-Chain ist gerichteter Graph mit klarer Sequenz
