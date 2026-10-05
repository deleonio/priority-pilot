# Spec #2212 — Journal (Tagebuch-Einträge)

Nutzerbezogene Ressource `JournalEntry` (userId, text, date `YYYY-MM-DD`, pillarId nullable). Alle Pakete unbegrenzt (ADR 0018).

## API (`server/src/express/routes/journal.ts`)

| Route                 | Vorbedingung                                 | Ergebnis                                                                                 |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /journal`       | Session, Text 1–3000                         | 201, Eintrag `{id, text, date, pillarId}`; ohne `date` = heute (UTC), ohne Säule `null`  |
| `POST /journal`       | leer/zu lang/Datum/Säule ungültig oder fremd | 400, nichts gespeichert                                                                  |
| `GET /journal`        | Session                                      | nur eigene Einträge, absteigend nach `date`                                              |
| `PATCH /journal/:id`  | eigener Eintrag                              | 200, geänderte Felder; gleiche Validierung wie POST; fremd/unbekannt → 404 ohne Änderung |
| `DELETE /journal/:id` | eigener Eintrag                              | 204; fremd/unbekannt → 404 ohne Änderung                                                 |
| alle                  | keine Session                                | 401                                                                                      |

Säule löschen setzt `pillarId` der Einträge auf `null` (kein Löschen der Einträge).

## UI (fünfter Haupt-Tab „Journal", KI-UX-Block)

1. Tab „Journal" öffnen → Formular „Neuer Eintrag" (Freitext, Datum heute, Säule optional) über der Liste „Einträge".
2. „Eintrag speichern" → Eintrag erscheint ohne Reload in der Liste, Formular leer.
3. „Eintrag vom <Datum> bearbeiten" → Inline-Formular, „Speichern" aktualisiert die Liste.
4. „Eintrag vom <Datum> löschen" → `ConfirmDeleteDialog` („Endgültig löschen") → Eintrag verschwindet.
5. 375 px: kein horizontaler Überlauf (Bounding-Box), Bedienelemente ≥ 44 px hoch.
