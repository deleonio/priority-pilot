# Spec #2463 — Gesetzte Deadline wieder leeren können

## Ziel

Im Task-Modus des Aufgabenformulars gibt es am Deadline-Feld eine Bedienmöglichkeit zum Entfernen.
Nach Entfernen + Speichern ist die Aufgabe ohne Deadline (`deadline: null`), der Auto-Löschen-Schalter
ist aus und gesperrt (#534-Kopplung), und die Aufgabe taucht nicht mehr im Dashboard-Widget
„Anstehende Deadlines" auf.

## Voraussetzungen

- Fachlicher Leeren-Pfad existiert bereits: Save wandelt ein leeres Feld zu `deadline: null`
  (`TaskForm.tsx` Save), der Server akzeptiert `deadline: null` im Update und liefert `null` zurück.
  Es fehlt ausschließlich die Bedienmöglichkeit am Feld.
- #534-Kopplung bleibt unverändert: Der Effekt (`TaskForm.tsx` ~1267) setzt `autoDelete` bei leerer
  Deadline selbst auf `false` und sperrt den Schalter. Der Entfernen-Button setzt nur
  `form.current.deadline = ''` + `setDeadlineInput('')` — kein zweiter Reset-/Hinweis-Mechanismus.
- Serie-Modus bleibt unberührt (Startdatum statt Deadline).

## Verhalten (aus den AKs)

1. **AK1 — Entfernen-Schalter:** Im Task-Modus gibt es am Deadline-Feld einen Button mit zugänglichem
   Namen „Deadline entfernen" (i18n `taskForm.deadlineClear`, en: „Remove deadline"; sichtbares
   Text-Label, kein Icon-only — KI-UX). Er wird nur gerendert, solange eine Deadline gesetzt ist
   (ohne Datum kein toter Knopf). Ein Klick leert das Feld vollständig.
2. **AK2 — Persistenz:** Nach Entfernen + Speichern enthält der Update-Payload `deadline: null` und
   `autoDeleteAfterDeadline: false`; ein erneut geöffnetes Formular zeigt kein Datum, und die Aufgabe
   erscheint nicht im Dashboard-Widget „Anstehende Deadlines". API-GET liefert `deadline: null`.
3. **AK3 — Kopplung #534:** Ist der Auto-Löschen-Schalter aktiv, fällt er beim Entfernen der Deadline
   (über den Button-Pfad) auf `false` zurück und ist gesperrt.
4. **AK4 — Mobil (375 px):** Der Entfernen-Button ist per Tap ohne Tastatur bedienbar; die
   `deadline-group` bleibt innerhalb des Viewports (kein horizontales Clipping — Bounding-Box-Messung,
   nicht `scrollWidth`).

## Test-Mapping

| AK                                   | Test         | Datei                                            |
| ------------------------------------ | ------------ | ------------------------------------------------ |
| AK1 (+AK2/AK3 am Button-Pfad)        | TF1 (Vitest) | `frontend/src/components/TaskForm.test.tsx`      |
| AK1 (nur bei gesetzter Deadline)     | TF2 (Vitest) | `frontend/src/components/TaskForm.test.tsx`      |
| AK2 End-to-End (Reopen, API, Widget) | TF3 (e2e)    | `frontend/e2e/issue-2463-deadline-clear.spec.ts` |
| AK4 (375 px, Tap, Bounding-Box)      | TF4 (e2e)    | `frontend/e2e/issue-2463-deadline-clear.spec.ts` |

## Vertrag für die Umsetzung

- KolButton (kein rohes `<button>`), zugänglicher Name „Deadline entfernen" / „Remove deadline";
  Platzierung in der `deadline-group` nach dem Datumsfeld (Fokus-Reihenfolge: Datumsfeld → Button →
  Auto-Löschen-Schalter, KI-UX). Keine Signalfarbe (Sekundäraktion); kein neues CSS außer ggf.
  `--pp-space-*`-Abstand.
- Neue i18n-Keys in `frontend/src/i18n/locales/de/taskForm.json` und `en/taskForm.json`.
