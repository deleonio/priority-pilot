# Spec #2399 — Daten bei Rückkehr in den Vordergrund neu laden

Entscheidung F2 b aus #1957: nur Refetch beim Wechsel zurück in die App, kein Live-Push.

## Rückkehr in den Vordergrund

- **Vorbedingung:** App ist geladen; Änderungen kamen von einem anderen Gerät (per API).
- **Schritte:** `document.visibilityState` wechselt auf `visible` (`visibilitychange`).
- **Erwartet:**
  - `App.reload()` läuft erneut (Aufgaben + Serien); ein gemountetes `JournalTab` lädt `listJournalEntries` neu.
  - Neue Aufgabe erscheint ohne Seiten-Neuladen in der Liste.
  - `hidden` löst nichts aus; das Erstladen beim Mount zählt nicht als Refetch.

## Schnelle Wechsel

- Vor jedem Refetch wird der vorige Ladevorgang abgebrochen (`AbortSignal.aborted`), höchstens einer je Datenart bleibt aktiv.

## Laufende Eingaben

- `tasks` wird beim Refetch nicht auf `null` gesetzt; ein offenes Aufgabenformular behält seine Eingaben.
