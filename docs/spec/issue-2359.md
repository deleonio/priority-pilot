# Spec #2359 — Aufgabe aus Serie/Vorlage anlegen

Vertrag: `POST /series/{id}/instances` (#2357, unverändert). Frontend-only.

## Aktion „Aufgabe anlegen“ (AK1, AK5)

- Vorbedingung: Tab „Serien & Vorlagen“, eigene Serie (`forUserId == null`).
- Aktive Serie (`active !== false`): Toolbar-Aktion „Aufgabe anlegen“ (erster Eintrag). Ruhende Serie: Aktion fehlt.
- Klick öffnet `SeriesInstanceDialog` (Titel „Aufgabe anlegen: <Serientitel>“) mit Titel, Priorität, Aufwand, Beschreibung der Serie vorbefüllt, Fälligkeit leer (optional).

## Bestätigen / Abbrechen (AK2, AK3, AK5)

- Bestätigen: `api.createSeriesInstance({ id, seriesInstanceInput })` genau einmal (auch bei Doppelklick). Body enthält nur geänderte Felder plus `deadline` (falls gesetzt), damit der Server unveränderte Übernahme nicht als „geändert“ wertet.
- Erfolg: `onCreated(task)`; `SeriesTab` schließt den Dialog, zeigt `KolAlert` „Aufgabe angelegt: <Titel>“, ruft `onTasksChanged`.
- Fehler (z. B. 409): Dialog bleibt offen, Fehlermeldung inline, `onCreated` nicht gerufen.
- Abbrechen: `onClose`, kein API-Aufruf.

## Badge (AK4)

- `seriesBadge(task, seriesById)`: Serie mit `autoCreate === false` → „Vorlage“ bzw. „Vorlage (geändert)“; sonst unverändert „Serie“/„Serie (geändert)“. Ohne `seriesById`-Eintrag Fallback „Serie“.

## Mobile (AK6)

- 375 px: Aktion ≥ 44 px, Dialog ohne horizontales Scrollen (E2E).
