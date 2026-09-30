# Spec #1890 — MCP-Werkzeug `feedback_send`

PO-Entscheidung O1: ab Plus, auch mit Nur-lese-Token; die Ausnahme vom Schreibverbot gilt nur für `POST /feedback`.

## Ziel

Ein MCP-Client sendet Feedback (Kategorie, Titel, Beschreibung); der Eintrag landet wie beim Formular im Feedback-Ablageort, Admins werden benachrichtigt.

## Regeln

1. `tools/list` führt `feedback_send` (Pflichtfelder `category`, `title`, `description`), ohne `write`-Markierung; Katalog: 33 Werkzeuge.
2. Gültiger Aufruf → Eintrag wie beim Formular (Kategorie, Titel, Text, absendende Person) + Admin-Mail 1×.
3. Frontmatter `quelle: mcp` (Formular bleibt `quelle: app-feedback`).
4. Ungültige Kategorie / leerer Titel / leerer Text → Tool-Fehler mit Feldname, kein Eintrag, keine Mail.
5. Nicht konfiguriert (503) → Tool-Fehler, keine Erfolgsmeldung.
6. Lese-Token: `POST /feedback` und `feedback_send` erlaubt; jede andere schreibende Route (`POST /tasks`) weiter 403. Plan-Prüfung `mcp_read` bleibt vorgeschaltet.

## Tests

`server/src/mcp/feedback-send.test.ts` (AK1–AK6); Katalog-Zähler in `tools.test.ts`, `mcp-handshake.test.ts`.
