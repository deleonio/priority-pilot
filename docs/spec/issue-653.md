# Issue 653: Tab-Freiheit in Löschdialogen

**Stand:** 2026-08-27  
**Ziel:** Sicherstellen, dass Löschdialoge keine Fokus-Gefängnisse sind - Tab bewegt den Fokus weiter

---

## Ziel

Alle Löschdialoge (Tasks, Säulen, Serien) müssen gewährleisten, dass der Fokus nach Initialsetzung frei beweglich bleibt. Ein Tab-Tastendruck muss den Fokus weiterbewegen, nicht zurückhalten.

### Bezug zu UX-Pattern

Das UX-Pattern `docs/ux-pattern-sequential-confirmation.md` definiert striktes Fokus-Management als verbindliche Accessibility-Anforderung. Tab-Freiheit ist ein wesentlicher Bestandteil dieses Fokus-Vertrags.

---

## Vorbedingung

- Löschdialog ist geöffnet (Task, Säule oder Serie)
- Fokus liegt initial auf dem sicheren Button („Abbrechen" oder „Nein")
- Kein Fokus liegt auf dem destruktiven Button („Endgültig löschen" oder „Ja")

---

## Schritte

1. **Tab-Taste drücken**
   - Nutzer betätigt die Tab-Taste auf der Tastatur
   - System verarbeitet den Tab-Event

2. **Fokus prüfen**
   - System prüft, ob Fokus sich bewegt hat
   - Fokus muss auf einem anderen Element liegen (nicht mehr auf dem Initial-Button)

---

## Erwartetes Ergebnis

- Tab bewegt den Fokus weiter (kein Fokus-Gefängnis)
- Fokus liegt auf einem anderen Dialog-Button oder Element
- Ursprünglicher Button ist nicht mehr fokussiert
- Kein persistenter Fokus-Watchdog hält den Fokus fest
