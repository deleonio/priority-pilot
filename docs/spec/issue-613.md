# Issue 613: Label-Race-Conditions im CI-Workflow

**Stand:** 2026-08-13  
**Ziel:** Label-Race-Conditions im CI-Workflow verhindern oder sauber handeln.

## Problemstellung

CI-Workflows setzen GitHub-Labels, um den Status von PRs zu steuern. Bei Race-Conditions können Workflows sich gegenseitig überschreiben oder in Endlosschleifen geraten.

### Betroffene Labels

- `ai:review-no-result` – KI-Review hatte kein Ergebnis
- `ai:needs-review` – KI-Review benötigt menschliche Prüfung

---

## Szenario 1: `ai:review-no-result` Race-Condition

### Ziel

Definiertes Verhalten bei `ai:review-no-result` – Retry oder needs-human, kein Self-Loop.

### Vorbedingung

- PR ist im CI-Workflow
- KI-Review wird ausgeführt
- Transienter Fehler tritt auf (z.B. API-Timeout, Rate-Limit)

### Schritte

1. **KI-Review fehlgeschlagen**
   - CI-Workflow erkennt, dass KI-Review kein Ergebnis lieferte
   - Workflow setzt Label `ai:review-no-result`

2. **Race-Condition tritt auf**
   - Ein zweiter Workflow-Lauf versucht gleichzeitig, das Label zu setzen
   - GitHub-API antwortet mit transientem Fehler (z.B. 403, 409, 5xx)

### Erwartetes Ergebnis

- **Option A (Retry):** Workflow wiederholt den Label-Vorgang mit Backoff (max. 3 Versuche)
- **Option B (Fallback):** Nach Retry-Limit setzt Workflow `ai:needs-human` und erstellt Kommentar mit Fehlerkontext
- **Verhindert:** Self-Loop durch `ai:review-no-result` ohne Eskalation

---

## Szenario 2: `ai:needs-review` Re-Arm Race-Condition

### Ziel

`ai:needs-review` Re-Arm (#536) verhindern oder sauber handhaben.

### Vorbedingung

- PR hat bereits `ai:needs-review` Label
- Menschlicher Reviewer hat PR geprüft und Label entfernt
- CI-Workflow läuft erneut und versucht, `ai:needs-review` erneut zu setzen

### Schritte

1. **Re-Arm Versuch**
   - CI-Workflow versucht, `ai:needs-review` erneut zu setzen
   - Race-Condition: gleichzeitiger Zugriff durch mehrere Workflow-Läufe

2. **Race-Erkennung**
   - Workflow erkennt, dass Label bereits existiert (oder race mit anderen Workflow)
   - GitHub-API antwortet mit transientem Fehler

### Erwartetes Ergebnis

- **Erkannt:** Workflow erkennt Re-Arm Versuch und bricht ab (noop)
- **Oder:** Transienter Fehler wird mit Retry behandelt (max. 2 Versuche)
- **Verhindert:** Endloses `ai:needs-review` Re-Arm ohne menschliches Eingreifen

---

## Szenario 3: Transiente GitHub-API Races bei Label-Switch

### Ziel

Transiente GitHub-API-Races bei Label-Switch abfangen (optimistic locking oder Retry).

### Vorbedingung

- PR hat Label A (z.B. `ai:processing`)
- CI-Workflow will Label A auf B switchen (z.B. `ai:needs-review`)
- Gleichzeitig greift ein anderer Workflow auf die Labels zu

### Schritte

1. **Label-Switch Attempt**
   - Workflow versucht, Label A zu entfernen und Label B zu setzen
   - Gleichzeitig modifiziert anderer Workflow die Labels

2. **Race-Condition tritt auf**
   - GitHub-API antwortet mit konfliktem Fehler (z.B. 409 Conflict)
   - Oder: Label-Status hat sich zwischen Lesen und Schreiben geändert

### Erwartetes Ergebnis

- **Optimistic Locking:** Workflow prüft vor dem Schreiben, ob sich Label-Status geändert hat
- **Oder Retry:** Workflow wiederholt mit exponential backoff (max. 3 Versuche)
- **Oder Fallback:** Bei persistentem Fehler wird Workflow mit Status `failed` beendet und `ai:needs-human` gesetzt

---

## Technische Hinweise

### Label-Operationen

- `gh label add` – Label hinzufügen
- `gh label remove` – Label entfernen
- `gh label list` – Label auflisten (für Race-Erkennung)

### Retry-Strategie

- Exponential Backoff: 1s, 2s, 4s (max. 3 Versuche)
- Bei persistenten Fehlern → `ai:needs-human` + Fehlerkommentar

### Race-Erkennung

- Vor jedem Label-Switch: `gh label list` prüfen
- Wenn Label sich geändert hat → Race erkannt → noop oder Retry

---

## Testfälle (Ableitung)

1. **ai:review-no-result → Retry → needs-human**
   - Gegeben: KI-Review schlägt fehl mit transientem Fehler
   - Wenn: Workflow `ai:review-no-result` setzt (mit Retry)
   - Dann: Nach Retry-Limit → `ai:needs-human` + Fehlerkommentar

2. **ai:needs-review Re-Arm → noop**
   - Gegeben: PR hat bereits `ai:needs-review`
   - Wenn: Workflow versucht erneut, `ai:needs-review` zu setzen
   - Dann: noop (Label bereits vorhanden)

3. **Label-Switch mit Race → Retry → Success**
   - Gegeben: PR hat `ai:processing`, Workflow will auf `ai:needs-review` switchen
   - Wenn: Race-Condition tritt auf (konkurrierender Workflow)
   - Dann: Retry mit Backoff → erfolgreich

4. **Label-Switch mit persistentem Race → needs-human**
   - Gegeben: Race-Condition wie oben, aber persistent
   - Wenn: Alle Retries scheitern
   - Dann: `ai:needs-human` + Fehlerkommentar
