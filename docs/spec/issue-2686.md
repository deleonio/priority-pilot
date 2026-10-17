# Fehler beim Laden freier Zeitfenster landen im Log — Balamentum

**Stand:** 2026-10-18  
**Ziel:** Fehler beim Laden freier Zeitfenster (#2686) sind im Server-Log sichtbar, ohne dass sich die API-Antwort ändert.

## Journey: Zeitfenster-Ladung schlägt fehl → Log hat die Ursache

### Ziel

Der Endpunkt `GET /tasks/free-slots` antwortet bei jedem Fehler weiterhin mit 200 und `[]` (bestehender Vertrag, das Dashboard bleibt leer), schreibt aber jetzt **genau eine** Logzeile mit der Fehlerursache.

### Vorbedingung

- Angemeldeter Nutzer mit mindestens einer Kalenderquelle (sonst verlässt der Guard den Ladepfad ohne catch)

### Schritte

1. Eine DB-Abfrage im Ladepfad wirft (z. B. `CalendarEvent.findAll`)
2. `GET /tasks/free-slots` wird aufgerufen

### Erwartetes Ergebnis

- Genau ein `console.error`-Aufruf; das Error-Objekt mit der Ursache ist als Argument dabei (Repo-Muster `console.error('…:', error)` wie `series.ts:387` / `feedback.ts:169`)
- Antwort: Status 200, Body `[]`

## Journey: Normalbetrieb bleibt still

### Ziel

Leer- und Erfolgsfälle erzeugen keine Logzeilen — der Fehlerpfad ist der einzige, der loggt.

### Erwartetes Ergebnis

- Kein `console.error`-Aufruf; Antwort unverändert (Leerfall ohne Kalenderquelle: 200, `[]`)

## Abgrenzung

- `GET/PUT /free-slot-config` bleibt unberührt: Fehler weiterhin sichtbarer 500 via `sendError` (AK3 — bestehende Tests bleiben grün, kein neuer Test nötig).
- Keine Änderung an sichtbaren Texten, Routen oder Verträgen → kein Test-Pflege-Bedarf außerhalb dieser Datei.
