# Spec #2414 — Serien-Vorlage: Felder ohne Wirkung ausblenden

Baut auf `issue-2358.md` auf. Gilt für TaskForm im Serien-Modus (Anlegen und `SeriesEditForm`).

## Schalter „Automatisch anlegen"

- Ziel: Eine Vorlage (Schalter aus) zeigt nur Felder mit Wirkung.
- Schalter aus: Rhythmus-Auswahl, Checkbox „Automatisch löschen nach 3 Tagen bei verpasster Deadline" und Startdatum sind nicht im Formular (AK1). Option „Ohne Rhythmus" ist nie mehr wählbar (AK2/AK3).
- Speichern bei aus: `autoCreate:false`, `rhythm:'none'`, `autoDeleteAfterDeadline:false`, kein `startDate` — auch wenn Auto-Löschen vorher an war (AK2). Update analog.
- Schalter an: Rhythmus und Checkbox sichtbar, Speichern wie bisher (AK3).
- aus → an im selben Dialog stellt vorher gewählten Rhythmus und Auto-Lösch-Wert wieder her (AK4).
- Gespeicherte Vorlage (`none`) → an: Rhythmus `weekly`, Startdatum sichtbar (AK5).
- Aufgaben-Modus unverändert: Checkbox sichtbar, ohne Deadline deaktiviert (AK6).
- Mobile 375 px: Ein-/Ausblenden ohne horizontalen Überlauf (AK7, E2E).
