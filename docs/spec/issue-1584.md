# Aufgabenformular: Rückfrage beim Schließen ohne Speichern

**Stand:** 2026-09-20

## Ziel

Das Aufgabenformular-Modal (`TaskFormModal`, neu und bearbeiten) verwirft Eingaben nicht mehr kommentarlos: Schließt der Nutzer über X, Escape oder Klick auf den Backdrop, obwohl mindestens ein Formularwert geändert wurde, erscheint eine Rückfrage mit „Weiter bearbeiten" und „Verwerfen". Ohne Änderung schließt das Modal weiterhin sofort.

## Dirty-Erkennung (AK7)

`isTaskFormDirty(initial: TaskFormSnapshot, current: TaskFormSnapshot): boolean` in `frontend/src/lib/task.ts` — eine reine Funktion, die einen Snapshot der Formularwerte beim Öffnen gegen den aktuellen Stand beim Schließzeitpunkt vergleicht (Titel, Priorität, Aufwand, Beschreibung, Adresse, Deadline, Kategorie, Modus, Säulen-Beiträge). Rückgabe `false`, wenn alle Felder inhaltlich gleich sind — auch wenn ein Feld getippt und wieder auf den Ausgangswert zurückgesetzt wurde (Vergleich nach Wert, nicht nach „wurde berührt"). Säulen-Beiträge werden reihenfolge-unabhängig verglichen (gleiches Muster wie `pillarsEqual` in `TaskForm.tsx`).

## Ablauf (AK1–AK6, AK8)

1. **Unverändert schließen:** Modal öffnen, ohne Eingabe per Escape (X, Backdrop-Klick) schließen → Modal verschwindet sofort, keine Rückfrage (AK1).
2. **Geändert schließen:** mindestens ein Feld geändert, dann Escape (X, Backdrop) → Rückfrage erscheint, das Aufgabenformular bleibt (unsichtbar, aber nicht entfernt) im Hintergrund bestehen (AK2).
3. **Weiter bearbeiten:** schließt nur die Rückfrage; das Formular ist weiterhin offen, der eingegebene Titel steht unverändert im Feld (AK3).
4. **Verwerfen:** schließt Formular und Rückfrage; es wird kein `POST`/`PATCH` gegen `/tasks` gesendet, die Aufgabenliste enthält den eingegebenen Titel nicht (AK4).
5. **Erfolgreich gespeichert:** Klick auf „Anlegen"/„Bearbeiten" schließt das Modal ohne Rückfrage, obwohl Werte geändert wurden — Speichern zählt nicht als Verwerfen (AK5).
6. **375px-Viewport:** die Rückfrage ist vollständig sichtbar und bedienbar, beide Buttons liegen innerhalb der Viewport-Breite (AK6).
7. **Unverändertes Verhalten:** `QuickCaptureModal` und die bestehenden Bestätigungs-Dialoge (`ConfirmDeleteDialog`) ändern ihr Schließverhalten nicht (AK8).

## Erwartetes Ergebnis

- Kein Datenverlust durch versehentliches Schließen (X/Escape/Backdrop) nach einer Änderung.
- Kein zusätzlicher Rückfrage-Schritt, wenn nichts geändert wurde oder erfolgreich gespeichert wurde.
- Der explizite „Abbrechen"-Button im Formular schließt weiterhin direkt ohne Rückfrage (bewusste Nutzerentscheidung, siehe Analyse-Block im Ticket — nicht Teil der Testfälle dieses Specs, da AK2 die Rückfrage ausdrücklich nur für X/Escape/Backdrop verlangt).

## Bausteine

Verschachtelter Dialog analog `ConfirmSeriesActionModal` (aus dem bereits offenen `TaskForm`-Modal gerendert); Button-Variant-Konvention und Initialfokus-Verhalten wie `ConfirmDeleteDialog` (sicherer Button zuerst, Initialfokus darauf).
