---
description: Prüft einen Pull Request im Kreuzverhör und postet Review-Kommentare mit Ampel
argument-hint: '[pr-nummer]'
allowed-tools: Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Bash(gh pr comment:*), Bash(gh pr review:*), Bash(gh issue view:*), Bash(gh api:*), Bash(git fetch:*), Bash(git diff:*), Read, Grep, Glob
---

Führe den PR-Kreuzverhör-Review aus der Wissensbasis aus: @.ai-knowledge/pr-review.md

Ziel-PR: $ARGUMENTS (leer = zuletzt geöffneter/aktualisierter offener PR bzw. der aktuell per
`subscribe_pr_activity` abonnierte PR).

Haltung: konstruktiv, aber **adversarial** wie im Kreuzverhör — Annahmen hinterfragen, jeden Punkt
mit konkretem Datei-/Zeilenbezug belegen.

1. **PR verstehen** — Titel, Beschreibung und **vollständigen Diff** lesen (`gh pr view`,
   `gh pr diff`); verknüpftes Ticket laden, um das Soll-Verhalten zu kennen.
2. **Kreuzverhör** — kritische Fragen: Löst der PR das Problem (ganz)? Edge Cases? Ist es der
   einfachste Weg? Performance- oder Security-Bedenken?
3. **Code-Qualität** — Benennung/Lesbarkeit, Testabdeckung, Projekt-Konventionen
   ([conventions.md](../../.ai-knowledge/conventions.md): Tabs, `strict`, ESM mit `.js`, keine
   Type-Assertions).
4. **Findings posten** — pro Punkt ein an Datei/Zeile **verankerter** Review-Kommentar mit: _Was_
   das Problem/die Frage ist, _warum_ es zählt, _konkreter Vorschlag_. Gebündelt als Review mit
   `event=COMMENT` (kein formales Approve/Request-Changes — der Merge bleibt beim Menschen).
5. **Urteil mit Ampel** — Abschluss-Kommentar (deutsch) mit **Ampel** 🟢/🟡/🔴 am Anfang und kurzer
   Finding-Liste. Ist der PR solide: knappe Bestätigung (🟢).

Review-Kommentare schreiben **öffentlich** auf GitHub — vor dem Posten bestätigen lassen.
Kein Produktivcode ändern oder committen — reiner Review.
