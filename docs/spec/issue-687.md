# Issue 687 – Lektorat mit Diff-Modal

**Stand:** 2026-08-15  
**Ziel:** Lektorat-Aktionen zeigen Änderungen in einem Modal mit Diff-Anzeige, bevor sie übernommen werden

---

## Journey 1: Titel lektorieren mit Diff-Modal

### Ziel

Titel-Text mit KI lektorieren und Änderungen in einem Modal mit Diff-Anzeige prüfen, bevor sie übernommen werden.

### Vorbedingung

- Nutzer ist angemeldet
- „Neuen Task anlegen"-Dialog ist geöffnet
- Titel-Feld enthält Text

### Schritte

1. **Lektorat auslösen**
   - Klick auf **„Titel lektorieren"**
   - API-Call wird ausgelöst (Lektorat-Backend)

2. **Diff-Modal erscheint**
   - Modal öffnet sich mit **Diff-Anzeige**
   - Original-Text wird links (oder oben) angezeigt
   - Lektorierter Text wird rechts (oder unten) angezeigt
   - Änderungen sind visuell hervorgehoben (z. B. Farben, Markierungen)

3. **Option A: Abbrechen**
   - Klick auf **„Abbrechen"** (sekundärer Button)
   - Modal schließt sich
   - **KEINE** Änderung am Titel-Feld

4. **Option B: Übernehmen**
   - Klick auf **„Übernehmen"** (primärer Button)
   - Modal schließt sich
   - Titel-Feld wird mit lektoriertem Text überschrieben

### Erwartetes Ergebnis

- Modal zeigt den Diff zwischen Original und lektoriertem Text
- Abbrechen behält den Original-Text
- Übernehmen überschreibt das Feld mit dem lektorierten Text
- Fokus-Management: Beim Öffnen des Modals erhält der primäre Button (Übernehmen) oder Modal-Titel den Fokus
- Fokus-Management: Beim Schließen kehrt der Fokus zum Lektorat-Button zurück

---

## Journey 2: Beschreibung lektorieren mit Diff-Modal

### Ziel

Beschreibungstext mit KI lektorieren und Änderungen in einem Modal mit Diff-Anzeige prüfen, bevor sie übernommen werden.

### Vorbedingung

- Nutzer ist angemeldet
- „Neuen Task anlegen"-Dialog ist geöffnet
- Beschreibungsfeld enthält Text

### Schritte

1. **Lektorat auslösen**
   - Klick auf **„Beschreibung lektorieren"**
   - API-Call wird ausgelöst (Lektorat-Backend)

2. **Diff-Modal erscheint**
   - Modal öffnet sich mit **Diff-Anzeige**
   - Original-Text wird links (oder oben) angezeigt
   - Lektorierter Text wird rechts (oder unten) angezeigt
   - Änderungen sind visuell hervorgehoben

3. **Option A: Abbrechen**
   - Klick auf **„Abbrechen"**
   - Modal schließt sich
   - **KEINE** Änderung am Beschreibungsfeld

4. **Option B: Übernehmen**
   - Klick auf **„Übernehmen"**
   - Modal schließt sich
   - Beschreibungsfeld wird mit lektoriertem Text überschrieben

### Erwartetes Ergebnis

- Modal zeigt den Diff zwischen Original und lektoriertem Text
- Abbrechen behält den Original-Text
- Übernehmen überschreibt das Feld mit dem lektorierten Text
- Fokus-Management gemäß UX-Pattern `docs/ux-pattern-sequential-confirmation.md`

---

## Randfälle & Fehler

| Situation                             | Erwartetes Verhalten                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Lektorat-API-Fehler (502, 503)        | Modal wird nicht geöffnet; stattdessen Fehlermeldung wie bisher (AK 4 aus Issue 680) |
| Leerer Original-Text                  | Lektorat-Button bleibt deaktiviert; Modal wird nicht geöffnet                        |
| Identischer Text (keine Änderungen)   | Diff-Modal zeigt keine Änderungen; Übernehmen aktiviert but hat keinen Effekt        |
| ESC-Taste im Modal                    | Modal schließt sich; verhält sich wie „Abbrechen" (keine Änderung)                   |
| Klick außerhalb des Modals (Backdrop) | Modal schließt sich; verhält sich wie „Abbrechen" (keine Änderung)                   |

---

## UX-Pattern-Referenz

Dieses Feature orientiert sich an **`docs/ux-pattern-sequential-confirmation.md`**:

- Sequenzielle Bestätigung: Prüfung vor Übernahme
- Striktes Fokus-Management beim Öffnen/Schließen des Modals
- Barrierefreiheit: Screenreader-Unterstützung für Diff-Anzeige

---

## Versionierung

- **v1.0** (2026-08-15): Initialefassung für Issue 687. Zwei Journeys (Titel/Beschreibung) mit Diff-Modal.
