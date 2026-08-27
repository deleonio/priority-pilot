# Documenter PR #1052 — docs(user-guide)-Sync

## Erledigt
- PR #1052 analysiert (diff + view: title, body, files, labels, author).
- `/tmp/doc.json` erstellt mit Struktur per SKILL.md:
  - `pr`: 1052
  - `title`: leer (title_compliant=true, type=docs passt)
  - `type`: docs, `scope`: null
  - `files`: docs/user-guide.md (einzige geänderte Datei)
  - `issues`: [] (kein Closes/Fixes im Body)
  - `summaries`: de/en mit Kerninhalt (Sync: 8 Funde aus Guide-Sync-Report, Suche hinzugefügt,
    Punkte-Logik korrigiert, Top-3-Push ergänzt)
  - `notes`: Bot-Commit Hinweis, Referenz auf Issue-Comments für Details
- JSON mit `jq .` verifiziert (gültig).

## Relevante Stellen
- `/tmp/doc.json`: Output-Datei für Changelog/Release-Notes.
- docs/user-guide.md: einzige Datei im Diff (26+/19−).
- PR-Body: Guide-Sync-Report mit 8 Funden (Suche fehlte, Punkte-Logik falsch, Push unvollständig,
  Tab-Name falsch, Offline-Karte, Sprachfelder, Empty-State, Kopf-Aktionen Anzahl).

## Annahmen
- title_compliant=true (aus Input) → title leer (Conventional Commits bereits erfüllt).
- type/scope = docs/k.A. (aus Input, PR-Titel "docs: ..." bestätigt docs).
- Keine Issues verlinkt (Body ohne Closes/Fixes).

## Verworfen
- Titel auf "docs: sync user guide with actual app state" gekürzt (title_compliant=true → leer,
  SKILL.md Regel: "title: empty if true=true and the type fits").

## Offen
-

## Nächster Schritt
-

## Fallstricke
- Smart-Quotes in JSON (', ") parsen nicht – durch straight quotes ersetzt.
- `jq .` am Ende essenziell (Syntax-Check, Exit-Code 5 bei Fehlern).
